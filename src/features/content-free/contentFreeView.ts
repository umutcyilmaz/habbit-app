import { getContentFreeProgress } from "../../domain/contentFree/getContentFreeProgress";
import type { ContentFreeState, ContentFreeViolation } from "../../domain/models/ContentFreeState";
import type { ISODateString } from "../../domain/models/shared";

// This is a history selection, not a reversibility guarantee. The transition
// still owns Reset linkage, time ordering, and safe streak restoration.
export function getLatestManualContentFreeUndoCandidate(content: ContentFreeState): ContentFreeViolation | null {
  if (content.status !== "active") return null;
  const effective = content.violations.filter((entry) =>
    entry.status === "recorded" && entry.activationId === content.activationId);
  const latest = effective[effective.length - 1];
  return latest?.source.kind === "manual" ? latest : null;
}

export function getContentFreeFeatureView(content: ContentFreeState, now: ISODateString) {
  return {
    progress: getContentFreeProgress(content, now),
    activationId: content.status === "active" ? content.activationId : null,
    // Sort a copy for presentation; retain canonical record identities and
    // array order in persisted state. Later array entries win equal-time ties.
    history: [...content.violations].reverse().sort((left, right) =>
      Date.parse(right.recordedAt) - Date.parse(left.recordedAt)),
    manualUndoCandidateId: getLatestManualContentFreeUndoCandidate(content)?.id ?? null
  };
}

export function formatContentFreeStreakSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  const whole = Math.floor(seconds);
  const days = Math.floor(whole / 86400);
  const hours = Math.floor((whole % 86400) / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return `${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m ${remainder}s`;
}

export function formatContentFreeEventTime(timestamp: string): string {
  const time = new Date(timestamp);
  return Number.isFinite(time.getTime()) ? time.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit"
  }) : "Unknown time";
}
