import type { BehaviorSlipReason } from "../domain/models/BehaviorSlip";
import type { ISODateString, UUID } from "../domain/models/shared";
import { getBehaviorSlipImpact } from "../domain/productPolicy/getBehaviorSlipImpact";
import { recordManualContentFreeViolationState } from "./bloomContentFreeTransitions";
import { normalizeContentFree, normalizeResetJourney } from "./bloomProductStateSchema";
import { recordActiveResetViolationState } from "./bloomResetTransitions";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type RecordBehaviorSlipInput = {
  reason: BehaviorSlipReason;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  logActionId: UUID;
  resetViolationId: UUID;
  replacementResetAttemptId: UUID;
  contentFreeViolationId: UUID;
};

// One manual behavior has one owner. Effective Reset owns linked Content-Free
// atomically; only an unrestricted event may use the standalone Content-Free
// transition. A rejected Reset transaction never falls back to another owner.
export function recordBehaviorSlipState(
  state: BloomLocalState,
  input: RecordBehaviorSlipInput
): BloomLocalState {
  try {
    if (!hasFields(input, ["reason", "occurredAt", "recordedAt", "logActionId", "resetViolationId",
      "replacementResetAttemptId", "contentFreeViolationId"]) ||
      !isValidBloomIsoTimestamp(input.occurredAt) || !isValidBloomIsoTimestamp(input.recordedAt) ||
      Date.parse(input.recordedAt) < Date.parse(input.occurredAt) ||
      ![input.logActionId, input.resetViolationId, input.replacementResetAttemptId, input.contentFreeViolationId]
        .every((id) => typeof id === "string" && id.trim().length > 0)) return state;

    normalizeResetJourney(state.resetJourney);
    normalizeContentFree(state.contentFree);
    // Source ownership spans both histories, including tombstones. A replay
    // cannot change its reason or move to another owner to become a new event.
    if ([...state.resetJourney.violations, ...state.contentFree.violations].some((violation) =>
      violation.source.kind === "manual" && violation.source.logActionId === input.logActionId)) return state;

    const impact = getBehaviorSlipImpact(state, input.reason, input.occurredAt);
    if (impact === null) return state;
    if (impact.reset === "restart") {
      return recordActiveResetViolationState(state, {
        violationId: input.resetViolationId,
        replacementAttemptId: input.replacementResetAttemptId,
        occurredAt: input.occurredAt,
        recordedAt: input.recordedAt,
        source: { kind: "manual", logActionId: input.logActionId },
        reason: input.reason,
        contentFreeViolationId: input.contentFreeViolationId
      });
    }
    if (impact.contentFree === "resetStreak") {
      return recordManualContentFreeViolationState(state, {
        violationId: input.contentFreeViolationId,
        logActionId: input.logActionId,
        occurredAt: input.occurredAt,
        recordedAt: input.recordedAt
      });
    }
    return state;
  } catch {
    return state;
  }
}

function hasFields(value: unknown, required: readonly string[]): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => keys.includes(key));
}
