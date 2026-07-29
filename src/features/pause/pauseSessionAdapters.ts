import type {
  PauseSessionDraft,
  PauseSessionPatch
} from "../../storage/bloomState";

export function resolvePauseAgainUpdate(
  session: PauseSessionDraft,
  timerStartedAt = new Date().toISOString(),
  intervalSeconds = 90
): PauseSessionPatch {
  return {
    phase: "timer",
    timerStartedAt,
    timerDurationSeconds:
      session.elapsedDurationSeconds + intervalSeconds
  };
}
