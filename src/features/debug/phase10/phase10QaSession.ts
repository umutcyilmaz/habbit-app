import { createBloomProductFlowActions } from "../../../app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../../../app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../../../app/providers/bloomLocalStateMutationRuntime";
import { createDefaultBloomState } from "../../../storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, createBloomStatePersistenceCoordinator } from "../../../storage/bloomStatePersistence";
import type { StorageClient } from "../../../storage/storageAdapters";
import { createResetContinuityFixture } from "./resetContinuityFixture";

export const phase10Scenarios = [
  { id: "day10-inactive", label: "1 · Day 10 / Content-Free inactive", days: 9 },
  { id: "day10-credit", label: "2 · Day 10 / earned credit active", days: 9 },
  { id: "completed-pending", label: "3 · Completed / decision pending", days: 15 },
  { id: "continuation-accepted", label: "4 · Accepted / 15 earned days", days: 15 },
  { id: "continuation-declined", label: "5 · Declined / inactive", days: 15 },
  { id: "completed-existing", label: "6 · Completed / existing streak", days: 15 }
] as const;
export type Phase10ScenarioId = typeof phase10Scenarios[number]["id"];
export const PHASE10_STORAGE_PREFIX = "bloom.e2e.phase10.";
const clockKey = "clock";

// A supplied Home run must never fall back to previous QA or canonical storage.
export function getHomeQaStoragePrefix(run: string | undefined): string {
  if (run === undefined) return PHASE10_STORAGE_PREFIX;
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(run)) throw new Error("A new valid Home QA run is required");
  return `bloom.e2e.home.${run}.`;
}

// Namespace every operation, including migrations, corruption backups and
// deletion enumeration. Never read/copy canonical Bloom or existing E2E data.
export function createPhase10StorageClient(client: StorageClient, prefix = PHASE10_STORAGE_PREFIX): StorageClient {
  if (prefix !== PHASE10_STORAGE_PREFIX && !/^bloom\.e2e\.home\.[a-zA-Z0-9_-]{8,80}\.$/.test(prefix)) throw new Error("Invalid isolated QA prefix");
  return {
    getItem: (key) => client.getItem(prefix + key),
    setItem: (key, value) => client.setItem(prefix + key, value),
    removeItem: (key) => client.removeItem(prefix + key),
    getAllKeys: async () => (await client.getAllKeys()).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
  };
}

export function createPhase10QaSession(client: StorageClient, prefix = PHASE10_STORAGE_PREFIX) {
  const isolated = createPhase10StorageClient(client, prefix);
  const fixture = createResetContinuityFixture();
  let observationTime = fixture.now().toISOString();
  let delayNextWrite = false;
  let failNextWrite = false;
  let invalidateNextWrite = false;
  let preparing = false;
  const now = () => new Date(observationTime);
  const storage: StorageClient = {
    ...isolated,
    setItem: async (key, value) => {
      if (delayNextWrite) { delayNextWrite = false; await new Promise<void>(resolve => setTimeout(resolve, 20000)); }
      if (failNextWrite) { failNextWrite = false; return Promise.reject(new Error("QA injected storage failure")); }
      return isolated.setItem(key, value);
    }
  };
  const persistence = createBloomStatePersistenceCoordinator(storage, now);
  const runtime = { now, load: persistence.load, save: (state: Parameters<typeof persistence.enqueueWrite>[0]) => {
    if (invalidateNextWrite) {
      invalidateNextWrite = false;
      return Promise.resolve({ status: "invalidated" as const, writeId: 0, generation: 0 });
    }
    return persistence.enqueueWrite(state);
  }, deleteAll: persistence.deleteAll };
  return {
    runtime,
    async restoreClock() {
      const value = await isolated.getItem(clockKey);
      if (value !== null) {
        if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error("Invalid isolated QA clock");
        observationTime = value;
      }
    },
    async advanceClockByDays(days: number) {
      if (!Number.isInteger(days) || days < 1 || days > 30 || preparing) throw new Error("Invalid isolated clock advance");
      const next = new Date(Date.parse(observationTime) + days * 86400000).toISOString();
      await isolated.setItem(clockKey, next);
      observationTime = next;
    },
    delayNextSave() { delayNextWrite = true; },
    failNextSave() { failNextWrite = true; invalidateNextWrite = false; },
    invalidateNextSave() { invalidateNextWrite = true; failNextWrite = false; },
    async prepareScenario(id: Phase10ScenarioId, beforeCompletion = false) {
      if (preparing) throw new Error("QA setup already in progress");
      const scenario = phase10Scenarios.find((entry) => entry.id === id);
      if (!scenario) throw new Error("Unknown Phase 10 scenario");
      if (beforeCompletion && id !== "completed-pending") throw new Error("Completion preparation is only available for Scenario 3");
      preparing = true;
      delayNextWrite = false;
      failNextWrite = false;
      invalidateNextWrite = false;
      try {
        if (prefix !== PHASE10_STORAGE_PREFIX && await isolated.getItem(BLOOM_STATE_STORAGE_KEY) !== null) throw new Error("Use a new Home QA run; existing QA records cannot be replaced");
        const initial = createDefaultBloomState();
        const mutation = createBloomLocalStateMutationRuntime({ initialState: initial, persistState: persistence.enqueueWrite });
        mutation.completeHydration(mutation.beginHydration(), initial, { needsPersist: false, persistenceError: null });
        const actions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: mutation.applyAcknowledgedMutation });
        const flow = createBloomProductFlowActions({ productActions: actions, now });
        const confirm = async (pending: ReturnType<typeof flow.contentFree.activate>) => {
          const result = await pending;
          if (!result.ok) throw new Error("QA setup was not acknowledged by persistence");
        };
        observationTime = fixture.startedAt;
        if (id === "completed-existing") {
          observationTime = fixture.observeDays(-5);
          await confirm(flow.contentFree.activate());
        }
        // Reuse the established baseline fixture. All later activation,
        // completion and decisions go through production acknowledged actions.
        await confirm(mutation.applyAcknowledgedMutation((state) => ({ ...state, resetJourney: fixture.state.resetJourney })));
        observationTime = fixture.observeDays(scenario.days);
        await isolated.setItem(clockKey, observationTime);
        if (id === "day10-credit") await confirm(flow.contentFree.activate());
        if (scenario.days === 15 && !beforeCompletion) await confirm(flow.reset.completeElapsed());
        if (id === "continuation-accepted") await confirm(flow.reset.decideContentFreeContinuation("accepted"));
        if (id === "continuation-declined") await confirm(flow.reset.decideContentFreeContinuation("declined"));
        return mutation.getDurableState();
      } finally { preparing = false; }
    }
  };
}
export type Phase10QaSession = ReturnType<typeof createPhase10QaSession>;
