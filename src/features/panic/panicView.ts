import type { BehaviorSlipReason } from "../../domain/models/BehaviorSlip";
import type { ISODateString } from "../../domain/models/shared";
import { getBehaviorSlipImpact, type BehaviorSlipImpact } from "../../domain/productPolicy/getBehaviorSlipImpact";
import { getUrgeControlProgress, type UrgeControlProgress } from "../../domain/urgeControl/getUrgeControlProgress";
import type { BloomLocalState } from "../../storage/bloomState";

export type PanicFacts = Pick<BloomLocalState, "resetJourney" | "contentFree" | "urgeControl">;
export type PanicView =
  | { kind: "choices"; impact: BehaviorSlipImpact | null; canConfirmSlip: boolean }
  | { kind: "resume"; eventId: string; progress: UrgeControlProgress }
  | { kind: "unavailable" };

export function samePanicFacts(first: PanicFacts, second: PanicFacts): boolean {
  return first.resetJourney === second.resetJourney && first.contentFree === second.contentFree &&
    first.urgeControl === second.urgeControl;
}

export function getPanicView(facts: PanicFacts, reason: BehaviorSlipReason | null, at: ISODateString): PanicView {
  const event = facts.urgeControl.activeEvent;
  if (event !== null) {
    const progress = getUrgeControlProgress(facts.urgeControl, at);
    return progress === null ? { kind: "unavailable" } : { kind: "resume", eventId: event.id, progress };
  }
  const impact = reason === null ? null : getBehaviorSlipImpact(facts, reason, at);
  return { kind: "choices", impact,
    canConfirmSlip: impact !== null && (impact.reset !== "unchanged" || impact.contentFree !== "unchanged") };
}
