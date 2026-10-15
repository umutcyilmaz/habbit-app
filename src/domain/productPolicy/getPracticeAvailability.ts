import type { BloomLocalState } from "../../storage/bloomState";
import { canOfferResetContentFreeContinuation } from "../contentFree/getResetContentFreeCredit";

export type PracticeAvailability = { canStart: boolean; reason: "available" | "unavailable" | "reset" | "reset_pending" };
// No elapsed-time interpretation: canonical active remains blocked until the
// Reset completion transition and required continuation choice are durable.
export function getPracticeAvailability(durable: BloomLocalState | null, ready: boolean, accepted: BloomLocalState | null = durable): PracticeAvailability {
  if (!ready || !durable || accepted!==durable) return {canStart:false,reason:"unavailable"};
  const reset=durable.resetJourney;
  if(reset.status==="active") return {canStart:false,reason:"reset"};
  if(reset.status==="baseline_pending" || reset.status==="completed" && canOfferResetContentFreeContinuation(durable,durable)) return {canStart:false,reason:"reset_pending"};
  if(!["inactive","recommended","completed"].includes(reset.status)) return {canStart:false,reason:"unavailable"};
  return {canStart:true,reason:"available"};
}
