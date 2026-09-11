import { isDeepStrictEqual } from "node:util";

import type { ResetBaseline, ResetJourney } from "../src/domain/models";
import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { createDefaultBloomState, startResetFromBaselineState, type BloomLocalState } from "../src/storage/bloomState";
import {
  BLOOM_CORRUPT_BACKUP_PREFIX, BLOOM_LEGACY_STATE_STORAGE_KEYS, BLOOM_STATE_STORAGE_KEY,
  createBloomStatePersistenceCoordinator, loadBloomLocalState, persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState, withoutResetViolationUndoFields } from "./verify-bloom-product-persistence";

const startedAt = "2026-09-01T12:00:00.000Z";
const capturedAt = "2026-09-01T11:59:00.000Z";
const now = () => new Date("2026-09-30T12:00:00.000Z");
const historicalKeys = ["bloom.localState.v6", "bloom.localState.v5", "bloom.localState.v4", "bloom.localState.v3", "bloom.localState.v2", "bloom.localState.v1"] as const;
const v5Key = historicalKeys[1];
const daySeconds = 86400;
type StartInput = Parameters<typeof startResetFromBaselineState>[1];

export async function verifyBloomResetBaseline() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Elapsed Reset attempts must use canonical v7 persistence.");
  equal(BLOOM_LEGACY_STATE_STORAGE_KEYS, historicalKeys, "Migration must prefer v6 through v1 in descending order.");
  verifyBaselineStart();
  const rejectedStarts = verifyRejectedStarts();
  verifyElapsedProgress();
  await verifyNoAutomaticCompletion();
  await verifyV3ThroughV5Migration();
  await verifyMigrationDurability();
  const corruptCases = await verifyCorruptResetPreservation();
  await verifyDeletionAndFuturePreservation();
  console.log(`Bloom Reset baseline verification passed (${rejectedStarts} rejected starts; ${corruptCases} corrupt Reset cases; elapsed-time boundaries, unchanged histories, no automatic completion, and v3–v7 migration).`);
}

function verifyBaselineStart() {
  for (const historical of [false, true]) {
    for (const baseline of [createBaseline(), { ...createBaseline(), averageIntervalSeconds: 86400.5, averageErectionQuality: 6.5, explicitContentSessionRatio: 0.25 }, { ...createBaseline(), averageIntervalSeconds: 0, averageErectionQuality: 1, explicitContentSessionRatio: 0 }, { ...createBaseline(), averageErectionQuality: 10, explicitContentSessionRatio: 1 }]) {
      const state = createBaselinePendingState(historical);
      const sourceBytes = JSON.stringify(state);
      const input = { resetBaseline: baseline, resetAttemptId: "new-reset-attempt", startedAt };
      const active = startResetFromBaselineState(state, input);
      assert(active !== state && active.resetJourney.status === "active", "A valid baseline_pending journey must become active.");
      assert("id" in state.resetJourney && active.resetJourney.id === state.resetJourney.id, "Starting Reset must preserve the existing journey identity.");
      equal(active.resetJourney.currentAttempt, { id: "new-reset-attempt", status: "active", startedAt }, "Active attempts must persist only identity, status, and the supplied start time.");
      assert(active.resetJourney.startedAt === startedAt && active.resetJourney.currentAttempt.startedAt === startedAt, "The new journey and attempt must use the same explicit start time.");
      assert(!("completedDays" in active.resetJourney.currentAttempt), "Starting Reset must not persist an active day counter.");
      equal(active.resetJourney.baseline, baseline, "The supplied nonmedical baseline must be retained without deriving aggregates from historical sessions.");
      for (const field of ["averageIntervalSeconds", "averageErectionQuality", "explicitContentSessionRatio"] as const) {
        assert((field in active.resetJourney.baseline) === (field in baseline), "Unknown aggregate fields must remain absent, not zero-filled.");
      }
      equal(active.resetJourney.pastAttempts, state.resetJourney.pastAttempts, "Starting Reset must preserve historical completed and restarted attempts.");
      equal(active.resetJourney.violations, state.resetJourney.violations, "Starting Reset must retain historical violation facts.");
      assert(active.resetJourney.durationDays === 15 && active.resetJourney.bestCompletedDays === state.resetJourney.bestCompletedDays, "Starting Reset must retain the 15-day duration and historical best progress.");
      for (const key of Object.keys(state) as Array<keyof BloomLocalState>) {
        if (key !== "resetJourney") assert(active[key] === state[key], `Starting Reset must leave ${key} untouched by reference, including active Content-Free, onboarding acceptance, Tracking, and legacy state.`);
      }
      assert(!active.masturbationTracking.enabled && active.masturbationTracking.currentSession === null, "Starting Reset must not enable tracking or create a session.");
      assert(JSON.stringify(state) === sourceBytes, "Starting Reset must not mutate its source state.");
      equal(startResetFromBaselineState(state, input), active, "The transition must be deterministic with explicitly supplied inputs.");
      const validation = validateAndNormalizeBloomState(active);
      assert(validation.success, `Started Reset must be structurally valid, including retained earlier history: ${validation.success ? "" : validation.error}`);
      const activeBytes = JSON.stringify(active);
      for (const repeated of [input, { ...input, resetAttemptId: "replacement-attempt", resetBaseline: { ...baseline, id: "replacement-baseline" }, startedAt: "2026-10-01T12:00:00.000Z" }, null]) {
        assert(startResetFromBaselineState(active, repeated as StartInput) === active, "A repeated start must preserve the original baseline, start time, and attempt identity by returning the exact active state.");
      }
      baseline.selfReport.urgeIntensity = "high";
      baseline.id = "mutated-caller-baseline";
      assert(JSON.stringify(active) === activeBytes, "The saved baseline must own its nested values independently of later caller mutation.");
    }
  }
  const sameTime = createBaselinePendingState(false);
  assert(startResetFromBaselineState(sameTime, { resetBaseline: { ...createBaseline(), capturedAt: startedAt }, resetAttemptId: "equal-time-attempt", startedAt }) !== sameTime, "Baseline capture and Reset start may occur at the same timestamp.");
  const unrelated = createBaselinePendingState(true);
  unrelated.masturbationTracking = createPopulatedState().masturbationTracking;
  const started = startResetFromBaselineState(unrelated, validInput());
  assert(started !== unrelated && started.masturbationTracking === unrelated.masturbationTracking, "Baseline completion must not add unrelated tracking/session preconditions or implement session blocking in this phase.");
}

function verifyRejectedStarts() {
  let count = 0;
  const reject = (state: BloomLocalState, input: unknown, label: string) => {
    const original = JSON.stringify(state);
    assert(startResetFromBaselineState(state, input as StartInput) === state, `${label}: invalid starts must return the original state atomically.`);
    assert(JSON.stringify(state) === original, `${label}: invalid starts must not leave partial baseline or attempt facts.`);
    count++;
  };
  const pending = createBaselinePendingState(true);
  const active = startResetFromBaselineState(createBaselinePendingState(false), validInput());
  const completed = createPopulatedState().resetJourney;
  assert(completed.status === "completed", "Completed Reset fixture required.");
  const { assessment: _assessment, ...finished } = completed;
  for (const reset of [createDefaultBloomState().resetJourney, { status: "recommended", id: "recommendation-only", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } as const, active.resetJourney, { ...finished, status: "assessment_pending" } as const, completed]) {
    reject({ ...pending, resetJourney: reset as ResetJourney }, validInput(), `disallowed ${reset.status} source`);
  }
  for (const input of [null, [], "start", {}, { ...validInput(), resetAttemptId: undefined }, { ...validInput(), resetAttemptId: "" }, { ...validInput(), resetAttemptId: "   " }, { ...validInput(), resetAttemptId: 17 }, { ...validInput(), startedAt: "2026-02-30T12:00:00.000Z" }, { ...validInput(), startedAt: "2026-09-01" }, { ...validInput(), startedAt: "2026-09-01T12:00:00+00:00" }, { ...validInput(), startedAt: "2026-09-01T11:58:59.999Z" }]) {
    reject(pending, input, "missing, malformed, or inconsistent transition input");
  }
  for (const [label, path, value, remove] of invalidBaselineCases()) {
    const baseline: unknown = clone(createBaseline());
    replaceAtPath(baseline, path, value, remove === true);
    reject(pending, { ...validInput(), resetBaseline: baseline }, label);
  }
  for (const value of [null, [], "baseline"]) reject(pending, { ...validInput(), resetBaseline: value }, "baseline must be a complete valid object");
  reject(pending, { ...validInput(), resetAttemptId: "attempt-past" }, "attempt IDs must not reuse restarted history");
  reject(pending, { ...validInput(), resetAttemptId: "attempt-current" }, "attempt IDs must not reuse completed history");
  reject(pending, { ...validInput(), startedAt: "2026-02-10T12:00:00.000Z", resetBaseline: { ...createBaseline(), capturedAt: "2026-02-10T11:00:00.000Z" } }, "a new attempt must not overlap an earlier historical attempt");
  for (const [path, value] of [
    ["id", ""], ["durationDays", 14], ["bestCompletedDays", 0], ["baseline", createBaseline()],
    ["startedAt", startedAt], ["currentAttempt", { id: "already-started", status: "active", startedAt }],
    ["violations.0.attemptId", "unknown-attempt"]
  ] as const) {
    const malformed = clone(pending);
    replaceAtPath(malformed.resetJourney, path, value, false);
    reject(malformed, validInput(), `malformed baseline_pending source: ${path}`);
  }
  return count;
}

function verifyElapsedProgress() {
  const state = startResetFromBaselineState(createBaselinePendingState(false), validInput());
  assert(state.resetJourney.status === "active", "Active selector fixture required.");
  const original = JSON.stringify(state.resetJourney);
  const boundaries = [
    [0, 0, 1, false], [23 * 3600 + 59 * 60, 0, 1, false],
    [daySeconds, 1, 2, false], [14 * daySeconds, 14, 15, false],
    [15 * daySeconds, 15, 15, true], [22 * daySeconds, 15, 15, true], [-daySeconds, 0, 1, false]
  ] as const;
  for (const [elapsedSeconds, completedDays, currentDay, isPeriodComplete] of boundaries) {
    const time = new Date(Date.parse(startedAt) + elapsedSeconds * 1000).toISOString();
    equal(getResetProgress(state.resetJourney, time), {
      completedDays, currentDay, isPeriodComplete, remainingDays: 15 - completedDays,
      remainingSeconds: Math.max(0, 15 * daySeconds - Math.max(0, elapsedSeconds))
    }, `Elapsed Reset progress must be correct at ${elapsedSeconds} seconds, independently of app-open or calendar-day events.`);
  }
  const lastMillisecond = getResetProgress(state.resetJourney, "2026-09-02T11:59:59.999Z");
  assert(lastMillisecond !== null && lastMillisecond.completedDays === 0 && lastMillisecond.currentDay === 1, "A partial 24-hour period must not round up into a completed day.");
  const midnight = getResetProgress(state.resetJourney, "2026-09-02T00:00:00.000Z");
  assert(midnight?.completedDays === 0, "Crossing midnight must not count a day before 24 elapsed hours.");
  assert(JSON.stringify(state.resetJourney) === original && state.resetJourney.status === "active", "Progress selectors must neither mutate state nor persist assessment_pending at 15 days.");
  for (const invalid of ["", "2026-02-30T12:00:00.000Z", "2026-09-02", "2026-09-02T12:00:00+00:00", 17, null]) {
    assert(getResetProgress(state.resetJourney, invalid as string) === null, "Invalid explicit current time must not create progress facts.");
  }
  for (const reset of [createDefaultBloomState().resetJourney, createBaselinePendingState(false).resetJourney, { status: "recommended", id: "recommended", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } as const]) {
    assert(getResetProgress(reset as ResetJourney, startedAt) === null, "An unstarted Reset must not acquire elapsed progress.");
  }
  const completed = createPopulatedState().resetJourney;
  assert(completed.status === "completed", "Finished selector fixture required.");
  const { assessment: _assessment, ...finished } = completed;
  for (const reset of [completed, { ...finished, status: "assessment_pending" } as const]) {
    equal(getResetProgress(reset, startedAt), { completedDays: 15, currentDay: 15, isPeriodComplete: true, remainingDays: 0, remainingSeconds: 0 }, "Finished historical journeys remain fixed at 15 completed days.");
  }
  const restarted = createLegacyActiveState().resetJourney;
  assert(restarted.status === "active", "Restarted active fixture required.");
  const restartTime = new Date(Date.parse(restarted.currentAttempt.startedAt) + daySeconds * 1000).toISOString();
  assert(getResetProgress(restarted, restartTime)?.completedDays === 1, "Progress must derive from the current attempt start, not the older journey start or historical best.");
}

async function verifyNoAutomaticCompletion() {
  const active = startResetFromBaselineState(createBaselinePendingState(true), validInput());
  const original = JSON.stringify(active);
  const validation = validateAndNormalizeBloomState(active);
  assert(validation.success && validation.state.resetJourney.status === "active", "Validation must not convert elapsed active Reset into assessment_pending.");
  const client = new ResetTestStorage();
  await persistBloomLocalState(active, client, now);
  const raw = client.values.get(BLOOM_STATE_STORAGE_KEY);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current" && loaded.state.resetJourney.status === "active", "Loading long after 15 elapsed days must retain an active persisted lifecycle.");
  equal(loaded.state, active, "Save/load must preserve all Reset and unrelated facts without deriving persisted counters or completion.");
  const progress = getResetProgress(loaded.state.resetJourney, now().toISOString());
  assert(progress?.isPeriodComplete === true && progress.completedDays === 15, "An unchanged active persisted journey may truthfully report elapsed completion.");
  assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw && JSON.stringify(active) === original, "Validation, loading, and selection must not rewrite state on elapsed completion.");
  assert(!("completedDays" in loaded.state.resetJourney.currentAttempt), "Current v7 persistence must not recreate an active completed-day field.");
}

async function verifyV3ThroughV5Migration() {
  const active = createLegacyActiveState();
  for (const version of [3, 4, 5] as const) {
    const expected = expectedMigratedState(active, version);
    for (const counter of [0, 14]) {
      const stored = asHistoricalVersion(active, version, counter);
      const client = new ResetTestStorage();
      const key = `bloom.localState.v${version}`;
      client.values.set(key, envelope(version, stored));
      const loaded = await loadBloomLocalState(client, now);
      assert(loaded.status === "success" && loaded.source === "legacy" && !loaded.needsPersist, `v${version}: active historical state must migrate directly to durable v7.`);
      equal(loaded.state, expected, `v${version}: migration must preserve all established version-specific facts while removing only the old active counter.`);
      assert(loaded.state.resetJourney.status === "active", "Migration after many elapsed days must not auto-complete Reset.");
      assert(!("completedDays" in loaded.state.resetJourney.currentAttempt), "Migrated current attempts must not retain the stale active counter.");
      assert(loaded.state.resetJourney.startedAt === "2026-01-01T00:00:00.000Z" && loaded.state.resetJourney.currentAttempt.startedAt === "2026-02-03T10:10:00.000Z", "Migration must preserve original journey and restarted-attempt time semantics without rewriting times.");
      equal(loaded.state.resetJourney.pastAttempts, active.resetJourney.pastAttempts, "Restarted 0–14 counts and historical completed 15-day facts must remain unchanged.");
      assert(loaded.state.resetJourney.bestCompletedDays === 15, "Migration must preserve historical best progress rather than infer it from elapsed time.");
      const atStart = getResetProgress(loaded.state.resetJourney, loaded.state.resetJourney.currentAttempt.startedAt);
      assert(atStart?.completedDays === 0, "Neither stale active counters nor historical best progress may drive current elapsed progress.");
      assert(!client.values.has(key) && client.values.has(BLOOM_STATE_STORAGE_KEY), "Successful migration must retain durable v7 and clean its source.");
    }
  }
  for (const state of [createDefaultBloomState(), createBaselinePendingState(true), createPopulatedState()]) {
    const client = new ResetTestStorage();
    client.values.set(v5Key, envelope(5, asHistoricalVersion(state, 5)));
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success", "Valid v5 states without an active Reset must still migrate.");
    equal(loaded.state, state, "Non-active v5 migration must be structurally lossless without invented baseline or progress.");
  }
}

async function verifyMigrationDurability() {
  const expected = createLegacyActiveState();
  const raw = envelope(5, asHistoricalVersion(expected, 5, 14));
  const failedClient = new ResetTestStorage();
  failedClient.values.set(v5Key, raw);
  failedClient.failCurrentWrite = true;
  const failed = await loadBloomLocalState(failedClient, now);
  assert(failed.status === "success" && failed.source === "legacy" && failed.needsPersist && failed.persistenceError !== null, "Failed v7 migration must retain usable original state with an unacknowledged write.");
  equal(failed.state, expected, "Failed migration must not discard baseline, historical progress, or unrelated data.");
  assert(failedClient.values.get(v5Key) === raw && !failedClient.values.has(BLOOM_STATE_STORAGE_KEY) && !failedClient.operations.includes(`remove:${v5Key}`), "A failed v7 write must retain byte-exact v5 source and never attempt cleanup.");
  failedClient.failCurrentWrite = false;
  const retried = await loadBloomLocalState(failedClient, now);
  assert(retried.status === "success" && !retried.needsPersist && !failedClient.values.has(v5Key), "A later retry must durably migrate and clean the preserved v5 source.");
  const heldClient = new ResetTestStorage();
  heldClient.values.set(v5Key, raw);
  const held = heldClient.holdNextCurrentWrite();
  let settled = false;
  const loading = loadBloomLocalState(heldClient, now).then((result) => { settled = true; return result; });
  await held.started;
  assert(!settled && heldClient.values.get(v5Key) === raw && !heldClient.values.has(BLOOM_STATE_STORAGE_KEY), "Pending v7 persistence must retain v5 and leave migration unresolved.");
  assert(!heldClient.operations.includes(`remove:${v5Key}`), "Source cleanup must wait for durable v7.");
  held.release();
  await loading;
  assert(heldClient.operations.indexOf(`remove:${v5Key}`) > heldClient.operations.indexOf(`durable:${BLOOM_STATE_STORAGE_KEY}`), "Successful migration must remove its source strictly after durable v7 acknowledgement.");
  const cleanupClient = new ResetTestStorage();
  cleanupClient.values.set(v5Key, raw);
  cleanupClient.failRemovalKey = v5Key;
  const cleanup = await loadBloomLocalState(cleanupClient, now);
  assert(cleanup.status === "success" && !cleanup.needsPersist && cleanupClient.values.get(v5Key) === raw && cleanupClient.values.has(BLOOM_STATE_STORAGE_KEY), "Cleanup failure must retain durable v7 and the untouched old source.");
  const reloaded = await loadBloomLocalState(cleanupClient, now);
  assert(reloaded.status === "success" && reloaded.source === "current", "A leftover old key must not override durable v7.");
}

async function verifyCorruptResetPreservation() {
  const active = startResetFromBaselineState(createBaselinePendingState(true), validInput());
  const cases: Array<[string, string, unknown, boolean?]> = [
    ["missing journey identity", "id", undefined, true], ["blank journey identity", "id", " "],
    ["wrong duration", "durationDays", 14], ["missing start", "startedAt", undefined, true],
    ["start before baseline", "startedAt", "2026-09-01T11:58:00.000Z"], ["missing baseline", "baseline", undefined, true],
    ["missing attempt", "currentAttempt", undefined, true], ["nonobject attempt", "currentAttempt", []],
    ["missing attempt start", "currentAttempt.startedAt", undefined, true], ["invalid attempt timestamp", "currentAttempt.startedAt", "2026-02-30T12:00:00.000Z"],
    ["attempt before journey", "currentAttempt.startedAt", "2026-09-01T11:59:00.000Z"],
    ["wrong current attempt state", "currentAttempt.status", "restarted"], ["blank current attempt identity", "currentAttempt.id", ""],
    ["reused historical attempt identity", "currentAttempt.id", "attempt-past"],
    ["active counter zero must be absent", "currentAttempt.completedDays", 0], ["active counter 14 must be absent", "currentAttempt.completedDays", 14],
    ["active counter null must be absent", "currentAttempt.completedDays", null],
    ["future lifecycle completion", "completedAt", startedAt], ["future lifecycle assessment", "assessment", {}],
    ["historical restarted progress too high", "pastAttempts.0.completedDays", 15],
    ["historical completed progress not fifteen", "pastAttempts.1.completedDays", 14]
  ];
  for (const [label, path, value, remove] of invalidBaselineCases()) cases.push([label, `baseline.${path}`, value, remove === true]);
  let count = 0;
  for (const [label, path, value, remove] of cases) {
    const malformed = clone(active);
    replaceAtPath(malformed.resetJourney, path, value, remove === true);
    assert(!validateAndNormalizeBloomState(malformed).success, `${label}: malformed canonical Reset must fail validation.`);
    // Non-finite values cannot be represented in JSON; their direct validation
    // and mutation rejection are checked separately from persisted null values.
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    await assertCorruptPreserved(envelope(7, malformed), BLOOM_STATE_STORAGE_KEY, label);
    count++;
  }
  for (const version of [3, 4, 5] as const) {
    for (const counter of [undefined, -1, 15, 1.5, "2"]) {
      const source = asHistoricalVersion(createLegacyActiveState(), version, 0);
      replaceAtPath(source, "resetJourney.currentAttempt.completedDays", counter, counter === undefined);
      await assertCorruptPreserved(envelope(version, source), `bloom.localState.v${version}`, "Malformed historical counters must be rejected before dropping them during migration");
      count++;
    }
  }
  return count;
}

async function verifyDeletionAndFuturePreservation() {
  const client = new ResetTestStorage();
  for (const key of [BLOOM_STATE_STORAGE_KEY, ...historicalKeys, `${BLOOM_CORRUPT_BACKUP_PREFIX}old`, `${BLOOM_CORRUPT_BACKUP_PREFIX}current`]) client.values.set(key, "remove");
  client.values.set("unrelated", "retain");
  await createBloomStatePersistenceCoordinator(client, now).deleteAll();
  equal([...client.values.entries()], [["unrelated", "retain"]], "Delete-all must remove every v1–v7 key and Bloom corrupt backup without touching unrelated storage.");
  assert(client.operations[client.operations.length - 1] === `remove:${BLOOM_STATE_STORAGE_KEY}`, "Current-key-last deletion lifecycle ordering must remain intact.");
  for (const key of [BLOOM_STATE_STORAGE_KEY, ...historicalKeys]) {
    const futureClient = new ResetTestStorage();
    const raw = envelope(99, { resetJourney: "future user-owned fact" });
    futureClient.values.set(key, raw);
    const future = await loadBloomLocalState(futureClient, now);
    assert(future.status === "unsupported-version" && future.version === 99 && future.sourceKey === key, "Future versions must remain unsupported at any known key.");
    assert(futureClient.values.get(key) === raw, "Future source bytes must remain untouched.");
    assertBackup(futureClient, future.backupKey, raw, key);
  }
}

function createBaseline(): ResetBaseline {
  return { id: "new-reset-baseline", capturedAt, selfReport: { urgeIntensity: "notSure", abilityToPause: "preferNotToSay", spontaneousOrMorningErections: "notSure" } };
}

function validInput(): StartInput { return { resetBaseline: createBaseline(), resetAttemptId: "new-reset-attempt", startedAt }; }

function createBaselinePendingState(historical: boolean): BloomLocalState {
  const state = historical ? createPopulatedState() : createDefaultBloomState();
  const previous = state.resetJourney;
  state.resetJourney = {
    status: "baseline_pending", id: "pending-reset-journey", durationDays: 15,
    bestCompletedDays: previous.bestCompletedDays,
    pastAttempts: previous.status === "completed" ? [...previous.pastAttempts, previous.currentAttempt] : previous.pastAttempts,
    violations: previous.violations
  };
  state.masturbationTracking = { ...state.masturbationTracking, enabled: false, currentSession: null };
  state.productOnboarding = acceptedOnboarding();
  return state;
}

function acceptedOnboarding(): Extract<BloomLocalState["productOnboarding"], { status: "completed" }> {
  const result = scoreBloomOnboarding({
    explicitContentFrequency: "dailyOrMore", unplannedContentUse: "almostAlways", activityInterruption: "often",
    contentTriggeredMasturbation: "almostAlways", repeatedContentReturn: "often", difficultyReducingContent: "often",
    erectionQuality: 2, erectionMaintenanceDifficulty: "almostAlways", masturbationTechniques: ["veryTightPressure"],
    techniqueDependency: "almostAlways", delayedOrDifficultEjaculation: "often", safetySignals: ["none"]
  }, "2025-12-01T10:00:00.000Z");
  return { status: "completed", result, planAcceptance: { acceptedAt: "2025-12-01T10:01:00.000Z", recommendation: result.recommendation } };
}

function createLegacyActiveState(): BloomLocalState {
  const state = createPopulatedState();
  const previous = state.resetJourney;
  assert(previous.status === "completed", "Historical Reset fixture required.");
  state.productOnboarding = acceptedOnboarding();
  state.resetJourney = {
    status: "active", id: previous.id, durationDays: 15, bestCompletedDays: 15,
    startedAt: "2026-01-01T00:00:00.000Z",
    baseline: { ...previous.baseline, capturedAt: "2025-12-31T10:00:00.000Z" },
    currentAttempt: { id: "attempt-current", status: "active", startedAt: "2026-02-03T10:10:00.000Z" },
    pastAttempts: [{ id: "older-completed-attempt", status: "completed", startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-16T00:00:00.000Z", completedDays: 15 }, ...previous.pastAttempts],
    violations: previous.violations
  };
  return state;
}

function expectedMigratedState(state: BloomLocalState, version: 3 | 4 | 5): BloomLocalState {
  if (version === 3) return { ...state, productOnboarding: { status: "notCompleted", result: null } };
  if (version === 4 && state.productOnboarding.status === "completed") return { ...state, productOnboarding: { ...state.productOnboarding, planAcceptance: null } };
  return state;
}

function asHistoricalVersion(state: BloomLocalState, version: 3 | 4 | 5, activeCounter = 0): Record<string, unknown> {
  const result = clone(state) as unknown as Record<string, unknown>;
  if (state.resetJourney.status === "active") replaceAtPath(result, "resetJourney.currentAttempt.completedDays", activeCounter, false);
  if (version === 3) delete result.productOnboarding;
  else if (version === 4 && state.productOnboarding.status === "completed") replaceAtPath(result, "productOnboarding.planAcceptance", undefined, true);
  return result;
}

function invalidBaselineCases(): Array<[string, string, unknown, boolean?]> {
  const cases: Array<[string, string, unknown, boolean?]> = [
    ["missing baseline id", "id", undefined, true], ["blank baseline id", "id", " "], ["nonstr baseline id", "id", 17],
    ["missing capturedAt", "capturedAt", undefined, true], ["invalid capturedAt", "capturedAt", "2026-02-30T12:00:00.000Z"],
    ["noncanonical capturedAt", "capturedAt", "2026-09-01T11:59:00+00:00"],
    ["missing self report", "selfReport", undefined, true], ["null self report", "selfReport", null], ["array self report", "selfReport", []]
  ];
  for (const [field, values] of [
    ["averageIntervalSeconds", [-1, NaN, Infinity, "0", null]],
    ["averageErectionQuality", [0, 10.1, NaN, Infinity, "5", null]],
    ["explicitContentSessionRatio", [-0.1, 1.1, NaN, Infinity, "0.5", null]]
  ] as const) for (const value of values) cases.push([`invalid ${field}: ${value}`, field, value]);
  for (const field of ["urgeIntensity", "abilityToPause", "spontaneousOrMorningErections"]) {
    cases.push([`missing ${field}`, `selfReport.${field}`, undefined, true]);
    cases.push([`unknown ${field}`, `selfReport.${field}`, "medicalInterpretation"]);
  }
  return cases;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function envelope(version: number, state: unknown) { return JSON.stringify({ version, savedAt: now().toISOString(), state: version >= 3 && version <= 6 ? withoutResetViolationUndoFields(state) : state }); }

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const keys = path.split(".");
  const final = keys.pop();
  assert(final !== undefined, "Fixture mutation requires a final field.");
  let parent = root as Record<string, unknown>;
  for (const key of keys) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[final];
  else parent[final] = value;
}

async function assertCorruptPreserved(raw: string, key: string, label: string) {
  const client = new ResetTestStorage();
  client.values.set(key, raw);
  const result = await loadBloomLocalState(client, now);
  assert(result.status === "corrupt" && result.sourceKey === key, `${label}: malformed Reset must use established corruption handling.`);
  assert(client.values.get(key) === raw, `${label}: malformed source bytes must remain untouched.`);
  assertBackup(client, result.backupKey, raw, key);
}

function assertBackup(client: ResetTestStorage, key: string | null, raw: string, sourceKey: string) {
  assert(key !== null && key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt/future data must receive a scoped backup.");
  const backup = client.values.get(key);
  assert(backup !== undefined, "Backup must become durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === sourceKey, "Backups must preserve exact source bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class ResetTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  failCurrentWrite = false;
  failRemovalKey: string | null = null;
  private heldWrite: { started: () => void; wait: Promise<void> } | null = null;

  holdNextCurrentWrite() {
    let started!: () => void;
    let release!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    const wait = new Promise<void>((resolve) => { release = resolve; });
    this.heldWrite = { started, wait };
    return { started: began, release };
  }

  async getItem(key: string) { return this.values.get(key) ?? null; }

  async setItem(key: string, value: string) {
    this.operations.push(`write:${key}`);
    if (key === BLOOM_STATE_STORAGE_KEY) {
      const held = this.heldWrite;
      this.heldWrite = null;
      if (held !== null) { held.started(); await held.wait; }
      if (this.failCurrentWrite) throw new Error("Synthetic v7 migration write failure.");
    }
    this.values.set(key, value);
    this.operations.push(`durable:${key}`);
  }

  async removeItem(key: string) {
    this.operations.push(`remove:${key}`);
    if (key === this.failRemovalKey) throw new Error("Synthetic old-key cleanup failure.");
    this.values.delete(key);
  }

  async getAllKeys() { return [...this.values.keys()]; }
}
