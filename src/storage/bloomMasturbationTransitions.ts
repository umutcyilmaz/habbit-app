import type { ContentFreeState } from "../domain/models/ContentFreeState";
import type { CompletedMasturbationPause, MasturbationSessionFeedback } from "../domain/models/MasturbationSession";
import type { CompletedMasturbationSession, MasturbationTrackingState } from "../domain/models/MasturbationTrackingState";
import type { ISODateString, UUID } from "../domain/models/shared";
import { getMasturbationTrackingAvailability } from "../domain/productPolicy/getMasturbationTrackingAvailability";
import {
  normalizeContentFree,
  normalizeMasturbationSessionFeedback,
  normalizeMasturbationTracking
} from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type StartMasturbationSessionInput = { sessionId: UUID; startedAt: ISODateString };
export type StartMasturbationPauseInput = { startedAt: ISODateString };
export type EndMasturbationPauseInput = { endedAt: ISODateString };
export type EndMasturbationSessionInput = { endedAt: ISODateString };
export type CompleteMasturbationSessionFeedbackInput = {
  feedback: MasturbationSessionFeedback;
  recordedAt: ISODateString;
  contentFreeViolationId?: UUID;
};

// Tracking is the permission source. No onboarding dependency or wall clock.
export function startMasturbationSessionState(
  state: BloomLocalState,
  input: StartMasturbationSessionInput
): BloomLocalState {
  const tracking = state.masturbationTracking;
  try {
    normalizeMasturbationTracking(tracking);
    if (!hasFields(input, ["sessionId", "startedAt"])) return state;
    const availability = getMasturbationTrackingAvailability(state, input.startedAt);
    if (availability === null || !availability.canStartSession) return state;
    const masturbationTracking: MasturbationTrackingState = {
      ...tracking,
      currentSession: { id: input.sessionId, status: "active", startedAt: input.startedAt, pauses: [] }
    };
    // Includes canonical time, nonempty identity, and history ID uniqueness.
    normalizeMasturbationTracking(masturbationTracking);
    return { ...state, masturbationTracking };
  } catch {
    return state;
  }
}

export function startMasturbationPauseState(
  state: BloomLocalState,
  input: StartMasturbationPauseInput
): BloomLocalState {
  const tracking = state.masturbationTracking;
  const session = tracking.currentSession;
  if (session?.status !== "active") return state;
  try {
    normalizeMasturbationTracking(tracking);
    if (!hasFields(input, ["startedAt"]) || session.pauses.some((pause) => pause.status === "active")) return state;
    const masturbationTracking: MasturbationTrackingState = {
      ...tracking,
      currentSession: { ...session, pauses: [...session.pauses, { status: "active", startedAt: input.startedAt }] }
    };
    // Validates the new pause against the session start and previous pause end.
    normalizeMasturbationTracking(masturbationTracking);
    return { ...state, masturbationTracking };
  } catch {
    return state;
  }
}

export function endMasturbationPauseState(
  state: BloomLocalState,
  input: EndMasturbationPauseInput
): BloomLocalState {
  const tracking = state.masturbationTracking;
  const session = tracking.currentSession;
  if (session?.status !== "active") return state;
  try {
    normalizeMasturbationTracking(tracking);
    if (!hasFields(input, ["endedAt"]) || !isValidBloomIsoTimestamp(input.endedAt)) return state;
    const pause = session.pauses[session.pauses.length - 1];
    if (pause?.status !== "active" || Date.parse(input.endedAt) < Date.parse(pause.startedAt)) return state;
    const completedPause: CompletedMasturbationPause = {
      ...pause,
      status: "completed",
      endedAt: input.endedAt,
      durationSeconds: elapsedSeconds(pause.startedAt, input.endedAt)
    };
    const masturbationTracking: MasturbationTrackingState = {
      ...tracking,
      currentSession: { ...session, pauses: [...session.pauses.slice(0, -1), completedPause] }
    };
    normalizeMasturbationTracking(masturbationTracking);
    return { ...state, masturbationTracking };
  } catch {
    return state;
  }
}

// End the physical event only. Its full elapsed duration includes all pauses.
export function endMasturbationSessionState(
  state: BloomLocalState,
  input: EndMasturbationSessionInput
): BloomLocalState {
  const tracking = state.masturbationTracking;
  const session = tracking.currentSession;
  if (session?.status !== "active") return state;
  try {
    normalizeMasturbationTracking(tracking);
    if (!hasFields(input, ["endedAt"]) || !isValidBloomIsoTimestamp(input.endedAt) ||
      Date.parse(input.endedAt) < Date.parse(session.startedAt)) return state;
    const endedAt = input.endedAt;
    if (session.pauses.some((pause) => Date.parse(endedAt) < Date.parse(
      pause.status === "active" ? pause.startedAt : pause.endedAt
    ))) return state;
    const pauses: CompletedMasturbationPause[] = session.pauses.map((pause) => pause.status === "completed"
      ? pause
      : { ...pause, status: "completed", endedAt, durationSeconds: elapsedSeconds(pause.startedAt, endedAt) });
    const masturbationTracking: MasturbationTrackingState = {
      ...tracking,
      currentSession: {
        ...session,
        status: "awaiting_feedback",
        endedAt,
        durationSeconds: elapsedSeconds(session.startedAt, endedAt),
        pauses
      }
    };
    normalizeMasturbationTracking(masturbationTracking);
    return { ...state, masturbationTracking };
  } catch {
    return state;
  }
}

// Feedback resolves an existing physical event even if Tracking is now disabled.
export function completeMasturbationSessionFeedbackState(
  state: BloomLocalState,
  input: CompleteMasturbationSessionFeedbackInput
): BloomLocalState {
  const tracking = state.masturbationTracking;
  const session = tracking.currentSession;
  if (session?.status !== "awaiting_feedback") return state;
  try {
    normalizeMasturbationTracking(tracking);
    if (!hasFields(input, ["feedback", "recordedAt"], ["contentFreeViolationId"]) ||
      !hasFields(input.feedback, ["erectionQuality", "usedExplicitContent", "endingReason"]) ||
      !isValidBloomIsoTimestamp(input.recordedAt) || Date.parse(input.recordedAt) < Date.parse(session.endedAt)) return state;
    const feedback = normalizeMasturbationSessionFeedback(input.feedback);
    const completed: CompletedMasturbationSession = { ...session, ...feedback, status: "completed" };
    const masturbationTracking: MasturbationTrackingState = {
      ...tracking,
      currentSession: null,
      sessions: [...tracking.sessions, completed]
    };
    normalizeMasturbationTracking(masturbationTracking);

    let contentFree: ContentFreeState = state.contentFree;
    if (feedback.usedExplicitContent) {
      normalizeContentFree(contentFree);
      // V1 uses physical session end as the event anchor, not a claim about
      // the exact instant explicit content was first used during the session.
      const occurredAt = session.endedAt;
      if (contentFree.status === "active" && Date.parse(contentFree.activatedAt) <= Date.parse(occurredAt)) {
        const violationId = input.contentFreeViolationId;
        if (typeof violationId !== "string" || Date.parse(occurredAt) < Date.parse(contentFree.currentStreakStartedAt) ||
          contentFree.violations.some((violation) => violation.id === violationId ||
            (violation.source.kind === "masturbationSession" && violation.source.sessionId === session.id))) return state;
        const streakBefore = {
          currentStreakStartedAt: contentFree.currentStreakStartedAt,
          bestStreakSeconds: contentFree.bestStreakSeconds
        };
        const updated: ContentFreeState = {
          ...contentFree,
          currentStreakStartedAt: occurredAt,
          bestStreakSeconds: Math.max(contentFree.bestStreakSeconds, elapsedSeconds(contentFree.currentStreakStartedAt, occurredAt)),
          violations: [...contentFree.violations, {
            id: violationId,
            activationId: contentFree.activationId,
            kind: "intentionalExplicitContent",
            occurredAt,
            recordedAt: input.recordedAt,
            source: { kind: "masturbationSession", sessionId: session.id },
            status: "recorded",
            streakBefore
          }]
        };
        normalizeContentFree(updated);
        contentFree = updated;
      }
    }
    // Publish both candidate slices together only after all validation passes.
    return { ...state, masturbationTracking, contentFree };
  } catch {
    return state;
  }
}

export function discardActiveMasturbationSessionState(state: BloomLocalState): BloomLocalState {
  const tracking = state.masturbationTracking;
  if (tracking.currentSession?.status !== "active") return state;
  try {
    normalizeMasturbationTracking(tracking);
    return { ...state, masturbationTracking: { ...tracking, currentSession: null } };
  } catch {
    return state;
  }
}

function elapsedSeconds(startedAt: ISODateString, endedAt: ISODateString): number {
  return Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
}

function hasFields(value: unknown, required: readonly string[], optional: readonly string[] = []): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}
