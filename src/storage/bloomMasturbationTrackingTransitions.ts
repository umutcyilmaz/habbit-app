import { normalizeMasturbationTracking, normalizeResetJourney } from "./bloomProductStateSchema";
import { canEnableMasturbationTracking } from "../domain/productPolicy/getMasturbationTrackingAvailability";
import type { BloomLocalState } from "./bloomState";

// Manual activation respects persisted Reset lifecycle, independently of the
// event-time behavioral restriction. Reset completion never enables Tracking.
export function enableMasturbationTrackingState(state: BloomLocalState): BloomLocalState {
  try {
    const tracking = state.masturbationTracking;
    normalizeMasturbationTracking(tracking);
    if (tracking.enabled) return state;
    normalizeResetJourney(state.resetJourney);
    return canEnableMasturbationTracking(state.resetJourney)
      ? { ...state, masturbationTracking: { ...tracking, enabled: true } }
      : state;
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
