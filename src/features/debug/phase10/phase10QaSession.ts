import { createBloomProductFlowActions } from "../../../app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../../../app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../../../app/providers/bloomLocalStateMutationRuntime";
import { createDefaultBloomState } from "../../../storage/bloomState";
import { createBloomStatePersistenceCoordinator } from "../../../storage/bloomStatePersistence";
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

// Namespace every operation, including migrations, corruption backups and
// deletion enumeration. Never read/copy canonical Bloom or existing E2E data.
export function createPhase10StorageClient(client: StorageClient): StorageClient {
  return {
    getItem: (key) => client.getItem(PHASE10_STORAGE_PREFIX + key),
    setItem: (key, value) => client.setItem(PHASE10_STORAGE_PREFIX + key, value),
    removeItem: (key) => client.removeItem(PHASE10_STORAGE_PREFIX + key),
    getAllKeys: async () => (await client.getAllKeys()).filter((key) => key.startsWith(PHASE10_STORAGE_PREFIX)).map((key) => key.slice(PHASE10_STORAGE_PREFIX.length))
  };
}

export function createPhase10QaSession(client: StorageClient) {
  const isolated = createPhase10StorageClient(client);
  const fixture = createResetContinuityFixture();
  let observationTime = fixture.now().toISOString();
  let failNextWrite = false;
  let preparing = false;
  const now = () => new Date(observationTime);
  const storage: StorageClient = {
    ...isolated,
    setItem: (key, value) => {
      if (failNextWrite) { failNextWrite = false; return Promise.reject(new Error("QA injected storage failure")); }
      return isolated.setItem(key, value);
    }
  };
  const persistence = createBloomStatePersistenceCoordinator(storage, now);
  const runtime = { now, load: persistence.load, save: persistence.enqueueWrite, deleteAll: persistence.deleteAll };
  return {
    runtime,
    async restoreClock() {
      const value = await isolated.getItem(clockKey);
      if (value !== null) {
        if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error("Invalid isolated QA clock");
        observationTime = value;
      }
    },
    failNextSave() { failNextWrite = true; },
    async prepareScenario(id: Phase10ScenarioId, beforeCompletion = false) {
      if (preparing) throw new Error("QA setup already in progress");
      const scenario = phase10Scenarios.find((entry) => entry.id === id);
      if (!scenario) throw new Error("Unknown Phase 10 scenario");
      if (beforeCompletion && id !== "completed-pending") throw new Error("Completion preparation is only available for Scenario 3");
      preparing = true;
      failNextWrite = false;
      try {
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
