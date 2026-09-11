import { isDeepStrictEqual } from "node:util";

import type { OnboardingRecommendation, ResetJourney } from "../src/domain/models";
import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import type { BloomOnboardingAnswers, BloomOnboardingQuizResult } from "../src/domain/onboarding/types";
import {
  acceptProductOnboardingRecommendationState,
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

const recommendations = ["masturbation_tracking", "content_free", "reset", "reset_and_content_free"] as const;
const completedAt = "2026-09-10T09:00:00.000Z";
const acceptedAt = "2026-09-11T10:00:00.000Z";
const now = () => new Date("2026-09-12T10:00:00.000Z");
const v4Key = "bloom.localState.v4";
const v3Key = "bloom.localState.v3";
const v2Key = "bloom.localState.v2";
const v1Key = "bloom.localState.v1";
const legacyKeys = ["onboarding", "activePlan", "tenDayReset", "protection", "pause", "arousalControl", "checkIns", "debug"] as const;
type AcceptanceInput = Parameters<typeof acceptProductOnboardingRecommendationState>[1];

export async function verifyBloomPlanAcceptance() {
  assert(BLOOM_PERSISTENCE_VERSION === 5 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v5", "Plan acceptance must use canonical v5 persistence.");
  equal(BLOOM_LEGACY_STATE_STORAGE_KEYS, [v4Key, v3Key, v2Key, v1Key], "Migration must prefer v4, v3, v2, then v1.");
  verifyRecommendationTransitions();
  const rejectedInputs = verifySafePreconditions();
  await verifyAcceptedRoundTrips();
  await verifyV4Migration();
  await verifyOlderMigrationAndPrecedence();
  await verifyMigrationDurability();
  const malformedMarkers = await verifyMalformedAcceptance();
  await verifyDeletionAndFuturePreservation();
  console.log(`Bloom plan acceptance verification passed (${rejectedInputs} rejected transition cases; ${malformedMarkers} malformed acceptance cases; four plans, histories, idempotency, and v1–v5 migration lifecycle).`);
}

function verifyRecommendationTransitions() {
  equal(createDefaultBloomState().productOnboarding, { status: "notCompleted", result: null }, "Fresh onboarding must not invent completion or acceptance.");
  for (const recommendation of recommendations) {
    for (const base of [createDefaultBloomState(), createInactiveHistoryState()]) {
      const state = withPendingResult(base, recommendation);
      assert(state.productOnboarding.status === "completed" && state.productOnboarding.planAcceptance === null, "Saving a completed quiz must leave acceptance pending.");
      const originalBytes = JSON.stringify(state);
      const resultBytes = JSON.stringify(state.productOnboarding.result);
      const input = inputFor(recommendation);
      const accepted = acceptProductOnboardingRecommendationState(state, input);
      assert(accepted !== state && accepted.productOnboarding.status === "completed", `${recommendation}: valid acceptance must produce a new completed state.`);
      equal(accepted.productOnboarding.planAcceptance, { acceptedAt, recommendation }, `${recommendation}: acceptance must record exactly the stored recommendation and supplied time.`);
      assert(accepted.productOnboarding.result === state.productOnboarding.result && JSON.stringify(accepted.productOnboarding.result) === resultBytes, "Acceptance must preserve the complete historical result and raw answer bytes without rescoring.");
      assert(JSON.stringify(state) === originalBytes, "Acceptance must not mutate its source state.");
      equal(acceptProductOnboardingRecommendationState(state, input), accepted, "Identical source state and explicit inputs must yield deterministic acceptance.");
      for (const key of [...legacyKeys, "urgeControl"] as const) assert(accepted[key] === state[key], `${recommendation}: ${key} must remain untouched by reference.`);
      assert(accepted.masturbationTracking.currentSession === null && accepted.masturbationTracking.sessions === state.masturbationTracking.sessions, "Acceptance must retain session history and create no masturbation session.");
      const activatesContent = recommendation === "content_free" || recommendation === "reset_and_content_free";
      const preparesReset = recommendation === "reset" || recommendation === "reset_and_content_free";
      assert(accepted.masturbationTracking.enabled === (recommendation === "masturbation_tracking"), "Only the tracking recommendation enables tracking at onboarding acceptance.");
      if (activatesContent) {
        equal(accepted.contentFree, { ...state.contentFree, status: "active", activationId: "new-content-activation", activatedAt: acceptedAt, currentStreakStartedAt: acceptedAt }, "Content-Free must activate once with the supplied identity/time and preserve all prior history.");
        assert(accepted.contentFree.pastActivations === state.contentFree.pastActivations && accepted.contentFree.violations === state.contentFree.violations, "Content-Free activation must neither erase history nor create a violation.");
      } else assert(accepted.contentFree === state.contentFree, "Recommendations without Content-Free must preserve its entire existing slice.");
      if (preparesReset) {
        equal(accepted.resetJourney, { ...state.resetJourney, status: "baseline_pending", id: "new-reset-journey" }, "Reset acceptance must preserve progress/history and enter only baseline_pending.");
        for (const key of ["startedAt", "baseline", "currentAttempt", "completedAt", "assessment"]) assert(!(key in accepted.resetJourney), `Reset acceptance must not create ${key} before later lifecycle work.`);
        assert(accepted.resetJourney.pastAttempts === state.resetJourney.pastAttempts && accepted.resetJourney.violations === state.resetJourney.violations, "Reset acceptance must preserve the exact historical arrays.");
      } else assert(accepted.resetJourney === state.resetJourney, "Recommendations without Reset must leave inactive Reset without a new identity.");
      const valid = validateAndNormalizeBloomState(accepted);
      assert(valid.success, `${recommendation}: acceptance must produce structurally valid persistable state: ${valid.success ? "" : valid.error}`);
      for (const repeated of [input, { acceptedAt: "2026-10-01T10:00:00.000Z", contentFreeActivationId: "different-content", resetJourneyId: "different-reset" }, { recommendation: "protect", acceptedAt: "invalid" }, null]) {
        assert(acceptProductOnboardingRecommendationState(accepted, repeated as AcceptanceInput) === accepted, "Every repeat acceptance must be an exact no-op, preserving the first time, identities, and activation count.");
      }
      assert(saveProductOnboardingResultState(accepted, createResult("masturbation_tracking")) === accepted, "Saving another quiz must not erase an accepted historical user action in this phase.");
    }
  }

  const enabled = withPendingResult(createInactiveHistoryState(), "masturbation_tracking");
  enabled.masturbationTracking = { ...enabled.masturbationTracking, enabled: true };
  assert(acceptProductOnboardingRecommendationState(enabled, { acceptedAt }) !== enabled, "Tracking acceptance may retain already-enabled tracking when no session or Reset conflicts exist.");
  for (const recommendation of ["masturbation_tracking", "reset"] as const) {
    const existingContent = withPendingResult(createInactiveHistoryState(), recommendation);
    existingContent.contentFree = createPopulatedState().contentFree;
    const accepted = acceptProductOnboardingRecommendationState(existingContent, inputFor(recommendation));
    assert(accepted !== existingContent && accepted.contentFree === existingContent.contentFree, "An unrelated existing Content-Free activation must remain untouched when the recommendation does not start Content-Free.");
  }
  const equalTime = withPendingResult(createDefaultBloomState(), "masturbation_tracking");
  assert(acceptProductOnboardingRecommendationState(equalTime, { acceptedAt: completedAt }) !== equalTime, "Explicit acceptance may occur at the exact quiz completion timestamp.");
}

function verifySafePreconditions() {
  let count = 0;
  const reject = (state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(acceptProductOnboardingRecommendationState(state, input as AcceptanceInput) === state, `${label}: reject atomically by returning the original state.`);
    assert(JSON.stringify(state) === before, `${label}: a rejected acceptance must not mutate any slice.`);
    count++;
  };
  reject(createDefaultBloomState(), { acceptedAt }, "quiz not completed");
  for (const recommendation of recommendations) {
    const state = withPendingResult(createInactiveHistoryState(), recommendation);
    const input = inputFor(recommendation);
    for (const invalid of [null, [], "accept", {}, { ...input, acceptedAt: "2026-02-30T10:00:00.000Z" }, { ...input, acceptedAt: "2026-09-11" }, { ...input, acceptedAt: "2026-09-11T10:00:00+00:00" }, { ...input, acceptedAt: "2026-09-09T10:00:00.000Z" }, { ...input, recommendation: "reset" }, { ...input, unexpected: true }]) reject(state, invalid, `${recommendation}: invalid or caller-selected input`);
    const malformed = clone(state);
    assert(malformed.productOnboarding.status === "completed", "Completed fixture required.");
    malformed.productOnboarding.result.resetEligible = "yes" as unknown as boolean;
    reject(malformed, input, `${recommendation}: malformed completed result`);
    for (const reset of nonInactiveResetStates()) reject({ ...state, resetJourney: reset }, input, `${recommendation}: existing ${reset.status} Reset`);
    for (const session of [
      { status: "active", id: "ongoing-session", startedAt: completedAt, pauses: [] } as const,
      createPopulatedState().masturbationTracking.currentSession
    ]) {
      assert(session !== null, "Pending session fixture required.");
      reject({ ...state, masturbationTracking: { ...state.masturbationTracking, currentSession: session as NonNullable<BloomLocalState["masturbationTracking"]["currentSession"]> } }, input, `${recommendation}: unfinished masturbation session`);
    }
    if (recommendation !== "masturbation_tracking") reject({ ...state, masturbationTracking: { ...state.masturbationTracking, enabled: true } }, input, `${recommendation}: do not disable existing tracking`);
    if (recommendation === "content_free" || recommendation === "reset_and_content_free") {
      for (const id of [undefined, "", "  ", null, 17]) reject(state, { ...input, contentFreeActivationId: id }, `${recommendation}: invalid or missing Content-Free identity`);
      reject({ ...state, contentFree: createPopulatedState().contentFree }, input, `${recommendation}: active Content-Free must not be replaced`);
      const staleActivation = { ...state, contentFree: { ...state.contentFree, activationId: "stale-activation", activatedAt: completedAt } };
      reject(staleActivation, input, `${recommendation}: malformed inactive Content-Free must not silently discard old activation facts`);
      reject(state, { ...input, contentFreeActivationId: "cf-past" }, `${recommendation}: historical activation ID must not be reused`);
      const overlapping = clone(state);
      overlapping.contentFree.pastActivations[0]!.endedAt = "2026-09-12T10:00:00.000Z";
      reject(overlapping, input, `${recommendation}: new activation must not overlap an old activation interval`);
    }
    if (recommendation === "reset" || recommendation === "reset_and_content_free") {
      for (const id of [undefined, "", "  ", null, 17]) reject(state, { ...input, resetJourneyId: id }, `${recommendation}: invalid or missing Reset identity`);
    }
  }
  const replaceable = withPendingResult(createDefaultBloomState(), "reset");
  const changed = saveProductOnboardingResultState(replaceable, createResult("content_free"));
  assert(changed.productOnboarding.status === "completed" && changed.productOnboarding.planAcceptance === null && changed.productOnboarding.result.recommendation === "content_free", "A result can still be replaced before any acceptance has occurred.");
  const acceptedChanged = acceptProductOnboardingRecommendationState(changed, { acceptedAt, contentFreeActivationId: "latest-recommendation" });
  assert(acceptedChanged.contentFree.status === "active" && acceptedChanged.resetJourney.status === "inactive", "Acceptance must use the currently stored recommendation, without a stale caller-provided choice.");
  return count;
}

async function verifyAcceptedRoundTrips() {
  for (const recommendation of recommendations) {
    const pending = withPendingResult(createInactiveHistoryState(), recommendation);
    const accepted = acceptProductOnboardingRecommendationState(pending, inputFor(recommendation));
    const client = new PlanTestStorage();
    await persistBloomLocalState(accepted, client, now);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "current", `${recommendation}: an accepted v5 result must reload as current.`);
    equal(loaded.state, accepted, `${recommendation}: accepted marker, initial feature states, and every existing slice must survive round trip.`);
    assert(JSON.stringify(loaded.state.productOnboarding.result) === JSON.stringify(accepted.productOnboarding.result), "Loading accepted onboarding must retain raw answer order and historical scoring facts.");
    assert(acceptProductOnboardingRecommendationState(loaded.state, inputFor(recommendation)) === loaded.state, "Idempotency must survive persistence and process reload.");
  }
  const accepted = acceptProductOnboardingRecommendationState(withPendingResult(createDefaultBloomState(), "reset_and_content_free"), inputFor("reset_and_content_free"));
  // A historical acceptance is not a permanent cross-slice invariant: later
  // feature lifecycles can change while the original user action remains true.
  const later = { ...createPopulatedState(), productOnboarding: accepted.productOnboarding };
  const validated = validateAndNormalizeBloomState(later);
  assert(validated.success, "Acceptance validation must not infer current feature states or enforce initial transition conditions on later history.");
  equal(validated.state.productOnboarding, accepted.productOnboarding, "Historical accepted recommendations must remain facts without rescoring or activation repair.");
}

async function verifyV4Migration() {
  const completed = withPendingResult(createPopulatedState(), "reset_and_content_free");
  const pendingV4 = asV4(completed);
  const v4Onboarding = pendingV4.productOnboarding;
  const variants: Array<[string, unknown, BloomLocalState]> = [
    ["completed v4 with active feature history", pendingV4, completed],
    ["notCompleted v4", asV4(createPopulatedState()), createPopulatedState()],
    ["v4 carrying a plausible later acceptance", { ...pendingV4, productOnboarding: { ...v4Onboarding, planAcceptance: { acceptedAt, recommendation: "reset_and_content_free" } } }, completed],
    ["v4 carrying malformed later acceptance", { ...pendingV4, productOnboarding: { ...v4Onboarding, planAcceptance: "do not infer" } }, completed]
  ];
  for (const [label, stored, expected] of variants) {
    const client = new PlanTestStorage();
    client.values.set(v4Key, envelope(4, stored));
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "legacy" && !loaded.needsPersist && loaded.persistenceError === null, `${label}: valid v4 must become durable v5.`);
    equal(loaded.state, expected, `${label}: migration preserves every existing result/feature fact and introduces no inferred acceptance.`);
    if (loaded.state.productOnboarding.status === "completed") assert(loaded.state.productOnboarding.planAcceptance === null, "Active Tracking, Content-Free, and Reset must not imply onboarding acceptance.");
    assert(JSON.stringify(loaded.state.productOnboarding.result) === JSON.stringify(expected.productOnboarding.result), "Migration must retain complete historical results and raw answer bytes.");
    assert(!client.values.has(v4Key) && client.values.has(BLOOM_STATE_STORAGE_KEY), "Successful v4 migration must leave durable v5 and clean its source.");
    equal(client.operations.filter((operation) => operation.startsWith("write:")), [`write:${BLOOM_STATE_STORAGE_KEY}`], "Migration must write directly to v5 without intermediate physical versions.");
  }
}

async function verifyOlderMigrationAndPrecedence() {
  const populated = createPopulatedState();
  const { productOnboarding: _onboarding, ...v3 } = populated;
  const legacy = Object.fromEntries(legacyKeys.map((key) => [key, populated[key]]));
  for (const [key, raw, expected] of [
    [v3Key, envelope(3, v3), populated],
    [v2Key, envelope(2, legacy), { ...createDefaultBloomState(), ...legacy }],
    [v1Key, JSON.stringify(legacy), { ...createDefaultBloomState(), ...legacy }]
  ] as const) {
    const client = new PlanTestStorage();
    client.values.set(key, raw);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "legacy" && !loaded.needsPersist, `${key}: supported older data must migrate directly to v5.`);
    equal(loaded.state, expected, `${key}: older migration must retain its established safe defaults and historical slices.`);
    equal(loaded.state.productOnboarding, { status: "notCompleted", result: null }, "Pre-v4 data must not invent onboarding completion or acceptance.");
  }
  const current = acceptProductOnboardingRecommendationState(withPendingResult(createDefaultBloomState(), "content_free"), inputFor("content_free"));
  const previous = asV4(withPendingResult(createPopulatedState(), "reset"));
  const client = new PlanTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, envelope(5, current));
  client.values.set(v4Key, envelope(4, previous));
  client.values.set(v3Key, envelope(3, v3));
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Present v5 must win over every historical source.");
  equal(loaded.state, current, "Old sources must never erase a persisted acceptance.");
  equal(client.readKeys, [BLOOM_STATE_STORAGE_KEY], "Current data must prevent fallback reads.");
  const oldClient = new PlanTestStorage();
  oldClient.values.set(v4Key, envelope(4, previous));
  oldClient.values.set(v3Key, envelope(3, v3));
  const migrated = await loadBloomLocalState(oldClient, now);
  assert(migrated.status === "success" && migrated.state.productOnboarding.status === "completed", "v4 must take precedence over v3 and retain the new-product result.");
  assert(!oldClient.readKeys.includes(v3Key), "v4 migration must not merge older v3 facts.");
}

async function verifyMigrationDurability() {
  const expected = withPendingResult(createPopulatedState(), "reset_and_content_free");
  const raw = envelope(4, asV4(expected));
  const client = new PlanTestStorage();
  client.values.set(v4Key, raw);
  client.failCurrentWrite = true;
  const failed = await loadBloomLocalState(client, now);
  assert(failed.status === "success" && failed.source === "legacy" && failed.needsPersist && failed.persistenceError !== null, "Failed v5 migration must return preserved usable state with an unacknowledged write.");
  equal(failed.state, expected, "Failed migration must retain the complete original result and every feature slice.");
  assert(client.values.get(v4Key) === raw && !client.values.has(BLOOM_STATE_STORAGE_KEY) && !client.operations.includes(`remove:${v4Key}`), "Failed v5 write must leave v4 bytes untouched and never attempt cleanup.");
  client.failCurrentWrite = false;
  const retried = await loadBloomLocalState(client, now);
  assert(retried.status === "success" && !retried.needsPersist && !client.values.has(v4Key), "Retry must durably migrate and clean the retained source.");
  const heldClient = new PlanTestStorage();
  heldClient.values.set(v4Key, raw);
  const held = heldClient.holdNextCurrentWrite();
  let settled = false;
  const loading = loadBloomLocalState(heldClient, now).then((result) => { settled = true; return result; });
  await held.started;
  assert(!settled && heldClient.values.get(v4Key) === raw && !heldClient.values.has(BLOOM_STATE_STORAGE_KEY), "A pending durable v5 write must retain v4 and keep migration unresolved.");
  assert(!heldClient.operations.includes(`remove:${v4Key}`), "Source cleanup must not run while v5 is pending.");
  held.release();
  await loading;
  assert(heldClient.operations.indexOf(`remove:${v4Key}`) > heldClient.operations.indexOf(`durable:${BLOOM_STATE_STORAGE_KEY}`), "Successful migration must remove v4 strictly after durable v5 acknowledgement.");
  const cleanupClient = new PlanTestStorage();
  cleanupClient.values.set(v4Key, raw);
  cleanupClient.failRemovalKey = v4Key;
  const cleanup = await loadBloomLocalState(cleanupClient, now);
  assert(cleanup.status === "success" && !cleanup.needsPersist && cleanupClient.values.get(v4Key) === raw && cleanupClient.values.has(BLOOM_STATE_STORAGE_KEY), "Failed cleanup must preserve both durable v5 and its original source.");
  const reloaded = await loadBloomLocalState(cleanupClient, now);
  assert(reloaded.status === "success" && reloaded.source === "current", "A leftover v4 source must not override durable v5 after cleanup failure.");
}

async function verifyMalformedAcceptance() {
  const accepted = acceptProductOnboardingRecommendationState(withPendingResult(createDefaultBloomState(), "content_free"), inputFor("content_free"));
  const malformed: Array<[string, unknown]> = [
    ["missing marker", undefined], ["string marker", "accepted"], ["array marker", []],
    ["empty marker", {}], ["missing time", { recommendation: "content_free" }],
    ["missing recommendation", { acceptedAt }],
    ["unknown recommendation", { acceptedAt, recommendation: "protect" }],
    ["mismatching recommendation", { acceptedAt, recommendation: "reset" }],
    ["invalid day", { acceptedAt: "2026-02-30T10:00:00.000Z", recommendation: "content_free" }],
    ["noncanonical time", { acceptedAt: "2026-09-11T10:00:00+00:00", recommendation: "content_free" }],
    ["date-only time", { acceptedAt: "2026-09-11", recommendation: "content_free" }],
    ["nonnumeric time", { acceptedAt: 17, recommendation: "content_free" }],
    ["before quiz completion", { acceptedAt: "2026-09-09T10:00:00.000Z", recommendation: "content_free" }],
    ["extra scoring field", { acceptedAt, recommendation: "content_free", confidence: "high" }]
  ];
  for (const [label, marker] of malformed) {
    const state = clone(accepted) as unknown as { productOnboarding: Record<string, unknown> };
    if (marker === undefined) delete state.productOnboarding.planAcceptance;
    else state.productOnboarding.planAcceptance = marker;
    await assertCorruptPreserved(envelope(5, state), BLOOM_STATE_STORAGE_KEY, label);
  }
  for (const marker of [null, { acceptedAt, recommendation: "content_free" }]) {
    await assertCorruptPreserved(envelope(5, { ...createDefaultBloomState(), productOnboarding: { status: "notCompleted", result: null, planAcceptance: marker } }), BLOOM_STATE_STORAGE_KEY, "notCompleted must not carry acceptance");
  }
  const v4 = asV4(withPendingResult(createDefaultBloomState(), "content_free"));
  await assertCorruptPreserved(envelope(4, { ...v4, productOnboarding: { ...v4.productOnboarding, inventedFact: true } }), v4Key, "v4 must still validate its original onboarding shape");
  return malformed.length + 3;
}

async function verifyDeletionAndFuturePreservation() {
  const client = new PlanTestStorage();
  const keys = [BLOOM_STATE_STORAGE_KEY, v4Key, v3Key, v2Key, v1Key, `${BLOOM_CORRUPT_BACKUP_PREFIX}old`, `${BLOOM_CORRUPT_BACKUP_PREFIX}current`];
  for (const key of keys) client.values.set(key, "remove");
  client.values.set("unrelated", "retain");
  await createBloomStatePersistenceCoordinator(client, now).deleteAll();
  equal([...client.values.entries()], [["unrelated", "retain"]], "Delete-all must remove v1–v5 and all Bloom corrupt backups while retaining unrelated data.");
  assert(client.operations[client.operations.length - 1] === `remove:${BLOOM_STATE_STORAGE_KEY}`, "Delete-all must preserve current-key-last lifecycle ordering.");
  for (const key of [BLOOM_STATE_STORAGE_KEY, v4Key, v3Key, v2Key, v1Key]) {
    const futureClient = new PlanTestStorage();
    const raw = envelope(99, { productOnboarding: "future historical fact" });
    futureClient.values.set(key, raw);
    if (key !== v1Key) futureClient.values.set(v1Key, JSON.stringify(createDefaultBloomState()));
    const future = await loadBloomLocalState(futureClient, now);
    assert(future.status === "unsupported-version" && future.version === 99 && future.sourceKey === key, "Future envelope versions must remain unsupported without older-key fallback.");
    assert(futureClient.values.get(key) === raw, "Unsupported future source bytes must remain intact.");
    assertBackup(futureClient, future.backupKey, raw, key);
  }
}

function createResult(recommendation: OnboardingRecommendation): BloomOnboardingQuizResult {
  const result = scoreBloomOnboarding({
    explicitContentFrequency: "dailyOrMore", unplannedContentUse: "almostAlways", activityInterruption: "often",
    contentTriggeredMasturbation: "almostAlways", repeatedContentReturn: "often", difficultyReducingContent: "often",
    erectionQuality: 2, erectionMaintenanceDifficulty: "almostAlways", masturbationTechniques: ["other", "normalHandTechnique", "veryTightPressure"],
    techniqueDependency: "almostAlways", delayedOrDifficultEjaculation: "often", safetySignals: ["unsure", "pain"]
  }, completedAt);
  // A historical recommendation may differ from today's algorithm; acceptance
  // must follow the stored fact and retain raw object/selection ordering.
  result.recommendation = recommendation;
  result.answers = Object.fromEntries(Object.entries(result.answers).reverse()) as BloomOnboardingAnswers;
  return result;
}

function withPendingResult(state: BloomLocalState, recommendation: OnboardingRecommendation) {
  return saveProductOnboardingResultState(state, createResult(recommendation));
}

function inputFor(recommendation: OnboardingRecommendation): AcceptanceInput {
  return {
    acceptedAt,
    ...(recommendation === "content_free" || recommendation === "reset_and_content_free" ? { contentFreeActivationId: "new-content-activation" } : {}),
    ...(recommendation === "reset" || recommendation === "reset_and_content_free" ? { resetJourneyId: "new-reset-journey" } : {})
  };
}

function createInactiveHistoryState(): BloomLocalState {
  const state = createPopulatedState();
  assert(state.contentFree.status === "active" && state.resetJourney.status === "completed", "Populated history fixture required.");
  state.masturbationTracking = { ...state.masturbationTracking, enabled: false, currentSession: null };
  state.contentFree = {
    status: "inactive", bestStreakSeconds: state.contentFree.bestStreakSeconds,
    pastActivations: [...state.contentFree.pastActivations, { id: state.contentFree.activationId, startedAt: state.contentFree.activatedAt, endedAt: "2026-02-20T10:00:00.000Z" }],
    violations: state.contentFree.violations
  };
  state.resetJourney = {
    status: "inactive", durationDays: 15, bestCompletedDays: state.resetJourney.bestCompletedDays,
    pastAttempts: [...state.resetJourney.pastAttempts, state.resetJourney.currentAttempt], violations: state.resetJourney.violations
  };
  return state;
}

function nonInactiveResetStates(): ResetJourney[] {
  const populated = createPopulatedState().resetJourney;
  assert(populated.status === "completed", "Completed Reset fixture required.");
  const { assessment: _assessment, ...assessmentPending } = populated;
  const { completedAt: _completedAt, currentAttempt: _currentAttempt, ...started } = assessmentPending;
  return [
    { status: "recommended", id: "existing-reset", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] },
    { status: "baseline_pending", id: "existing-reset", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] },
    { ...started, status: "active", currentAttempt: { id: "attempt-current", status: "active", startedAt: "2026-02-03T10:10:00.000Z", completedDays: 1 } },
    { ...assessmentPending, status: "assessment_pending" }, populated
  ];
}

function asV4(state: BloomLocalState) {
  const onboarding = state.productOnboarding;
  return { ...state, productOnboarding: onboarding.status === "completed" ? { status: "completed" as const, result: onboarding.result } : onboarding };
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function envelope(version: number, state: unknown) { return JSON.stringify({ version, savedAt: now().toISOString(), state }); }

async function assertCorruptPreserved(raw: string, key: string, label: string) {
  const client = new PlanTestStorage();
  client.values.set(key, raw);
  client.values.set(v1Key, JSON.stringify(createDefaultBloomState()));
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "corrupt" && loaded.sourceKey === key, `${label}: malformed acceptance must follow corruption handling instead of normalization or fallback.`);
  assert(client.values.get(key) === raw && !client.readKeys.includes(v1Key), `${label}: original bytes must remain untouched without older-key fallback.`);
  assertBackup(client, loaded.backupKey, raw, key);
}

function assertBackup(client: PlanTestStorage, key: string | null, raw: string, sourceKey: string) {
  assert(key !== null && key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt/future data must receive a scoped backup.");
  const backup = client.values.get(key);
  assert(backup !== undefined, "Backup must be durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === sourceKey, "Backup must preserve exact source bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }

function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class PlanTestStorage implements StorageClient {
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

  async getItem(key: string) { this.readKeys.push(key); return this.values.get(key) ?? null; }

  async setItem(key: string, value: string) {
    this.operations.push(`write:${key}`);
    if (key === BLOOM_STATE_STORAGE_KEY) {
      const held = this.heldWrite;
      this.heldWrite = null;
      if (held !== null) { held.started(); await held.wait; }
      if (this.failCurrentWrite) throw new Error("Synthetic v5 migration write failure.");
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
