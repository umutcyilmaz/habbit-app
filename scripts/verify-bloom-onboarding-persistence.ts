import { isDeepStrictEqual } from "node:util";

import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import type { BloomOnboardingAnswers, BloomOnboardingQuizResult } from "../src/domain/onboarding/types";
import {
  createDefaultBloomState,
  saveProductOnboardingResultState,
  type BloomLocalState
} from "../src/storage/bloomState";
import {
  BLOOM_CORRUPT_BACKUP_PREFIX,
  BLOOM_LEGACY_STATE_STORAGE_KEYS,
  BLOOM_STATE_STORAGE_KEY,
  createBloomStatePersistenceCoordinator,
  loadBloomLocalState,
  persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";

const now = () => new Date("2026-09-11T10:00:00.000Z");
const completedAt = "2026-09-10T09:15:00.000Z";
const v3Key = "bloom.localState.v3";
const v2Key = "bloom.localState.v2";
const v1Key = "bloom.localState.v1";
const legacyKeys = ["activePlan", "onboarding", "tenDayReset", "debug", "protection", "checkIns", "pause", "arousalControl"] as const;
const featureKeys = ["masturbationTracking", "contentFree", "resetJourney", "urgeControl"] as const;

export async function verifyBloomOnboardingPersistence() {
  verifyDefaultsAndSaving();
  await verifyResultRoundTrips();
  await verifyHistoricalResultsAreNotRescored();
  await verifyV3Migration();
  await verifyOlderMigrations();
  await verifyMigrationWriteOwnership();
  await verifyVersionPrecedence();
  await verifyDeleteAllAndFutureVersions();
  const malformedCount = await verifyMalformedResults();
  console.log(`Bloom product onboarding persistence verification passed (${malformedCount} malformed cases; historical results, save isolation, and v1–v4 migration lifecycle).`);
}

function verifyDefaultsAndSaving() {
  assert(BLOOM_PERSISTENCE_VERSION === 4 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v4", "Product onboarding must use canonical v4 storage.");
  equal(BLOOM_LEGACY_STATE_STORAGE_KEYS, [v3Key, v2Key, v1Key], "Migration must prefer v3, then v2, then v1.");
  const first = createDefaultBloomState();
  const second = createDefaultBloomState();
  assertDefaultOnboarding(first, "fresh state");
  equal(first.productOnboarding, second.productOnboarding, "Fresh onboarding must not invent timestamps or IDs.");
  assert(first.productOnboarding !== second.productOnboarding, "Separate defaults must not share mutable onboarding state.");

  for (const recommendation of ["masturbation_tracking", "content_free", "reset", "reset_and_content_free"] as const) {
    for (const state of [createDefaultBloomState(), createPopulatedState()]) {
      const original = JSON.stringify(state);
      const result = createResult();
      result.recommendation = recommendation;
      const saved = saveProductOnboardingResultState(state, result);
      assert(saved !== state && saved.productOnboarding.status === "completed", `${recommendation}: saving must produce completed onboarding.`);
      equal(saved.productOnboarding.result, result, `${recommendation}: save must retain the complete result.`);
      assert(saved.productOnboarding.result !== result, "Saved results must not alias the caller's mutable input.");
      for (const key of Object.keys(state) as Array<keyof BloomLocalState>) {
        if (key !== "productOnboarding") assert(saved[key] === state[key], `${recommendation}: saving must preserve ${key} by reference, including every plan and feature.`);
      }
      assert(JSON.stringify(state) === original, "Saving must not mutate any part of the prior state.");
      equal(saveProductOnboardingResultState(state, result), saved, "The pure save mutation must be deterministic.");
      const snapshot = JSON.stringify(saved.productOnboarding);
      (result.answers.masturbationTechniques as string[]).push("proneRubbing");
      (result.answers.safetySignals as string[]).push("newMarkedCurvature");
      result.dimensions.contentDysregulation = "uncertain";
      result.evidence.contentDysregulation.normalizedScore = 1.25;
      assert(JSON.stringify(saved.productOnboarding) === snapshot, "The saved fact must own its nested answers, dimensions, and evidence.");
    }
  }
  const state = saveProductOnboardingResultState(first, createResult());
  const replacement = createResult({ explicitContentFrequency: "never" });
  const replaced = saveProductOnboardingResultState(state, replacement);
  equal(replaced.productOnboarding, { status: "completed", result: replacement }, "A later valid result must replace the complete onboarding fact without merging old answers.");
  assertDefaultOnboarding(first, "the original unsaved state");
}

async function verifyResultRoundTrips() {
  const result = createResult();
  // JSON object insertion order and multi-select order are deliberately unusual.
  result.answers = Object.fromEntries(Object.entries(result.answers).reverse()) as BloomOnboardingAnswers;
  const rawAnswers = JSON.stringify(result.answers);
  const state = saveProductOnboardingResultState(createPopulatedState(), result);
  assert(JSON.stringify(state.productOnboarding.result?.answers) === rawAnswers, "Saving must retain raw answer bytes, including selection and question-key order.");
  const client = new OnboardingTestStorage();
  await persistBloomLocalState(state, client, now);
  const payload = client.values.get(BLOOM_STATE_STORAGE_KEY);
  assert(payload !== undefined, "Saved onboarding must become durable.");
  const parsed = JSON.parse(payload) as { version: number; state: BloomLocalState };
  assert(parsed.version === 4, "Saved onboarding must declare envelope version 4.");
  assert(JSON.stringify(parsed.state.productOnboarding.result?.answers) === rawAnswers, "Serialization must preserve the entire raw answer object byte-for-byte.");
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Saved onboarding must load as current state.");
  equal(loaded.state, state, "Save/load must preserve onboarding and every populated legacy and product slice.");
  assert(JSON.stringify(loaded.state.productOnboarding.result?.answers) === rawAnswers, "Runtime validation must preserve raw answer bytes and semantic values.");

  const unknown = createResult({
    explicitContentFrequency: "notSure", unplannedContentUse: "notSure", activityInterruption: "notSure",
    contentTriggeredMasturbation: "notSure", repeatedContentReturn: "notSure", difficultyReducingContent: "neverTriedToReduce",
    erectionQuality: "notSure", erectionMaintenanceDifficulty: "notSure", masturbationTechniques: ["notSure"],
    techniqueDependency: "notSure", delayedOrDifficultEjaculation: "notSure", safetySignals: ["unsure"]
  });
  const unknownState = saveProductOnboardingResultState(createDefaultBloomState(), unknown);
  await persistBloomLocalState(unknownState, client, now);
  const unknownLoaded = await loadBloomLocalState(client, now);
  assert(unknownLoaded.status === "success", "Explicit unknown answers and null evidence scores must remain valid facts.");
  equal(unknownLoaded.state.productOnboarding.result, unknown, "Unknown answers must not turn into zeros or disappear during persistence.");
}

async function verifyHistoricalResultsAreNotRescored() {
  const historical = createResult();
  const current = scoreBloomOnboarding(historical.answers, historical.completedAt);
  historical.dimensions = {
    contentDysregulation: "low", erectionResponseConcern: "low", stimulationPattern: "low",
    recommendationConfidence: "uncertain", safetyFlag: "noneReported"
  };
  historical.recommendation = "reset";
  historical.recommendationConfidence = "uncertain";
  historical.resetEligible = false;
  historical.safetyFlag = "noneReported";
  historical.evidence = {
    contentDysregulation: { normalizedScore: 7.125, answeredCount: 1, totalCount: 5, strongSignalCount: 0 },
    erectionResponseConcern: { normalizedScore: 100, answeredCount: 3, totalCount: 3, strongSignalCount: 3 },
    stimulationPattern: { normalizedScore: 0, answeredCount: 2, totalCount: 2, strongSignalCount: 0 }
  };
  assert(!isDeepStrictEqual(historical, current), "Historical fixture must differ from today's derived scores, dimensions, recommendation, gate, and safety interpretation.");
  const state = saveProductOnboardingResultState(createPopulatedState(), historical);
  equal(state.productOnboarding.result, historical, "Saving validates a historical result without rescoring or enforcing today's recommendation policy.");
  const validation = validateAndNormalizeBloomState(state);
  assert(validation.success, "Structurally valid historical derivations must validate despite differing from today's algorithm.");
  equal(validation.state.productOnboarding.result, historical, "Direct validation must not recalculate historical derived facts or evidence counts from raw answers.");
  const client = new OnboardingTestStorage();
  await persistBloomLocalState(state, client, now);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success", "Structurally valid historical results must load.");
  equal(loaded.state.productOnboarding.result, historical, "Loading must retain the historical result unchanged for an explicit future re-score.");
}

async function verifyV3Migration() {
  const state = createPopulatedState();
  const prior = withoutProductOnboarding(state);
  const smuggled = { status: "completed", result: createResult() };
  for (const [label, stored] of [
    ["valid v3", prior],
    ["v3 carrying a plausible later onboarding slice", { ...prior, productOnboarding: smuggled }],
    ["v3 carrying malformed later onboarding", { ...prior, productOnboarding: { status: "completed", result: "do not infer" } }]
  ] as const) {
    const client = new OnboardingTestStorage();
    client.values.set(v3Key, envelope(3, stored));
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "legacy" && !loaded.needsPersist && loaded.persistenceError === null, `${label}: v3 must migrate directly to durable v4.`);
    equal(withoutProductOnboarding(loaded.state), prior, `${label}: all twelve prior slices must survive exactly.`);
    assertDefaultOnboarding(loaded.state, label);
    assert(!client.values.has(v3Key), `${label}: the source v3 key must be removed after migration.`);
    const rawV4 = client.values.get(BLOOM_STATE_STORAGE_KEY);
    assert(rawV4 !== undefined, `${label}: migrated v4 must be durable.`);
    equal(JSON.parse(rawV4), { version: 4, savedAt: now().toISOString(), state: loaded.state }, `${label}: migration must write the returned v4 snapshot directly.`);
    const reloaded = await loadBloomLocalState(client, now);
    assert(reloaded.status === "success" && reloaded.source === "current" && !reloaded.needsPersist, `${label}: durable migration must load as stable current state.`);
    equal(reloaded.state, loaded.state, `${label}: migrated state must remain stable.`);
  }
}

async function verifyOlderMigrations() {
  const populated = saveProductOnboardingResultState(createPopulatedState(), createResult());
  const legacy = pick(populated, legacyKeys);
  assert(populated.onboarding.completed && populated.onboarding.quizResult !== null, "Older migration fixture must contain genuine legacy onboarding and an active plan.");
  for (const [label, key, raw] of [
    ["v2 envelope", v2Key, envelope(2, legacy)],
    ["v2 with later product fields", v2Key, envelope(2, populated)],
    ["raw v1", v1Key, JSON.stringify(legacy)],
    ["raw v1 with later product fields", v1Key, JSON.stringify(populated)]
  ] as const) {
    const client = new OnboardingTestStorage();
    client.values.set(key, raw);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "legacy" && !loaded.needsPersist, `${label}: older users must reach durable v4 in one migration.`);
    equal(pick(loaded.state, legacyKeys), legacy, `${label}: older valid legacy slices must remain unchanged.`);
    equal(pick(loaded.state, featureKeys), pick(createDefaultBloomState(), featureKeys), `${label}: Phase 1B facts must start from safe defaults.`);
    assertDefaultOnboarding(loaded.state, label);
    equal(client.operations.filter((operation) => operation.startsWith("write:")), [`write:${BLOOM_STATE_STORAGE_KEY}`], `${label}: migration must not require intermediate physical version writes.`);
    assert(!client.values.has(key), `${label}: successful migration must clean its source key.`);
  }
}

async function verifyMigrationWriteOwnership() {
  const prior = withoutProductOnboarding(createPopulatedState());
  const raw = envelope(3, prior);
  const failedClient = new OnboardingTestStorage();
  failedClient.values.set(v3Key, raw);
  failedClient.failCurrentWrite = true;
  const failed = await loadBloomLocalState(failedClient, now);
  assert(failed.status === "success" && failed.source === "legacy" && failed.needsPersist && failed.persistenceError !== null, "Failed v4 write must return usable v3 facts with an unacknowledged migration warning.");
  equal(withoutProductOnboarding(failed.state), prior, "Failed migration must preserve every original populated slice.");
  assertDefaultOnboarding(failed.state, "failed v3 migration");
  assert(failedClient.values.get(v3Key) === raw && !failedClient.values.has(BLOOM_STATE_STORAGE_KEY), "Failed v4 writes must retain original v3 bytes and not invent durable v4.");
  assert(!failedClient.operations.includes(`remove:${v3Key}`), "A failed migration must not attempt source cleanup.");
  failedClient.failCurrentWrite = false;
  const retried = await loadBloomLocalState(failedClient, now);
  assert(retried.status === "success" && !retried.needsPersist && !failedClient.values.has(v3Key), "A later retry must durably migrate and clean the retained v3 source.");

  const heldClient = new OnboardingTestStorage();
  heldClient.values.set(v3Key, raw);
  const held = heldClient.holdNextCurrentWrite();
  let finished = false;
  const loading = loadBloomLocalState(heldClient, now).then((result) => { finished = true; return result; });
  await held.started;
  assert(!finished && heldClient.values.get(v3Key) === raw && !heldClient.values.has(BLOOM_STATE_STORAGE_KEY), "Migration must await the durable v4 write while retaining source bytes.");
  assert(!heldClient.operations.includes(`remove:${v3Key}`), "Pending v4 writes must not clean v3 early.");
  held.release();
  const loaded = await loading;
  assert(loaded.status === "success" && !loaded.needsPersist, "Releasing the durable write must complete migration.");
  assert(heldClient.operations.indexOf(`remove:${v3Key}`) > heldClient.operations.indexOf(`durable:${BLOOM_STATE_STORAGE_KEY}`), "Source cleanup must follow durable v4 acknowledgement.");

  const cleanupClient = new OnboardingTestStorage();
  cleanupClient.values.set(v3Key, raw);
  cleanupClient.failRemovalKey = v3Key;
  const cleanup = await loadBloomLocalState(cleanupClient, now);
  assert(cleanup.status === "success" && !cleanup.needsPersist && cleanupClient.values.get(v3Key) === raw && cleanupClient.values.has(BLOOM_STATE_STORAGE_KEY), "Failed cleanup must preserve both durable v4 and the original v3 source.");
  const reloaded = await loadBloomLocalState(cleanupClient, now);
  assert(reloaded.status === "success" && reloaded.source === "current", "A leftover source after cleanup failure must not override current v4.");
}

async function verifyVersionPrecedence() {
  const current = saveProductOnboardingResultState(createPopulatedState(), createResult());
  const v3 = withoutProductOnboarding(createPopulatedState());
  v3.debug = { dateOffsetDays: 3 };
  const v2 = { ...pick(current, legacyKeys), debug: { dateOffsetDays: 2 } };
  const client = new OnboardingTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, envelope(4, current));
  client.values.set(v3Key, envelope(3, v3));
  client.values.set(v2Key, envelope(2, v2));
  client.values.set(v1Key, JSON.stringify(pick(current, legacyKeys)));
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Canonical v4 must take priority over every older key.");
  equal(loaded.state, current, "Older keys must not replace a completed current onboarding result.");
  equal(client.readKeys, [BLOOM_STATE_STORAGE_KEY], "Present v4 must prevent all fallback reads.");

  const previous = new OnboardingTestStorage();
  previous.values.set(v3Key, envelope(3, v3));
  previous.values.set(v2Key, envelope(2, v2));
  const migrated = await loadBloomLocalState(previous, now);
  assert(migrated.status === "success" && migrated.state.debug.dateOffsetDays === 3, "The most recent v3 source must win over v2.");
  assert(!previous.readKeys.includes(v2Key), "Migration must not merge older v2 facts into valid v3.");

  const relocated = new OnboardingTestStorage();
  relocated.values.set(v3Key, envelope(4, current));
  const relocation = await loadBloomLocalState(relocated, now);
  assert(relocation.status === "success" && relocation.source === "legacy", "A current envelope at an older key must safely relocate.");
  equal(relocation.state.productOnboarding, current.productOnboarding, "Envelope version must preserve completed onboarding during key relocation.");
}

async function verifyDeleteAllAndFutureVersions() {
  const client = new OnboardingTestStorage();
  for (const key of [BLOOM_STATE_STORAGE_KEY, v3Key, v2Key, v1Key, `${BLOOM_CORRUPT_BACKUP_PREFIX}old`, `${BLOOM_CORRUPT_BACKUP_PREFIX}current`]) client.values.set(key, "delete me");
  client.values.set("unrelated", "retain me");
  await createBloomStatePersistenceCoordinator(client, now).deleteAll();
  equal([...client.values.entries()], [["unrelated", "retain me"]], "Delete-all must remove v1/v2/v3/v4 and every Bloom corrupt backup only.");
  assert(client.operations[client.operations.length - 1] === `remove:${BLOOM_STATE_STORAGE_KEY}`, "Delete-all must preserve current-key-last recovery ordering.");
  for (const key of [BLOOM_STATE_STORAGE_KEY, v3Key, v2Key, v1Key]) {
    const futureClient = new OnboardingTestStorage();
    const raw = envelope(99, { productOnboarding: "future user-owned fact" });
    futureClient.values.set(key, raw);
    if (key !== v1Key) futureClient.values.set(v1Key, JSON.stringify(pick(createPopulatedState(), legacyKeys)));
    const result = await loadBloomLocalState(futureClient, now);
    assert(result.status === "unsupported-version" && result.version === 99 && result.sourceKey === key, `${key}: unsupported future envelopes must remain unsupported without fallback.`);
    assert(futureClient.values.get(key) === raw, `${key}: unsupported future source bytes must remain untouched.`);
    assertBackup(futureClient, result.backupKey, raw, key);
  }
}

async function verifyMalformedResults() {
  const valid = saveProductOnboardingResultState(createPopulatedState(), createResult());
  const cases: Array<{ label: string; path: string; value?: unknown; remove?: true }> = [];
  const bad = (label: string, path: string, value: unknown) => cases.push({ label, path, value });
  const missing = (path: string) => cases.push({ label: `missing ${path}`, path, remove: true });
  const result = "productOnboarding.result";
  for (const [label, value] of [["null", null], ["array", []], ["string", "completed"]] as const) bad(`${label} slice`, "productOnboarding", value);
  missing("productOnboarding");
  missing("productOnboarding.status");
  bad("unknown discriminant", "productOnboarding.status", "pending");
  bad("notCompleted carrying result", "productOnboarding.status", "notCompleted");
  bad("completed missing result", result, null);
  bad("extra slice field", "productOnboarding.completedAt", completedAt);
  for (const key of Object.keys(createResult())) missing(`${result}.${key}`);
  bad("array result", result, []);
  bad("extra result fact", `${result}.diagnosis`, "not supported");
  for (const key of ["quizVersion", "scoringVersion"]) {
    for (const value of [0, 2, 1.5, "1", null]) bad(`invalid ${key}: ${value}`, `${result}.${key}`, value);
  }
  for (const value of ["2026-02-30T09:15:00.000Z", "2026-09-10", "2026-09-10T09:15:00+00:00", "", 1]) bad(`invalid completedAt: ${value}`, `${result}.completedAt`, value);
  bad("nonboolean eligibility", `${result}.resetEligible`, "false");
  bad("unknown recommendation", `${result}.recommendation`, "protect");
  bad("unknown confidence", `${result}.recommendationConfidence`, "definite");
  bad("conflicting confidence copies", `${result}.recommendationConfidence`, "low");
  bad("unknown safety flag", `${result}.safetyFlag`, "medical");
  bad("conflicting safety copies", `${result}.safetyFlag`, "noneReported");
  bad("array answers", `${result}.answers`, []);
  bad("unknown question ID", `${result}.answers.oldQuizQuestion`, "often");
  for (const key of Object.keys(createResult().answers)) missing(`${result}.answers.${key}`);
  for (const key of ["explicitContentFrequency", "unplannedContentUse", "activityInterruption", "contentTriggeredMasturbation", "repeatedContentReturn", "difficultyReducingContent", "erectionMaintenanceDifficulty", "techniqueDependency", "delayedOrDifficultEjaculation"]) {
    bad(`invalid answer ${key}`, `${result}.answers.${key}`, "unsupported");
  }
  for (const value of [0, 11, 1.5, "7", null]) bad(`invalid erection quality: ${value}`, `${result}.answers.erectionQuality`, value);
  for (const [key, values] of [
    ["masturbationTechniques", [[], "normalHandTechnique", ["unsupported"], ["normalHandTechnique", "normalHandTechnique"], ["notSure", "other"]]],
    ["safetySignals", [[], "none", ["unsupported"], ["pain", "pain"], ["none", "pain"], ["none", "unsure"]]]
  ] as const) {
    for (const value of values) bad(`invalid ${key}: ${JSON.stringify(value)}`, `${result}.answers.${key}`, value);
  }
  bad("array dimensions", `${result}.dimensions`, []);
  bad("extra dimension", `${result}.dimensions.medicalRisk`, "high");
  for (const key of Object.keys(createResult().dimensions)) missing(`${result}.dimensions.${key}`);
  for (const key of ["contentDysregulation", "erectionResponseConcern", "stimulationPattern"]) bad(`invalid dimension ${key}`, `${result}.dimensions.${key}`, "severe");
  bad("invalid dimension safety", `${result}.dimensions.safetyFlag`, "clear");
  bad("invalid dimension confidence", `${result}.dimensions.recommendationConfidence`, "certain");
  bad("array evidence", `${result}.evidence`, []);
  bad("extra evidence category", `${result}.evidence.medicalRisk`, {});
  for (const [key, total] of [["contentDysregulation", 5], ["erectionResponseConcern", 3], ["stimulationPattern", 2]] as const) {
    const prefix = `${result}.evidence.${key}`;
    missing(prefix);
    bad(`array ${key} evidence`, prefix, []);
    bad(`extra ${key} evidence`, `${prefix}.medicalRisk`, 5);
    for (const field of ["normalizedScore", "answeredCount", "totalCount", "strongSignalCount"]) missing(`${prefix}.${field}`);
    for (const value of [-0.01, 100.01, NaN, Infinity, "50", null]) bad(`invalid ${key} score: ${value}`, `${prefix}.normalizedScore`, value);
    for (const value of [-1, 0.5, total + 1, "1"]) bad(`invalid ${key} count: ${value}`, `${prefix}.answeredCount`, value);
    for (const value of [-1, 0.5, total + 1, "0"]) bad(`invalid ${key} strong count: ${value}`, `${prefix}.strongSignalCount`, value);
    bad(`incorrect ${key} total`, `${prefix}.totalCount`, total + 1);
    bad(`strong count exceeds ${key} answered count`, `${prefix}.answeredCount`, 0);
  }
  for (const entry of cases) {
    const malformed: unknown = JSON.parse(JSON.stringify(valid));
    replaceAtPath(malformed, entry.path, entry.value, entry.remove === true);
    const checked = validateAndNormalizeBloomState(malformed);
    assert(!checked.success, `${entry.label}: malformed onboarding must fail instead of becoming different valid user facts.`);
    if (entry.path.startsWith(`${result}.`) || entry.path === result) {
      const candidate = (malformed as BloomLocalState).productOnboarding.result;
      const saved = saveProductOnboardingResultState(valid, candidate as BloomOnboardingQuizResult);
      assert(saved === valid, `${entry.label}: invalid saves must leave the exact prior state unchanged.`);
    }
    // JSON represents non-finite numbers as null. Direct checks above own the
    // non-finite cases; explicit null fixtures cover score/count coherence.
    if (typeof entry.value === "number" && !Number.isFinite(entry.value)) continue;
    const client = new OnboardingTestStorage();
    const raw = envelope(4, malformed);
    client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
    client.values.set(v3Key, envelope(3, withoutProductOnboarding(createPopulatedState())));
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "corrupt" && loaded.sourceKey === BLOOM_STATE_STORAGE_KEY, `${entry.label}: malformed v4 must follow corruption handling without older-key fallback.`);
    assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${entry.label}: original malformed payload bytes must remain untouched.`);
    assert(!client.readKeys.includes(v3Key), `${entry.label}: corruption must not silently restore older state.`);
    assertBackup(client, loaded.backupKey, raw, BLOOM_STATE_STORAGE_KEY);
  }
  return cases.length;
}

function createResult(overrides: Partial<BloomOnboardingAnswers> = {}): BloomOnboardingQuizResult {
  return scoreBloomOnboarding({
    explicitContentFrequency: "dailyOrMore", unplannedContentUse: "almostAlways", activityInterruption: "often",
    contentTriggeredMasturbation: "almostAlways", repeatedContentReturn: "often", difficultyReducingContent: "often",
    erectionQuality: 2, erectionMaintenanceDifficulty: "almostAlways",
    masturbationTechniques: ["other", "normalHandTechnique", "veryTightPressure"],
    techniqueDependency: "almostAlways", delayedOrDifficultEjaculation: "often", safetySignals: ["unsure", "pain"],
    ...overrides
  }, completedAt);
}

function assertDefaultOnboarding(state: BloomLocalState, label: string) {
  equal(state.productOnboarding, { status: "notCompleted", result: null }, `${label}: no product result may be invented or inferred from legacy onboarding or feature history.`);
}

function withoutProductOnboarding(state: BloomLocalState) {
  const { productOnboarding: _productOnboarding, ...prior } = state;
  return prior;
}

function pick(state: BloomLocalState, keys: readonly (keyof BloomLocalState)[]) {
  return Object.fromEntries(keys.map((key) => [key, state[key]]));
}

function envelope(version: number, state: unknown) {
  return JSON.stringify({ version, savedAt: now().toISOString(), state });
}

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const parts = path.split(".");
  const final = parts.pop();
  assert(final !== undefined, "Fixture mutation needs a field name.");
  let parent = root as Record<string, unknown>;
  for (const part of parts) parent = parent[part] as Record<string, unknown>;
  if (remove) delete parent[final];
  else parent[final] = value;
}

function assertBackup(client: OnboardingTestStorage, key: string | null, raw: string, sourceKey: string) {
  assert(key !== null && key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt/future data must receive a scoped backup.");
  const backup = client.values.get(key);
  assert(backup !== undefined, "Corrupt/future backup must be durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === sourceKey, "Backups must preserve exact payload bytes and original source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(isDeepStrictEqual(actual, expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class OnboardingTestStorage implements StorageClient {
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
      if (this.failCurrentWrite) throw new Error("Synthetic v4 migration write failure.");
    }
    this.values.set(key, value);
    this.operations.push(`durable:${key}`);
  }

  async removeItem(key: string) {
    this.operations.push(`remove:${key}`);
    if (key === this.failRemovalKey) throw new Error("Synthetic source-key cleanup failure.");
    this.values.delete(key);
  }

  async getAllKeys() { return [...this.values.keys()]; }
}
