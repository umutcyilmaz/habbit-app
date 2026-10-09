import { getContentFreeStreakSeconds } from "../domain/contentFree/getContentFreeStreakSeconds";
import { canOfferResetContentFreeContinuation, getResetContentFreeCredit } from "../domain/contentFree/getResetContentFreeCredit";
import type { ContentFreeState } from "../domain/models/ContentFreeState";
import type { ISODateString, UUID } from "../domain/models/shared";
import { getResetRestrictionStatus } from "../domain/productPolicy/getResetRestrictionStatus";
import { normalizeContentFree, normalizeResetJourney } from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type ActivateContentFreeInput = { activationId: UUID; activatedAt: ISODateString };
export type DeactivateContentFreeInput = { endedAt: ISODateString };
export type RecordManualContentFreeViolationInput = {
  violationId: UUID;
  logActionId: UUID;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
};
export type UndoManualContentFreeViolationInput = { violationId: UUID; undoneAt: ISODateString };

export function activateContentFreeState(state: BloomLocalState, input: ActivateContentFreeInput): BloomLocalState {
  return activateWithResetCredit(state, input, false);
}

function activateWithResetCredit(state: BloomLocalState, input: ActivateContentFreeInput, allowCompletedReset: boolean): BloomLocalState {
  const content = state.contentFree;
  if (content.status !== "inactive") return state;
  try {
    normalizeContentFree(content);
    if (!hasFields(input, ["activationId", "activatedAt"]) || !isValidBloomIsoTimestamp(input.activatedAt)) return state;
    if (content.pastActivations.some((activation) => activation.id === input.activationId ||
      Date.parse(input.activatedAt) < Date.parse(activation.endedAt)) ||
      content.violations.some((violation) => violation.activationId === input.activationId || violation.id === input.activationId)) return state;
    normalizeResetJourney(state.resetJourney);
    if (!allowCompletedReset && canOfferResetContentFreeContinuation(state, state)) return state;
    const resetCredit = state.resetJourney.status === "active" || allowCompletedReset
      ? getResetContentFreeCredit(state.resetJourney, content, input.activatedAt) : null;
    const contentFree: ContentFreeState = {
      ...content,
      ...(resetCredit === null ? {} : { resetCredit }),
      status: "active",
      activationId: input.activationId,
      activatedAt: input.activatedAt,
      currentStreakStartedAt: input.activatedAt
    };
    normalizeContentFree(contentFree);
    return { ...state, contentFree };
  } catch {
    return state;
  }
}

export function deactivateContentFreeState(state: BloomLocalState, input: DeactivateContentFreeInput): BloomLocalState {
  const content = state.contentFree;
  if (content.status !== "active") return state;
  try {
    normalizeContentFree(content);
    if (!hasFields(input, ["endedAt"]) || !isValidBloomIsoTimestamp(input.endedAt) ||
      Date.parse(input.endedAt) < Date.parse(content.activatedAt) ||
      Date.parse(input.endedAt) < Date.parse(content.currentStreakStartedAt)) return state;
    const contentFree: ContentFreeState = {
      status: "inactive",
      bestStreakSeconds: Math.max(content.bestStreakSeconds, getContentFreeStreakSeconds(content, content.currentStreakStartedAt, input.endedAt)),
      pastActivations: [...content.pastActivations, { id: content.activationId, startedAt: content.activatedAt, endedAt: input.endedAt, ...(content.resetCredit === undefined ? {} : { resetCredit: content.resetCredit }) }],
      violations: content.violations
    };
    // Also prevents archiving an end before any event in this activation.
    normalizeContentFree(contentFree);
    return { ...state, contentFree };
  } catch {
    return state;
  }
}

// This API always means intentional explicit-content use, with a manual origin.
// While Reset restricts behavior at occurredAt, its atomic violation transaction
// owns the event. A completed elapsed period needs no Reset restart.
export function recordManualContentFreeViolationState(
  state: BloomLocalState,
  input: RecordManualContentFreeViolationInput
): BloomLocalState {
  const content = state.contentFree;
  if (content.status !== "active") return state;
  try {
    normalizeContentFree(content);
    if (!hasFields(input, ["violationId", "logActionId", "occurredAt", "recordedAt"]) ||
      !isValidBloomIsoTimestamp(input.occurredAt) || !isValidBloomIsoTimestamp(input.recordedAt)) return state;
    const restriction = getResetRestrictionStatus(state.resetJourney, input.occurredAt);
    if (restriction === null || restriction.isRestrictionActive) return state;
    if (Date.parse(input.recordedAt) < Date.parse(input.occurredAt) ||
      Date.parse(input.occurredAt) < Date.parse(content.activatedAt) ||
      Date.parse(input.occurredAt) < Date.parse(content.currentStreakStartedAt) ||
      content.violations.some((violation) => violation.id === input.violationId ||
        (violation.source.kind === "manual" && violation.source.logActionId === input.logActionId))) return state;
    const contentFree: ContentFreeState = {
      ...content,
      currentStreakStartedAt: input.occurredAt,
      bestStreakSeconds: Math.max(content.bestStreakSeconds, getContentFreeStreakSeconds(content, content.currentStreakStartedAt, input.occurredAt)),
      violations: [...content.violations, {
        id: input.violationId,
        activationId: content.activationId,
        kind: "intentionalExplicitContent",
        occurredAt: input.occurredAt,
        recordedAt: input.recordedAt,
        source: { kind: "manual", logActionId: input.logActionId },
        streakBefore: {
          currentStreakStartedAt: content.currentStreakStartedAt,
          bestStreakSeconds: content.bestStreakSeconds
        },
        status: "recorded"
      }]
    };
    normalizeContentFree(contentFree);
    return { ...state, contentFree };
  } catch {
    return state;
  }
}

// Restore only a safely reversible latest standalone manual event. Keep its
// source consumed as a tombstone, and leave other transaction owners untouched.
export function undoManualContentFreeViolationState(
  state: BloomLocalState,
  input: UndoManualContentFreeViolationInput
): BloomLocalState {
  const content = state.contentFree;
  if (content.status !== "active") return state;
  try {
    normalizeContentFree(content);
    if (!hasFields(input, ["violationId", "undoneAt"])) return state;
    const target = content.violations.find((violation) => violation.id === input.violationId);
    if (target === undefined || target.status !== "recorded" || target.source.kind !== "manual" ||
      !isValidBloomIsoTimestamp(input.undoneAt) || Date.parse(input.undoneAt) < Date.parse(target.recordedAt)) return state;
    // Valid Reset history is needed to establish ownership, even after a
    // linked Reset violation has been undone or its journey has completed.
    normalizeResetJourney(state.resetJourney);
    const logActionId = target.source.logActionId;
    if (state.resetJourney.violations.some((violation) =>
      violation.source.kind === "manual" && violation.source.logActionId === logActionId)) return state;
    if (target.activationId !== content.activationId || content.currentStreakStartedAt !== target.occurredAt ||
      Date.parse(target.streakBefore.currentStreakStartedAt) > Date.parse(target.occurredAt)) return state;
    const effective = content.violations.filter((violation) =>
      violation.status === "recorded" && violation.activationId === content.activationId);
    if (effective[effective.length - 1] !== target ||
      effective.some((violation) => Date.parse(violation.occurredAt) > Date.parse(target.occurredAt)) ||
      effective.some((violation) => violation !== target &&
        Date.parse(violation.occurredAt) > Date.parse(target.streakBefore.currentStreakStartedAt))) return state;
    const endedSeconds = getContentFreeStreakSeconds(content, target.streakBefore.currentStreakStartedAt, target.occurredAt, target.activationId, target.id);
    if (content.bestStreakSeconds !== Math.max(target.streakBefore.bestStreakSeconds, endedSeconds)) return state;
    const contentFree: ContentFreeState = {
      ...content,
      currentStreakStartedAt: target.streakBefore.currentStreakStartedAt,
      bestStreakSeconds: target.streakBefore.bestStreakSeconds,
      violations: content.violations.map((violation) => violation === target
        ? { ...violation, status: "undone", undoneAt: input.undoneAt }
        : violation)
    };
    normalizeContentFree(contentFree);
    return { ...state, contentFree };
  } catch {
    return state;
  }
}

function hasFields(value: unknown, required: readonly string[]): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => keys.includes(key));
}

// One atomic, acknowledged decision. IDs/time are prepared by the flow factory.
// Repeated acceptance, decline, or later activation cannot consume it twice.
export function decideResetContentFreeContinuationState(
  state: BloomLocalState,
  input: { decision: "accepted" | "declined"; decidedAt: ISODateString; activationId: UUID }
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "completed" || reset.contentFreeContinuation !== undefined || state.contentFree.status !== "inactive") return state;
  try {
    normalizeResetJourney(reset);
    normalizeContentFree(state.contentFree);
    if (!canOfferResetContentFreeContinuation(state, state)) return state;
    if (!hasFields(input, ["decision", "decidedAt", "activationId"]) ||
      !["accepted", "declined"].includes(input.decision) || !isValidBloomIsoTimestamp(input.decidedAt) ||
      Date.parse(input.decidedAt) < Date.parse(reset.completedAt)) return state;
    const activated = input.decision === "accepted"
      ? activateWithResetCredit(state, { activationId: input.activationId, activatedAt: input.decidedAt }, true) : state;
    if (input.decision === "accepted" && activated === state) return state;
    const resetJourney = { ...reset, contentFreeContinuation: { decision: input.decision, decidedAt: input.decidedAt } };
    normalizeResetJourney(resetJourney);
    return { ...activated, resetJourney };
  } catch { return state; }
}
