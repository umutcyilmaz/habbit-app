import type { ResetBaseline } from "../domain/models/ResetBaseline";
import type { ResetJourney } from "../domain/models/ResetJourney";
import type { ISODateString, UUID } from "../domain/models/shared";
import { normalizeResetBaseline, normalizeResetJourney } from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type StartResetFromBaselineInput = {
  resetBaseline: ResetBaseline;
  resetAttemptId: UUID;
  startedAt: ISODateString;
};

// Complete preparation and start one attempt using only supplied facts.
// Repeated starts and invalid inputs follow the existing exact no-op pattern.
export function startResetFromBaselineState(
  state: BloomLocalState,
  input: StartResetFromBaselineInput
): BloomLocalState {
  const reset = state.resetJourney;
  if (reset.status !== "baseline_pending") return state;

  try {
    // Reject partially started source state before constructing its successor.
    normalizeResetJourney(reset);
    if (typeof input !== "object" || input === null || Array.isArray(input)) return state;
    const keys = Object.keys(input);
    if (keys.length !== 3 || !keys.includes("resetBaseline") ||
      !keys.includes("resetAttemptId") || !keys.includes("startedAt")) return state;
    const { startedAt, resetAttemptId } = input;
    if (!isValidBloomIsoTimestamp(startedAt)) return state;
    const baseline = normalizeResetBaseline(input.resetBaseline);
    if (Date.parse(startedAt) < Date.parse(baseline.capturedAt)) return state;

    const resetJourney: ResetJourney = {
      status: "active",
      id: reset.id,
      durationDays: reset.durationDays,
      bestCompletedDays: reset.bestCompletedDays,
      pastAttempts: reset.pastAttempts,
      violations: reset.violations,
      baseline,
      startedAt,
      currentAttempt: { id: resetAttemptId, status: "active", startedAt }
    };
    // Validate identities, history references, and non-overlapping attempts.
    normalizeResetJourney(resetJourney);
    return { ...state, resetJourney };
  } catch {
    return state;
  }
}
