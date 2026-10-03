import type { ResetJourney } from "../domain/models/ResetJourney";
import type { ISODateString, UUID } from "../domain/models/shared";
import { getTrackingResetRecommendation } from "../domain/reset/getTrackingResetRecommendation";
import { normalizeProductOnboarding } from "./bloomOnboardingSchema";
import { normalizeMasturbationTracking, normalizeResetJourney } from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type AcceptResetRecommendationInput = {
  resetJourneyId: UUID;
  acceptedAt: ISODateString;
};

// Advice stays derived until explicit acceptance. Preparing a journey captures
// no evidence or acceptance history and does not begin its active period.
export function acceptResetRecommendationState(
  state: BloomLocalState,
  input: AcceptResetRecommendationInput
): BloomLocalState {
  const reset = state.resetJourney;
  // A completed journey cannot be repeated safely in the current baseline model.
  if (reset.status !== "inactive" && reset.status !== "recommended") return state;

  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const keys = Object.keys(input);
    if (keys.length !== 2 || !keys.includes("resetJourneyId") || !keys.includes("acceptedAt")) return state;
    const { resetJourneyId, acceptedAt } = input;
    if (!isValidBloomIsoTimestamp(acceptedAt) || typeof resetJourneyId !== "string" ||
      resetJourneyId.trim().length === 0) return state;

    const tracking = state.masturbationTracking;
    const onboarding = state.productOnboarding;
    normalizeResetJourney(reset);
    normalizeMasturbationTracking(tracking);
    normalizeProductOnboarding(onboarding);
    if (tracking.currentSession !== null ||
      (onboarding.status === "completed" && onboarding.planAcceptance === null)) return state;

    // Re-read canonical observations at the operation time, never a rendered
    // recommendation snapshot. Historical recommended journeys need no evidence.
    if (reset.status === "inactive" &&
      getTrackingResetRecommendation(tracking, acceptedAt)?.status !== "recommended") return state;

    const resetJourney: ResetJourney = {
      durationDays: reset.durationDays,
      bestCompletedDays: reset.bestCompletedDays,
      pastAttempts: reset.pastAttempts,
      violations: reset.violations,
      status: "baseline_pending",
      id: reset.status === "recommended" ? reset.id : resetJourneyId
    };
    normalizeResetJourney(resetJourney);
    return { ...state, resetJourney };
  } catch {
    return state;
  }
}
