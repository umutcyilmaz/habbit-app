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
