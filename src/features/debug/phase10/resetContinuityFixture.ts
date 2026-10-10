import { createDefaultBloomState, startResetFromBaselineState } from "../../../storage/bloomState";

// Shared Node/DEV-E2E fixture. Never uses device time, production storage,
// or the legacy Reset date-offset helper. Only the guarded QA runtime uses it.
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
