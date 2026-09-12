import type { ContentFreeState, ContentFreeViolation } from "../domain/models/ContentFreeState";
import type { MasturbationSessionFeedback } from "../domain/models/MasturbationSession";
import type { CompletedMasturbationSession } from "../domain/models/MasturbationTrackingState";
import type { ISODateString, UUID } from "../domain/models/shared";
import {
  normalizeContentFree,
  normalizeMasturbationSessionFeedback,
  normalizeMasturbationTracking,
  normalizeResetJourney
} from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type EditCompletedMasturbationSessionFeedbackInput = {
  sessionId: UUID;
  feedback: MasturbationSessionFeedback;
  editedAt: ISODateString;
  contentFreeViolationId?: UUID;
};
export type DeleteCompletedMasturbationSessionInput = { sessionId: UUID; deletedAt: ISODateString };

export function editCompletedMasturbationSessionFeedbackState(
  state: BloomLocalState,
  input: EditCompletedMasturbationSessionFeedbackInput
): BloomLocalState {
  try {
    if (!hasFields(input, ["sessionId", "feedback", "editedAt"], ["contentFreeViolationId"]) ||
      !hasFields(input.feedback, ["erectionQuality", "usedExplicitContent", "endingReason"]) ||
      !isValidBloomIsoTimestamp(input.editedAt)) return state;
    const tracking = state.masturbationTracking;
    normalizeMasturbationTracking(tracking);
    const session = tracking.sessions.find((entry) => entry.id === input.sessionId);
    if (session === undefined || Date.parse(input.editedAt) < Date.parse(session.endedAt)) return state;
    const feedback = normalizeMasturbationSessionFeedback(input.feedback);
    if (sameFeedback(session, feedback)) return state;

    let contentFree = state.contentFree;
    if (session.usedExplicitContent !== feedback.usedExplicitContent) {
      if (hasResetLink(state, session.id)) return state;
      normalizeContentFree(contentFree);
      // Container validation guarantees no duplicate source across either status.
      const linked = findSessionViolation(contentFree, session.id);
      const reconciled = feedback.usedExplicitContent
        ? addOrReapplyViolation(contentFree, session, linked, input.editedAt, input.contentFreeViolationId)
        : removeEffectiveViolation(contentFree, session, linked, input.editedAt);
      if (reconciled === null) return state;
      normalizeContentFree(reconciled);
      contentFree = reconciled;
    }

    const masturbationTracking = {
      ...tracking,
      sessions: tracking.sessions.map((entry) => entry === session ? { ...entry, ...feedback } : entry)
    };
    normalizeMasturbationTracking(masturbationTracking);
    return { ...state, masturbationTracking, contentFree };
  } catch {
    return state;
  }
}

export function deleteCompletedMasturbationSessionState(
  state: BloomLocalState,
  input: DeleteCompletedMasturbationSessionInput
): BloomLocalState {
  try {
    if (!hasFields(input, ["sessionId", "deletedAt"]) || !isValidBloomIsoTimestamp(input.deletedAt)) return state;
    const tracking = state.masturbationTracking;
    normalizeMasturbationTracking(tracking);
    const session = tracking.sessions.find((entry) => entry.id === input.sessionId);
    if (session === undefined || Date.parse(input.deletedAt) < Date.parse(session.endedAt) || hasResetLink(state, session.id)) return state;
    let contentFree = state.contentFree;
    normalizeContentFree(contentFree);
    const linked = findSessionViolation(contentFree, session.id);
    if (linked?.status === "recorded") {
      const restored = undoSessionViolation(contentFree, session, linked, input.deletedAt);
      if (restored === null) return state;
      normalizeContentFree(restored);
      contentFree = restored;
    }
    // No effective dependency remains for missing or already-undone links.
    // Keep any Content-Free tombstone, but do not invent a deleted-session row.
    const masturbationTracking = { ...tracking, sessions: tracking.sessions.filter((entry) => entry !== session) };
    normalizeMasturbationTracking(masturbationTracking);
    return { ...state, masturbationTracking, contentFree };
  } catch {
    return state;
  }
}

function addOrReapplyViolation(
  content: ContentFreeState,
  session: CompletedMasturbationSession,
  linked: ContentFreeViolation | undefined,
  editedAt: ISODateString,
  violationId: UUID | undefined
): ContentFreeState | null {
  if (linked !== undefined) {
    if (linked.status !== "undone" || content.status !== "active" || linked.activationId !== content.activationId ||
      linked.occurredAt !== session.endedAt || Date.parse(editedAt) < Date.parse(linked.undoneAt) ||
      content.currentStreakStartedAt !== linked.streakBefore.currentStreakStartedAt ||
      content.bestStreakSeconds !== linked.streakBefore.bestStreakSeconds ||
      Date.parse(linked.occurredAt) < Date.parse(content.currentStreakStartedAt)) return null;
    const linkedIndex = content.violations.indexOf(linked);
    if (content.violations.some((entry, index) => entry.status === "recorded" && entry.activationId === content.activationId &&
      (index > linkedIndex || Date.parse(entry.occurredAt) > Date.parse(linked.streakBefore.currentStreakStartedAt)))) return null;
    // Reuse the original identity, occurrence/recording times, and prior snapshot.
    // The optional new-record ID is irrelevant when this source already exists.
    const { undoneAt: _undoneAt, ...original } = linked;
    const reapplied: ContentFreeViolation = { ...original, status: "recorded" };
    return {
      ...content,
      currentStreakStartedAt: linked.occurredAt,
      bestStreakSeconds: Math.max(content.bestStreakSeconds, elapsedSeconds(content.currentStreakStartedAt, linked.occurredAt)),
      violations: content.violations.map((entry) => entry === linked ? reapplied : entry)
    };
  }

  const applicability = activationAtEvent(content, session.endedAt);
  if (applicability === "none") return content;
  if (applicability !== "current" || content.status !== "active" || typeof violationId !== "string" ||
    Date.parse(session.endedAt) < Date.parse(content.currentStreakStartedAt) ||
    content.violations.some((entry) => entry.id === violationId)) return null;
  return {
    ...content,
    currentStreakStartedAt: session.endedAt,
    bestStreakSeconds: Math.max(content.bestStreakSeconds, elapsedSeconds(content.currentStreakStartedAt, session.endedAt)),
    violations: [...content.violations, {
      id: violationId,
      activationId: content.activationId,
      kind: "intentionalExplicitContent",
      occurredAt: session.endedAt,
      recordedAt: editedAt,
      source: { kind: "masturbationSession", sessionId: session.id },
      streakBefore: { currentStreakStartedAt: content.currentStreakStartedAt, bestStreakSeconds: content.bestStreakSeconds },
      status: "recorded"
    }]
  };
}

function removeEffectiveViolation(
  content: ContentFreeState,
  session: CompletedMasturbationSession,
  linked: ContentFreeViolation | undefined,
  editedAt: ISODateString
): ContentFreeState | null {
  if (linked === undefined) {
    // A missing link is only explainable when no activation covered the event.
    return activationAtEvent(content, session.endedAt) === "none" ? content : null;
  }
  if (linked.status === "undone") return content;
  return undoSessionViolation(content, session, linked, editedAt);
}

function undoSessionViolation(
  content: ContentFreeState,
  session: CompletedMasturbationSession,
  linked: ContentFreeViolation,
  correctedAt: ISODateString
): ContentFreeState | null {
  if (content.status !== "active" || linked.status !== "recorded" || linked.activationId !== content.activationId ||
    linked.occurredAt !== session.endedAt || content.currentStreakStartedAt !== linked.occurredAt ||
    Date.parse(correctedAt) < Date.parse(linked.recordedAt) ||
    Date.parse(linked.streakBefore.currentStreakStartedAt) > Date.parse(linked.occurredAt)) return null;
  const effective = content.violations.filter((entry) => entry.status === "recorded" && entry.activationId === content.activationId);
  if (effective[effective.length - 1] !== linked ||
    effective.some((entry) => Date.parse(entry.occurredAt) > Date.parse(linked.occurredAt)) ||
    effective.some((entry) => entry !== linked && Date.parse(entry.occurredAt) > Date.parse(linked.streakBefore.currentStreakStartedAt))) return null;
  const endedSeconds = elapsedSeconds(linked.streakBefore.currentStreakStartedAt, linked.occurredAt);
  if (content.bestStreakSeconds !== Math.max(linked.streakBefore.bestStreakSeconds, endedSeconds)) return null;
  return {
    ...content,
    currentStreakStartedAt: linked.streakBefore.currentStreakStartedAt,
    bestStreakSeconds: linked.streakBefore.bestStreakSeconds,
    violations: content.violations.map((entry) => entry === linked ? { ...entry, status: "undone", undoneAt: correctedAt } : entry)
  };
}

function activationAtEvent(content: ContentFreeState, occurredAt: ISODateString): "none" | "current" | "pastOrAmbiguous" {
  const time = Date.parse(occurredAt);
  // Existing persisted interval validation allows events at either endpoint.
  // Without a linked activation ID, a shared boundary cannot be assigned safely.
  if (content.pastActivations.some((activation) => Date.parse(activation.startedAt) <= time && time <= Date.parse(activation.endedAt))) {
    return "pastOrAmbiguous";
  }
  return content.status === "active" && Date.parse(content.activatedAt) <= time ? "current" : "none";
}

function hasResetLink(state: BloomLocalState, sessionId: UUID): boolean {
  normalizeResetJourney(state.resetJourney);
  return state.resetJourney.violations.some((violation) => violation.source.kind === "masturbationSession" && violation.source.sessionId === sessionId);
}

function findSessionViolation(content: ContentFreeState, sessionId: UUID): ContentFreeViolation | undefined {
  return content.violations.find((violation) => violation.source.kind === "masturbationSession" && violation.source.sessionId === sessionId);
}

function sameFeedback(left: MasturbationSessionFeedback, right: MasturbationSessionFeedback): boolean {
  return left.erectionQuality === right.erectionQuality && left.usedExplicitContent === right.usedExplicitContent && left.endingReason === right.endingReason;
}

function elapsedSeconds(startedAt: ISODateString, endedAt: ISODateString): number {
  return Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
}

function hasFields(value: unknown, required: readonly string[], optional: readonly string[] = []): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}
