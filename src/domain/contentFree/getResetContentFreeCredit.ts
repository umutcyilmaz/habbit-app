import type { ContentFreeState, ResetContentFreeCredit } from "../models/ContentFreeState";
import type { ResetJourney } from "../models/ResetJourney";
import type { ISODateString } from "../models/shared";

const periodMilliseconds = 15 * 86400000;

// Walk only connected, evidenced attempts. A historical journey.startedAt is
// not sufficient evidence when its older attempts are missing or disconnected.
export function getResetContentFreeCredit(
  reset: ResetJourney, content: ContentFreeState, at: ISODateString
): ResetContentFreeCredit | null {
  if (reset.status !== "active" && reset.status !== "completed") return null;
  const observed = Date.parse(at);
  if (!Number.isFinite(observed) || new Date(observed).toISOString() !== at) return null;
  const current = reset.currentAttempt;
  const end = Math.min(observed, Date.parse(current.startedAt) + periodMilliseconds,
    reset.status === "completed" ? Date.parse(reset.completedAt) : Infinity);
  let start = Date.parse(current.startedAt);
  const attempts = [...reset.pastAttempts].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  for (const attempt of attempts) {
    if (attempt.status !== "restarted" || Date.parse(attempt.endedAt) !== start) continue;
    if (Date.parse(attempt.endedAt) - Date.parse(attempt.startedAt) >= periodMilliseconds) break;
    const violation = reset.violations.find((entry) => entry.id === attempt.restartViolationId);
    if (violation?.status !== "recorded" || violation.attemptId !== attempt.id) break;
    start = Date.parse(attempt.startedAt);
  }
  start = Math.max(start, Date.parse(reset.startedAt));
  for (const violation of reset.violations) {
    if (violation.status === "recorded" && violation.reason !== "masturbation" && Date.parse(violation.occurredAt) <= end) {
      start = Math.max(start, Date.parse(violation.occurredAt));
    }
  }
  // Tracker activation/deactivation is not a behavior violation. Reset's
  // independently verified interval remains eligible across those boundaries.
  for (const violation of content.violations) {
    if (violation.status === "recorded") start = Math.max(start, Date.parse(violation.occurredAt));
  }
  if (end <= start) return null;
  return { bestStreakSecondsBefore: content.bestStreakSeconds, resetJourneyId: reset.id, earnedStartedAt: new Date(start).toISOString(), earnedUntil: new Date(end).toISOString() };
}

export type ResetContentFreeContinuationOffer = {
  journeyId: string;
  attemptId: string;
  credit: ResetContentFreeCredit;
  earnedSeconds: number;
  completedDays: number;
  primaryLabel: string;
};

// The caller supplies durable truth. Accepted in-memory completion alone must
// never make an offer visible. All displayed day credit comes from this read.
export function getResetContentFreeContinuationOffer(
  state: { resetJourney: ResetJourney; contentFree: ContentFreeState },
  durable: { resetJourney: ResetJourney; contentFree: ContentFreeState }
): ResetContentFreeContinuationOffer | null {
  const reset = state.resetJourney;
  if (reset !== durable.resetJourney || state.contentFree !== durable.contentFree ||
    reset.status !== "completed" || Date.parse(reset.completedAt) !== Date.parse(reset.currentAttempt.startedAt) + periodMilliseconds ||
    reset.contentFreeContinuation !== undefined || state.contentFree.status !== "inactive") return null;
  const credit = getResetContentFreeCredit(reset, state.contentFree, reset.completedAt);
  if (credit === null) return null;
  const earnedSeconds = Math.floor((Date.parse(credit.earnedUntil) - Date.parse(credit.earnedStartedAt)) / 1000);
  const completedDays = Math.floor(earnedSeconds / 86400);
  return { journeyId: reset.id, attemptId: reset.currentAttempt.id, credit, earnedSeconds, completedDays,
    primaryLabel: completedDays > 0 ? `${completedDays} günlük serimle devam et` : "Kazandığım süreyle devam et" };
}

export function canOfferResetContentFreeContinuation(
  state: { resetJourney: ResetJourney; contentFree: ContentFreeState },
  durable: { resetJourney: ResetJourney; contentFree: ContentFreeState }
): boolean {
  return getResetContentFreeContinuationOffer(state, durable) !== null;
}
