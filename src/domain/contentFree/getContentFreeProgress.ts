import type { ContentFreeState } from "../models/ContentFreeState";
import type { ISODateString } from "../models/shared";

import { getContentFreeStreakSeconds } from "./getContentFreeStreakSeconds";

type ContentFreeProgressHistory = {
  effectiveBestStreakSeconds: number;
  hasEffectiveViolation: boolean;
};

export type ContentFreeProgress = ContentFreeProgressHistory & (
  | { status: "inactive" }
  | { status: "active"; currentStreakSeconds: number; currentCompletedDays: number }
);

// A read of validated domain state, with an explicit clock and no writes.
// Inactive results retain historical best without inventing a current streak.
export function getContentFreeProgress(contentFree: ContentFreeState, now: ISODateString): ContentFreeProgress | null {
  if (!isCanonicalTimestamp(now) || !Number.isInteger(contentFree.bestStreakSeconds) ||
    contentFree.bestStreakSeconds < 0) return null;
  const hasEffectiveViolation = contentFree.violations.some((violation) => violation.status === "recorded");
  if (contentFree.status === "inactive") {
    return { status: "inactive", effectiveBestStreakSeconds: contentFree.bestStreakSeconds, hasEffectiveViolation };
  }
  if (contentFree.status !== "active" || !isCanonicalTimestamp(contentFree.currentStreakStartedAt) ||
    !isCanonicalTimestamp(contentFree.activatedAt) || Date.parse(contentFree.currentStreakStartedAt) < Date.parse(contentFree.activatedAt)) return null;
  const credit = contentFree.resetCredit;
  if (credit !== undefined && (!isCanonicalTimestamp(credit.earnedStartedAt) || !isCanonicalTimestamp(credit.earnedUntil) ||
    Date.parse(credit.earnedStartedAt) >= Date.parse(credit.earnedUntil) || Date.parse(credit.earnedUntil) > Date.parse(contentFree.activatedAt) ||
    !Number.isInteger(credit.bestStreakSecondsBefore) || credit.bestStreakSecondsBefore < 0)) return null;
  const currentStreakSeconds = Date.parse(now) < Date.parse(contentFree.activatedAt) ? 0 : getContentFreeStreakSeconds(contentFree, contentFree.currentStreakStartedAt, now);
  return {
    status: "active",
    currentStreakSeconds,
    currentCompletedDays: Math.floor(currentStreakSeconds / 86400),
    effectiveBestStreakSeconds: Math.max(contentFree.bestStreakSeconds, currentStreakSeconds),
    hasEffectiveViolation
  };
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
