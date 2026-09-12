import { normalizeMasturbationTracking, normalizeResetJourney } from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";

// Manual activation respects persisted Reset lifecycle, independently of the
// event-time behavioral restriction. Assessment owns enabling its Reset path.
export function enableMasturbationTrackingState(state: BloomLocalState): BloomLocalState {
  try {
    const tracking = state.masturbationTracking;
    normalizeMasturbationTracking(tracking);
    if (tracking.enabled) return state;
    normalizeResetJourney(state.resetJourney);
    switch (state.resetJourney.status) {
      case "inactive":
      case "recommended":
      case "completed":
        return { ...state, masturbationTracking: { ...tracking, enabled: true } };
      case "baseline_pending":
      case "active":
      case "assessment_pending":
      default:
        return state;
    }
  } catch {
    return state;
  }
}

// Disabling new starts never destroys unfinished work or completed history.
export function disableMasturbationTrackingState(state: BloomLocalState): BloomLocalState {
  try {
    const tracking = state.masturbationTracking;
    normalizeMasturbationTracking(tracking);
    if (!tracking.enabled) return state;
    return { ...state, masturbationTracking: { ...tracking, enabled: false } };
  } catch {
    return state;
  }
}
