import { isDeepStrictEqual } from "node:util";

import type { PostResetAssessment, ResetJourney } from "../src/domain/models";
import { getResetRestrictionStatus } from "../src/domain/productPolicy/getResetRestrictionStatus";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import {
  completeElapsedResetPeriodState, createDefaultBloomState, disableMasturbationTrackingState,
  recordActiveResetViolationState, undoActiveResetViolationState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, BLOOM_CORRUPT_BACKUP_PREFIX, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState, createInput } from "./verify-bloom-reset-violations";

const periodMilliseconds = 15 * 24 * 60 * 60 * 1000;
const now = () => new Date("2026-10-30T12:00:00.000Z");
type PeriodInput = Parameters<typeof completeElapsedResetPeriodState>[1];

export async function verifyBloomResetCompletion() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "New transitions writing established finished Reset shapes must keep persistence v7 and its key.");
  await verifyElapsedCompletion();
  await verifyLegacyHydration();
  verifyEveryHistoricalAssessmentAnswer();
  const rejectedPeriods = verifyRejectedPeriodTransitions();
  await verifyNoAutomaticAdvancement();
  verifyViolationAndUndoBoundaries();
  await verifyHistoricalCompletionCompatibility();
  const corruptCases = await verifyMalformedFinishedStates();
  console.log(`Bloom Reset completion verification passed (${rejectedPeriods} rejected period transitions; ${corruptCases} corrupt finished-state cases; canonical elapsed boundaries, preserved Tracking preferences, legacy normalization/writeback, historical assessment validation, and v7 round trips).`);
}

async function verifyElapsedCompletion() {
  for (const retainedHistory of [false, true]) for (const enabled of [false, true]) {
    const active = createCompletionFixture(retainedHistory);
    active.masturbationTracking.enabled = enabled;
    assert(active.resetJourney.status === "active", "Active completion fixture required.");
    const sourceReset = active.resetJourney;
    const completedAt = boundaryOf(sourceReset);
    const justBefore = addMilliseconds(completedAt, -1);
    assert(completeElapsedResetPeriodState(active, { observedAt: justBefore }) === active && getResetRestrictionStatus(sourceReset, justBefore)?.isRestrictionActive === true, "The last millisecond remains restricted and cannot complete.");
    for (const observedAt of [completedAt, addMilliseconds(completedAt, 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)]) {
      const before = JSON.stringify(active);
      const withoutAssessment = completeElapsedResetPeriodState(active, { observedAt });
      assert(withoutAssessment !== active && withoutAssessment.resetJourney.status === "completed", "A complete elapsed period must transition active Reset to completed.");
      equal(withoutAssessment.resetJourney, {
        ...sourceReset, status: "completed", bestCompletedDays: 15, completedAt,
        currentAttempt: { ...sourceReset.currentAttempt, status: "completed", completedAt, completedDays: 15 }
      }, "Completion must preserve original journey/baseline/history and finish the same current attempt at its exact elapsed boundary.");
      assert(withoutAssessment.resetJourney.completedAt === completedAt && withoutAssessment.resetJourney.currentAttempt.completedAt === completedAt, "Late observations must never move the actual behavioral restriction end to the next app open.");
      assert(withoutAssessment.resetJourney.currentAttempt.id === sourceReset.currentAttempt.id && withoutAssessment.resetJourney.currentAttempt.startedAt === sourceReset.currentAttempt.startedAt, "The final completed attempt must retain its original identity/start.");
      assert(withoutAssessment.resetJourney.pastAttempts === sourceReset.pastAttempts && withoutAssessment.resetJourney.violations === sourceReset.violations, "Completion must keep prior attempts and recorded/undone tombstones intact without appending the final current attempt to history.");
      assert(!("assessment" in withoutAssessment.resetJourney), "Elapsed completion must not invent assessment answers.");
      assert(withoutAssessment.masturbationTracking.enabled === enabled && withoutAssessment.masturbationTracking.currentSession === null, "Reset completion must preserve enabled and disabled Tracking preferences and must not create a session.");
      assert(getResetRestrictionStatus(active.resetJourney, observedAt)?.isRestrictionActive === false && getResetRestrictionStatus(withoutAssessment.resetJourney, observedAt)?.isRestrictionActive === false, "Restriction must already be inactive at the boundary and stay inactive after durable completion.");
      assertOtherReferencesUnchanged(active, withoutAssessment, ["resetJourney"], "elapsed completion");
      assert(JSON.stringify(active) === before, "Elapsed completion must not mutate the active source state.");
      equal(completeElapsedResetPeriodState(active, { observedAt }), withoutAssessment, "Elapsed completion must be deterministic from the explicit observation time.");
      for (const repeated of [{ observedAt }, { observedAt: now().toISOString() }, null]) {
        assert(completeElapsedResetPeriodState(withoutAssessment, repeated as PeriodInput) === withoutAssessment, "A second period completion must preserve the first completedAt and return the exact completed state.");
      }
      const validated = validateAndNormalizeBloomState(withoutAssessment);
      assert(validated.success, `Produced completed state must validate: ${validated.success ? "" : validated.error}`);
      await assertRoundTrip(withoutAssessment, "completed");
    }
    if (retainedHistory) {
      assert(sourceReset.startedAt !== sourceReset.currentAttempt.startedAt, "Restart fixture must distinguish overall journey and current attempt start.");
      assert(sourceReset.violations.some((violation) => violation.status === "undone") && sourceReset.violations.some((violation) => violation.status === "recorded"), "History fixture must exercise both recorded violations and undone tombstones.");
      const originalJourneyBoundary = addMilliseconds(sourceReset.startedAt, periodMilliseconds);
      assert(completeElapsedResetPeriodState(active, { observedAt: originalJourneyBoundary }) === active, "The older overall journey start must not prematurely complete a restarted current attempt.");
    }
  }
  const fractional = createCompletionFixture(false);
  assert(fractional.resetJourney.status === "active", "Active fixture required.");
  fractional.resetJourney.currentAttempt.startedAt = "2026-09-01T12:00:00.123Z";
  const fractionBoundary = boundaryOf(fractional.resetJourney);
  assert(completeElapsedResetPeriodState(fractional, { observedAt: addMilliseconds(fractionBoundary, -1) }) === fractional, "Completion must not round the final millisecond up to a full period.");
  const fractionComplete = completeElapsedResetPeriodState(fractional, { observedAt: fractionBoundary });
  assert(fractionComplete.resetJourney.status === "completed" && fractionComplete.resetJourney.completedAt === "2026-09-16T12:00:00.123Z", "Exact elapsed completion must preserve millisecond precision.");
  const manuallyEnabled = createCompletionFixture(false);
  manuallyEnabled.masturbationTracking.enabled = true;
  const manuallyDisabled = disableMasturbationTrackingState(manuallyEnabled);
  const afterDisable = makeCompleted(manuallyDisabled);
  assert(!afterDisable.masturbationTracking.enabled && afterDisable.masturbationTracking === manuallyDisabled.masturbationTracking, "An explicit manual disable during Reset must survive elapsed completion unchanged.");
  const unexpectedSession = createCompletionFixture(false);
  unexpectedSession.masturbationTracking = createPopulatedState().masturbationTracking;
  assert(unexpectedSession.resetJourney.status === "active", "Active fixture required.");
  const withoutAssessment = completeElapsedResetPeriodState(unexpectedSession, { observedAt: boundaryOf(unexpectedSession.resetJourney) });
  assert(withoutAssessment !== unexpectedSession && withoutAssessment.masturbationTracking === unexpectedSession.masturbationTracking, "Period completion must not add unrelated tracking preconditions or alter an existing session.");
}

async function verifyLegacyHydration() {
  for (const enabled of [false, true]) {
    const finished = makeCompleted(createCompletionFixture(true));
    finished.masturbationTracking.enabled = enabled;
    const canonical = validateAndNormalizeBloomState(finished);
    assert(canonical.success && canonical.state.resetJourney.status === "completed", "Canonical completion fixture required.");
    const expected = canonical.state;
    const legacy = { ...expected, resetJourney: { ...expected.resetJourney, status: "assessment_pending" } };
    const original = JSON.stringify(legacy);
    const validated = validateAndNormalizeBloomState(legacy);
    assert(validated.success && validated.wasNormalized, "Valid v7 assessment_pending must normalize and mark existing normalization writeback.");
    equal(validated.state, expected, "Legacy normalization must change only Reset status, preserving every completion fact and unrelated slice.");
    assert(JSON.stringify(legacy) === original, "Normalization must not mutate its legacy input.");
    const client = new CompletionTestStorage();
    const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state: legacy });
    client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "current" && loaded.needsPersist && loaded.persistenceError === null, "Legacy v7 hydration must use current-key normalization writeback without a version migration.");
    equal(loaded.state, expected, "Hydration must preserve exact history, baseline, times, Content-Free, Tracking, and legacy product facts.");
    assert(loaded.state.resetJourney.status === "completed" && !("assessment" in loaded.state.resetJourney), "Normalizing the retired lifecycle must not fabricate assessment metadata.");
    for (const key of Object.keys(expected) as Array<keyof BloomLocalState>) {
      if (key !== "resetJourney") assert(JSON.stringify(loaded.state[key]) === JSON.stringify(expected[key]), `${key}: canonical unrelated slices must remain byte-for-byte semantically unchanged.`);
    }
    assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, "Hydration must leave the raw payload available until existing writeback persists normalization.");
    await persistBloomLocalState(loaded.state, client, now);
    const reloaded = await loadBloomLocalState(client, now);
    assert(reloaded.status === "success" && !reloaded.needsPersist, "Persisted normalized v7 completion must reload stably without repeating normalization.");
    equal(reloaded.state, expected, "Normalization writeback must retain all user facts.");
    const durable = client.values.get(BLOOM_STATE_STORAGE_KEY);
    assert(durable !== undefined && (JSON.parse(durable) as { version: unknown }).version === 7 && !durable.includes('"assessment_pending"'), "Existing writeback must replace the retired status under v7, without a new key.");

    for (const readiness of ["ready", "notReady", "notSure"] as const) {
      assert(expected.resetJourney.status === "completed", "Historical fixture requires finished facts.");
      const historical = { ...expected, resetJourney: { ...expected.resetJourney, assessment: createHistoricalAssessment(expected, readiness, addMilliseconds(expected.resetJourney.completedAt, 86400000)) } };
      await assertRoundTrip(historical, "completed");
    }
  }
}

function verifyEveryHistoricalAssessmentAnswer() {
  const withoutAssessment = makeCompleted(createCompletionFixture(false));
  const urge = ["decreased", "same", "increased", "notSure", "preferNotToSay"] as const;
  const pause = ["harder", "same", "easier", "notSure", "preferNotToSay"] as const;
  const erection = ["lessFrequent", "same", "moreFrequent", "notSure", "preferNotToSay"] as const;
  const response = ["worse", "same", "better", "notSure", "preferNotToSay"] as const;
  for (let index = 0; index < 5; index++) {
    for (const readiness of ["ready", "notReady", "notSure"] as const) {
      const assessment: PostResetAssessment = {
        ...createHistoricalAssessment(withoutAssessment, readiness), urgeIntensityChange: urge[index]!, abilityToPauseChange: pause[index]!,
        spontaneousErectionChange: erection[index]!, overallSexualResponseChange: response[index]!
      };
      assert(withoutAssessment.resetJourney.status === "completed", "Completed historical fixture required.");
      const historical = { ...withoutAssessment, resetJourney: { ...withoutAssessment.resetJourney, assessment } };
      const validated = validateAndNormalizeBloomState(historical);
      assert(validated.success && validated.state.resetJourney.status === "completed", "Every existing descriptive answer, including uncertainty and nonresponse, must remain valid historical metadata.");
      equal(validated.state.resetJourney.assessment, assessment, "Historical assessment answers must not be converted into scores, permission, or inferred conclusions.");
      equal(validated.state.masturbationTracking, withoutAssessment.masturbationTracking, "Historical readiness must not change the Tracking preference.");
    }
  }
}

function verifyRejectedPeriodTransitions() {
  let count = 0;
  const reject = (state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(completeElapsedResetPeriodState(state, input as PeriodInput) === state, `${label}: invalid elapsed completion must return the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: rejected elapsed completion must not leave partial finished-attempt facts.`);
    count++;
  };
  const active = createCompletionFixture(true);
  assert(active.resetJourney.status === "active", "Active fixture required.");
  const boundary = boundaryOf(active.resetJourney);
  for (const input of [null, [], "complete", {}, { observedAt: boundary, unexpected: true }]) reject(active, input, "malformed completion input");
  for (const observedAt of [null, 17, "", "2026-02-30T12:00:00.000Z", "2026-09-23", "2026-09-23T12:00:00+00:00", addMilliseconds(active.resetJourney.currentAttempt.startedAt, -1), active.resetJourney.currentAttempt.startedAt, addMilliseconds(boundary, -1)]) {
    reject(active, { observedAt }, "invalid, future-skewed, or incomplete elapsed observation");
  }
  for (const state of nonActiveStates()) reject(state, { observedAt: now().toISOString() }, `wrong lifecycle ${state.resetJourney.status}`);
  for (const [path, value] of [
    ["resetJourney.id", ""], ["resetJourney.durationDays", 14], ["resetJourney.currentAttempt.completedDays", 14],
    ["resetJourney.currentAttempt.startedAt", "2026-02-30T12:00:00.000Z"], ["resetJourney.baseline.id", ""],
    ["resetJourney.completedAt", boundary], ["resetJourney.assessment", {}]
  ] as const) {
    const malformed = clone(active);
    replaceAtPath(malformed, path, value, false);
    reject(malformed, { observedAt: now().toISOString() }, `malformed active source ${path}`);
  }
  return count;
}

async function verifyNoAutomaticAdvancement() {
  const active = createCompletionFixture(true);
  const before = JSON.stringify(active);
  assert(active.resetJourney.status === "active" && getResetProgress(active.resetJourney, now().toISOString())?.isPeriodComplete === true, "Late-observation fixture must already have 15 elapsed days.");
  const validated = validateAndNormalizeBloomState(active);
  assert(validated.success && validated.state.resetJourney.status === "active", "Validation must not advance lifecycle merely because elapsed time is complete.");
  const client = new CompletionTestStorage();
  await persistBloomLocalState(active, client, now);
  const raw = client.values.get(BLOOM_STATE_STORAGE_KEY);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.state.resetJourney.status === "active", "Loading long after 15 days must retain active state until an explicit completion call.");
  equal(loaded.state, active, "Persistence must not infer assessment answers, enable tracking, or rewrite the elapsed active snapshot.");
  assert(JSON.stringify(active) === before && client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, "Selectors, validation, and loading must not mutate persisted or in-memory active facts.");
  const withoutAssessment = completeElapsedResetPeriodState(loaded.state, { observedAt: now().toISOString() });
  await persistBloomLocalState(withoutAssessment, client, now);
  const completedReload = await loadBloomLocalState(client, now);
  assert(completedReload.status === "success" && completedReload.state.resetJourney.status === "completed" && !completedReload.state.masturbationTracking.enabled, "Reloading direct completion must preserve disabled Tracking.");
}

function verifyViolationAndUndoBoundaries() {
  const active = createCompletionFixture(true);
  assert(active.resetJourney.status === "active", "Active history fixture required.");
  const boundary = boundaryOf(active.resetJourney);
  for (const time of [boundary, addMilliseconds(boundary, 86400000)]) {
    for (const reason of ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
      const input = { ...createInput(reason, { kind: "manual", logActionId: "after-period-event" }), violationId: "after-period-violation", replacementAttemptId: "after-period-attempt", contentFreeViolationId: "after-period-content", occurredAt: time, recordedAt: time };
      assert(recordActiveResetViolationState(active, input) === active, "A violation at or after the completed period must never start another 15-day restriction before explicit lifecycle advancement.");
      const finished = completeElapsedResetPeriodState(active, { observedAt: time });
      assert(recordActiveResetViolationState(finished, input) === finished, "Finished Reset must not accept a restart violation.");
      for (const violation of finished.resetJourney.violations) {
        assert(undoActiveResetViolationState(finished, { violationId: violation.id, undoneAt: now().toISOString() }) === finished, "Neither recorded history nor undone tombstones may roll back a non-active completed Reset or its final best progress.");
      }
    }
  }
}

async function verifyHistoricalCompletionCompatibility() {
  const withoutAssessment = makeCompleted(createCompletionFixture(false));
  assert(withoutAssessment.resetJourney.status === "completed", "Completed fixture required.");
  const historicalEnd = addMilliseconds(withoutAssessment.resetJourney.completedAt, 3600000);
  const historical: BloomLocalState = {
    ...withoutAssessment,
    resetJourney: { ...withoutAssessment.resetJourney, completedAt: historicalEnd, currentAttempt: { ...withoutAssessment.resetJourney.currentAttempt, completedAt: historicalEnd } }
  };
  assert(validateAndNormalizeBloomState(historical).success, "Practical historical validation must retain a temporally ordered noncanonical arithmetic completion time rather than rewriting past user facts.");
  assert(historical.resetJourney.status === "completed", "Historical completion fixture required.");
  const completed: BloomLocalState = { ...historical, resetJourney: { ...historical.resetJourney, assessment: createHistoricalAssessment(historical, "notSure", historicalEnd) } };
  await assertRoundTrip(completed, "completed");
  const legacy = { ...historical, resetJourney: { ...historical.resetJourney, status: "assessment_pending" } };
  const normalized = validateAndNormalizeBloomState(legacy);
  assert(normalized.success && normalized.state.resetJourney.status === "completed" && normalized.state.resetJourney.completedAt === historicalEnd, "Legacy normalization must preserve authoritative historical completion facts rather than recalculate their timestamps.");
}

async function verifyMalformedFinishedStates() {
  const withoutAssessment = makeCompleted(createCompletionFixture(true));
  const assessment = createHistoricalAssessment(withoutAssessment, "ready");
  assert(withoutAssessment.resetJourney.status === "completed", "Completed fixture required.");
  const completed: BloomLocalState = { ...withoutAssessment, resetJourney: { ...withoutAssessment.resetJourney, assessment } };
  const legacy = { ...withoutAssessment, resetJourney: { ...withoutAssessment.resetJourney, status: "assessment_pending" } };
  const cases: Array<[string, unknown, string, unknown, boolean?]> = [
    ["missing journey identity", withoutAssessment, "resetJourney.id", undefined, true], ["missing journey start", withoutAssessment, "resetJourney.startedAt", undefined, true],
    ["missing baseline", withoutAssessment, "resetJourney.baseline", undefined, true], ["missing completion time", withoutAssessment, "resetJourney.completedAt", undefined, true],
    ["invalid period completion timestamp", withoutAssessment, "resetJourney.completedAt", "2026-02-30T12:00:00.000Z"],
    ["wrong final best", withoutAssessment, "resetJourney.bestCompletedDays", 14], ["wrong final attempt status", withoutAssessment, "resetJourney.currentAttempt.status", "active"],
    ["wrong final completed days", withoutAssessment, "resetJourney.currentAttempt.completedDays", 14], ["missing final count", withoutAssessment, "resetJourney.currentAttempt.completedDays", undefined, true],
    ["inconsistent completion timestamps", withoutAssessment, "resetJourney.currentAttempt.completedAt", addMilliseconds(withoutAssessment.resetJourney.completedAt, 1)],
    ["malformed present assessment", completed, "resetJourney.assessment", null],
    ["legacy pending carrying assessment", legacy, "resetJourney.assessment", assessment],
    ["legacy pending missing completion", legacy, "resetJourney.completedAt", undefined, true],
    ["legacy pending wrong attempt", legacy, "resetJourney.currentAttempt.status", "active"],
    ["legacy pending wrong best", legacy, "resetJourney.bestCompletedDays", 14],
    ["legacy pending mismatched completion", legacy, "resetJourney.currentAttempt.completedAt", addMilliseconds(withoutAssessment.resetJourney.completedAt, 1)],
    ["mismatching assessment journey", completed, "resetJourney.assessment.resetJourneyId", "other-journey"],
    ["mismatching assessment attempt", completed, "resetJourney.assessment.resetAttemptId", "other-attempt"],
    ["mismatching assessment baseline", completed, "resetJourney.assessment.baselineId", "other-baseline"],
    ["invalid assessment time", completed, "resetJourney.assessment.completedAt", "2026-02-30T12:00:00.000Z"],
    ["assessment before period end", completed, "resetJourney.assessment.completedAt", addMilliseconds(withoutAssessment.resetJourney.completedAt, -1)],
    ["invalid descriptive assessment answer", completed, "resetJourney.assessment.overallSexualResponseChange", "recovered"],
    ["invalid readiness", completed, "resetJourney.assessment.readinessToRestartTracking", "permissionGranted"]
  ];
  for (const key of Object.keys(assessment)) {
    cases.push([`historical assessment missing ${key}`, completed, `resetJourney.assessment.${key}`, undefined, true]);
  }
  for (const key of ["id", "resetJourneyId", "resetAttemptId", "baselineId"]) {
    for (const value of ["", " ", 17, null]) cases.push([`invalid historical identity ${key}`, completed, `resetJourney.assessment.${key}`, value]);
  }
  for (const key of ["urgeIntensityChange", "abilityToPauseChange", "spontaneousErectionChange", "overallSexualResponseChange", "readinessToRestartTracking"]) {
    for (const value of ["medicalConclusion", null, 1]) cases.push([`invalid historical answer ${key}`, completed, `resetJourney.assessment.${key}`, value]);
  }
  for (const [label, state, path, value, remove] of cases) {
    const malformed = clone(state);
    replaceAtPath(malformed, path, value, remove === true);
    await assertCorruptPreserved(malformed, label);
  }
  const beforeAttempt = clone(withoutAssessment);
  assert(beforeAttempt.resetJourney.status === "completed", "Completed fixture required.");
  const invalidEnd = addMilliseconds(beforeAttempt.resetJourney.currentAttempt.startedAt, -1);
  beforeAttempt.resetJourney.completedAt = invalidEnd;
  beforeAttempt.resetJourney.currentAttempt.completedAt = invalidEnd;
  await assertCorruptPreserved(beforeAttempt, "finished period cannot end before its final attempt starts");
  return cases.length + 1;
}

function createCompletionFixture(retainedHistory: boolean): BloomLocalState {
  const active = createActiveState(retainedHistory, true);
  if (!retainedHistory) return active;
  const mistakenInput = {
    ...createInput("masturbationWithExplicitContent", { kind: "manual", logActionId: "completion-fixture-mistake" }),
    violationId: "completion-undone-violation", replacementAttemptId: "completion-undone-attempt", contentFreeViolationId: "completion-undone-content",
    occurredAt: "2026-09-03T12:00:00.000Z", recordedAt: "2026-09-03T12:01:00.000Z"
  };
  const mistaken = recordActiveResetViolationState(active, mistakenInput);
  const restored = undoActiveResetViolationState(mistaken, { violationId: mistakenInput.violationId, undoneAt: "2026-09-03T12:02:00.000Z" });
  assert(restored !== mistaken, "Tombstone completion fixture must successfully undo the mistaken event.");
  const restarted = recordActiveResetViolationState(restored, {
    ...createInput("intentionalExplicitContent", { kind: "manual", logActionId: "completion-fixture-effective-event" }),
    violationId: "completion-effective-violation", replacementAttemptId: "completion-current-attempt", contentFreeViolationId: "completion-effective-content",
    occurredAt: "2026-09-08T12:00:00.000Z", recordedAt: "2026-09-08T12:01:00.000Z"
  });
  assert(restarted !== restored && restarted.resetJourney.status === "active", "Completion fixture must carry a real current restart and preserved earlier tombstone.");
  return restarted;
}

function makeCompleted(active: BloomLocalState): BloomLocalState {
  assert(active.resetJourney.status === "active", "Completion builder requires active Reset.");
  const withoutAssessment = completeElapsedResetPeriodState(active, { observedAt: addMilliseconds(boundaryOf(active.resetJourney), 2 * 86400000) });
  assert(withoutAssessment.resetJourney.status === "completed", "Completion builder must finish the actual elapsed period.");
  return withoutAssessment;
}

function createHistoricalAssessment(state: BloomLocalState, readiness: PostResetAssessment["readinessToRestartTracking"], submittedAt?: string): PostResetAssessment {
  const reset = state.resetJourney;
  assert(reset.status === "completed", "Historical assessment fixture requires completed Reset.");
  return {
    id: "submitted-post-reset-assessment", resetJourneyId: reset.id, resetAttemptId: reset.currentAttempt.id, baselineId: reset.baseline.id,
    completedAt: submittedAt ?? reset.completedAt, urgeIntensityChange: "decreased", abilityToPauseChange: "easier",
    spontaneousErectionChange: "notSure", overallSexualResponseChange: "preferNotToSay", readinessToRestartTracking: readiness
  };
}

function nonActiveStates(): BloomLocalState[] {
  const defaults = createDefaultBloomState();
  const withoutAssessment = makeCompleted(createCompletionFixture(false));
  return [
    defaults,
    { ...defaults, resetJourney: { status: "recommended", id: "recommended", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } },
    { ...defaults, resetJourney: { status: "baseline_pending", id: "baseline-pending", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } },
    withoutAssessment,
    createPopulatedState()
  ];
}

function boundaryOf(reset: Extract<ResetJourney, { status: "active" }>): string { return addMilliseconds(reset.currentAttempt.startedAt, periodMilliseconds); }
function addMilliseconds(time: string, delta: number): string { return new Date(Date.parse(time) + delta).toISOString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function assertOtherReferencesUnchanged(before: BloomLocalState, after: BloomLocalState, allowed: readonly (keyof BloomLocalState)[], label: string) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (!allowed.includes(key)) assert(after[key] === before[key], `${label}: ${key} must remain unchanged by reference, including Content-Free, onboarding acceptance, Urge Control, Protect, and legacy state.`);
  }
}

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const keys = path.split(".");
  const final = keys.pop();
  assert(final !== undefined, "Fixture mutation requires a field name.");
  let parent = root as Record<string, unknown>;
  for (const key of keys) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[final];
  else parent[final] = value;
}

async function assertRoundTrip(state: BloomLocalState, status: "completed") {
  const client = new CompletionTestStorage();
  await persistBloomLocalState(state, client, now);
  const payload = client.values.get(BLOOM_STATE_STORAGE_KEY);
  assert(payload !== undefined && (JSON.parse(payload) as { version: unknown }).version === 7, "Finished states must persist under unchanged v7 storage.");
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current" && loaded.state.resetJourney.status === status, `${status}: valid persisted lifecycle must reload without automatic advancement.`);
  equal(loaded.state, state, `${status}: complete Reset history, independent Content-Free, tracking state, and legacy facts must survive save/load unchanged.`);
}

async function assertCorruptPreserved(state: unknown, label: string) {
  assert(!validateAndNormalizeBloomState(state).success, `${label}: contradictory finished facts must fail direct validation rather than be repaired.`);
  const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state });
  const client = new CompletionTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
  const result = await loadBloomLocalState(client, now);
  assert(result.status === "corrupt" && result.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: malformed finished facts must follow existing corruption handling.`);
  assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${label}: original corrupt payload bytes must remain untouched.`);
  assert(result.backupKey !== null && result.backupKey.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt finished states must receive a scoped backup.");
  const backup = client.values.get(result.backupKey);
  assert(backup !== undefined, "Corrupt backup must become durable.");
  const parsed = JSON.parse(backup) as { sourceKey?: unknown; rawPayload?: unknown };
  assert(parsed.sourceKey === BLOOM_STATE_STORAGE_KEY && parsed.rawPayload === raw, "Backup must retain exact payload bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class CompletionTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
