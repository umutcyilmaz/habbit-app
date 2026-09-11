import type { ContentFreeState } from "../domain/models/ContentFreeState";
import type { ResetJourney } from "../domain/models/ResetJourney";
import type { ISODateString, UUID } from "../domain/models/shared";
import type { BloomLocalState } from "./bloomState";
import { normalizeProductOnboarding } from "./bloomOnboardingSchema";
import { normalizeContentFree, normalizeMasturbationTracking, normalizeResetJourney } from "./bloomProductStateSchema";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type ProductOnboardingAcceptanceInput = {
  acceptedAt: ISODateString;
  contentFreeActivationId?: UUID;
  resetJourneyId?: UUID;
};

// Initial product onboarding only. Time and identities come from the caller;
// the recommendation comes exclusively from the stored historical result.
// No scorer, clock, navigation, or persistence write is invoked.
export function acceptProductOnboardingRecommendationState(
  state: BloomLocalState,
  input: ProductOnboardingAcceptanceInput
): BloomLocalState {
  const onboarding = state.productOnboarding;
  // Check the marker first: retries cannot replace the original action time,
  // even when their inputs or the product's subsequent state have changed.
  if (onboarding.status !== "completed" || onboarding.planAcceptance !== null) return state;

  try {
    normalizeProductOnboarding(onboarding);
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const keys = Object.keys(input);
    if (!keys.includes("acceptedAt") || keys.some((key) =>
      key !== "acceptedAt" && key !== "contentFreeActivationId" && key !== "resetJourneyId")) return state;
    const { acceptedAt } = input;
    if (!isValidBloomIsoTimestamp(acceptedAt) || Date.parse(acceptedAt) < Date.parse(onboarding.result.completedAt)) return state;

    const recommendation = onboarding.result.recommendation;
    const enablesTracking = recommendation === "masturbation_tracking";
    const activatesContentFree = recommendation === "content_free" || recommendation === "reset_and_content_free";
    const preparesReset = recommendation === "reset" || recommendation === "reset_and_content_free";

    const tracking = state.masturbationTracking;
    const reset = state.resetJourney;
    // A starting plan cannot replace an ongoing Reset, discard an unfinished
    // session, or disable Tracking that the user already enabled separately.
    if (reset.status !== "inactive" || tracking.currentSession !== null || (!enablesTracking && tracking.enabled)) return state;
    normalizeMasturbationTracking(tracking);
    normalizeResetJourney(reset);

    let contentFree: ContentFreeState = state.contentFree;
    if (activatesContentFree) {
      const id = input.contentFreeActivationId;
      if (!keys.includes("contentFreeActivationId") || !isIdentity(id) || contentFree.status !== "inactive") return state;
      normalizeContentFree(contentFree);
      // Validation below also rejects reused activation IDs and overlapping
      // activation boundaries. Histories and best streak retain their values.
      const activated: ContentFreeState = {
        bestStreakSeconds: contentFree.bestStreakSeconds,
        pastActivations: contentFree.pastActivations,
        violations: contentFree.violations,
        status: "active",
        activationId: id,
        activatedAt: acceptedAt,
        currentStreakStartedAt: acceptedAt
      };
      normalizeContentFree(activated);
      contentFree = activated;
    }

    let resetJourney: ResetJourney = reset;
    if (preparesReset) {
      const id = input.resetJourneyId;
      if (!keys.includes("resetJourneyId") || !isIdentity(id)) return state;
      resetJourney = {
        durationDays: reset.durationDays,
        bestCompletedDays: reset.bestCompletedDays,
        pastAttempts: reset.pastAttempts,
        violations: reset.violations,
        status: "baseline_pending",
        id
      };
      normalizeResetJourney(resetJourney);
    }

    // All guards succeeded before any state is published. Combined acceptance
    // is one atomic snapshot; Reset itself waits for a later baseline action.
    return {
      ...state,
      productOnboarding: {
        ...onboarding,
        planAcceptance: { acceptedAt, recommendation }
      },
      masturbationTracking: enablesTracking && !tracking.enabled ? { ...tracking, enabled: true } : tracking,
      contentFree,
      resetJourney
    };
  } catch {
    // Match existing pure state mutations: malformed input is an exact no-op.
    return state;
  }
}

function isIdentity(value: unknown): value is UUID {
  return typeof value === "string" && value.trim().length > 0;
}
