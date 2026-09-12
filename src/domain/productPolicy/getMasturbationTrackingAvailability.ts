import type { MasturbationTrackingState } from "../models/MasturbationTrackingState";
import type { ResetJourney } from "../models/ResetJourney";
import type { ISODateString } from "../models/shared";
import { getResetRestrictionStatus, type ResetRestrictionStatus } from "./getResetRestrictionStatus";

export type MasturbationTrackingStartBlockReason =
  | "trackingDisabled"
  | "activeSession"
  | "awaitingFeedback"
  | "resetRestriction"
  | null;

export type MasturbationTrackingAvailability = {
  enabled: boolean;
  currentSessionStatus: "none" | "active" | "awaiting_feedback";
  resetRestriction: ResetRestrictionStatus;
} & (
  | { canStartSession: true; blockReason: null }
  | { canStartSession: false; blockReason: Exclude<MasturbationTrackingStartBlockReason, null> }
);

// Structural model input keeps this capability read independent of storage,
// providers, and Home priorities. Invalid policy facts never grant permission.
export function getMasturbationTrackingAvailability(
  state: { masturbationTracking: MasturbationTrackingState; resetJourney: ResetJourney },
  at: ISODateString
): MasturbationTrackingAvailability | null {
  const resetRestriction = getResetRestrictionStatus(state.resetJourney, at);
  const tracking = state.masturbationTracking;
  if (resetRestriction === null || typeof tracking.enabled !== "boolean") return null;
  const currentSessionStatus = tracking.currentSession === null ? "none" : tracking.currentSession?.status;
  if (currentSessionStatus !== "none" && currentSessionStatus !== "active" && currentSessionStatus !== "awaiting_feedback") return null;
  // Canonical precedence: permission, unfinished physical session, pending
  // feedback, effective Reset restriction, then no blocker.
  const blockReason = !tracking.enabled ? "trackingDisabled"
    : currentSessionStatus === "active" ? "activeSession"
    : currentSessionStatus === "awaiting_feedback" ? "awaitingFeedback"
    : resetRestriction.isRestrictionActive ? "resetRestriction"
    : null;
  const facts = { enabled: tracking.enabled, currentSessionStatus, resetRestriction } as const;
  return blockReason === null
    ? { ...facts, canStartSession: true, blockReason: null }
    : { ...facts, canStartSession: false, blockReason };
}
