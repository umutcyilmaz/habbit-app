import { createDefaultBloomState, startResetFromBaselineState } from "../../src/storage/bloomState";

// Isolated test clock. This module is never imported by app/src code and never
// uses device time, production storage, or the legacy Reset date-offset helper.
export function createResetContinuityFixture() {
  const startedAt = "2026-10-01T10:00:00.250Z";
  let elapsedMilliseconds = 0;
  const now = () => new Date(Date.parse(startedAt) + elapsedMilliseconds);
  const observeDays = (days: number, extraMilliseconds = 0) => {
    elapsedMilliseconds = days * 86400000 + extraMilliseconds;
    return now().toISOString();
  };
  const initial = createDefaultBloomState();
  const pending = { ...initial, resetJourney: { ...initial.resetJourney, status: "baseline_pending" as const, id: "continuity-reset" } };
  const state = startResetFromBaselineState(pending, {
    resetBaselineId: "continuity-baseline", resetAttemptId: "continuity-attempt", startedAt, capturedAt: startedAt,
    selfReport: { erectionDecline: "none", needsStrongerOrFasterStimulation: "no", climaxTakesLonger: "no", difficultyArousingWithoutExplicitContent: "notTried" }
  });
  return { state, startedAt, now, observeDays };
}
