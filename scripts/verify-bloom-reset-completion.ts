import { isDeepStrictEqual } from "node:util";

import type { PostResetAssessment, ResetJourney } from "../src/domain/models";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import {
  completeElapsedResetPeriodState, completePostResetAssessmentState, createDefaultBloomState,
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
  await verifyAssessmentCompletion();
  verifyEveryAssessmentAnswer();
  const rejectedPeriods = verifyRejectedPeriodTransitions();
  const rejectedAssessments = verifyRejectedAssessments();
  await verifyNoAutomaticAdvancement();
  verifyViolationAndUndoBoundaries();
  verifyHistoricalCompletionCompatibility();
  const corruptCases = await verifyMalformedFinishedStates();
  console.log(`Bloom Reset completion verification passed (${rejectedPeriods} rejected period transitions; ${rejectedAssessments} rejected assessments; ${corruptCases} corrupt finished-state cases; canonical elapsed boundaries, all readiness values, and v7 round trips).`);
}

async function verifyElapsedCompletion() {
  for (const retainedHistory of [false, true]) {
    const active = createCompletionFixture(retainedHistory);
    assert(active.resetJourney.status === "active", "Active completion fixture required.");
    const sourceReset = active.resetJourney;
    const completedAt = boundaryOf(sourceReset);
    for (const observedAt of [completedAt, addMilliseconds(completedAt, 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)]) {
      const before = JSON.stringify(active);
      const pending = completeElapsedResetPeriodState(active, { observedAt });
      assert(pending !== active && pending.resetJourney.status === "assessment_pending", "A complete elapsed period must transition active Reset to assessment_pending.");
      equal(pending.resetJourney, {
        ...sourceReset, status: "assessment_pending", bestCompletedDays: 15, completedAt,
        currentAttempt: { ...sourceReset.currentAttempt, status: "completed", completedAt, completedDays: 15 }
      }, "Completion must preserve original journey/baseline/history and finish the same current attempt at its exact elapsed boundary.");
      assert(pending.resetJourney.completedAt === completedAt && pending.resetJourney.currentAttempt.completedAt === completedAt, "Late observations must never move the actual behavioral restriction end to the next app open.");
      assert(pending.resetJourney.currentAttempt.id === sourceReset.currentAttempt.id && pending.resetJourney.currentAttempt.startedAt === sourceReset.currentAttempt.startedAt, "The final completed attempt must retain its original identity/start.");
      assert(pending.resetJourney.pastAttempts === sourceReset.pastAttempts && pending.resetJourney.violations === sourceReset.violations, "Completion must keep prior attempts and recorded/undone tombstones intact without appending the final current attempt to history.");
      assert(!("assessment" in pending.resetJourney), "Elapsed completion must not invent assessment answers.");
      assert(!pending.masturbationTracking.enabled && pending.masturbationTracking.currentSession === null, "Assessment-pending completion must not enable tracking or create a session.");
      assertOtherReferencesUnchanged(active, pending, ["resetJourney"], "elapsed completion");
      assert(JSON.stringify(active) === before, "Elapsed completion must not mutate the active source state.");
      equal(completeElapsedResetPeriodState(active, { observedAt }), pending, "Elapsed completion must be deterministic from the explicit observation time.");
      for (const repeated of [{ observedAt }, { observedAt: now().toISOString() }, null]) {
        assert(completeElapsedResetPeriodState(pending, repeated as PeriodInput) === pending, "A second period completion must preserve the first completedAt and return the exact pending state.");
      }
      const validated = validateAndNormalizeBloomState(pending);
      assert(validated.success, `Produced assessment_pending state must validate: ${validated.success ? "" : validated.error}`);
      await assertRoundTrip(pending, "assessment_pending");
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
  assert(fractionComplete.resetJourney.status === "assessment_pending" && fractionComplete.resetJourney.completedAt === "2026-09-16T12:00:00.123Z", "Exact elapsed completion must preserve millisecond precision.");
  const unexpectedSession = createCompletionFixture(false);
  unexpectedSession.masturbationTracking = createPopulatedState().masturbationTracking;
  assert(unexpectedSession.resetJourney.status === "active", "Active fixture required.");
  const pending = completeElapsedResetPeriodState(unexpectedSession, { observedAt: boundaryOf(unexpectedSession.resetJourney) });
  assert(pending !== unexpectedSession && pending.masturbationTracking === unexpectedSession.masturbationTracking, "Period completion must not add unrelated tracking preconditions or alter an existing session; assessment submission owns its explicit session guard.");
}

async function verifyAssessmentCompletion() {
  for (const retainedHistory of [false, true]) {
    const pending = makePending(createCompletionFixture(retainedHistory));
    assert(pending.resetJourney.status === "assessment_pending", "Pending assessment fixture required.");
    for (const readiness of ["ready", "notReady", "notSure"] as const) {
      for (const submittedAt of [pending.resetJourney.completedAt, addMilliseconds(pending.resetJourney.completedAt, 3 * 24 * 60 * 60 * 1000)]) {
        const assessment = createAssessment(pending, readiness, submittedAt);
        const before = JSON.stringify(pending);
        const completed = completePostResetAssessmentState(pending, assessment);
        assert(completed !== pending && completed.resetJourney.status === "completed", `Readiness ${readiness}: valid assessment must complete Reset.`);
        equal(completed.resetJourney, { ...pending.resetJourney, status: "completed", assessment }, "Assessment completion must store the exact descriptive answers while retaining final attempt, restriction end, baseline, and all histories.");
        assert(completed.resetJourney.completedAt === pending.resetJourney.completedAt && completed.resetJourney.assessment.completedAt === submittedAt, "Period completion time and questionnaire submission time must remain distinct historical facts.");
        assert(completed.resetJourney.bestCompletedDays === 15, "Assessment completion must retain maximum historical Reset progress.");
        assert(completed.masturbationTracking.enabled && completed.masturbationTracking.currentSession === null, `Readiness ${readiness} is descriptive and must never gate tracking enablement.`);
        assert(completed.masturbationTracking.sessions === pending.masturbationTracking.sessions, "Enabling tracking must retain the existing session history by reference and create no session.");
        assertOtherReferencesUnchanged(pending, completed, ["resetJourney", "masturbationTracking"], "assessment completion");
        assert(completed.resetJourney.pastAttempts === pending.resetJourney.pastAttempts && completed.resetJourney.violations === pending.resetJourney.violations, "Assessment must not rewrite earlier attempts or violation tombstones.");
        assert(completed.resetJourney.assessment !== assessment, "Stored assessment must be detached from the caller's mutable input.");
        assert(JSON.stringify(pending) === before, "Assessment completion must not mutate its pending source state.");
        equal(completePostResetAssessmentState(pending, assessment), completed, "The assessment transition must be deterministic without generating time or identities.");
        for (const repeated of [assessment, { ...assessment, id: "replacement-assessment", completedAt: now().toISOString(), readinessToRestartTracking: "ready" }, null]) {
          assert(completePostResetAssessmentState(completed, repeated as PostResetAssessment) === completed, "Repeated submission must not overwrite the first assessment, its timestamp, or any unrelated state.");
        }
        const snapshot = JSON.stringify(completed);
        assessment.id = "mutated-caller-assessment";
        assessment.urgeIntensityChange = "increased";
        assert(JSON.stringify(completed) === snapshot, "Later caller mutation must not change the stored assessment fact.");
        assert(validateAndNormalizeBloomState(completed).success, "Produced completed Reset must satisfy existing finished-state identity/time validation.");
        await assertRoundTrip(completed, "completed");
      }
    }
  }
  const alreadyEnabled = makePending(createCompletionFixture(true));
  alreadyEnabled.masturbationTracking = { ...alreadyEnabled.masturbationTracking, enabled: true };
  const completed = completePostResetAssessmentState(alreadyEnabled, createAssessment(alreadyEnabled, "notReady"));
  assert(completed !== alreadyEnabled && completed.masturbationTracking === alreadyEnabled.masturbationTracking, "Already-enabled valid tracking must stay intact by reference without gating on readiness.");
  const contentInactive = makePending(createCompletionFixture(false));
  contentInactive.contentFree = createDefaultBloomState().contentFree;
  const withoutContent = completePostResetAssessmentState(contentInactive, createAssessment(contentInactive, "notSure"));
  assert(withoutContent !== contentInactive && withoutContent.contentFree === contentInactive.contentFree, "Assessment must leave inactive Content-Free independent and unactivated.");
}

function verifyEveryAssessmentAnswer() {
  const pending = makePending(createCompletionFixture(false));
  const urge = ["decreased", "same", "increased", "notSure", "preferNotToSay"] as const;
  const pause = ["harder", "same", "easier", "notSure", "preferNotToSay"] as const;
  const erection = ["lessFrequent", "same", "moreFrequent", "notSure", "preferNotToSay"] as const;
  const response = ["worse", "same", "better", "notSure", "preferNotToSay"] as const;
  for (let index = 0; index < 5; index++) {
    for (const readiness of ["ready", "notReady", "notSure"] as const) {
      const assessment: PostResetAssessment = {
        ...createAssessment(pending, readiness), urgeIntensityChange: urge[index]!, abilityToPauseChange: pause[index]!,
        spontaneousErectionChange: erection[index]!, overallSexualResponseChange: response[index]!
      };
      const completed = completePostResetAssessmentState(pending, assessment);
      assert(completed.resetJourney.status === "completed" && completed.masturbationTracking.enabled, "Every existing descriptive answer, including uncertainty and nonresponse, must remain valid without medical interpretation or readiness gating.");
      equal(completed.resetJourney.assessment, assessment, "Assessment answers must not be converted into scores, permission, or inferred conclusions.");
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

function verifyRejectedAssessments() {
  let count = 0;
  const reject = (state: BloomLocalState, assessment: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(completePostResetAssessmentState(state, assessment as PostResetAssessment) === state, `${label}: invalid assessment must return the original state atomically.`);
    assert(JSON.stringify(state) === before, `${label}: invalid assessment must not partially complete Reset or enable tracking.`);
    count++;
  };
  const pending = makePending(createCompletionFixture(true));
  const assessment = createAssessment(pending, "ready");
  for (const value of [null, [], "assessment", {}]) reject(pending, value, "invalid assessment object");
  for (const key of Object.keys(assessment)) {
    const missing = { ...assessment } as Record<string, unknown>;
    delete missing[key];
    reject(pending, missing, `missing assessment ${key}`);
  }
  for (const key of ["id", "resetJourneyId", "resetAttemptId", "baselineId"] as const) {
    for (const value of ["", " ", 17, null]) reject(pending, { ...assessment, [key]: value }, `invalid identity ${key}`);
    if (key !== "id") reject(pending, { ...assessment, [key]: "mismatching-identity" }, `mismatching ${key}`);
  }
  assert(pending.resetJourney.status === "assessment_pending", "Pending fixture required.");
  for (const value of [null, 17, "2026-02-30T12:00:00.000Z", "2026-09-23", "2026-09-23T12:00:00+00:00", addMilliseconds(pending.resetJourney.completedAt, -1)]) {
    reject(pending, { ...assessment, completedAt: value }, "invalid or too-early assessment time");
  }
  for (const key of ["urgeIntensityChange", "abilityToPauseChange", "spontaneousErectionChange", "overallSexualResponseChange", "readinessToRestartTracking"] as const) {
    for (const value of ["medicalConclusion", null, 1]) reject(pending, { ...assessment, [key]: value }, `invalid assessment enum ${key}`);
  }
  const unfinished = createPopulatedState().masturbationTracking.currentSession;
  assert(unfinished !== null && unfinished.status === "awaiting_feedback", "Awaiting-feedback fixture required.");
  const activeSession = { id: "unexpected-active-session", status: "active" as const, startedAt: pending.resetJourney.completedAt, pauses: [] };
  for (const session of [unfinished, activeSession]) {
    reject({ ...pending, masturbationTracking: { ...pending.masturbationTracking, currentSession: session } }, assessment, `${session.status} session must not be guessed away during assessment`);
  }
  for (const [path, value] of [
    ["masturbationTracking.enabled", "yes"], ["masturbationTracking.currentSession", undefined],
    ["masturbationTracking.sessions.0.erectionQuality", 11], ["resetJourney.bestCompletedDays", 14],
    ["resetJourney.currentAttempt.completedDays", 14], ["resetJourney.baseline.id", ""], ["resetJourney.assessment", assessment]
  ] as const) {
    const malformed = clone(pending);
    replaceAtPath(malformed, path, value, false);
    reject(malformed, assessment, `malformed assessment source ${path}`);
  }
  for (const state of [...nonActiveStates().filter((entry) => entry.resetJourney.status !== "assessment_pending"), createCompletionFixture(false)]) {
    reject(state, assessment, `wrong assessment lifecycle ${state.resetJourney.status}`);
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
  const pending = completeElapsedResetPeriodState(loaded.state, { observedAt: now().toISOString() });
  await persistBloomLocalState(pending, client, now);
  const pendingReload = await loadBloomLocalState(client, now);
  assert(pendingReload.status === "success" && pendingReload.state.resetJourney.status === "assessment_pending" && !pendingReload.state.masturbationTracking.enabled, "Loading pending assessment must not auto-submit a questionnaire or enable tracking.");
}

function verifyViolationAndUndoBoundaries() {
  const active = createCompletionFixture(true);
  assert(active.resetJourney.status === "active", "Active history fixture required.");
  const boundary = boundaryOf(active.resetJourney);
  for (const time of [boundary, addMilliseconds(boundary, 86400000)]) {
    for (const reason of ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
      const input = { ...createInput(reason, { kind: "manual", logActionId: "after-period-event" }), violationId: "after-period-violation", replacementAttemptId: "after-period-attempt", contentFreeViolationId: "after-period-content", occurredAt: time, recordedAt: time };
      assert(recordActiveResetViolationState(active, input) === active, "A violation at or after the completed period must never start another 15-day restriction before explicit lifecycle advancement.");
      const pending = completeElapsedResetPeriodState(active, { observedAt: time });
      const completed = completePostResetAssessmentState(pending, createAssessment(pending, "notReady"));
      for (const finished of [pending, completed]) {
        assert(recordActiveResetViolationState(finished, input) === finished, "Finished Reset lifecycles must not accept a restart violation.");
        for (const violation of finished.resetJourney.violations) {
          assert(undoActiveResetViolationState(finished, { violationId: violation.id, undoneAt: now().toISOString() }) === finished, "Neither recorded history nor undone tombstones may roll back a non-active completed Reset or its final best progress.");
        }
      }
    }
  }
}

function verifyHistoricalCompletionCompatibility() {
  const pending = makePending(createCompletionFixture(false));
  assert(pending.resetJourney.status === "assessment_pending", "Pending fixture required.");
  const historicalEnd = addMilliseconds(pending.resetJourney.completedAt, 3600000);
  const historical: BloomLocalState = {
    ...pending,
    resetJourney: { ...pending.resetJourney, completedAt: historicalEnd, currentAttempt: { ...pending.resetJourney.currentAttempt, completedAt: historicalEnd } }
  };
  assert(validateAndNormalizeBloomState(historical).success, "Practical historical validation must retain a temporally ordered noncanonical arithmetic completion time rather than rewriting past user facts.");
  const completed = completePostResetAssessmentState(historical, createAssessment(historical, "notSure", historicalEnd));
  assert(completed.resetJourney.status === "completed" && completed.resetJourney.completedAt === historicalEnd, "Assessment completion must preserve an existing valid historical restriction-end timestamp instead of recalculating it.");
}

async function verifyMalformedFinishedStates() {
  const pending = makePending(createCompletionFixture(true));
  const assessment = createAssessment(pending, "ready");
  const completed = completePostResetAssessmentState(pending, assessment);
  assert(pending.resetJourney.status === "assessment_pending", "Pending fixture required.");
  const cases: Array<[string, BloomLocalState, string, unknown, boolean?]> = [
    ["missing journey identity", pending, "resetJourney.id", undefined, true], ["missing journey start", pending, "resetJourney.startedAt", undefined, true],
    ["missing baseline", pending, "resetJourney.baseline", undefined, true], ["missing completion time", pending, "resetJourney.completedAt", undefined, true],
    ["invalid period completion timestamp", pending, "resetJourney.completedAt", "2026-02-30T12:00:00.000Z"],
    ["wrong final best", pending, "resetJourney.bestCompletedDays", 14], ["wrong final attempt status", pending, "resetJourney.currentAttempt.status", "active"],
    ["wrong final completed days", pending, "resetJourney.currentAttempt.completedDays", 14], ["missing final count", pending, "resetJourney.currentAttempt.completedDays", undefined, true],
    ["inconsistent completion timestamps", pending, "resetJourney.currentAttempt.completedAt", addMilliseconds(pending.resetJourney.completedAt, 1)],
    ["pending carrying assessment", pending, "resetJourney.assessment", assessment],
    ["completed missing assessment", completed, "resetJourney.assessment", undefined, true],
    ["mismatching assessment journey", completed, "resetJourney.assessment.resetJourneyId", "other-journey"],
    ["mismatching assessment attempt", completed, "resetJourney.assessment.resetAttemptId", "other-attempt"],
    ["mismatching assessment baseline", completed, "resetJourney.assessment.baselineId", "other-baseline"],
    ["invalid assessment time", completed, "resetJourney.assessment.completedAt", "2026-02-30T12:00:00.000Z"],
    ["assessment before period end", completed, "resetJourney.assessment.completedAt", addMilliseconds(pending.resetJourney.completedAt, -1)],
    ["invalid descriptive assessment answer", completed, "resetJourney.assessment.overallSexualResponseChange", "recovered"],
    ["invalid readiness", completed, "resetJourney.assessment.readinessToRestartTracking", "permissionGranted"]
  ];
  for (const [label, state, path, value, remove] of cases) {
    const malformed = clone(state);
    replaceAtPath(malformed, path, value, remove === true);
    await assertCorruptPreserved(malformed, label);
  }
  const beforeAttempt = clone(pending);
  assert(beforeAttempt.resetJourney.status === "assessment_pending", "Pending fixture required.");
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

function makePending(active: BloomLocalState): BloomLocalState {
  assert(active.resetJourney.status === "active", "Pending builder requires active Reset.");
  const pending = completeElapsedResetPeriodState(active, { observedAt: addMilliseconds(boundaryOf(active.resetJourney), 2 * 86400000) });
  assert(pending.resetJourney.status === "assessment_pending", "Pending builder must finish the actual elapsed period.");
  return pending;
}

function createAssessment(state: BloomLocalState, readiness: PostResetAssessment["readinessToRestartTracking"], submittedAt?: string): PostResetAssessment {
  const reset = state.resetJourney;
  assert(reset.status === "assessment_pending", "Assessment fixture requires pending Reset.");
  return {
    id: "submitted-post-reset-assessment", resetJourneyId: reset.id, resetAttemptId: reset.currentAttempt.id, baselineId: reset.baseline.id,
    completedAt: submittedAt ?? reset.completedAt, urgeIntensityChange: "decreased", abilityToPauseChange: "easier",
    spontaneousErectionChange: "notSure", overallSexualResponseChange: "preferNotToSay", readinessToRestartTracking: readiness
  };
}

function nonActiveStates(): BloomLocalState[] {
  const defaults = createDefaultBloomState();
  const pending = makePending(createCompletionFixture(false));
  return [
    defaults,
    { ...defaults, resetJourney: { status: "recommended", id: "recommended", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } },
    { ...defaults, resetJourney: { status: "baseline_pending", id: "baseline-pending", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } },
    pending,
    completePostResetAssessmentState(pending, createAssessment(pending, "ready"))
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

async function assertRoundTrip(state: BloomLocalState, status: "assessment_pending" | "completed") {
  const client = new CompletionTestStorage();
  await persistBloomLocalState(state, client, now);
  const payload = client.values.get(BLOOM_STATE_STORAGE_KEY);
  assert(payload !== undefined && (JSON.parse(payload) as { version: unknown }).version === 7, "Finished states must persist under unchanged v7 storage.");
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current" && loaded.state.resetJourney.status === status, `${status}: valid persisted lifecycle must reload without automatic advancement.`);
  equal(loaded.state, state, `${status}: complete Reset history, independent Content-Free, tracking state, and legacy facts must survive save/load unchanged.`);
}

async function assertCorruptPreserved(state: BloomLocalState, label: string) {
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
