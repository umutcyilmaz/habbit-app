import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useBloomLocalState,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { pauseRoundDurationSeconds } from "../../../shared/runtime/e2eMode";
import { runStableMountMutationOnce } from "../../../shared/runtime/runStableMountMutationOnce";
import { PauseCircleTimer } from "../components/PauseCircleTimer";
import { PauseAfterCheckInForm } from "../components/PauseAfterCheckInForm";
import { PauseFlowHeader } from "../components/PauseFlowHeader";
import type { PauseSessionCompletionData } from "../../../storage/bloomState";
import { getPausePersistenceErrorMessage } from "../pausePersistenceFeedback";
import { createPauseSavedCompletionHref } from "../pauseSavedRoute";
import { resolvePauseAgainUpdate } from "../pauseSessionAdapters";
import {
  createPauseTimerSessionSnapshot,
  extendPauseTimerRemainingSeconds,
  extendPauseTimerSnapshot,
  getPauseTimerElapsedSeconds,
  getPauseTimerRemainingSeconds,
  reconcilePauseTimerRemainingSeconds,
  type PauseTimerSessionSnapshot
} from "../pauseTimerState";

function getBreathingPhase(remainingSeconds: number) {
  const phase = remainingSeconds % 12;

  if (phase >= 8) {
    return "Breathe in";
  }

  if (phase >= 4) {
    return "Exhale slowly";
  }

  return "Notice what is present";
}

export function PauseTimerScreen() {
  const router = useRouter();
  const {
    state,
    updatePauseSession,
    addPauseSessionDuration,
    completePauseSession,
    retryPersistedMutation,
    discardPauseSession
  } = useBloomLocalState();
  const activeSession = state.pause.activeSession;
  const initialTimerSnapshot =
    activeSession !== null
      ? createPauseTimerSessionSnapshot(activeSession)
      : null;
  const timerSnapshotRef =
    useRef<PauseTimerSessionSnapshot | null>(initialTimerSnapshot);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    initialTimerSnapshot === null
      ? pauseRoundDurationSeconds
      : getPauseTimerRemainingSeconds(initialTimerSnapshot)
  );
  const remainingSecondsRef = useRef(remainingSeconds);
  const [isCheckingIn, setIsCheckingIn] = useState(
    activeSession?.phase === "afterPause"
  );
  const hasRoutedRef = useRef(false);
  const timerInitializationSessionIdRef = useRef<string | null>(null);
  const completionAttemptRef = useRef(false);
  const completionRecordIdRef = useRef<string | null>(null);
  const completionPromiseRef =
    useRef<Promise<BloomPersistedMutationResult> | null>(null);
  const isMountedRef = useRef(true);
  const [isSaving, setIsSaving] = useState(false);
  const [completionAccepted, setCompletionAccepted] = useState(false);
  const [retryToken, setRetryToken] =
    useState<BloomPersistenceRetryToken | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const persistenceNavigationBlocked = isSaving;
  const allowPersistenceNavigation = usePersistenceNavigationGuard(
    persistenceNavigationBlocked
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const showAfterPauseCheckIn = useCallback(() => {
    if (hasRoutedRef.current || activeSession === null) {
      return;
    }

    const snapshot =
      timerSnapshotRef.current ??
      createPauseTimerSessionSnapshot(activeSession);
    const elapsedDurationSeconds = getPauseTimerElapsedSeconds(
      snapshot,
      remainingSecondsRef.current
    );
    const result = updatePauseSession(activeSession.id, {
      phase: "afterPause",
      elapsedDurationSeconds
    });

    if (!result.ok) {
      return;
    }

    hasRoutedRef.current = true;
    timerSnapshotRef.current = {
      ...snapshot,
      elapsedDurationSeconds
    };
    setIsCheckingIn(true);
  }, [activeSession, updatePauseSession]);

  useEffect(() => {
    if (activeSession === null) {
      timerSnapshotRef.current = null;
      return;
    }

    const nextSnapshot = createPauseTimerSessionSnapshot(activeSession);
    const previousSnapshot = timerSnapshotRef.current;

    const nextRemainingSeconds = reconcilePauseTimerRemainingSeconds(
      remainingSecondsRef.current,
      previousSnapshot,
      nextSnapshot
    );
    remainingSecondsRef.current = nextRemainingSeconds;
    setRemainingSeconds(nextRemainingSeconds);
    timerSnapshotRef.current = nextSnapshot;
  }, [
    activeSession?.elapsedDurationSeconds,
    activeSession?.id,
    activeSession?.timerDurationSeconds
  ]);

  useEffect(() => {
    if (activeSession === null) {
      if (!completionAttemptRef.current) {
        router.replace(routes.pause);
      }

      return undefined;
    }

    if (
      activeSession.timerStartedAt === undefined
    ) {
      runStableMountMutationOnce(
        timerInitializationSessionIdRef,
        activeSession.id,
        () =>
          updatePauseSession(activeSession.id, {
            timerStartedAt: new Date().toISOString()
          }).ok
      );
    }

    return undefined;
  }, [
    activeSession?.id,
    activeSession?.timerStartedAt,
    router,
    updatePauseSession
  ]);

  useEffect(() => {
    if (activeSession === null || isCheckingIn) {
      return undefined;
    }

    const interval = setInterval(() => {
      const nextRemainingSeconds =
        remainingSecondsRef.current > 0
          ? remainingSecondsRef.current - 1
          : remainingSecondsRef.current;
      remainingSecondsRef.current = nextRemainingSeconds;
      setRemainingSeconds(nextRemainingSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, isCheckingIn]);

  useEffect(() => {
    if (remainingSeconds === 0) {
      showAfterPauseCheckIn();
    }
  }, [remainingSeconds, showAfterPauseCheckIn]);

  const addTime = () => {
    if (activeSession === null) {
      return;
    }

    const result = addPauseSessionDuration(activeSession.id, 60);

    if (result.ok) {
      const snapshot =
        timerSnapshotRef.current ??
        createPauseTimerSessionSnapshot(activeSession);
      timerSnapshotRef.current = extendPauseTimerSnapshot(snapshot, 60);
      const nextRemainingSeconds = extendPauseTimerRemainingSeconds(
        remainingSecondsRef.current,
        60
      );
      remainingSecondsRef.current = nextRemainingSeconds;
      setRemainingSeconds(nextRemainingSeconds);
    }
  };

  const closePause = () => {
    if (activeSession !== null) {
      discardPauseSession(activeSession.id);
    }

    router.replace(routes.home);
  };

  const savePause = async (completionData: PauseSessionCompletionData) => {
    if (completionPromiseRef.current !== null) {
      return;
    }

    let persistencePromise: Promise<BloomPersistedMutationResult>;

    if (retryToken !== null) {
      persistencePromise = retryPersistedMutation(retryToken);
    } else {
      if (activeSession === null || completionAttemptRef.current) {
        return;
      }

      completionAttemptRef.current = true;
      completionRecordIdRef.current = activeSession.id;
      persistencePromise = completePauseSession(
        activeSession.id,
        completionData
      );
    }

    completionPromiseRef.current = persistencePromise;
    setIsSaving(true);
    setPersistenceError(null);

    try {
      const result = await persistencePromise;

      if (!isMountedRef.current) {
        return;
      }

      if (result.ok) {
        const recordId = completionRecordIdRef.current;

        if (recordId === null) {
          setPersistenceError(
            "Bloom saved this Pause, but couldn’t identify its saved record. You can leave safely."
          );
          return;
        }

        setRetryToken(null);
        allowPersistenceNavigation();
        router.replace(createPauseSavedCompletionHref(recordId));
        return;
      }

      if (result.accepted) {
        setCompletionAccepted(true);
        setRetryToken(result.retryable ? result.retryToken : null);
      } else {
        completionAttemptRef.current = false;
        completionRecordIdRef.current = null;
        setCompletionAccepted(false);
        setRetryToken(null);
      }

      setPersistenceError(getPausePersistenceErrorMessage(result));
    } finally {
      if (completionPromiseRef.current === persistencePromise) {
        completionPromiseRef.current = null;

        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    }
  };

  const pauseAgain = () => {
    if (activeSession === null) {
      return;
    }

    const pauseAgainUpdate = resolvePauseAgainUpdate(
      activeSession,
      new Date().toISOString(),
      pauseRoundDurationSeconds
    );
    const result = updatePauseSession(activeSession.id, pauseAgainUpdate);

    if (!result.ok) {
      return;
    }

    hasRoutedRef.current = false;
    timerSnapshotRef.current = createPauseTimerSessionSnapshot({
      ...activeSession,
      ...pauseAgainUpdate
    });
    remainingSecondsRef.current = pauseRoundDurationSeconds;
    setRemainingSeconds(pauseRoundDurationSeconds);
    setIsCheckingIn(false);
  };

  if (isCheckingIn) {
    return (
      <AppScreen>
        <PauseFlowHeader
          title="How is it now?"
          subtitle="You created a pause. Notice what changed."
          disabled={isSaving}
          onBackPress={
            completionAccepted
              ? () => router.replace(routes.pause)
              : () => {
                  if (activeSession !== null) {
                    updatePauseSession(activeSession.id, { phase: "timer" });
                  }
                  hasRoutedRef.current = false;
                  setIsCheckingIn(false);
                }
          }
          onClosePress={closePause}
        />
        <PauseAfterCheckInForm
          onSave={savePause}
          onPauseAgain={pauseAgain}
          isSaving={isSaving}
          completionLocked={completionAccepted}
          canRetry={retryToken !== null}
          persistenceError={persistenceError}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PauseFlowHeader
        title="90-Second Pause"
        subtitle="Breathe, notice, and let the moment settle before continuing."
        disabled={isSaving}
        onBackPress={() => router.back()}
        onClosePress={closePause}
      />

      <View style={styles.stack}>
        <AppCard testID="bloom.pause.timer" style={styles.timerCard}>
          <View style={styles.cardStack}>
            <PauseCircleTimer
              remainingSeconds={remainingSeconds}
              phaseLabel={getBreathingPhase(remainingSeconds)}
            />
            <AppText tone="secondary" align="center">
              An urge can feel intense and still pass.
            </AppText>
            <View style={styles.actions}>
              <AppButton
                testID="bloom.pause.timer.add-time"
                variant="secondary"
                onPress={addTime}
              >
                Add 60 seconds
              </AppButton>
              <AppButton onPress={showAfterPauseCheckIn}>Finish early</AppButton>
              <AppButton variant="ghost" onPress={showAfterPauseCheckIn}>
                I want to continue
              </AppButton>
            </View>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  actions: {
    alignSelf: "stretch",
    gap: theme.spacing.sm
  },
  timerCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage
  }
});
