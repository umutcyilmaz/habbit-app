import type { PauseSessionDraft } from "../../storage/bloomState";

export type PauseTimerSessionSnapshot = {
  sessionId: string;
  configuredDurationSeconds: number;
  elapsedDurationSeconds: number;
};

export function createPauseTimerSessionSnapshot(
  session: Pick<
    PauseSessionDraft,
    "id" | "timerDurationSeconds" | "elapsedDurationSeconds"
  >
): PauseTimerSessionSnapshot {
  return {
    sessionId: session.id,
    configuredDurationSeconds: session.timerDurationSeconds,
    elapsedDurationSeconds: session.elapsedDurationSeconds
  };
}

export function getPauseTimerRemainingSeconds(
  snapshot: PauseTimerSessionSnapshot
) {
  return Math.max(
    snapshot.configuredDurationSeconds - snapshot.elapsedDurationSeconds,
    0
  );
}

export function extendPauseTimerSnapshot(
  snapshot: PauseTimerSessionSnapshot,
  extensionSeconds: number
): PauseTimerSessionSnapshot {
  if (
    !Number.isSafeInteger(extensionSeconds) ||
    extensionSeconds <= 0 ||
    !Number.isSafeInteger(
      snapshot.configuredDurationSeconds + extensionSeconds
    )
  ) {
    return snapshot;
  }

  return {
    ...snapshot,
    configuredDurationSeconds:
      snapshot.configuredDurationSeconds + extensionSeconds
  };
}

export function extendPauseTimerRemainingSeconds(
  remainingSeconds: number,
  extensionSeconds: number
) {
  if (
    !Number.isSafeInteger(remainingSeconds) ||
    remainingSeconds < 0 ||
    !Number.isSafeInteger(extensionSeconds) ||
    extensionSeconds <= 0 ||
    !Number.isSafeInteger(remainingSeconds + extensionSeconds)
  ) {
    return remainingSeconds;
  }

  return remainingSeconds + extensionSeconds;
}

export function reconcilePauseTimerRemainingSeconds(
  currentRemainingSeconds: number,
  previousSnapshot: PauseTimerSessionSnapshot | null,
  nextSnapshot: PauseTimerSessionSnapshot
) {
  if (
    previousSnapshot === null ||
    previousSnapshot.sessionId !== nextSnapshot.sessionId ||
    previousSnapshot.elapsedDurationSeconds !==
      nextSnapshot.elapsedDurationSeconds
  ) {
    return getPauseTimerRemainingSeconds(nextSnapshot);
  }

  const configuredDurationDelta =
    nextSnapshot.configuredDurationSeconds -
    previousSnapshot.configuredDurationSeconds;
  const reconciledRemainingSeconds =
    currentRemainingSeconds + configuredDurationDelta;

  return Number.isSafeInteger(reconciledRemainingSeconds)
    ? Math.max(reconciledRemainingSeconds, 0)
    : getPauseTimerRemainingSeconds(nextSnapshot);
}

export function getPauseTimerElapsedSeconds(
  snapshot: PauseTimerSessionSnapshot,
  remainingSeconds: number
) {
  if (!Number.isSafeInteger(remainingSeconds) || remainingSeconds < 0) {
    return snapshot.elapsedDurationSeconds;
  }

  return Math.max(
    snapshot.elapsedDurationSeconds,
    Math.min(
      snapshot.configuredDurationSeconds - remainingSeconds,
      snapshot.configuredDurationSeconds
    )
  );
}
