import type { ProductOnboardingState } from "../../domain/models/ProductOnboardingState";

export function productOnboardingEntryRoute(onboarding: ProductOnboardingState): "/onboarding" | "/bloom/starting-recommendation" | "/(tabs)/today" {
  if (onboarding.status === "notCompleted") return "/onboarding";
  return onboarding.planAcceptance === null ? "/bloom/starting-recommendation" : "/(tabs)/today";
}
