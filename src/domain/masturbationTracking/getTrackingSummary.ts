import type { MasturbationTrackingState } from "../models/MasturbationTrackingState";
import type { ISODateString } from "../models/shared";

export type TrackingSummary = {
  completedSessionCount: number;
  averageErectionQuality: number | null;
  averageIntervalSeconds: number | null;
};

// Shared Home/Progress observation only. These averages never affect policy.
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
