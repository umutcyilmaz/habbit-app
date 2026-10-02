import type { MasturbationTrackingState } from "../models/MasturbationTrackingState";
import type { ResetBaseline } from "../models/ResetBaseline";
import type { ISODateString } from "../models/shared";

export type ResetTrackingSnapshot = Pick<
  ResetBaseline,
  "averageIntervalSeconds" | "averageErectionQuality" | "explicitContentSessionRatio"
>;

// Historical observations only: the current session and Tracking preference do
// not affect this snapshot. Null means the explicit capture time is invalid;
// absent aggregate fields mean there are not enough eligible observations.
export function getResetTrackingSnapshot(
  tracking: MasturbationTrackingState,
  capturedAt: ISODateString
): ResetTrackingSnapshot | null {
  if (!isCanonicalTimestamp(capturedAt)) return null;
  const capturedAtMilliseconds = Date.parse(capturedAt);
  const eligible = tracking.sessions.filter((session) =>
    session.status === "completed" && Date.parse(session.endedAt) <= capturedAtMilliseconds
  );
  if (eligible.length === 0) return {};

  const snapshot: ResetTrackingSnapshot = {
    averageErectionQuality: eligible.reduce((total, session) => total + session.erectionQuality, 0) / eligible.length,
    explicitContentSessionRatio: eligible.filter((session) => session.usedExplicitContent === true).length / eligible.length
  };
  if (eligible.length >= 2) {
    const starts = eligible.map((session) => Date.parse(session.startedAt)).sort((left, right) => left - right);
    let intervalMilliseconds = 0;
    for (let index = 1; index < starts.length; index++) {
      intervalMilliseconds += starts[index]! - starts[index - 1]!;
    }
    snapshot.averageIntervalSeconds = intervalMilliseconds / (starts.length - 1) / 1000;
  }
  return snapshot;
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
