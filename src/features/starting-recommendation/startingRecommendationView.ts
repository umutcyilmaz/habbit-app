import type { ProductOnboardingState, ProductPlanAcceptance } from "../../domain/models/ProductOnboardingState";
import type { BloomLocalState } from "../../storage/bloomState";
import { normalizeProductOnboarding } from "../../storage/bloomOnboardingSchema";

export type StartingRecommendationFacts = Pick<BloomLocalState,
  "productOnboarding" | "masturbationTracking" | "resetJourney" | "contentFree">;
export type AcceptedStartingRecommendation = StartingRecommendationFacts & {
  productOnboarding: Extract<ProductOnboardingState, { status: "completed" }> & { planAcceptance: ProductPlanAcceptance };
};
export type StartingRecommendationView =
  | { kind: "recommendation"; recommendation: Extract<ProductOnboardingState, { status: "completed" }>["result"]["recommendation"] }
  | { kind: "unavailable" };

export function sameStartingRecommendationFacts(left: StartingRecommendationFacts, right: StartingRecommendationFacts): boolean {
  return left.productOnboarding === right.productOnboarding && left.masturbationTracking === right.masturbationTracking &&
    left.resetJourney === right.resetJourney && left.contentFree === right.contentFree;
}

export function getStartingRecommendationView(state: Pick<StartingRecommendationFacts, "productOnboarding">): StartingRecommendationView {
  try {
    // Structural validation only: historical derived output is never rescored.
    normalizeProductOnboarding(state.productOnboarding);
    const onboarding = state.productOnboarding;
    return onboarding.status === "completed" && onboarding.planAcceptance === null
      ? { kind: "recommendation", recommendation: onboarding.result.recommendation }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

// Keep recovery tied to the accepted plan and, for Reset plans, its actual
// prepared journey. A later plan or advanced/replaced Reset is not this target.
export function isStartingRecommendationSuccessorCurrent(accepted: AcceptedStartingRecommendation, current: StartingRecommendationFacts): boolean {
  if (accepted.productOnboarding !== current.productOnboarding) return false;
  const recommendation = accepted.productOnboarding.planAcceptance.recommendation;
  return recommendation !== "reset" && recommendation !== "reset_and_content_free" ||
    current.resetJourney === accepted.resetJourney && current.resetJourney.status === "baseline_pending";
}
