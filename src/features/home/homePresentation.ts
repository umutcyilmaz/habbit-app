import type { MasturbationTrackingState } from "../../domain/models/MasturbationTrackingState";
import type { ISODateString } from "../../domain/models/shared";

export type TrackingSummary = {
  completedSessionCount: number;
  averageErectionQuality: number | null;
  averageIntervalSeconds: number | null;
};

// Presentation only. Neither these averages nor their formatting affect Home policy.
export function getTrackingSummary(tracking: MasturbationTrackingState, at: ISODateString): TrackingSummary {
  const observedAt = Date.parse(at);
  const sessions = tracking.sessions
    .filter((session) => session.status === "completed" && Date.parse(session.endedAt) <= observedAt)
    .slice()
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const completedSessionCount = sessions.length;
  const averageErectionQuality = completedSessionCount === 0 ? null :
    sessions.reduce((sum, session) => sum + session.erectionQuality, 0) / completedSessionCount;
  let intervalSeconds = 0;
  for (let index = 1; index < sessions.length; index++) {
    intervalSeconds += (Date.parse(sessions[index]!.startedAt) - Date.parse(sessions[index - 1]!.startedAt)) / 1000;
  }
  return {
    completedSessionCount,
    averageErectionQuality,
    averageIntervalSeconds: completedSessionCount < 2 ? null : intervalSeconds / (completedSessionCount - 1)
  };
}

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
