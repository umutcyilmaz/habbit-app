import type { BehaviorEventSource } from "../domain/models/BehaviorEventSource";
import type { ContentFreeState } from "../domain/models/ContentFreeState";
import type { ResetBaseline } from "../domain/models/ResetBaseline";
import type { ResetJourney, ResetViolation, RestartedResetAttempt } from "../domain/models/ResetJourney";
import type { ISODateString, UUID } from "../domain/models/shared";
import { getResetProgress } from "../domain/reset/getResetProgress";
import { normalizeContentFree, normalizeResetBaseline, normalizeResetJourney, normalizeResetViolation } from "./bloomProductStateSchema";
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
      reason: input.reason
    });
    if (reset.violations.some((existing) => existing.id === violation.id ||
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

function sameBehaviorSource(left: BehaviorEventSource, right: BehaviorEventSource): boolean {
  return left.kind === "manual"
    ? right.kind === "manual" && left.logActionId === right.logActionId
    : right.kind === "masturbationSession" && left.sessionId === right.sessionId;
}
