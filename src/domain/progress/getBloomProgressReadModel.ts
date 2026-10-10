import { getContentFreeProgress, type ContentFreeProgress } from "../contentFree/getContentFreeProgress";
import {
  getResetContentFreeCredit,
  getResetContentFreeContinuationOffer,
  type ResetContentFreeContinuationOffer
} from "../contentFree/getResetContentFreeCredit";
import { getTrackingSummary, type TrackingSummary } from "../masturbationTracking/getTrackingSummary";
import type { ContentFreeState, ResetContentFreeCredit } from "../models/ContentFreeState";
import type { MasturbationTrackingState } from "../models/MasturbationTrackingState";
import type { ResetJourney, ResetCompletedDays } from "../models/ResetJourney";
import type { ISODateString } from "../models/shared";
import { getMasturbationTrackingAvailability } from "../productPolicy/getMasturbationTrackingAvailability";
import type { ResetRestrictionStatus } from "../productPolicy/getResetRestrictionStatus";
import { getResetProgress, type ResetProgress } from "../reset/getResetProgress";

// No dependency on legacy slices or application/provider modules. A hydrated
// provider snapshot is structurally compatible; its accepted `state` is ignored.
export type BloomProgressState = {
  masturbationTracking: MasturbationTrackingState;
  contentFree: ContentFreeState;
  resetJourney: ResetJourney;
};

export type BloomProgressSource = Readonly<{
  durableState: BloomProgressState;
  hydrationStatus: "loading" | "ready" | "error";
}>;

type ReadonlyResetRestriction = Readonly<Omit<ResetRestrictionStatus, "progress">> & {
  readonly progress: Readonly<ResetProgress> | null;
};
type ReadonlyContinuationOffer = Readonly<Omit<ResetContentFreeContinuationOffer, "credit">> & {
  readonly credit: Readonly<ResetContentFreeCredit>;
};

export type BloomProgressReadModel = Readonly<{
  observedAt: ISODateString;
  tracking: Readonly<{
    enabled: boolean;
    currentSessionStatus: "none" | "active" | "awaiting_feedback";
    summary: Readonly<TrackingSummary>;
  }>;
  contentFree: Readonly<{
    progress: Readonly<ContentFreeProgress>;
    pastActivationCount: number;
    effectiveViolationCount: number;
  }>;
  reset: Readonly<{
    status: ResetJourney["status"];
    progress: Readonly<ResetProgress> | null;
    restriction: ReadonlyResetRestriction;
    recordedBestCompletedDays: ResetCompletedDays;
    pastAttemptCount: number;
    completedAttemptCount: number;
    effectiveViolationCount: number;
    earnedContentFreeCredit: Readonly<ResetContentFreeCredit> | null;
    continuationOffer: ReadonlyContinuationOffer | null;
  }>;
}>;

// Current canonical facts with an explicit observation clock, not an as-of
// history query. Nothing here can acknowledge a write or advance a lifecycle.
export function getBloomProgressReadModel(
  source: BloomProgressSource,
  at: ISODateString
): BloomProgressReadModel | null {
  if (source.hydrationStatus !== "ready") return null;
  const state = source.durableState;
  try {
    const availability = getMasturbationTrackingAvailability(state, at);
    const contentFreeProgress = getContentFreeProgress(state.contentFree, at);
    if (availability === null || contentFreeProgress === null) return null;
    const reset = state.resetJourney;
    // The restriction selector intentionally has no progress for completed
    // journeys. Their confirmed 15-day result comes from getResetProgress.
    const resetProgress = reset.status === "active"
      ? availability.resetRestriction.progress
      : getResetProgress(reset, at);

    return {
      observedAt: at,
      tracking: {
        enabled: availability.enabled,
        currentSessionStatus: availability.currentSessionStatus,
        summary: getTrackingSummary(state.masturbationTracking, at)
      },
      contentFree: {
        progress: contentFreeProgress,
        pastActivationCount: state.contentFree.pastActivations.length,
        effectiveViolationCount: state.contentFree.violations.filter((entry) => entry.status === "recorded").length
      },
      reset: {
        status: reset.status,
        progress: resetProgress,
        restriction: availability.resetRestriction,
        recordedBestCompletedDays: reset.bestCompletedDays,
        pastAttemptCount: reset.pastAttempts.length,
        completedAttemptCount: reset.pastAttempts.filter((attempt) => attempt.status === "completed").length +
          (reset.status === "completed" ? 1 : 0),
        effectiveViolationCount: reset.violations.filter((entry) => entry.status === "recorded").length,
        earnedContentFreeCredit: getResetContentFreeCredit(reset, state.contentFree, at),
        continuationOffer: getResetContentFreeContinuationOffer(state, state)
      }
    };
  } catch {
    // Persisted state validation belongs to hydration. An unavailable selector
    // must not turn unknown facts into an apparently empty/zero dashboard.
    return null;
  }
}
