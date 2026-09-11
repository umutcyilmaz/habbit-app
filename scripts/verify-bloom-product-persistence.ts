import { isDeepStrictEqual } from "node:util";

import type {
  ContentFreeState,
  MasturbationSession,
  ResetJourney,
  UrgeControlEvent
} from "../src/domain/models";
import {
  activePlanFromQuizResult,
  createDefaultBloomState,
  type BloomLocalState,
  type QuizResult
} from "../src/storage/bloomState";
import {
  BLOOM_CORRUPT_BACKUP_PREFIX,
  BLOOM_LEGACY_STATE_STORAGE_KEYS,
  BLOOM_STATE_STORAGE_KEY,
  createBloomStatePersistenceCoordinator,
  loadBloomLocalState,
  persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import {
  BLOOM_PERSISTENCE_VERSION,
  readPersistedEnvelope,
  validateAndNormalizeBloomState
} from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";

const now = () => new Date("2026-07-22T10:00:00.000Z");
const v4Key = "bloom.localState.v4";
const v3Key = "bloom.localState.v3";
const v2Key = "bloom.localState.v2";
const v1Key = "bloom.localState.v1";
const productKeys = ["masturbationTracking", "contentFree", "resetJourney", "urgeControl"] as const;
const legacyKeys = ["activePlan", "onboarding", "tenDayReset", "debug", "protection", "checkIns", "pause", "arousalControl"] as const;

export async function verifyBloomProductPersistence() {
  verifyTruthfulDefaults();
  await verifyPopulatedV5RoundTrips();
  await verifyV2Migration();
  await verifyMigrationWriteFailureAndRetry();
  await verifyMigrationDurabilityBeforeCleanup();
  await verifyStoragePrecedenceAndRawCompatibility();
  await verifyAllVersionDeletion();
  await verifyFutureAndMalformedEnvelopePreservation();
  await verifyMalformedProductRecords();
}

function verifyTruthfulDefaults() {
  assert(BLOOM_PERSISTENCE_VERSION === 5, "The current envelope must be version 5.");
  assert(BLOOM_STATE_STORAGE_KEY === "bloom.localState.v5", "Current writes must use the v5 key.");
  equal(BLOOM_LEGACY_STATE_STORAGE_KEYS, [v4Key, v3Key, v2Key, v1Key], "Migration sources must prefer v4, then v3, then v2, then v1.");
  const first = createDefaultBloomState();
  const second = createDefaultBloomState();
  assertSafeProductDefaults(first, "fresh state");
  equal(first, second, "Repeated defaults must be stable, without random inactive journey identities.");
  first.masturbationTracking.enabled = true;
  first.contentFree.bestStreakSeconds = 100;
  first.urgeControl.records.push(completedUrgeEvent());
  assertSafeProductDefaults(second, "an independently created default state");
}

async function verifyPopulatedV5RoundTrips() {
  const states = createValidLifecycleStates();
  for (const [label, state] of states) {
    const validation = validateAndNormalizeBloomState(state);
    assert(validation.success, `${label}: valid product records must validate: ${validation.success ? "" : validation.error}`);
    equal(validation.state, state, `${label}: validation must preserve all valid legacy and new facts.`);
    // The existing canonical comparison includes object-key order. Check facts
    // above, then persist the canonical shape and require a stable reload.
    const canonicalState = validation.state;
    const canonicalValidation = validateAndNormalizeBloomState(canonicalState);
    assert(canonicalValidation.success && !canonicalValidation.wasNormalized, `${label}: canonical v5 validation must be stable.`);
    const client = new ProductTestStorage();
    await persistBloomLocalState(canonicalState, client, now);
    const payload = client.values.get(BLOOM_STATE_STORAGE_KEY);
    assert(payload !== undefined, `${label}: a v5 envelope must become durable.`);
    const parsed = JSON.parse(payload) as { version: unknown; state: unknown };
    assert(parsed.version === 5, `${label}: saved envelopes must explicitly declare v5.`);
    equal(parsed.state, state, `${label}: saving must preserve the expanded snapshot.`);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "current" && !loaded.needsPersist, `${label}: durable v5 must reload without migration.`);
    equal(loaded.state, state, `${label}: save/load must preserve every lifecycle field.`);
  }
}

async function verifyV2Migration() {
  const populated = createPopulatedState();
  const legacy = pickLegacy(populated);
  const variants: Array<[string, unknown]> = [
    ["canonical legacy-only v2", legacy],
    ["v2 carrying plausible new facts", populated],
    ["v2 carrying malformed new facts", {
      ...legacy, masturbationTracking: "do not import", contentFree: { status: "active" },
      resetJourney: { status: "completed" }, urgeControl: { records: [{ id: "invented" }] }
    }]
  ];
  for (const [label, storedState] of variants) {
    const client = new ProductTestStorage();
    const raw = envelope(2, storedState);
    client.values.set(v2Key, raw);
    assert(readPersistedEnvelope(JSON.parse(raw)).status === "legacy", "A valid v2 envelope is a migration source, not a future version.");
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "legacy" && !loaded.needsPersist && loaded.persistenceError === null, `${label}: migration must acknowledge durable v5.`);
    equal(pickLegacy(loaded.state), legacy, `${label}: all eight populated canonical legacy slices must survive unchanged.`);
    assertSafeProductDefaults(loaded.state, label);
    assert(!client.values.has(v2Key), `${label}: v2 is removed after successful migration.`);
    const durable = client.values.get(BLOOM_STATE_STORAGE_KEY);
    assert(durable !== undefined, `${label}: migrated v5 must remain durable.`);
    equal(JSON.parse(durable), { version: 5, savedAt: now().toISOString(), state: loaded.state }, `${label}: durable migration envelope must match the returned state.`);
    const second = await loadBloomLocalState(client, now);
    assert(second.status === "success" && second.source === "current" && !second.needsPersist, `${label}: reload must not repeat migration.`);
    equal(second.state, loaded.state, `${label}: migration must preserve its canonical result on reload.`);
  }
}

async function verifyMigrationWriteFailureAndRetry() {
  const client = new ProductTestStorage();
  const legacy = pickLegacy(createPopulatedState());
  const raw = envelope(2, legacy);
  client.values.set(v2Key, raw);
  client.failCurrentWrite = true;
  const failed = await loadBloomLocalState(client, now);
  assert(failed.status === "success" && failed.source === "legacy" && failed.needsPersist && failed.persistenceError !== null, "Failed v2 migration must report usable legacy state with an unacknowledged write.");
  equal(pickLegacy(failed.state), legacy, "Migration write failure must not discard populated legacy data.");
  assertSafeProductDefaults(failed.state, "failed v2 migration");
  assert(client.values.get(v2Key) === raw && !client.values.has(BLOOM_STATE_STORAGE_KEY), "Failed v5 write must leave original v2 byte-for-byte and no fake durable v5.");
  assert(!client.operations.includes(`remove:${v2Key}`), "A failed v5 write must not even attempt v2 cleanup.");
  client.failCurrentWrite = false;
  const retried = await loadBloomLocalState(client, now);
  assert(retried.status === "success" && !retried.needsPersist && !client.values.has(v2Key), "Retrying migration must eventually save v5 and clean v2.");
  equal(pickLegacy(retried.state), legacy, "Migration retry must preserve the same legacy facts.");
}

async function verifyMigrationDurabilityBeforeCleanup() {
  const client = new ProductTestStorage();
  const raw = envelope(2, pickLegacy(createPopulatedState()));
  client.values.set(v2Key, raw);
  const gate = client.holdNextCurrentWrite();
  let settled = false;
  const loading = loadBloomLocalState(client, now).then((result) => { settled = true; return result; });
  await gate.started;
  assert(!settled && client.values.get(v2Key) === raw && !client.values.has(BLOOM_STATE_STORAGE_KEY), "While the v5 write is unresolved, migration must keep v2 and withhold success.");
  assert(!client.operations.includes(`remove:${v2Key}`), "Legacy cleanup cannot start before the v5 write settles.");
  gate.release();
  const loaded = await loading;
  assert(loaded.status === "success" && !loaded.needsPersist, "Migration should acknowledge after the held write completes.");
  const durableIndex = client.operations.indexOf(`durable:${BLOOM_STATE_STORAGE_KEY}`);
  const removalIndex = client.operations.indexOf(`remove:${v2Key}`);
  assert(durableIndex >= 0 && removalIndex > durableIndex, "v2 cleanup must be ordered strictly after durable v5.");

  const cleanupFailure = new ProductTestStorage();
  cleanupFailure.values.set(v2Key, raw);
  cleanupFailure.failRemovalKey = v2Key;
  const retained = await loadBloomLocalState(cleanupFailure, now);
  assert(retained.status === "success" && !retained.needsPersist && cleanupFailure.values.get(v2Key) === raw && cleanupFailure.values.has(BLOOM_STATE_STORAGE_KEY), "Cleanup failure must retain both durable v5 and its original v2 fallback.");
  const reloaded = await loadBloomLocalState(cleanupFailure, now);
  assert(reloaded.status === "success" && reloaded.source === "current", "A leftover v2 key must not override durable v5 after cleanup failure.");
}

async function verifyStoragePrecedenceAndRawCompatibility() {
  const legacy = pickLegacy(createPopulatedState());
  const current = createPopulatedState();
  current.debug.dateOffsetDays = 30;
  const v4 = { ...createPopulatedState(), debug: { dateOffsetDays: 27 } };
  const v3 = { ...createPopulatedState(), debug: { dateOffsetDays: 25 } };
  const v2 = { ...legacy, debug: { dateOffsetDays: 20 } };
  const v1 = { ...legacy, debug: { dateOffsetDays: 10 } };
  const client = new ProductTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, envelope(5, current));
  client.values.set(v4Key, envelope(4, v4));
  client.values.set(v3Key, envelope(3, v3));
  client.values.set(v2Key, envelope(2, v2));
  client.values.set(v1Key, JSON.stringify(v1));
  const first = await loadBloomLocalState(client, now);
  assert(first.status === "success" && first.state.debug.dateOffsetDays === 30 && first.source === "current", "v5 must take precedence over v4, v3, v2 and v1.");
  equal(first.state, current, "v5 precedence must preserve populated new facts.");
  equal(client.readKeys, [BLOOM_STATE_STORAGE_KEY], "A present v5 payload must prevent fallback reads.");

  const phase1d = new ProductTestStorage();
  phase1d.values.set(v4Key, envelope(4, v4));
  phase1d.values.set(v3Key, envelope(3, v3));
  phase1d.values.set(v2Key, envelope(2, v2));
  const migratedV4 = await loadBloomLocalState(phase1d, now);
  assert(migratedV4.status === "success" && migratedV4.source === "legacy", "A v4 envelope must migrate ahead of v3 and older versions.");
  equal(migratedV4.state, v4, "v4 precedence must preserve all populated facts and empty product onboarding.");
  assert(!phase1d.readKeys.includes(v3Key) && !phase1d.readKeys.includes(v2Key), "v4 migration must not read or merge older versions.");

  const phase1b = new ProductTestStorage();
  phase1b.values.set(v3Key, envelope(3, v3));
  phase1b.values.set(v2Key, envelope(2, v2));
  phase1b.values.set(v1Key, JSON.stringify(v1));
  const migratedV3 = await loadBloomLocalState(phase1b, now);
  assert(migratedV3.status === "success" && migratedV3.source === "legacy", "A v3 envelope must migrate ahead of v2 and v1.");
  equal(migratedV3.state, v3, "v3 precedence must preserve all existing populated facts.");
  assert(!phase1b.readKeys.includes(v2Key) && !phase1b.readKeys.includes(v1Key), "v3 migration must not read or merge older versions.");

  const previous = new ProductTestStorage();
  previous.values.set(v2Key, envelope(2, v2));
  previous.values.set(v1Key, JSON.stringify(v1));
  const migrated = await loadBloomLocalState(previous, now);
  assert(migrated.status === "success" && migrated.state.debug.dateOffsetDays === 20, "v2 must take precedence over older raw v1.");
  assert(!previous.readKeys.includes(v1Key), "Migration must not merge older v1 facts into valid v2.");

  for (const key of [BLOOM_STATE_STORAGE_KEY, v4Key, v3Key, v2Key, v1Key]) {
    const rawClient = new ProductTestStorage();
    rawClient.values.set(key, JSON.stringify(createPopulatedState()));
    const rawLoaded = await loadBloomLocalState(rawClient, now);
    assert(rawLoaded.status === "success" && rawLoaded.source === "legacy", `Raw legacy payload at ${key} must remain supported.`);
    equal(pickLegacy(rawLoaded.state), legacy, `Raw payload at ${key} must preserve old facts.`);
    assertSafeProductDefaults(rawLoaded.state, `raw payload at ${key}`);
  }

  const relocated = new ProductTestStorage();
  relocated.values.set(v2Key, envelope(5, current));
  const relocation = await loadBloomLocalState(relocated, now);
  assert(relocation.status === "success" && relocation.source === "legacy", "A current envelope in an old key should relocate safely.");
  equal(relocation.state, current, "Envelope version, not key name, must preserve valid v5 facts during relocation.");
}

async function verifyAllVersionDeletion() {
  const client = new ProductTestStorage();
  const removedKeys = [BLOOM_STATE_STORAGE_KEY, v4Key, v3Key, v2Key, v1Key, `${BLOOM_CORRUPT_BACKUP_PREFIX}v2`, `${BLOOM_CORRUPT_BACKUP_PREFIX}v3`, `${BLOOM_CORRUPT_BACKUP_PREFIX}v4`, `${BLOOM_CORRUPT_BACKUP_PREFIX}v5`];
  for (const key of removedKeys) client.values.set(key, "preserved until deletion");
  client.values.set("another-app", "keep");
  await createBloomStatePersistenceCoordinator(client, now).deleteAll();
  equal([...client.values.entries()], [["another-app", "keep"]], "Delete-all must remove v1/v2/v3/v4/v5 and every Bloom backup while preserving unrelated keys.");
  assert(client.operations[client.operations.length - 1] === `remove:${BLOOM_STATE_STORAGE_KEY}`, "Current v5 must be deleted last, preserving existing failure recovery ordering.");
}

async function verifyFutureAndMalformedEnvelopePreservation() {
  for (const key of [BLOOM_STATE_STORAGE_KEY, v4Key, v3Key, v2Key, v1Key]) {
    const client = new ProductTestStorage();
    const raw = envelope(99, { privateFact: "future schema must survive" });
    client.values.set(key, raw);
    if (key !== v1Key) client.values.set(v1Key, JSON.stringify(pickLegacy(createPopulatedState())));
    const result = await loadBloomLocalState(client, now);
    assert(result.status === "unsupported-version" && result.version === 99 && result.sourceKey === key, `Future envelope at ${key} must remain unsupported without fallback.`);
    assert(client.values.get(key) === raw, "Future bytes must remain untouched at their original key.");
    assertBackup(client, result.backupKey, raw, key);
  }
  for (const version of [2, 3, 4, 5]) {
    const client = new ProductTestStorage();
    const key = version === 2 ? v2Key : version === 3 ? v3Key : version === 4 ? v4Key : BLOOM_STATE_STORAGE_KEY;
    const raw = JSON.stringify({ version, savedAt: "2026-02-30T10:00:00.000Z", state: createPopulatedState() });
    client.values.set(key, raw);
    const result = await loadBloomLocalState(client, now);
    assert(result.status === "corrupt", `Invalid v${version} envelope timestamp must be corruption, not a valid migration.`);
    assert(client.values.get(key) === raw, "Malformed envelope bytes must remain untouched.");
    assertBackup(client, result.backupKey, raw, key);
  }
}

type InvalidCase = { label: string; state: BloomLocalState; path: string; value?: unknown; remove?: true };

async function verifyMalformedProductRecords() {
  const state = createPopulatedState();
  const active = createValidLifecycleStates().find(([label]) => label === "active Reset and session")?.[1];
  assert(active !== undefined, "The active lifecycle fixture is required.");
  const cases: InvalidCase[] = [];
  const bad = (label: string, path: string, value: unknown, base = state) => cases.push({ label, path, value, state: base });
  const missing = (label: string, path: string, base = state) => cases.push({ label, path, remove: true, state: base });
  for (const key of productKeys) {
    missing(`missing ${key}`, key);
    bad(`null ${key}`, key, null);
    bad(`array ${key}`, key, []);
  }
  bad("nonboolean tracking enabled", "masturbationTracking.enabled", "yes");
  bad("completed session in current slot", "masturbationTracking.currentSession", completedSession());
  bad("unfinished session in history", "masturbationTracking.sessions.0.status", "active");
  bad("nonarray session history", "masturbationTracking.sessions", {});
  bad("duplicate session identity", "masturbationTracking.sessions.1.id", "source-session");
  bad("blank session identity", "masturbationTracking.sessions.0.id", " ");
  missing("missing completion feedback", "masturbationTracking.sessions.0.endingReason");
  bad("invalid ending reason", "masturbationTracking.sessions.0.endingReason", "diagnosis");
  bad("nonboolean explicit-content answer", "masturbationTracking.sessions.0.usedExplicitContent", 1);
  for (const invalid of [0, 11, 1.5, NaN, Infinity, "8", null]) bad(`invalid erection quality ${String(invalid)}`, "masturbationTracking.sessions.0.erectionQuality", invalid);
  for (const invalid of [-1, 0.5, NaN, Infinity, "600"]) bad(`invalid session duration ${String(invalid)}`, "masturbationTracking.sessions.0.durationSeconds", invalid);
  bad("impossible session start date", "masturbationTracking.sessions.0.startedAt", "2026-02-30T10:00:00.000Z");
  bad("session end before start", "masturbationTracking.sessions.0.endedAt", "2026-01-01T00:00:00.000Z");
  bad("nonarray pauses", "masturbationTracking.sessions.0.pauses", {});
  bad("active pause in ended session", "masturbationTracking.sessions.1.pauses.0.status", "active");
  missing("completed pause missing end", "masturbationTracking.sessions.1.pauses.0.endedAt");
  bad("fractional pause duration", "masturbationTracking.sessions.1.pauses.0.durationSeconds", 1.5);
  bad("pause outside session", "masturbationTracking.sessions.1.pauses.0.startedAt", "2025-01-01T00:00:00.000Z");
  bad("invalid partial feedback", "masturbationTracking.currentSession.erectionQuality", 11);
  bad("invalid content-free status", "contentFree.status", "paused");
  for (const invalid of [-1, 0.5, NaN, Infinity]) bad(`invalid best streak ${String(invalid)}`, "contentFree.bestStreakSeconds", invalid);
  missing("active content-free missing identity", "contentFree.activationId");
  bad("activation end before start", "contentFree.pastActivations.0.endedAt", "2025-01-01T00:00:00.000Z");
  bad("duplicate activation identity", "contentFree.pastActivations.0.id", "cf-current");
  bad("unknown violation activation", "contentFree.violations.0.activationId", "missing");
  bad("violation outside activation", "contentFree.violations.0.occurredAt", "2025-01-01T00:00:00.000Z");
  bad("invalid violation kind", "contentFree.violations.0.kind", "masturbation");
  bad("invalid violation status", "contentFree.violations.0.status", "ignored");
  missing("undone violation missing time", "contentFree.violations.0.undoneAt");
  bad("undo before recording", "contentFree.violations.0.undoneAt", "2026-01-01T00:00:00.000Z");
  bad("invalid source discriminator", "contentFree.violations.0.source.kind", "unknown");
  missing("manual source missing identity", "contentFree.violations.0.source.logActionId");
  missing("session source missing identity", "contentFree.violations.1.source.sessionId");
  bad("blank source identity", "contentFree.violations.1.source.sessionId", "");
  bad("duplicate source even when undone", "contentFree.violations.1.source", { kind: "manual", logActionId: "mistaken-manual-log" });
  bad("invalid prior streak snapshot", "contentFree.violations.0.streakBefore.bestStreakSeconds", -1);
  bad("wrong Reset duration", "resetJourney.durationDays", 10);
  bad("invalid Reset lifecycle", "resetJourney.status", "paused");
  bad("finished Reset with incomplete best", "resetJourney.bestCompletedDays", 14);
  for (const invalid of [-1, 16, 1.5]) bad(`invalid best Reset progress ${invalid}`, "resetJourney.bestCompletedDays", invalid);
  missing("started Reset missing baseline", "resetJourney.baseline");
  missing("finished Reset missing completion", "resetJourney.completedAt");
  missing("completed Reset missing assessment", "resetJourney.assessment");
  bad("active attempt claiming 15", "resetJourney.currentAttempt.completedDays", 15, active);
  bad("completed attempt claiming 14", "resetJourney.currentAttempt.completedDays", 14);
  bad("current Reset attempt in wrong lifecycle", "resetJourney.currentAttempt.status", "restarted");
  bad("invalid Reset violation reason", "resetJourney.violations.0.reason", "accidentalExposure");
  bad("unknown violated attempt", "resetJourney.violations.0.attemptId", "missing");
  bad("invalid Reset source", "resetJourney.violations.0.source", { kind: "manual" });
  bad("invalid baseline ratio", "resetJourney.baseline.explicitContentSessionRatio", 1.1);
  bad("negative baseline interval", "resetJourney.baseline.averageIntervalSeconds", -1);
  bad("nonfinite baseline interval", "resetJourney.baseline.averageIntervalSeconds", Infinity);
  bad("out-of-range baseline average", "resetJourney.baseline.averageErectionQuality", 10.1);
  bad("invalid baseline self-report", "resetJourney.baseline.selfReport.urgeIntensity", "diagnosed");
  bad("wrong assessment baseline", "resetJourney.assessment.baselineId", "wrong");
  bad("wrong assessment journey", "resetJourney.assessment.resetJourneyId", "wrong");
  bad("wrong assessment attempt", "resetJourney.assessment.resetAttemptId", "wrong");
  bad("assessment before Reset completion", "resetJourney.assessment.completedAt", "2026-02-01T00:00:00.000Z");
  bad("invalid assessment response", "resetJourney.assessment.readinessToRestartTracking", "approved");
  bad("invalid Urge history shape", "urgeControl.records", {});
  bad("completed Urge in active slot", "urgeControl.activeEvent", completedUrgeEvent());
  bad("active Urge in completed history", "urgeControl.records.0.status", "active");
  bad("duplicate Urge ID", "urgeControl.activeEvent.id", "urge-completed");
  missing("completed Urge missing time", "urgeControl.records.0.completedAt");
  missing("completed Urge missing outcome", "urgeControl.records.0.outcome");
  bad("invalid Urge technique", "urgeControl.records.0.selectedTechnique", "magic");
  bad("invalid Urge outcome", "urgeControl.records.0.outcome", "cured");
  bad("invalid Urge trigger", "urgeControl.records.0.trigger", "performance");
  bad("invalid second-line action", "urgeControl.records.0.secondLineAction", "sendAutomatically");
  bad("Urge completion before start", "urgeControl.records.0.completedAt", "2025-01-01T00:00:00.000Z");
  bad("phone-away end before start", "urgeControl.records.0.phoneAwayEndedAt", "2025-01-01T00:00:00.000Z");
  for (const invalidCase of cases) {
    const untrusted: unknown = JSON.parse(JSON.stringify(invalidCase.state));
    replaceAtPath(untrusted, invalidCase.path, invalidCase.value, invalidCase.remove === true);
    const validation = validateAndNormalizeBloomState(untrusted);
    assert(!validation.success, `${invalidCase.label}: malformed new facts must be rejected, not silently normalized into valid facts.`);
    const client = new ProductTestStorage();
    const raw = envelope(3, untrusted);
    client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
    const result = await loadBloomLocalState(client, now);
    assert(result.status === "corrupt", `${invalidCase.label}: malformed persisted new facts must follow the corruption strategy.`);
    assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${invalidCase.label}: preserve original bytes, not defaults or a dropped record.`);
    assertBackup(client, result.backupKey, raw, BLOOM_STATE_STORAGE_KEY);
  }
  console.log(`Bloom v5 product persistence: ${cases.length} malformed-state cases rejected and preserved.`);
}

function createValidLifecycleStates(): Array<[string, BloomLocalState]> {
  const populated = createPopulatedState();
  const completedReset = populated.resetJourney;
  assert(completedReset.status === "completed", "Populated fixture must carry completed Reset.");
  const { assessment: _assessment, ...pending } = completedReset;
  const { completedAt: _completedAt, currentAttempt: _currentAttempt, ...started } = pending;
  const active: ResetJourney = {
    ...started, status: "active", bestCompletedDays: 2,
    currentAttempt: { id: "attempt-current", status: "active", startedAt: "2026-02-03T10:10:00.000Z", completedDays: 1 }
  };
  const history = { id: "reset-new", durationDays: 15 as const, bestCompletedDays: 0 as const, pastAttempts: [], violations: [] };
  const states: Array<[string, BloomLocalState]> = [
    ["fresh inactive", createDefaultBloomState()],
    ["recommended Reset", { ...populated, resetJourney: { ...history, status: "recommended" } }],
    ["baseline pending Reset", { ...populated, resetJourney: { ...history, status: "baseline_pending" } }],
    ["active Reset and session", { ...populated, resetJourney: active, masturbationTracking: {
      ...populated.masturbationTracking,
      currentSession: { id: "session-active", status: "active", startedAt: "2026-03-01T10:00:00.000Z", pauses: [{ status: "active", startedAt: "2026-03-01T10:02:00.000Z" }] }
    } }],
    ["assessment pending Reset", { ...populated, resetJourney: { ...pending, status: "assessment_pending" } }],
    ["completed Reset and awaiting feedback", populated]
  ];
  const inactiveContent: ContentFreeState = {
    status: "inactive", bestStreakSeconds: populated.contentFree.bestStreakSeconds,
    pastActivations: [...populated.contentFree.pastActivations, { id: "cf-current", startedAt: "2026-02-01T00:00:00.000Z", endedAt: "2026-02-10T00:00:00.000Z" }],
    violations: populated.contentFree.violations
  };
  states.push(["inactive Content-Free retaining corrected history", { ...populated, contentFree: inactiveContent }]);
  states.push(["minimal unfinished event and zero-pause active session", {
    ...populated,
    masturbationTracking: { ...populated.masturbationTracking, currentSession: { id: "minimal-active", status: "active", startedAt: "2026-03-01T10:00:00.000Z", pauses: [] } },
    urgeControl: { ...populated.urgeControl, activeEvent: { id: "minimal-urge", status: "active", startedAt: "2026-03-01T11:00:00.000Z" } }
  }]);
  states.push(["unknown baseline aggregates and feedback", {
    ...populated,
    resetJourney: { ...completedReset, baseline: { id: "baseline", capturedAt: "2026-01-31T00:00:00.000Z", selfReport: { urgeIntensity: "notSure", abilityToPause: "preferNotToSay", spontaneousOrMorningErections: "notSure" } } },
    masturbationTracking: { ...populated.masturbationTracking, currentSession: { id: "feedback-empty", status: "awaiting_feedback", startedAt: "2026-03-01T10:00:00.000Z", endedAt: "2026-03-01T10:00:00.000Z", durationSeconds: 0, pauses: [] } }
  }]);
  return states;
}

export function createPopulatedState(): BloomLocalState {
  const state = createPopulatedLegacyState();
  const endings = ["climaxed", "stoppedBeforeClimax", "firmnessDecreased", "feltAnxious", "stoppedByChoice", "other"] as const;
  state.masturbationTracking = {
    enabled: true,
    currentSession: { id: "session-feedback", status: "awaiting_feedback", startedAt: "2026-03-01T10:00:00.000Z", endedAt: "2026-03-01T10:05:00.000Z", durationSeconds: 300, pauses: [], usedExplicitContent: false, erectionQuality: 5 },
    sessions: endings.map((endingReason, index) => ({
      ...completedSession(), id: index === 0 ? "source-session" : `session-${index}`, endingReason,
      erectionQuality: index === 0 ? 1 : 10,
      usedExplicitContent: index === 0,
      pauses: index === 0 ? [] : [{ status: "completed", startedAt: "2026-02-03T10:02:00.000Z", endedAt: "2026-02-03T10:03:00.000Z", durationSeconds: 60 }]
    }))
  };
  state.contentFree = {
    status: "active", activationId: "cf-current", activatedAt: "2026-02-01T00:00:00.000Z", currentStreakStartedAt: "2026-02-03T10:10:00.000Z", bestStreakSeconds: 19 * 86400,
    pastActivations: [{ id: "cf-past", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-20T00:00:00.000Z" }],
    violations: [
      { id: "cf-corrected", activationId: "cf-past", kind: "intentionalExplicitContent", occurredAt: "2026-01-10T00:00:00.000Z", recordedAt: "2026-01-10T00:01:00.000Z", source: { kind: "manual", logActionId: "mistaken-manual-log" }, streakBefore: { currentStreakStartedAt: "2026-01-01T00:00:00.000Z", bestStreakSeconds: 9 * 86400 }, status: "undone", undoneAt: "2026-01-11T00:00:00.000Z" },
      { id: "cf-recorded", activationId: "cf-current", kind: "intentionalExplicitContent", occurredAt: "2026-02-03T10:10:00.000Z", recordedAt: "2026-02-03T10:11:00.000Z", source: { kind: "masturbationSession", sessionId: "source-session" }, streakBefore: { currentStreakStartedAt: "2026-02-01T00:00:00.000Z", bestStreakSeconds: 19 * 86400 }, status: "recorded" }
    ]
  };
  state.resetJourney = {
    id: "reset-journey", durationDays: 15, status: "completed", startedAt: "2026-02-01T00:00:00.000Z", bestCompletedDays: 15,
    pastAttempts: [{ id: "attempt-past", status: "restarted", startedAt: "2026-02-01T00:00:00.000Z", endedAt: "2026-02-03T10:10:00.000Z", completedDays: 2, restartViolationId: "reset-violation" }],
    violations: [{ id: "reset-violation", attemptId: "attempt-past", occurredAt: "2026-02-03T10:10:00.000Z", recordedAt: "2026-02-03T10:11:00.000Z", source: { kind: "masturbationSession", sessionId: "source-session" }, reason: "masturbationWithExplicitContent" }],
    baseline: { id: "baseline", capturedAt: "2026-01-31T00:00:00.000Z", averageIntervalSeconds: 86400.5, averageErectionQuality: 6.5, explicitContentSessionRatio: 0.25, selfReport: { urgeIntensity: "medium", abilityToPause: "sometimesPossible", spontaneousOrMorningErections: "sometimes" } },
    completedAt: "2026-02-18T10:10:00.000Z",
    currentAttempt: { id: "attempt-current", status: "completed", startedAt: "2026-02-03T10:10:00.000Z", completedAt: "2026-02-18T10:10:00.000Z", completedDays: 15 },
    assessment: { id: "assessment", resetJourneyId: "reset-journey", resetAttemptId: "attempt-current", baselineId: "baseline", completedAt: "2026-02-18T10:20:00.000Z", urgeIntensityChange: "same", abilityToPauseChange: "easier", spontaneousErectionChange: "notSure", overallSexualResponseChange: "worse", readinessToRestartTracking: "notReady" }
  };
  state.urgeControl = {
    activeEvent: { id: "urge-active", status: "active", startedAt: "2026-03-01T11:00:00.000Z", interruptCompletedAt: "2026-03-01T11:00:10.000Z", phoneAwayStartedAt: "2026-03-01T11:01:00.000Z", selectedTechnique: "urgeSurfing", outcome: "stillStrong", trigger: "sleeplessnessNighttime", secondLineAction: "putPhoneInAnotherRoom" },
    records: [completedUrgeEvent()]
  };
  return state;
}

function completedSession(): Extract<MasturbationSession, { status: "completed" }> {
  return { id: "source-session", status: "completed", startedAt: "2026-02-03T10:00:00.000Z", endedAt: "2026-02-03T10:10:00.000Z", durationSeconds: 600, erectionQuality: 7, usedExplicitContent: true, endingReason: "climaxed", pauses: [] };
}

function completedUrgeEvent(): Extract<UrgeControlEvent, { status: "completed" }> {
  return { id: "urge-completed", status: "completed", startedAt: "2026-02-02T12:00:00.000Z", interruptCompletedAt: "2026-02-02T12:00:10.000Z", phoneAwayStartedAt: "2026-02-02T12:01:00.000Z", phoneAwayEndedAt: "2026-02-02T12:05:00.000Z", completedAt: "2026-02-02T12:06:00.000Z", selectedTechnique: "grounding54321", outcome: "unchanged", trigger: "sexualDesire", secondLineAction: "messageSupportPerson" };
}

function createPopulatedLegacyState(): BloomLocalState {
  const state = createDefaultBloomState();
  const quizResult: QuizResult = {
    scores: { PL: 5, PP: 3, CT: 1, FC: 1 }, normalizedScores: { PL: 0.8, PP: 0.5, CT: 0.1, FC: 0.2 }, primaryPattern: "pornLoop", secondaryPattern: "pressurePattern",
    flags: { eveningWindow: true, emptyMoments: true, boredom: true, aloneTime: true, stressTrigger: true, phoneLoop: true, firmnessConcern: false }, resultTitle: "Legacy result", resultBody: "Keep this legacy observation.", planName: "Legacy plan", recommendedFirstAction: "setupProtection", firstPlanSteps: [{ title: "Keep", description: "Existing step" }], chips: ["Existing chip"], completedAt: now().toISOString()
  };
  state.onboarding = { completed: true, quizAnswers: { porn_first: 2, loop_triggers: ["boredom"] }, quizResult, completedAt: quizResult.completedAt };
  state.activePlan = activePlanFromQuizResult(quizResult);
  state.tenDayReset = { startedAt: "2026-07-01", completedDates: ["2026-07-01", "2026-07-02"], lastCompletedAt: "2026-07-02T10:00:00.000Z" };
  state.debug.dateOffsetDays = 7;
  state.protection = { status: "active", setupCompletedAt: "2026-07-01T00:00:00.000Z", preferredWindow: "night", level: "balanced", adultContentPauseEnabled: true, nightStartTime: "22:00", nightEndTime: "08:00", lastProtectionPauseAt: "2026-07-02T22:00:00.000Z" };
  state.checkIns.records = [{ id: "legacy-check-in", createdAt: "2026-07-02T22:00:00.000Z", mood: "calm", moment: "evening", eventType: "both", note: "Retain this private reflection." }];
  state.pause = {
    activeSession: { id: "legacy-pause-active", startedAt: "2026-07-03T22:00:00.000Z", phase: "timer", triggers: ["boredom"], intensityBefore: 8, selectedAction: "pause90", timerStartedAt: "2026-07-03T22:00:00.000Z", timerDurationSeconds: 90, elapsedDurationSeconds: 30 },
    records: [{ id: "legacy-pause-record", startedAt: "2026-07-02T22:00:00.000Z", completedAt: "2026-07-02T22:02:00.000Z", triggers: ["stress"], intensityBefore: 6, intensityAfterChange: "lower", selectedAction: "pause90", feltTruth: "calmer", nextStep: "savePause", durationSeconds: 90 }]
  };
  state.arousalControl = {
    draft: { id: "legacy-arousal-draft", startedAt: "2026-07-03T12:00:00.000Z", dateKey: "2026-07-03", mode: "onePause", adultContent: "yes", pauseCount: 0 },
    logs: [{ id: "legacy-arousal-log", startedAt: "2026-07-02T12:00:00.000Z", completedAt: "2026-07-02T12:10:00.000Z", dateKey: "2026-07-02", completionStatus: "completed", mode: "onePause", focus: "onePause", adultContent: "yes", firmnessPlan: "finish", endingChoice: "climaxed", reflectionCompleted: true, durationPreference: "estimated", durationSeconds: 600, pauseCount: 1, note: "Legacy session note." }]
  };
  return state;
}

function assertSafeProductDefaults(state: BloomLocalState, label: string) {
  equal(state.masturbationTracking, { enabled: false, currentSession: null, sessions: [] }, `${label}: do not infer enabled tracking or session history.`);
  equal(state.contentFree, { status: "inactive", bestStreakSeconds: 0, pastActivations: [], violations: [] }, `${label}: do not infer Content-Free activity or violations.`);
  equal(state.resetJourney, { status: "inactive", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] }, `${label}: inactive Reset has no fake ID, baseline, assessment, attempts, or progress.`);
  equal(state.urgeControl, { activeEvent: null, records: [] }, `${label}: do not infer Urge Control history from Pause.`);
}

function pickLegacy(state: BloomLocalState) {
  return Object.fromEntries(legacyKeys.map((key) => [key, state[key]]));
}

function envelope(version: number, state: unknown) {
  return JSON.stringify({ version, savedAt: now().toISOString(), state });
}

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const keys = path.split(".");
  const final = keys.pop();
  assert(final !== undefined, "Invalid mutation path.");
  let parent = root as Record<string, unknown>;
  for (const key of keys) {
    const next = parent[key];
    assert(typeof next === "object" && next !== null, `Malformed test fixture path: ${path}`);
    parent = next as Record<string, unknown>;
  }
  if (remove) delete parent[final];
  else parent[final] = value;
}

function assertBackup(client: ProductTestStorage, key: string | null, raw: string, sourceKey: string) {
  assert(key !== null && key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt or future data must receive a scoped backup.");
  const backup = client.values.get(key);
  assert(backup !== undefined, "The backup must be durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === sourceKey, "The backup must retain exact source bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(isDeepStrictEqual(actual, expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class ProductTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  readonly readKeys: string[] = [];
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

  async getItem(key: string) {
    this.readKeys.push(key);
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.operations.push(`write:${key}`);
    if (key === BLOOM_STATE_STORAGE_KEY) {
      const held = this.heldWrite;
      this.heldWrite = null;
      if (held !== null) { held.started(); await held.wait; }
      if (this.failCurrentWrite) throw new Error("Synthetic v5 write failure.");
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
