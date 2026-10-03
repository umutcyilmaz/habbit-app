import type { ContentFreeState } from "../models/ContentFreeState";
import type { MasturbationTrackingState } from "../models/MasturbationTrackingState";
import type { ProductOnboardingState } from "../models/ProductOnboardingState";
import type { ResetJourney } from "../models/ResetJourney";
import type { UrgeControlState } from "../models/UrgeControlState";
import type { ISODateString, UUID } from "../models/shared";
import { getContentFreeProgress, type ContentFreeProgress } from "../contentFree/getContentFreeProgress";
import {
  getMasturbationTrackingAvailability,
  type MasturbationTrackingAvailability
} from "../productPolicy/getMasturbationTrackingAvailability";
import type { ResetProgress } from "../reset/getResetProgress";
import { getTrackingResetRecommendation, type TrackingResetRecommendation } from "../reset/getTrackingResetRecommendation";
import { getUrgeControlProgress, type UrgeControlProgress } from "../urgeControl/getUrgeControlProgress";

// Only current product facts belong to this input. A full application snapshot
// is structurally compatible, without making its other slices dependencies.
export type BloomHomeState = {
  masturbationTracking: MasturbationTrackingState;
  contentFree: ContentFreeState;
  resetJourney: ResetJourney;
  urgeControl: UrgeControlState;
  productOnboarding: ProductOnboardingState;
};

export type BloomHomeAction =
  | { id: "resumeMasturbationSession"; sessionId: UUID }
  | { id: "finishMasturbationSessionFeedback"; sessionId: UUID }
  | { id: "resumeUrgeControl"; eventId: UUID; stage: UrgeControlProgress["stage"] }
  | { id: "recordResetElapsedCompletion"; journeyId: UUID; attemptId: UUID; progress: ResetProgress }
  | { id: "completeResetBaseline"; journeyId: UUID }
  | { id: "viewActiveReset"; journeyId: UUID; attemptId: UUID; progress: ResetProgress }
  | { id: "reviewStartingRecommendation" }
  | { id: "reviewResetRecommendation" }
  | { id: "startMasturbationSession" }
  | { id: "viewContentFree" };

export type ContentFreeHomeTracker = {
  kind: "contentFree";
  progress: Extract<ContentFreeProgress, { status: "active" }>;
};

export type BloomHomeTracker =
  | { kind: "masturbationTracking"; availability: MasturbationTrackingAvailability; completedSessionCount: number }
  | ContentFreeHomeTracker;

export type BloomHomeReadModel = {
  primaryAction: BloomHomeAction | null;
  primaryTracker: BloomHomeTracker | null;
  secondaryTracker: ContentFreeHomeTracker | null;
  trackingAvailability: MasturbationTrackingAvailability;
  trackingResetRecommendation: TrackingResetRecommendation;
  resetRecommendationAction: Extract<BloomHomeAction, { id: "reviewResetRecommendation" }> | null;
  urgeControlProgress: UrgeControlProgress | null;
  urgeControlAvailable: true;
};

// Compose existing policy at one explicit time. Tracker summaries remain
// available even when unfinished work or a lifecycle task takes priority.
export function getBloomHomeReadModel(state: BloomHomeState, at: ISODateString): BloomHomeReadModel | null {
  try {
    const trackingAvailability = getMasturbationTrackingAvailability(state, at);
    if (trackingAvailability === null) return null;
    const trackingResetRecommendation = getTrackingResetRecommendation(state.masturbationTracking, at);
    if (trackingResetRecommendation === null) return null;
    const contentFreeProgress = getContentFreeProgress(state.contentFree, at);
    if (contentFreeProgress === null) return null;
    const urgeControlProgress = getUrgeControlProgress(state.urgeControl, at);
    if (state.urgeControl.activeEvent !== null && urgeControlProgress === null) return null;

    const contentFreeTracker: ContentFreeHomeTracker | null = contentFreeProgress.status === "active"
      ? { kind: "contentFree", progress: contentFreeProgress }
      : null;
    const primaryTracker: BloomHomeTracker | null = trackingAvailability.enabled
      ? {
          kind: "masturbationTracking",
          availability: trackingAvailability,
          completedSessionCount: state.masturbationTracking.sessions.length
        }
      : contentFreeTracker;

    return {
      primaryAction: getPrimaryAction(state, trackingAvailability, urgeControlProgress, primaryTracker),
      primaryTracker,
      secondaryTracker: trackingAvailability.enabled ? contentFreeTracker : null,
      trackingAvailability,
      trackingResetRecommendation,
      // Tracking-derived advice is optional and never participates in the
      // primary-action priority ladder. Acceptance revalidates these facts.
      resetRecommendationAction: trackingResetRecommendation.status === "recommended" &&
        state.resetJourney.status === "inactive" &&
        state.masturbationTracking.currentSession === null &&
        !(state.productOnboarding.status === "completed" && state.productOnboarding.planAcceptance === null)
        ? { id: "reviewResetRecommendation" }
        : null,
      urgeControlProgress,
      urgeControlAvailable: true
    };
  } catch {
    return null;
  }
}

function getPrimaryAction(
  state: BloomHomeState,
  trackingAvailability: MasturbationTrackingAvailability,
  urgeProgress: UrgeControlProgress | null,
  primaryTracker: BloomHomeTracker | null
): BloomHomeAction | null {
  // Unfinished work wins even when permission flags or another feature's
  // lifecycle conflict with that work. This read never resolves the conflict.
  const session = state.masturbationTracking.currentSession;
  if (session?.status === "active") return { id: "resumeMasturbationSession", sessionId: session.id };
  if (session?.status === "awaiting_feedback") return { id: "finishMasturbationSessionFeedback", sessionId: session.id };
  const urge = state.urgeControl.activeEvent;
  if (urge !== null && urgeProgress !== null) return { id: "resumeUrgeControl", eventId: urge.id, stage: urgeProgress.stage };

  const reset = state.resetJourney;
  // Availability already delegates to getResetRestrictionStatus. Reuse the
  // same result so Home does not calculate a second version of Reset policy.
  const restriction = trackingAvailability.resetRestriction;
  if (reset.status === "active" && restriction.needsCompletionTransition && restriction.progress !== null) {
    return { id: "recordResetElapsedCompletion", journeyId: reset.id, attemptId: reset.currentAttempt.id, progress: restriction.progress };
  }
  if (reset.status === "baseline_pending") return { id: "completeResetBaseline", journeyId: reset.id };
  if (reset.status === "active" && restriction.isRestrictionActive && restriction.progress !== null) {
    return { id: "viewActiveReset", journeyId: reset.id, attemptId: reset.currentAttempt.id, progress: restriction.progress };
  }

  const onboarding = state.productOnboarding;
  if (onboarding.status === "completed" && onboarding.planAcceptance === null) {
    return { id: "reviewStartingRecommendation" };
  }
  if (reset.status === "recommended") return { id: "reviewResetRecommendation" };

  if (primaryTracker?.kind === "masturbationTracking" && trackingAvailability.canStartSession) return { id: "startMasturbationSession" };
  if (primaryTracker?.kind === "contentFree") return { id: "viewContentFree" };
  return null;
}
