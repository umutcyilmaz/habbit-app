import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import {
  useBloomLocalState,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { getNextBloomAction } from "../../../domain/journey/getNextBloomAction";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { resetDurationSeconds } from "../../../shared/runtime/e2eMode";
import {
  isResetProgramComplete,
  isResetStarted
} from "../../../storage/bloomState";

const resetSteps = [
  {
    icon: "↘",
    text: "Put the phone down"
  },
  {
    icon: "◌",
    text: "Relax your belly and jaw"
  },
  {
    icon: "∿",
    text: "Breathe slowly"
  },
  {
    icon: "✓",
    text: "Let the urge pass without checking"
  }
] as const;

type TimerStatus = "idle" | "running" | "paused" | "completed";

export function TenDayResetPracticeScreen() {
  const router = useRouter();
  const {
    state,
    durableState,
    durableTodayKey,
    startTenDayReset,
    completeTodayReset,
    retryPersistedMutation,
    durableTodayCompleted
  } = useBloomLocalState();
  const resetComplete = isResetProgramComplete(
    durableState.tenDayReset
  );
  const nextAction = getNextBloomAction(durableState, durableTodayKey);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("idle");
  const [secondsLeft, setSecondsLeft] = useState(resetDurationSeconds);
  const [practiceAgain, setPracticeAgain] = useState(false);
  const completionAttemptRef = useRef(false);
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
  const showAlreadyCompleted =
    durableTodayCompleted &&
    !practiceAgain &&
    !completionAccepted &&
    !isSaving;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resetComplete && !completionAttemptRef.current) {
      router.replace(nextAction.route);
      return;
    }

    if (!isResetStarted(state.tenDayReset)) {
      startTenDayReset();
    }
  }, [
    nextAction.route,
    resetComplete,
    router,
    startTenDayReset,
    state.tenDayReset
  ]);

  useEffect(() => {
    if (timerStatus !== "running" || secondsLeft <= 0) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [secondsLeft, timerStatus]);

  useEffect(() => {
    if (secondsLeft === 0 && timerStatus === "running") {
      setTimerStatus("completed");
    }
  }, [secondsLeft, timerStatus]);

  const startTimer = () => {
    setTimerStatus((currentStatus) => (currentStatus === "running" ? "paused" : "running"));
  };

  const practiceAgainToday = () => {
    setPracticeAgain(true);
    setSecondsLeft(resetDurationSeconds);
    setTimerStatus("idle");
  };

  const viewSavedReset = () => {
    router.replace(routes.tenDayResetSaved);
  };

  const saveTodayReset = async () => {
    if (completionPromiseRef.current !== null) {
      return;
    }

    if (durableTodayCompleted && !completionAttemptRef.current) {
      viewSavedReset();
      return;
    }

    let persistencePromise: Promise<BloomPersistedMutationResult>;

    if (retryToken !== null) {
      persistencePromise = retryPersistedMutation(retryToken);
    } else {
      if (completionAttemptRef.current) {
        return;
      }

      completionAttemptRef.current = true;
      persistencePromise = completeTodayReset();
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
        setRetryToken(null);
        allowPersistenceNavigation();
        router.replace(routes.tenDayResetSaved);
        return;
      }

      if (result.accepted) {
        setCompletionAccepted(true);
        setRetryToken(result.retryable ? result.retryToken : null);
      } else {
        completionAttemptRef.current = false;
        setCompletionAccepted(false);
        setRetryToken(null);
      }

      setPersistenceError(getResetPersistenceErrorMessage(result));
    } finally {
      if (completionPromiseRef.current === persistencePromise) {
        completionPromiseRef.current = null;

        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    }
  };

  if (resetComplete && !completionAttemptRef.current) {
    return null;
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <ResetPracticeHeader
        disabled={isSaving}
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <PracticeTimerCard
          secondsLeft={showAlreadyCompleted ? 0 : secondsLeft}
          timerStatus={showAlreadyCompleted ? "completed" : timerStatus}
          alreadyCompleted={showAlreadyCompleted}
          onStartPress={startTimer}
          onSavePress={showAlreadyCompleted ? viewSavedReset : saveTodayReset}
          onAlreadyDonePress={saveTodayReset}
          onPracticeAgainPress={practiceAgainToday}
          isSaving={isSaving}
          completionLocked={completionAccepted}
          canRetry={retryToken !== null}
          persistenceError={persistenceError}
        />

        <DuringResetCard />

        {!showAlreadyCompleted ? (
          <View style={styles.bottomActions}>
            <AppButton
              disabled={completionAccepted && retryToken === null}
              loading={isSaving}
              onPress={saveTodayReset}
            >
              {retryToken !== null
                ? "Try saving again"
                : "Finish today’s reset"}
            </AppButton>
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

type ResetPracticeHeaderProps = {
  disabled: boolean;
  onBackPress: () => void;
  onClosePress: () => void;
};

function ResetPracticeHeader({
  disabled,
  onBackPress,
  onClosePress
}: ResetPracticeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <AppIconButton
          accessibilityLabel="Back to reset overview"
          accessibilityState={{ disabled }}
          disabled={disabled}
          icon={<AppText variant="title">‹</AppText>}
          onPress={onBackPress}
          style={styles.headerButton}
        />
        <View style={styles.headerLabelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
            TODAY’S RESET
          </AppText>
        </View>
        <AppIconButton
          accessibilityLabel="Close reset"
          accessibilityState={{ disabled }}
          disabled={disabled}
          icon={<AppText variant="title">×</AppText>}
          onPress={onClosePress}
          style={styles.headerButton}
        />
      </View>

      <View style={styles.titleBlock}>
        <AppText variant="heading" align="center" style={styles.title}>
          2-minute breathing reset
        </AppText>
        <AppText tone="secondary" align="center" style={styles.subtitle}>
          Use this when the urge feels automatic or you want to check.
        </AppText>
      </View>
    </View>
  );
}

type PracticeTimerCardProps = {
  secondsLeft: number;
  timerStatus: TimerStatus;
  alreadyCompleted: boolean;
  isSaving: boolean;
  completionLocked: boolean;
  canRetry: boolean;
  persistenceError: string | null;
  onStartPress: () => void;
  onSavePress: () => void;
  onAlreadyDonePress: () => void;
  onPracticeAgainPress: () => void;
};

function PracticeTimerCard({
  secondsLeft,
  timerStatus,
  alreadyCompleted,
  isSaving,
  completionLocked,
  canRetry,
  persistenceError,
  onStartPress,
  onSavePress,
  onAlreadyDonePress,
  onPracticeAgainPress
}: PracticeTimerCardProps) {
  const timerComplete = timerStatus === "completed";
  const buttonLabel = getTimerButtonLabel(
    timerStatus,
    alreadyCompleted,
    completionLocked,
    canRetry
  );
  const persistenceActionActive = isSaving || completionLocked || canRetry;

  return (
    <AppCard testID="bloom.reset.timer" style={styles.timerCard}>
      <View style={styles.timerVisual}>
        <View style={styles.timerInner}>
          <AppText variant="heading" style={styles.timerText}>
            {formatTime(secondsLeft)}
          </AppText>
          <AppText variant="caption" tone="secondary">
            reset
          </AppText>
        </View>
      </View>
      <AppText tone="secondary" align="center" style={styles.timerCopy}>
        {alreadyCompleted
          ? "You completed your reset practice for today."
          : "Put the phone down. Relax your belly and jaw. Breathe slowly."}
      </AppText>
      {alreadyCompleted ? (
        <AppText variant="bodySmall" align="center">
          Today’s reset is already saved.
        </AppText>
      ) : timerComplete ? (
        <AppText variant="bodySmall" align="center">
          The reset is complete. Save today when you are ready.
        </AppText>
      ) : null}
      {persistenceError !== null ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          variant="bodySmall"
          tone="danger"
          align="center"
        >
          {persistenceError}
        </AppText>
      ) : null}
      <View style={styles.timerActions}>
        <AppButton
          testID={
            alreadyCompleted
              ? "bloom.reset.saved-action"
              : timerComplete
                ? "bloom.reset.complete"
                : "bloom.reset.practice.start"
          }
          disabled={completionLocked && !canRetry}
          loading={isSaving}
          onPress={
            alreadyCompleted || timerComplete || persistenceActionActive
              ? onSavePress
              : onStartPress
          }
        >
          {buttonLabel}
        </AppButton>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving || completionLocked }}
          disabled={isSaving || completionLocked}
          onPress={alreadyCompleted ? onPracticeAgainPress : onAlreadyDonePress}
          style={({ pressed }) => [
            styles.textAction,
            pressed ? styles.textActionPressed : undefined,
            isSaving || completionLocked ? styles.textActionDisabled : undefined
          ]}
        >
          <AppText variant="label" tone="secondary" align="center">
            {alreadyCompleted ? "Practice again" : "I already did it"}
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

function getTimerButtonLabel(
  timerStatus: TimerStatus,
  alreadyCompleted: boolean,
  completionLocked: boolean,
  canRetry: boolean
) {
  if (canRetry) {
    return "Try saving again";
  }

  if (completionLocked) {
    return "Saving interrupted";
  }

  if (alreadyCompleted) {
    return "View saved reset";
  }

  switch (timerStatus) {
    case "running":
      return "Pause";
    case "paused":
      return "Resume";
    case "completed":
      return "Save today’s reset";
    case "idle":
    default:
      return "Start timer";
  }
}

function getResetPersistenceErrorMessage(
  result: BloomPersistedMutationResult
) {
  if (result.ok) {
    return null;
  }

  if (result.reason === "persistenceUnknown") {
    return "Bloom is still confirming today’s Reset in local storage. You can leave safely or try again; it is not shown as saved yet.";
  }

  if (result.reason === "persistenceSuperseded") {
    return "A newer change replaced this Reset save request. Today’s Reset was not marked as saved by this request.";
  }

  if (result.retryable) {
    return "Today’s Reset is complete for this session, but Bloom couldn’t save it to local storage. Try saving again.";
  }

  if (result.accepted) {
    return "Saving was interrupted because Bloom’s local data changed. Return to Reset before trying again.";
  }

  return "Bloom couldn’t complete today’s Reset right now. Try again.";
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function DuringResetCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title" style={styles.sectionTitle}>
          During this reset
        </AppText>
        <View style={styles.stepStack}>
          {resetSteps.map((step) => (
            <ResetPracticeStep key={step.text} icon={step.icon} text={step.text} />
          ))}
        </View>
      </View>
    </AppCard>
  );
}

type ResetPracticeStepProps = {
  icon: string;
  text: string;
};

function ResetPracticeStep({ icon, text }: ResetPracticeStepProps) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.iconCircle}>
        <AppText variant="label">{icon}</AppText>
      </View>
      <AppText variant="bodySmall" style={styles.stepText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  header: {
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm
  },
  headerActions: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface
  },
  headerLabelWrap: {
    position: "absolute",
    left: 58,
    right: 58,
    alignItems: "center"
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  titleBlock: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm
  },
  title: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 38,
    lineHeight: 44
  },
  subtitle: {
    maxWidth: 330
  },
  stack: {
    gap: theme.spacing.xl
  },
  timerCard: {
    alignItems: "center",
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  timerVisual: {
    width: 172,
    height: 172,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 86,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  timerInner: {
    width: 118,
    height: 118,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 59,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  timerText: {
    fontSize: 44,
    lineHeight: 52
  },
  timerCopy: {
    maxWidth: 300
  },
  timerActions: {
    alignSelf: "stretch",
    gap: theme.spacing.sm
  },
  textAction: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg
  },
  textActionPressed: {
    opacity: 0.75
  },
  textActionDisabled: {
    opacity: 0.5
  },
  card: {
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  sectionTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
  },
  stepStack: {
    gap: theme.spacing.sm
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: theme.spacing.md
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  stepText: {
    flex: 1
  },
  bottomActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
