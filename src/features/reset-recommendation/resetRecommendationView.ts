import type { ISODateString } from "../../domain/models/shared";
import { getTrackingResetRecommendation, type TrackingResetRecommendation } from "../../domain/reset/getTrackingResetRecommendation";
import type { BloomLocalState } from "../../storage/bloomState";
import { isValidBloomIsoTimestamp } from "../../storage/bloomValueValidation";

export type ResetRecommendationFacts = Pick<BloomLocalState, "resetJourney" | "masturbationTracking" | "productOnboarding">;
export type ResetRecommendationView =
  | { kind: "trackingRecommendation"; recommendation: Exclude<TrackingResetRecommendation, { status: "insufficientData" }> }
  | { kind: "persistedRecommendation" }
  | { kind: "unavailable" };

export function sameResetRecommendationFacts(left: ResetRecommendationFacts, right: ResetRecommendationFacts): boolean {
  return left.resetJourney === right.resetJourney && left.masturbationTracking === right.masturbationTracking &&
    left.productOnboarding === right.productOnboarding;
}

export function getResetRecommendationView(state: ResetRecommendationFacts, at: ISODateString): ResetRecommendationView {
  if (!isValidBloomIsoTimestamp(at) || state.masturbationTracking.currentSession !== null ||
    state.productOnboarding.status === "completed" && state.productOnboarding.planAcceptance === null) return { kind: "unavailable" };
  if (state.resetJourney.status === "recommended") return { kind: "persistedRecommendation" };
  if (state.resetJourney.status !== "inactive") return { kind: "unavailable" };
  const recommendation = getTrackingResetRecommendation(state.masturbationTracking, at);
  return recommendation?.status === "recommended"
    ? { kind: "trackingRecommendation", recommendation } : { kind: "unavailable" };
}
