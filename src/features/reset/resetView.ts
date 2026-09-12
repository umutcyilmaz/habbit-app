import type { ResetJourney, ResetViolation } from "../../domain/models/ResetJourney";
import type { ISODateString } from "../../domain/models/shared";
import { getResetRestrictionStatus, type ResetRestrictionStatus } from "../../domain/productPolicy/getResetRestrictionStatus";
import { getResetProgress, type ResetProgress } from "../../domain/reset/getResetProgress";

export type ResetRouteMode = "baseline" | "progress" | "completion" | "assessment";
export type ResetRouteInput = { mode: ResetRouteMode; journeyId: unknown; attemptId?: unknown };
export type ResetRouteView =
  | { kind: "missing" | "invalid" | "mismatch" | "unavailable" }
  | { kind: "baseline"; reset: Extract<ResetJourney, { status: "baseline_pending" }> }
  | {
      kind: "active";
      reset: Extract<ResetJourney, { status: "active" }>;
      progress: ResetProgress;
      restriction: ResetRestrictionStatus;
      bestCompletedDays: number;
      history: ResetViolation[];
      undoCandidateId: string | null;
    }
  | { kind: "assessment"; reset: Extract<ResetJourney, { status: "assessment_pending" }> }
  | { kind: "completed"; reset: Extract<ResetJourney, { status: "completed" }> };

export function getLatestResetUndoCandidate(reset: ResetJourney): ResetViolation | null {
  if (reset.status !== "active") return null;
  const recorded = reset.violations.filter((entry) => entry.status === "recorded");
  // Selection only. The transition decides whether the linked restart and
  // Content-Free history can actually be reversed, for either source kind.
  return recorded[recorded.length - 1] ?? null;
}

export function getResetRouteView(reset: ResetJourney, route: ResetRouteInput, at: ISODateString): ResetRouteView {
  const ids = route.mode === "baseline" ? [route.journeyId] : [route.journeyId, route.attemptId];
  if (ids.some((id) => id === undefined || id === null)) return { kind: "missing" };
  if (ids.some((id) => typeof id !== "string" || id.trim().length === 0)) return { kind: "invalid" };
  if (!("id" in reset) || reset.id !== route.journeyId) return { kind: "mismatch" };
  if (route.mode === "baseline") {
    return reset.status === "baseline_pending" ? { kind: "baseline", reset } : { kind: "mismatch" };
  }
  if (!("currentAttempt" in reset) || reset.currentAttempt.id !== route.attemptId) return { kind: "mismatch" };
  if (route.mode === "assessment") {
    if (reset.status === "assessment_pending") return { kind: "assessment", reset };
    return reset.status === "completed" ? { kind: "completed", reset } : { kind: "mismatch" };
  }
  if (reset.status !== "active") return { kind: "mismatch" };
  const progress = getResetProgress(reset, at);
  const restriction = getResetRestrictionStatus(reset, at);
  if (progress === null || restriction === null) return { kind: "unavailable" };
  return {
    kind: "active", reset, progress, restriction,
    bestCompletedDays: Math.max(reset.bestCompletedDays, progress.completedDays),
    history: [...reset.violations].reverse().sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt)),
    undoCandidateId: getLatestResetUndoCandidate(reset)?.id ?? null
  };
}

export function formatResetEventTime(timestamp: string): string {
  const time = new Date(timestamp);
  return Number.isFinite(time.getTime()) ? time.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit"
  }) : "Unknown time";
}

// Unit formatting only; remaining duration itself comes from getResetProgress.
export function formatResetRemainingSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 86400)}d ${Math.floor((whole % 86400) / 3600)}h ${Math.floor((whole % 3600) / 60)}m ${whole % 60}s`;
}
