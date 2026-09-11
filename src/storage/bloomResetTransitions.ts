import type { BehaviorEventSource } from "../domain/models/BehaviorEventSource";
import type { ContentFreeState } from "../domain/models/ContentFreeState";
import type { PostResetAssessment } from "../domain/models/PostResetAssessment";
import type { ResetBaseline } from "../domain/models/ResetBaseline";
import type { ResetCompletedDays, ResetJourney, ResetViolation, RestartedResetAttempt } from "../domain/models/ResetJourney";
import type { ISODateString, UUID } from "../domain/models/shared";
import { getResetProgress } from "../domain/reset/getResetProgress";
import {
  normalizeContentFree,
  normalizeMasturbationTracking,
  normalizePostResetAssessment,
  normalizeResetBaseline,
  normalizeResetJourney,
  normalizeResetViolation
} from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type StartResetFromBaselineInput = {
  resetBaseline: ResetBaseline;
  resetAttemptId: UUID;
  startedAt: ISODateString;
};

export type RecordActiveResetViolationInput = {
  violationId: UUID;
  replacementAttemptId: UUID;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  source: BehaviorEventSource;
  reason: ResetViolation["reason"];
  contentFreeViolationId?: UUID;
};

export type UndoActiveResetViolationInput = {
  violationId: UUID;
  undoneAt: ISODateString;
};

export type CompleteElapsedResetPeriodInput = {
  observedAt: ISODateString;
};

// Complete preparation and start one attempt using only supplied facts.
// Repeated starts and invalid inputs follow the existing exact no-op pattern.
export function startResetFromBaselineState(
  state: BloomLocalState,
  input: StartResetFromBaselineInput
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "baseline_pending") return state;

  try {
    // Reject partially started source state before constructing its successor.
    normalizeResetJourney(reset);
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const keys = Object.keys(input);
    if (keys.length !== 3 || !keys.includes("resetBaseline") ||
      !keys.includes("resetAttemptId") || !keys.includes("startedAt")) return state;
    const { startedAt, resetAttemptId } = input;
    if (!isValidBloomIsoTimestamp(startedAt)) return state;
    const baseline = normalizeResetBaseline(input.resetBaseline);
    if (Date.parse(startedAt) < Date.parse(baseline.capturedAt)) return state;

    const resetJourney: ResetJourney = {
      status: "active",
      id: reset.id,
      durationDays: reset.durationDays,
      bestCompletedDays: reset.bestCompletedDays,
      pastAttempts: reset.pastAttempts,
      violations: reset.violations,
      baseline,
      startedAt,
      currentAttempt: { id: resetAttemptId, status: "active", startedAt }
    };
    // Validate identities, history references, and non-overlapping attempts.
    normalizeResetJourney(resetJourney);
    return { ...state, resetJourney };
  } catch {
    return state;
  }
}

// Record one behavior across the affected systems without replaying history.
// All identities and times are explicit; the occurrence time owns the restart.
export function recordActiveResetViolationState(
  state: BloomLocalState,
  input: RecordActiveResetViolationInput
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "active") return state;

  try {
    normalizeResetJourney(reset);
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const required = ["violationId", "replacementAttemptId", "occurredAt", "recordedAt", "source", "reason"];
    const keys = Object.keys(input);
    if (!required.every((key) => keys.includes(key)) ||
      keys.some((key) => !required.includes(key) && key !== "contentFreeViolationId")) return state;

    // Reuse validation for IDs, canonical time ordering, reason, and a detached
    // source snapshot. Both violation records will share this same source.
    const violation = normalizeResetViolation({
      id: input.violationId,
      attemptId: reset.currentAttempt.id,
      occurredAt: input.occurredAt,
      recordedAt: input.recordedAt,
      source: input.source,
      reason: input.reason,
      status: "recorded",
      bestCompletedDaysBefore: reset.bestCompletedDays
    });
    if (reset.violations.some((existing) => existing.id === violation.id ||
      existing.attemptId === input.replacementAttemptId ||
      sameBehaviorSource(existing.source, violation.source))) return state;
    const { occurredAt, recordedAt, source } = violation;
    if (Date.parse(occurredAt) < Date.parse(reset.currentAttempt.startedAt)) return state;
    const progress = getResetProgress(reset, occurredAt);
    if (progress === null || progress.isPeriodComplete || progress.completedDays === 15) return state;

    const archived: RestartedResetAttempt = {
      id: reset.currentAttempt.id,
      status: "restarted",
      startedAt: reset.currentAttempt.startedAt,
      endedAt: occurredAt,
      completedDays: progress.completedDays,
      restartViolationId: violation.id
    };
    const resetJourney: ResetJourney = {
      ...reset,
      bestCompletedDays: reset.bestCompletedDays > progress.completedDays ? reset.bestCompletedDays : progress.completedDays,
      pastAttempts: [...reset.pastAttempts, archived],
      violations: [...reset.violations, violation],
      currentAttempt: { id: input.replacementAttemptId, status: "active", startedAt: occurredAt }
    };
    // Includes replacement identity uniqueness and the archive's linked event.
    normalizeResetJourney(resetJourney);

    let contentFree: ContentFreeState = state.contentFree;
    if (violation.reason !== "masturbation") {
      normalizeContentFree(contentFree);
      if (contentFree.status === "active") {
        const contentFreeViolationId = input.contentFreeViolationId;
        if (!keys.includes("contentFreeViolationId") || typeof contentFreeViolationId !== "string" ||
          Date.parse(occurredAt) < Date.parse(contentFree.currentStreakStartedAt) ||
          contentFree.violations.some((existing) => existing.id === contentFreeViolationId ||
            sameBehaviorSource(existing.source, source))) return state;
        const streakBefore = {
          currentStreakStartedAt: contentFree.currentStreakStartedAt,
          bestStreakSeconds: contentFree.bestStreakSeconds
        };
        const elapsedSeconds = Math.floor((Date.parse(occurredAt) - Date.parse(streakBefore.currentStreakStartedAt)) / 1000);
        const updated: ContentFreeState = {
          ...contentFree,
          currentStreakStartedAt: occurredAt,
          bestStreakSeconds: Math.max(contentFree.bestStreakSeconds, elapsedSeconds),
          violations: [...contentFree.violations, {
            id: contentFreeViolationId,
            activationId: contentFree.activationId,
            kind: "intentionalExplicitContent",
            occurredAt,
            recordedAt,
            source,
            streakBefore,
            status: "recorded"
          }]
        };
        normalizeContentFree(updated);
        contentFree = updated;
      }
    }

    // Publish only after both candidate slices validate. No other slice changes.
    return { ...state, resetJourney, contentFree };
  } catch {
    return state;
  }
}

// Reverse only the latest effective restart. Tombstones keep source identities
// handled, while the former active attempt resumes from its original start.
export function undoActiveResetViolationState(
  state: BloomLocalState,
  input: UndoActiveResetViolationInput
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "active") return state;

  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const keys = Object.keys(input);
    if (keys.length !== 2 || !keys.includes("violationId") || !keys.includes("undoneAt")) return state;
    const target = reset.violations.find((violation) => violation.id === input.violationId);
    if (target === undefined || target.status !== "recorded") return state;
    normalizeResetJourney(reset);
    const { undoneAt } = input;
    if (!isValidBloomIsoTimestamp(undoneAt) || Date.parse(undoneAt) < Date.parse(target.recordedAt)) return state;

    const effective = reset.violations.filter((violation) => violation.status === "recorded");
    const archived = reset.pastAttempts[reset.pastAttempts.length - 1];
    if (effective[effective.length - 1] !== target || archived?.status !== "restarted" ||
      archived.restartViolationId !== target.id || archived.id !== target.attemptId ||
      archived.endedAt !== target.occurredAt || reset.currentAttempt.startedAt !== target.occurredAt ||
      effective.some((violation) => violation.attemptId === reset.currentAttempt.id)) return state;

    const pastAttempts = reset.pastAttempts.slice(0, -1);
    const bestCompletedDays = bestBeforeRestart(reset.bestCompletedDays, pastAttempts, archived, target);
    if (bestCompletedDays === null) return state;

    // Source linkage is checked even for masturbation-only events. An
    // unexpected linked Content-Free record makes a Reset-only undo unsafe.
    let contentFree: ContentFreeState = state.contentFree;
    normalizeContentFree(contentFree);
    const linked = contentFree.violations.filter((violation) => sameBehaviorSource(violation.source, target.source));
    if (target.reason === "masturbation") {
      if (linked.length !== 0) return state;
    } else if (linked.length === 0) {
      // No record is not itself proof that Content-Free was unaffected. Use
      // activation boundaries to rule out an active program at logging time.
      // Equality at a boundary is ambiguous, so conservatively reject it.
      const loggedAt = Date.parse(target.recordedAt);
      if ((contentFree.status === "active" && Date.parse(contentFree.activatedAt) <= loggedAt) ||
        contentFree.pastActivations.some((activation) =>
          Date.parse(activation.startedAt) <= loggedAt && loggedAt <= Date.parse(activation.endedAt))) return state;
    } else {
      const violation = linked[0];
      if (linked.length !== 1 || violation === undefined || violation.status !== "recorded" ||
        contentFree.status !== "active" || violation.activationId !== contentFree.activationId ||
        violation.occurredAt !== target.occurredAt || violation.recordedAt !== target.recordedAt ||
        contentFree.currentStreakStartedAt !== violation.occurredAt ||
        Date.parse(violation.streakBefore.currentStreakStartedAt) > Date.parse(violation.occurredAt)) return state;
      const effectiveContent = contentFree.violations.filter((entry) =>
        entry.status === "recorded" && entry.activationId === violation.activationId);
      if (effectiveContent[effectiveContent.length - 1] !== violation ||
        effectiveContent.some((entry) => Date.parse(entry.occurredAt) > Date.parse(violation.occurredAt))) return state;
      const endedSeconds = Math.floor((Date.parse(violation.occurredAt) - Date.parse(violation.streakBefore.currentStreakStartedAt)) / 1000);
      if (contentFree.bestStreakSeconds !== Math.max(violation.streakBefore.bestStreakSeconds, endedSeconds)) return state;
      contentFree = {
        ...contentFree,
        currentStreakStartedAt: violation.streakBefore.currentStreakStartedAt,
        bestStreakSeconds: violation.streakBefore.bestStreakSeconds,
        violations: contentFree.violations.map((entry) => entry === violation ? { ...entry, status: "undone", undoneAt } : entry)
      };
      normalizeContentFree(contentFree);
    }

    const resetJourney: ResetJourney = {
      ...reset,
      bestCompletedDays,
      pastAttempts,
      currentAttempt: { id: archived.id, status: "active", startedAt: archived.startedAt },
      violations: reset.violations.map((violation) => violation === target ? { ...violation, status: "undone", undoneAt } : violation)
    };
    normalizeResetJourney(resetJourney);
    return { ...state, resetJourney, contentFree };
  } catch {
    return state;
  }
}

// Persist an elapsed period's actual end, independently of when it is observed.
// Selectors and hydration never call this transition automatically.
export function completeElapsedResetPeriodState(
  state: BloomLocalState,
  input: CompleteElapsedResetPeriodInput
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "active") return state;

  try {
    normalizeResetJourney(reset);
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const keys = Object.keys(input);
    if (keys.length !== 1 || !keys.includes("observedAt")) return state;
    const progress = getResetProgress(reset, input.observedAt);
    if (progress === null || !progress.isPeriodComplete || progress.completedDays !== 15) return state;
    const periodCompletedAt = new Date(
      Date.parse(reset.currentAttempt.startedAt) + reset.durationDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const resetJourney: ResetJourney = {
      ...reset,
      status: "assessment_pending",
      bestCompletedDays: 15,
      completedAt: periodCompletedAt,
      currentAttempt: {
        id: reset.currentAttempt.id,
        status: "completed",
        startedAt: reset.currentAttempt.startedAt,
        completedAt: periodCompletedAt,
        completedDays: 15
      }
    };
    normalizeResetJourney(resetJourney);
    return { ...state, resetJourney };
  } catch {
    return state;
  }
}

// Readiness is descriptive. Any valid assessment finishes this lifecycle and
// enables Tracking, without creating or replacing session history.
export function completePostResetAssessmentState(
  state: BloomLocalState,
  assessment: PostResetAssessment
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "assessment_pending") return state;

  try {
    normalizeResetJourney(reset);
    const tracking = state.masturbationTracking;
    if (tracking.currentSession !== null) return state;
    normalizeMasturbationTracking(tracking);
    const captured = normalizePostResetAssessment(assessment);
    if (captured.resetJourneyId !== reset.id || captured.resetAttemptId !== reset.currentAttempt.id ||
      captured.baselineId !== reset.baseline.id || Date.parse(captured.completedAt) < Date.parse(reset.completedAt)) return state;
    const resetJourney: ResetJourney = { ...reset, status: "completed", assessment: captured };
    normalizeResetJourney(resetJourney);
    return {
      ...state,
      resetJourney,
      masturbationTracking: tracking.enabled ? tracking : { ...tracking, enabled: true }
    };
  } catch {
    return state;
  }
}

function bestBeforeRestart(
  currentBest: ResetCompletedDays,
  remaining: ResetJourney["pastAttempts"],
  archived: RestartedResetAttempt,
  violation: ResetViolation
): ResetCompletedDays | null {
  const historicalBest = remaining.reduce<ResetCompletedDays>((best, attempt) =>
    attempt.completedDays > best ? attempt.completedDays : best, 0);
  const prior = violation.bestCompletedDaysBefore;
  if (prior !== undefined) {
    return prior >= historicalBest && currentBest === Math.max(prior, archived.completedDays) ? prior : null;
  }
  // Legacy records lack a snapshot. If the archived attempt tied a best that
  // remaining history cannot explain, the prior summary is unknowable.
  return currentBest > archived.completedDays || currentBest === historicalBest ? currentBest : null;
}

function sameBehaviorSource(left: BehaviorEventSource, right: BehaviorEventSource): boolean {
  return left.kind === "manual"
    ? right.kind === "manual" && left.logActionId === right.logActionId
    : right.kind === "masturbationSession" && left.sessionId === right.sessionId;
}
