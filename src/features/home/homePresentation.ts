import type { MasturbationTrackingState } from "../../domain/models/MasturbationTrackingState";

// Keep Home's existing public import path while sharing the exact calculation.
export { getTrackingSummary, type TrackingSummary } from "../../domain/masturbationTracking/getTrackingSummary";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

export function formatAverageInterval(seconds: number | null): string {
  return seconds === null ? "—" : `${formatNumber(seconds / 86400)} gün`;
}

export function formatErectionQuality(value: number | null): string {
  return value === null ? "—" : `${formatNumber(value)}/10`;
}

export function getBestContentFreeDays(effectiveBestStreakSeconds: number): number {
  return Math.floor(effectiveBestStreakSeconds / 86400);
}

// A completed record is the only anchor; enabled/active/draft state is not a last session.
export function getHomeTrackingElapsedSeconds(tracking: MasturbationTrackingState, at: string): number | null {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  let latest: number | null = null;
  for (const session of tracking.sessions) {
    const ended = Date.parse(session.endedAt);
    if (session.status === "completed" && Number.isFinite(ended) && ended <= time && (latest === null || ended > latest)) latest = ended;
  }
  return latest === null ? null : Math.floor((time - latest) / 1000);
}
