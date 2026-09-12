import type { ResetJourney } from "../models/ResetJourney";
import type { ISODateString } from "../models/shared";
import { getResetProgress, type ResetProgress } from "../reset/getResetProgress";

export type ResetRestrictionStatus = {
  isRestrictionActive: boolean;
  isElapsedPeriodComplete: boolean;
  needsCompletionTransition: boolean;
  progress: ResetProgress | null;
};

// Read validated domain facts at the supplied event time. A stale active status
// cannot extend the restriction, and this read never advances the lifecycle.
export function getResetRestrictionStatus(resetJourney: ResetJourney, at: ISODateString): ResetRestrictionStatus | null {
  if (!isCanonicalTimestamp(at)) return null;
  try {
    switch (resetJourney.status) {
      case "inactive":
      case "recommended":
      case "baseline_pending":
      case "assessment_pending":
      case "completed":
        return { isRestrictionActive: false, isElapsedPeriodComplete: false, needsCompletionTransition: false, progress: null };
      case "active": {
        if (resetJourney.currentAttempt?.status !== "active") return null;
        const progress = getResetProgress(resetJourney, at);
        if (progress === null) return null;
        return {
          isRestrictionActive: !progress.isPeriodComplete,
          isElapsedPeriodComplete: progress.isPeriodComplete,
          needsCompletionTransition: progress.isPeriodComplete,
          progress
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
