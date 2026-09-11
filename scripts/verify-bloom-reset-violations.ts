import { isDeepStrictEqual } from "node:util";

import type { BehaviorEventSource, ResetJourney, ResetViolation } from "../src/domain/models";
import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { createDefaultBloomState, recordActiveResetViolationState, startResetFromBaselineState, type BloomLocalState } from "../src/storage/bloomState";
import { BLOOM_CORRUPT_BACKUP_PREFIX, BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";

const startedAt = "2026-09-01T12:00:00.000Z";
const occurredAt = "2026-09-07T12:00:00.000Z";
const recordedAt = "2026-09-07T12:01:00.000Z";
const now = () => new Date("2026-09-30T12:00:00.000Z");
const reasons = ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const;
type ViolationInput = Parameters<typeof recordActiveResetViolationState>[1];

export async function verifyBloomResetViolations() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Recorded Reset violations must use canonical v7 persistence and its key.");
  await verifyAllReasonTransitions();
  verifyProgressAndStreakBoundaries();
  verifyDeduplicationAndSameDayEvents();
  const rejected = verifyAtomicRejections();
  const corrupted = await verifyMalformedLinkedRecords();
  console.log(`Bloom Reset violation verification passed (${rejected} rejected atomic transitions; ${corrupted} malformed linked-record cases; all reasons/source kinds, elapsed boundaries, source deduplication, and v7 round trips).`);
}

async function verifyAllReasonTransitions() {
  for (const reason of reasons) {
    for (const source of [{ kind: "manual", logActionId: "new-manual-event" }, { kind: "masturbationSession", sessionId: "new-session-event" }] as const) {
      for (const contentActive of [false, true]) {
        for (const retainedHistory of [false, true]) {
          const state = createActiveState(retainedHistory, contentActive);
          const before = JSON.stringify(state);
          const reset = state.resetJourney;
          assert(reset.status === "active", "Active Reset fixture required.");
          const input = createInput(reason, source);
          if (!contentActive || reason === "masturbation") delete input.contentFreeViolationId;
          const updated = recordActiveResetViolationState(state, input);
          assert(updated !== state && updated.resetJourney.status === "active", `${reason}/${source.kind}: valid behavior must restart the active attempt.`);
          const archived = {
            id: reset.currentAttempt.id, status: "restarted", startedAt: reset.currentAttempt.startedAt,
            endedAt: occurredAt, completedDays: 6, restartViolationId: input.violationId
          };
          equal(updated.resetJourney.pastAttempts, [...reset.pastAttempts, archived], "Restart must append one elapsed-time archive while preserving all prior completed/restarted attempts.");
          equal(updated.resetJourney.violations, [...reset.violations, {
            id: input.violationId, attemptId: reset.currentAttempt.id, occurredAt, recordedAt, source, reason,
            status: "recorded", bestCompletedDaysBefore: reset.bestCompletedDays
          }], "Restart must append exactly one violation with the original attempt and shared behavior identity.");
          equal(updated.resetJourney.currentAttempt, { id: input.replacementAttemptId, status: "active", startedAt: occurredAt }, "Replacement attempts persist identity and event start time without an active progress counter.");
          assert(!("completedDays" in updated.resetJourney.currentAttempt), "A new active attempt must never gain a persisted completed-day counter.");
          assert(updated.resetJourney.id === reset.id && updated.resetJourney.startedAt === reset.startedAt && updated.resetJourney.durationDays === 15, "Restart must retain journey identity, original start time, and duration.");
          equal(updated.resetJourney.baseline, reset.baseline, "Restart must retain the same baseline rather than recapturing it.");
          assert(updated.resetJourney.bestCompletedDays === Math.max(reset.bestCompletedDays, 6), "Restart must increase the historical best when appropriate and preserve any higher best.");
          const progress = getResetProgress(updated.resetJourney, occurredAt);
          assert(progress?.completedDays === 0 && progress.currentDay === 1, "The replacement attempt must begin at zero completed days on Day 1.");
          const contentAffected = contentActive && reason !== "masturbation";
          for (const key of Object.keys(state) as Array<keyof BloomLocalState>) {
            if (key !== "resetJourney" && (key !== "contentFree" || !contentAffected)) {
              assert(updated[key] === state[key], `${reason}: ${key} must remain untouched by reference, including onboarding, Tracking, Urge Control, Protect, and all legacy systems.`);
            }
          }
          if (contentAffected) {
            assert(state.contentFree.status === "active" && updated.contentFree.status === "active", "Affected Content-Free must remain active.");
            const elapsedSeconds = Math.floor((Date.parse(occurredAt) - Date.parse(state.contentFree.currentStreakStartedAt)) / 1000);
            equal(updated.contentFree, {
              ...state.contentFree,
              bestStreakSeconds: Math.max(state.contentFree.bestStreakSeconds, elapsedSeconds),
              currentStreakStartedAt: occurredAt,
              violations: [...state.contentFree.violations, {
                id: input.contentFreeViolationId, activationId: state.contentFree.activationId,
                kind: "intentionalExplicitContent", occurredAt, recordedAt, source,
                streakBefore: { currentStreakStartedAt: state.contentFree.currentStreakStartedAt, bestStreakSeconds: state.contentFree.bestStreakSeconds },
                status: "recorded"
              }]
            }, "Content involvement must reset only the streak, append the linked violation, preserve activation/history, and snapshot the prior best before updating it.");
            assert(updated.contentFree.pastActivations === state.contentFree.pastActivations, "A streak reset must not deactivate/reactivate Content-Free or reconstruct its activation history.");
            equal(last(updated.contentFree.violations)?.source, last(updated.resetJourney.violations)?.source, "Reset and Content-Free must use the exact same semantic BehaviorEventSource.");
          } else {
            assert(JSON.stringify(updated.contentFree) === JSON.stringify(state.contentFree), "Masturbation alone or inactive Content-Free must leave all Content-Free bytes unchanged.");
          }
          assert(JSON.stringify(state) === before, "A pure atomic transition must not mutate its source state.");
          equal(recordActiveResetViolationState(state, input), updated, "The transition must be deterministic using only explicit input identities and times.");
          assert(recordActiveResetViolationState(updated, input) === updated, "Retrying the same behavior must return the exact state without another archive, replacement, or linked violation.");
          const validated = validateAndNormalizeBloomState(updated);
          assert(validated.success, `Produced ${reason} history must satisfy existing structural and cross-record invariants: ${validated.success ? "" : validated.error}`);
          const client = new ViolationTestStorage();
          await persistBloomLocalState(updated, client, now);
          const loaded = await loadBloomLocalState(client, now);
          assert(loaded.status === "success" && loaded.source === "current" && loaded.state.resetJourney.status === "active", "Produced v7 violation state must reload as active without completion or migration.");
          equal(loaded.state, updated, "Reset archives, shared sources, Content-Free snapshots, and unrelated facts must survive v7 round trip.");
          assert(recordActiveResetViolationState(loaded.state, input) === loaded.state, "Source deduplication must survive persistence and reload.");
        }
      }
    }
  }
}

function verifyProgressAndStreakBoundaries() {
  const state = createActiveState(false, true);
  for (const [time, expectedDays] of [
    [startedAt, 0], ["2026-09-01T23:59:00.000Z", 0], [occurredAt, 6], ["2026-09-16T11:59:59.999Z", 14]
  ] as const) {
    const updated = recordActiveResetViolationState(state, { ...createInput("masturbation"), occurredAt: time, recordedAt: time });
    assert(updated !== state && updated.resetJourney.status === "active", "Any valid event before 15 full days may restart Reset.");
    assert(last(updated.resetJourney.pastAttempts)?.completedDays === expectedDays, "Archived progress must floor elapsed full days, including zero-length attempts and the last millisecond before completion.");
  }
  for (const time of ["2026-09-16T12:00:00.000Z", "2026-10-01T12:00:00.000Z"]) {
    for (const reason of reasons) {
      const input = { ...createInput(reason), occurredAt: time, recordedAt: time };
      assert(recordActiveResetViolationState(state, input) === state, "At and after exactly 15 elapsed days, no Reset or Content-Free change may extend the completed period.");
      assert(state.resetJourney.status === "active", "The boundary guard must not auto-transition the persisted lifecycle to assessment_pending.");
    }
  }
  const delayed = recordActiveResetViolationState(state, { ...createInput("masturbation"), recordedAt: "2026-10-01T12:00:00.000Z" });
  assert(delayed !== state && last(delayed.resetJourney.pastAttempts)?.completedDays === 6, "The occurredAt behavior time, rather than the later logging time, must determine eligibility and archived progress.");
  const fractional = createActiveState(false, true);
  assert(fractional.contentFree.status === "active", "Active Content-Free fixture required.");
  fractional.contentFree = { ...fractional.contentFree, currentStreakStartedAt: "2026-09-01T12:00:00.750Z", bestStreakSeconds: 2 };
  const fractionTime = "2026-09-07T12:00:00.249Z";
  const fractionResult = recordActiveResetViolationState(fractional, { ...createInput("intentionalExplicitContent"), occurredAt: fractionTime, recordedAt: fractionTime });
  assert(fractionResult !== fractional && fractionResult.contentFree.status === "active", "A fractional-second streak remains a valid explicit content event.");
  assert(fractionResult.contentFree.bestStreakSeconds === 518399, "Content-Free streak duration must floor to nonnegative whole seconds, not round up or store a fractional value.");
  equal(last(fractionResult.contentFree.violations)?.streakBefore, { currentStreakStartedAt: "2026-09-01T12:00:00.750Z", bestStreakSeconds: 2 }, "The undo snapshot must retain the original best before the elapsed streak increases it.");
  const higherBest = createActiveState(false, true);
  higherBest.contentFree.bestStreakSeconds = 100 * 86400;
  const preserved = recordActiveResetViolationState(higherBest, createInput("intentionalExplicitContent"));
  assert(preserved.contentFree.bestStreakSeconds === higherBest.contentFree.bestStreakSeconds, "A violation must not reduce an existing longer Content-Free best streak.");
  const zeroStreak = createActiveState(false, true);
  assert(zeroStreak.contentFree.status === "active", "Active Content-Free fixture required.");
  zeroStreak.contentFree = { ...zeroStreak.contentFree, currentStreakStartedAt: occurredAt, bestStreakSeconds: 0 };
  const zeroResult = recordActiveResetViolationState(zeroStreak, createInput("intentionalExplicitContent"));
  assert(zeroResult !== zeroStreak && zeroResult.contentFree.bestStreakSeconds === 0, "An event at the exact streak start is valid and records zero elapsed seconds without negative progress.");
  const laterStreak = createActiveState(false, true);
  assert(laterStreak.contentFree.status === "active", "Active Content-Free fixture required.");
  laterStreak.contentFree = { ...laterStreak.contentFree, currentStreakStartedAt: "2026-09-08T12:00:00.000Z" };
  const masturbationOnly = recordActiveResetViolationState(laterStreak, createInput("masturbation"));
  assert(masturbationOnly !== laterStreak && masturbationOnly.contentFree === laterStreak.contentFree, "An unrelated later Content-Free streak must not block a masturbation-only Reset violation.");
}

function verifyDeduplicationAndSameDayEvents() {
  for (const kind of ["manual", "masturbationSession"] as const) {
    const state = createActiveState(false, true);
    const source = sourceFor(kind, "stable-event");
    const firstInput = { ...createInput("masturbationWithExplicitContent", source), occurredAt: "2026-09-01T12:05:00.000Z", recordedAt: "2026-09-01T12:05:00.000Z" };
    const first = recordActiveResetViolationState(state, firstInput);
    const secondInput = {
      ...createInput("intentionalExplicitContent", sourceFor(kind, "another-event")),
      violationId: "second-reset-violation", replacementAttemptId: "second-replacement", contentFreeViolationId: "second-content-violation",
      occurredAt: "2026-09-01T12:10:00.000Z", recordedAt: "2026-09-01T12:10:00.000Z"
    };
    const second = recordActiveResetViolationState(first, secondInput);
    assert(first !== state && second !== first && second.resetJourney.status === "active", "Distinct source identities on the same day must each apply exactly once.");
    assert(second.resetJourney.pastAttempts.length === 2 && second.resetJourney.violations.length === 2 && second.contentFree.violations.length === 2, "Same-day events must not be collapsed before calendar/timezone semantics are modeled.");
    assert(second.resetJourney.pastAttempts.every((attempt) => attempt.completedDays === 0), "Multiple same-day attempts must preserve truthful zero-day historical progress.");
    for (const retried of [firstInput, { ...firstInput, violationId: "retry-different-id", replacementAttemptId: "retry-different-attempt", contentFreeViolationId: "retry-different-content", occurredAt: "2026-09-01T12:15:00.000Z", recordedAt: "2026-09-01T12:15:00.000Z" }]) {
      assert(recordActiveResetViolationState(second, retried) === second, "Source deduplication must search all journey history even after a later restart and despite new supplied record IDs.");
    }
  }
  const state = createActiveState(false, true);
  const manual = recordActiveResetViolationState(state, { ...createInput("masturbation", sourceFor("manual", "same-text")), occurredAt: startedAt, recordedAt: startedAt });
  const session = recordActiveResetViolationState(manual, { ...createInput("intentionalExplicitContent", sourceFor("masturbationSession", "same-text")), violationId: "different-reset-id", replacementAttemptId: "different-attempt-id", occurredAt: "2026-09-01T12:01:00.000Z", recordedAt: "2026-09-01T12:01:00.000Z" });
  assert(session !== manual && session.resetJourney.violations.length === 2, "Different BehaviorEventSource kinds must not collide merely because their identity strings are equal.");
  const changedReasonRetry = { ...createInput("masturbationWithExplicitContent", sourceFor("manual", "same-text")), violationId: "new-retry-id", replacementAttemptId: "new-retry-attempt", occurredAt: "2026-09-01T12:02:00.000Z", recordedAt: "2026-09-01T12:02:00.000Z" };
  assert(recordActiveResetViolationState(session, changedReasonRetry) === session, "Retrying an applied source with a changed reason must not create or repair a second event in this phase.");
  const scopedIds = recordActiveResetViolationState(createActiveState(false, true), { ...createInput("masturbationWithExplicitContent"), violationId: "same-scoped-id", replacementAttemptId: "same-scoped-id", contentFreeViolationId: "same-scoped-id" });
  assert(scopedIds.resetJourney.violations.length === 1 && scopedIds.contentFree.violations.length === 1, "Record ID collision checks must respect separate attempt/Reset-violation/Content-Free-violation identity scopes.");
}

function verifyAtomicRejections() {
  let count = 0;
  const reject = (state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(recordActiveResetViolationState(state, input as ViolationInput) === state, `${label}: reject by returning the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: rejected input must not leave a partial Reset archive or Content-Free update.`);
    count++;
  };
  const active = createActiveState(true, true);
  const input = createInput("masturbationWithExplicitContent");
  const finished = createPopulatedState().resetJourney;
  assert(finished.status === "completed", "Completed Reset fixture required.");
  const { assessment: _assessment, ...assessmentPending } = finished;
  for (const reset of [
    createDefaultBloomState().resetJourney,
    { status: "recommended", id: "recommended-reset", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } as const,
    { status: "baseline_pending", id: "pending-reset", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } as const,
    { ...assessmentPending, status: "assessment_pending" } as const, finished
  ]) reject({ ...active, resetJourney: reset as ResetJourney }, input, `wrong lifecycle ${reset.status}`);
  for (const value of [null, [], "event", {}]) reject(active, value, "invalid input structure");
  for (const field of ["violationId", "replacementAttemptId", "occurredAt", "recordedAt", "source", "reason"]) {
    const missing = { ...input } as Record<string, unknown>;
    delete missing[field];
    reject(active, missing, `missing ${field}`);
  }
  for (const field of ["violationId", "replacementAttemptId", "contentFreeViolationId"]) {
    for (const value of ["", "   ", null, 17]) reject(active, { ...input, [field]: value }, `invalid ${field}`);
  }
  for (const field of ["occurredAt", "recordedAt"]) {
    for (const value of ["2026-02-30T12:00:00.000Z", "2026-09-07", "2026-09-07T12:00:00+00:00", 17, null]) reject(active, { ...input, [field]: value }, `invalid ${field}`);
  }
  reject(active, { ...input, occurredAt: "2026-09-01T11:59:59.999Z" }, "event before current Reset attempt");
  reject(active, { ...input, recordedAt: "2026-09-07T11:59:59.999Z" }, "recordedAt before occurredAt");
  for (const reason of ["accidentalExposure", "other", "", null]) reject(active, { ...input, reason }, "unknown violation reason");
  for (const source of [null, [], {}, { kind: "unknown", id: "event" }, { kind: "manual" }, { kind: "manual", logActionId: " " }, { kind: "manual", logActionId: "event", sessionId: "other" }, { kind: "masturbationSession" }, { kind: "masturbationSession", sessionId: "" }, { kind: "masturbationSession", sessionId: "event", logActionId: "other" }]) {
    reject(active, { ...input, source }, "malformed behavior source");
  }
  reject(active, { ...input, violationId: "reset-violation" }, "Reset violation ID already belongs to history");
  for (const id of ["initial-active-attempt", "attempt-past", "attempt-current"]) reject(active, { ...input, replacementAttemptId: id }, "replacement attempt ID conflicts with current or historical attempts");
  for (const id of ["cf-corrected", "cf-recorded"]) reject(active, { ...input, contentFreeViolationId: id }, "Content-Free violation ID conflicts with current or corrected history");
  for (const reason of ["intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
    const missingContentId = createInput(reason);
    delete missingContentId.contentFreeViolationId;
    reject(active, missingContentId, "active Content-Free requires its linked violation ID");
    const laterStreak = createActiveState(false, true);
    assert(laterStreak.contentFree.status === "active", "Active Content-Free fixture required.");
    laterStreak.contentFree = { ...laterStreak.contentFree, currentStreakStartedAt: "2026-09-08T12:00:00.000Z" };
    reject(laterStreak, createInput(reason), "event predates current Content-Free streak and must reject the whole atomic operation");
  }
  for (const source of [sourceFor("manual", "mistaken-manual-log"), sourceFor("masturbationSession", "source-session")]) {
    const contentDuplicateOnly = createActiveState(false, true);
    contentDuplicateOnly.contentFree = createPopulatedState().contentFree;
    reject(contentDuplicateOnly, createInput("intentionalExplicitContent", source), "a Content-Free source already recorded or undone must not leave a partial Reset restart");
  }
  for (const [path, value] of [
    ["resetJourney.currentAttempt.completedDays", 6], ["resetJourney.durationDays", 14],
    ["resetJourney.pastAttempts.0.restartViolationId", "missing-violation"],
    ["contentFree.violations.0.activationId", "missing-activation"], ["contentFree.bestStreakSeconds", -1]
  ] as const) {
    const malformed = clone(active);
    replaceAtPath(malformed, path, value, false);
    reject(malformed, input, `malformed source state at ${path}`);
  }
  return count;
}

async function verifyMalformedLinkedRecords() {
  const state = recordActiveResetViolationState(createActiveState(false, true), createInput("masturbationWithExplicitContent"));
  assert(state.resetJourney.status === "active" && state.resetJourney.pastAttempts.length === 1 && state.contentFree.violations.length === 1, "Linked violation fixture required.");
  const cases: Array<[string, string, unknown, boolean?]> = [
    ["invalid restarted day count", "resetJourney.pastAttempts.0.completedDays", 15],
    ["negative restarted day count", "resetJourney.pastAttempts.0.completedDays", -1],
    ["fractional restarted day count", "resetJourney.pastAttempts.0.completedDays", 1.5],
    ["missing historical count", "resetJourney.pastAttempts.0.completedDays", undefined, true],
    ["missing restart violation reference", "resetJourney.pastAttempts.0.restartViolationId", "unknown-violation"],
    ["wrong restarted attempt reference", "resetJourney.violations.0.attemptId", "replacement-attempt"],
    ["unknown violation attempt", "resetJourney.violations.0.attemptId", "unknown-attempt"],
    ["violation before archived attempt", "resetJourney.violations.0.occurredAt", "2026-09-01T11:59:00.000Z"],
    ["recording before behavior", "resetJourney.violations.0.recordedAt", "2026-09-07T11:59:00.000Z"],
    ["negative archive interval", "resetJourney.pastAttempts.0.endedAt", "2026-09-01T11:59:00.000Z"],
    ["replacement overlaps archive", "resetJourney.currentAttempt.startedAt", "2026-09-07T11:59:00.000Z"],
    ["replacement reuses archive ID", "resetJourney.currentAttempt.id", "initial-active-attempt"],
    ["new active counter forbidden", "resetJourney.currentAttempt.completedDays", 0],
    ["best loses archived progress", "resetJourney.bestCompletedDays", 5],
    ["unknown Reset violation reason", "resetJourney.violations.0.reason", "accidentalExposure"],
    ["malformed source", "resetJourney.violations.0.source", { kind: "manual", sessionId: "wrong" }],
    ["unknown Content-Free activation", "contentFree.violations.0.activationId", "unknown-activation"],
    ["unknown Content-Free kind", "contentFree.violations.0.kind", "masturbation"],
    ["invalid streak snapshot", "contentFree.violations.0.streakBefore.bestStreakSeconds", -1],
    ["fractional streak snapshot", "contentFree.violations.0.streakBefore.bestStreakSeconds", 1.5],
    ["snapshot outside activation", "contentFree.violations.0.streakBefore.currentStreakStartedAt", "2026-08-01T12:00:00.000Z"],
    ["undone record missing undo time", "contentFree.violations.0.status", "undone"],
    ["recorded event carrying undo time", "contentFree.violations.0.undoneAt", recordedAt],
    ["streak before activation", "contentFree.currentStreakStartedAt", "2026-08-01T12:00:00.000Z"]
  ];
  for (const [label, path, value, remove] of cases) {
    const malformed = clone(state);
    replaceAtPath(malformed, path, value, remove === true);
    await assertCorruptPreserved(malformed, label);
  }
  for (const scope of ["resetJourney", "contentFree"] as const) {
    for (const sameId of [true, false]) {
      const malformed = clone(state);
      const first = malformed[scope].violations[0];
      assert(first !== undefined, "Violation fixture required.");
      // Even a fresh record ID cannot make an already used source a new event.
      (malformed[scope].violations as unknown[]).push({ ...first, id: sameId ? first.id : "different-id-same-source" });
      await assertCorruptPreserved(malformed, `${scope}: duplicate ${sameId ? "record identity" : "source identity"}`);
    }
  }
  return cases.length + 4;
}

export function createActiveState(retainedHistory: boolean, contentActive: boolean): BloomLocalState {
  const state = createPopulatedState();
  const previous = state.resetJourney;
  assert(previous.status === "completed" && state.contentFree.status === "active", "Populated historical fixture required.");
  state.resetJourney = {
    status: "baseline_pending", id: "ongoing-reset-journey", durationDays: 15,
    bestCompletedDays: retainedHistory ? previous.bestCompletedDays : 0,
    pastAttempts: retainedHistory ? [...previous.pastAttempts, previous.currentAttempt] : [],
    violations: retainedHistory ? previous.violations : []
  };
  state.masturbationTracking = { ...state.masturbationTracking, enabled: false, currentSession: null };
  state.productOnboarding = acceptedOnboarding();
  if (!retainedHistory) {
    state.contentFree = contentActive
      ? { status: "active", activationId: "active-content-program", activatedAt: startedAt, currentStreakStartedAt: startedAt, bestStreakSeconds: 2 * 86400, pastActivations: [], violations: [] }
      : createDefaultBloomState().contentFree;
  } else if (!contentActive) {
    state.contentFree = {
      status: "inactive", bestStreakSeconds: state.contentFree.bestStreakSeconds,
      pastActivations: [...state.contentFree.pastActivations, { id: state.contentFree.activationId, startedAt: state.contentFree.activatedAt, endedAt: "2026-03-01T12:00:00.000Z" }],
      violations: state.contentFree.violations
    };
  }
  const active = startResetFromBaselineState(state, {
    resetAttemptId: "initial-active-attempt", startedAt,
    resetBaseline: { id: "original-reset-baseline", capturedAt: "2026-09-01T11:59:00.000Z", averageIntervalSeconds: 86400.5, averageErectionQuality: 6.5, explicitContentSessionRatio: 0.25, selfReport: { urgeIntensity: "notSure", abilityToPause: "preferNotToSay", spontaneousOrMorningErections: "sometimes" } }
  });
  assert(active.resetJourney.status === "active", "The baseline transition must construct a valid active fixture.");
  return active;
}

function acceptedOnboarding(): Extract<BloomLocalState["productOnboarding"], { status: "completed" }> {
  const result = scoreBloomOnboarding({
    explicitContentFrequency: "dailyOrMore", unplannedContentUse: "almostAlways", activityInterruption: "often", contentTriggeredMasturbation: "almostAlways",
    repeatedContentReturn: "often", difficultyReducingContent: "often", erectionQuality: 2, erectionMaintenanceDifficulty: "almostAlways",
    masturbationTechniques: ["veryTightPressure"], techniqueDependency: "almostAlways", delayedOrDifficultEjaculation: "often", safetySignals: ["none"]
  }, "2026-08-01T10:00:00.000Z");
  return { status: "completed", result, planAcceptance: { acceptedAt: "2026-08-01T10:01:00.000Z", recommendation: result.recommendation } };
}

export function createInput(reason: ResetViolation["reason"], source: BehaviorEventSource = sourceFor("manual", "new-manual-event")): ViolationInput {
  return { violationId: "new-reset-violation", replacementAttemptId: "replacement-attempt", occurredAt, recordedAt, source, reason, ...(reason === "masturbation" ? {} : { contentFreeViolationId: "new-content-violation" }) };
}

function sourceFor(kind: BehaviorEventSource["kind"], id: string): BehaviorEventSource {
  return kind === "manual" ? { kind, logActionId: id } : { kind, sessionId: id };
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function last<T>(values: readonly T[]): T | undefined { return values[values.length - 1]; }

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const keys = path.split(".");
  const final = keys.pop();
  assert(final !== undefined, "Fixture mutation requires a field name.");
  let parent = root as Record<string, unknown>;
  for (const key of keys) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[final];
  else parent[final] = value;
}

async function assertCorruptPreserved(state: BloomLocalState, label: string) {
  assert(!validateAndNormalizeBloomState(state).success, `${label}: malformed linked records must fail direct validation rather than be repaired.`);
  const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state });
  const client = new ViolationTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "corrupt" && loaded.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: malformed linked records must follow existing corruption handling.`);
  assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${label}: original malformed payload bytes must remain untouched.`);
  assert(loaded.backupKey !== null && loaded.backupKey.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Malformed linked records must receive a scoped backup.");
  const backup = client.values.get(loaded.backupKey);
  assert(backup !== undefined, "Corrupt backup must be durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === BLOOM_STATE_STORAGE_KEY, "Backup must retain exact source bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class ViolationTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
