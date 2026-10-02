import type { BehaviorSlipReason } from "../models/BehaviorSlip";
import type { ContentFreeState } from "../models/ContentFreeState";
import type { ResetJourney } from "../models/ResetJourney";
import type { ISODateString } from "../models/shared";
import { getResetRestrictionStatus } from "./getResetRestrictionStatus";

export type BehaviorSlipImpact = {
  reset: "restart" | "unchanged";
  contentFree: "resetStreak" | "unchanged";
};

// Read validated product facts at occurrence time without advancing either
// lifecycle. Null means the supplied event cannot safely belong to current
// attempts/streaks; it must not be presented as a partially applicable event.
export function getBehaviorSlipImpact(
  state: { resetJourney: ResetJourney; contentFree: ContentFreeState },
  reason: BehaviorSlipReason,
  occurredAt: ISODateString
): BehaviorSlipImpact | null {
  if (reason !== "masturbation" && reason !== "intentionalExplicitContent" &&
    reason !== "masturbationWithExplicitContent") return null;
  try {
    const restriction = getResetRestrictionStatus(state.resetJourney, occurredAt);
    if (restriction === null) return null;
    // Progress intentionally clamps times before an attempt to zero. A slip
    // cannot use that display behavior to restart a not-yet-started attempt.
    if (state.resetJourney.status === "active" &&
      Date.parse(occurredAt) < Date.parse(state.resetJourney.currentAttempt.startedAt)) return null;

    let contentFree: BehaviorSlipImpact["contentFree"] = "unchanged";
    if (reason !== "masturbation") {
      const content = state.contentFree;
      if (content.status === "active") {
        if (!isCanonicalTimestamp(content.activatedAt) || !isCanonicalTimestamp(content.currentStreakStartedAt) ||
          Date.parse(content.currentStreakStartedAt) < Date.parse(content.activatedAt) ||
          Date.parse(occurredAt) < Date.parse(content.activatedAt) ||
          Date.parse(occurredAt) < Date.parse(content.currentStreakStartedAt)) return null;
        contentFree = "resetStreak";
      } else if (content.status !== "inactive") {
        return null;
      }
    }
    return { reset: restriction.isRestrictionActive ? "restart" : "unchanged", contentFree };
  } catch {
    return null;
  }
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
