import type { ContentFreeState } from "../models/ContentFreeState";
import type { ISODateString } from "../models/shared";

// Credit belongs only to the first streak of its activation. Violation undo
// restores the boundary and therefore restores credit without duplicating it.
export function getContentFreeStreakSeconds(
  content: ContentFreeState, startedAt: ISODateString, endedAt: ISODateString, activationId?: string, ignoredViolationId?: string
): number {
  const active = content.status === "active" && (activationId === undefined || activationId === content.activationId);
  const activation = active ? { startedAt: content.activatedAt, resetCredit: content.resetCredit }
    : content.pastActivations.find((entry) => entry.id === activationId);
  const id = active && content.status === "active" ? content.activationId : activationId;
  const boundaryViolated = content.violations.some((entry) => entry.activationId === id &&
    entry.status === "recorded" && entry.id !== ignoredViolationId && entry.occurredAt === activation?.startedAt);
  const creditMilliseconds = activation?.startedAt === startedAt && !boundaryViolated && activation.resetCredit !== undefined
    ? Date.parse(activation.resetCredit.earnedUntil) - Date.parse(activation.resetCredit.earnedStartedAt) : 0;
  return Math.floor((Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) + creditMilliseconds) / 1000);
}
