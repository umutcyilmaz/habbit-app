import type { MasturbationTrackingState } from "../models/MasturbationTrackingState";
import type { ISODateString } from "../models/shared";

export type TrackingResetRecommendationSignal =
  | "erectionQualityDownwardTrend"
  | "repeatedFirmnessDecrease"
  | "recentExplicitContentPattern";

export type TrackingResetRecommendation =
  | {
      status: "insufficientData";
      eligibleSessionCount: number;
      requiredSessionCount: 6;
    }
  | {
      status: "noCurrentRecommendation" | "recommended";
      eligibleSessionCount: number;
      windowSize: 3;
      evidence: {
        previousAverageErectionQuality: number;
        recentAverageErectionQuality: number;
        previousFirmnessDecreaseCount: number;
        recentFirmnessDecreaseCount: number;
        previousExplicitContentRatio: number;
        recentExplicitContentRatio: number;
        recentAverageIntervalSeconds: number;
      };
      signals: TrackingResetRecommendationSignal[];
    };

type Observation = {
  id: string;
  startedAtMilliseconds: number;
  erectionQuality: number;
  usedExplicitContent: boolean;
  endingReason: string;
};

const endingReasons = new Set([
  "climaxed", "stoppedBeforeClimax", "firmnessDecreased", "feltAnxious", "stoppedByChoice", "other"
]);

// A derived product observation, not a medical or causal interpretation. Only
// completed history and the explicit cutoff participate; no other lifecycle is read.
export function getTrackingResetRecommendation(
  tracking: MasturbationTrackingState,
  at: ISODateString
): TrackingResetRecommendation | null {
  if (!isCanonicalTimestamp(at) || !isRecord(tracking) || !Array.isArray(tracking.sessions)) return null;
  const cutoff = Date.parse(at);
  const eligible: Observation[] = [];
  const ids = new Set<string>();

  for (const session of tracking.sessions as unknown[]) {
    if (!isRecord(session)) return null;
    if (session.status === "active" || session.status === "awaiting_feedback") continue;
    if (session.status !== "completed" || !isCanonicalTimestamp(session.endedAt)) return null;
    if (Date.parse(session.endedAt) > cutoff) continue;
    if (typeof session.id !== "string" || session.id.trim() === "" || ids.has(session.id) ||
      !isCanonicalTimestamp(session.startedAt) || Date.parse(session.startedAt) > Date.parse(session.endedAt) ||
      typeof session.erectionQuality !== "number" || !Number.isFinite(session.erectionQuality) ||
      session.erectionQuality < 1 || session.erectionQuality > 10 ||
      typeof session.usedExplicitContent !== "boolean" ||
      typeof session.endingReason !== "string" || !endingReasons.has(session.endingReason)) return null;
    ids.add(session.id);
    eligible.push({
      id: session.id,
      startedAtMilliseconds: Date.parse(session.startedAt),
      erectionQuality: session.erectionQuality,
      usedExplicitContent: session.usedExplicitContent,
      endingReason: session.endingReason
    });
  }

  const eligibleSessionCount = eligible.length;
  if (eligibleSessionCount < 6) return { status: "insufficientData", eligibleSessionCount, requiredSessionCount: 6 };

  // Code-unit ID order avoids locale-dependent ties; source arrays/objects are untouched.
  eligible.sort((left, right) => left.startedAtMilliseconds - right.startedAtMilliseconds ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const latest = eligible.slice(-6);
  const previous = summarize(latest.slice(0, 3));
  const recentSessions = latest.slice(3);
  const recent = summarize(recentSessions);
  // For equal three-session windows this is exactly the mean-decline rule.
  // Compare sums so binary rounding of means cannot lose an exact 1.0 decline.
  const erectionTrend = recent.qualityTotal <= previous.qualityTotal - 3;
  const firmnessTrend = recent.firmnessCount >= 2 && recent.firmnessCount > previous.firmnessCount;
  const explicitPattern = recent.explicitCount >= 2;
  const signals: TrackingResetRecommendationSignal[] = [];
  if (erectionTrend) signals.push("erectionQualityDownwardTrend");
  if (firmnessTrend) signals.push("repeatedFirmnessDecrease");
  if (explicitPattern) signals.push("recentExplicitContentPattern");

  return {
    status: (erectionTrend || firmnessTrend) && explicitPattern ? "recommended" : "noCurrentRecommendation",
    eligibleSessionCount,
    windowSize: 3,
    evidence: {
      previousAverageErectionQuality: previous.qualityTotal / 3,
      recentAverageErectionQuality: recent.qualityTotal / 3,
      previousFirmnessDecreaseCount: previous.firmnessCount,
      recentFirmnessDecreaseCount: recent.firmnessCount,
      previousExplicitContentRatio: previous.explicitCount / 3,
      recentExplicitContentRatio: recent.explicitCount / 3,
      // Descriptive only: neither this interval nor frequency influences status/signals.
      recentAverageIntervalSeconds: (
        (recentSessions[1]!.startedAtMilliseconds - recentSessions[0]!.startedAtMilliseconds) +
        (recentSessions[2]!.startedAtMilliseconds - recentSessions[1]!.startedAtMilliseconds)
      ) / 2 / 1000
    },
    signals
  };
}

function summarize(sessions: Observation[]) {
  return {
    qualityTotal: sessions.reduce((total, session) => total + session.erectionQuality, 0),
    firmnessCount: sessions.filter((session) => session.endingReason === "firmnessDecreased").length,
    explicitCount: sessions.filter((session) => session.usedExplicitContent).length
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
