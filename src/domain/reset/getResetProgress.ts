import type { ResetCompletedDays, ResetJourney } from "../models/ResetJourney";
import type { ISODateString } from "../models/shared";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const RESET_DAYS = 15;

export type ResetProgress = {
  completedDays: ResetCompletedDays;
  // Capped at Day 15 once the period is complete; there is no Day 16.
  currentDay: number;
  isPeriodComplete: boolean;
  // Full or partial days remaining, rounded up to a whole day.
  remainingDays: number;
  remainingSeconds: number;
};

// No wall clock or state transition: callers provide a canonical timestamp.
// Null means the period has not started or a supplied timestamp is invalid.
export function getResetProgress(resetJourney: ResetJourney, now: ISODateString): ResetProgress | null {
  if (!isCanonicalTimestamp(now)) return null;
  if (resetJourney.status === "assessment_pending" || resetJourney.status === "completed") {
    return { completedDays: 15, currentDay: 15, isPeriodComplete: true, remainingDays: 0, remainingSeconds: 0 };
  }
  if (resetJourney.status !== "active") return null;
  const startedAt = resetJourney.currentAttempt.startedAt;
  if (!isCanonicalTimestamp(startedAt)) return null;

  const periodMilliseconds = RESET_DAYS * DAY_MILLISECONDS;
  const elapsedMilliseconds = Math.min(periodMilliseconds, Math.max(0, Date.parse(now) - Date.parse(startedAt)));
  const completedDays = Math.floor(elapsedMilliseconds / DAY_MILLISECONDS) as ResetCompletedDays;
  return {
    completedDays,
    currentDay: Math.min(RESET_DAYS, completedDays + 1),
    isPeriodComplete: completedDays === RESET_DAYS,
    remainingDays: RESET_DAYS - completedDays,
    remainingSeconds: (periodMilliseconds - elapsedMilliseconds) / 1000
  };
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
