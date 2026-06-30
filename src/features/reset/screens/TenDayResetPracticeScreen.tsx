import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

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

const resetDurationSeconds = 120;

type TimerStatus = "idle" | "running" | "paused" | "completed";

export function TenDayResetPracticeScreen() {
  const router = useRouter();
  const { startTenDayReset, completeTodayReset, resetTodayCompleted } = useBloomLocalState();
  const [timerStatus, setTimerStatus] = useState<TimerStatus>("idle");
  const [secondsRemaining, setSecondsRemaining] = useState(resetDurationSeconds);
  const [practiceAgainRequested, setPracticeAgainRequested] = useState(false);
  const showSavedState = resetTodayCompleted && !practiceAgainRequested;

  useEffect(() => {
    if (timerStatus !== "running") {
      return undefined;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [timerStatus]);

  useEffect(() => {
    if (timerStatus === "running" && secondsRemaining === 0) {
      setTimerStatus("completed");
    }
  }, [secondsRemaining, timerStatus]);

  const saveToday = () => {
    completeTodayReset();
    router.replace(routes.tenDayResetSaved);
  };

  const practiceAgain = () => {
    setPracticeAgainRequested(true);
    setTimerStatus("idle");
    setSecondsRemaining(resetDurationSeconds);
  };

  const handleTimerPrimaryPress = () => {
    if (showSavedState) {
      router.replace(routes.tenDayResetSaved);
      return;
    }

    if (timerStatus === "completed") {
      saveToday();
      return;
    }

    if (timerStatus === "running") {
      setTimerStatus("paused");
      return;
    }

    startTenDayReset();
    setTimerStatus("running");
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ResetPracticeHeader
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <PracticeTimerCard
          secondsRemaining={showSavedState ? 0 : secondsRemaining}
          timerStatus={showSavedState ? "completed" : timerStatus}
          savedToday={showSavedState}
          onPrimaryPress={handleTimerPrimaryPress}
          onAlreadyDonePress={saveToday}
          onPracticeAgainPress={practiceAgain}
        />

        <DuringResetCard />

        {showSavedState ? null : (
          <View style={styles.bottomActions}>
            <AppButton onPress={saveToday}>
              Finish today’s reset
            </AppButton>
          </View>
        )}
      </View>
    </AppScreen>
  );
}

type ResetPracticeHeaderProps = {
  onBackPress: () => void;
  onClosePress: () => void;
};

function ResetPracticeHeader({ onBackPress, onClosePress }: ResetPracticeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <AppIconButton
          accessibilityLabel="Back to reset overview"
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
  secondsRemaining: number;
  timerStatus: TimerStatus;
  savedToday: boolean;
  onPrimaryPress: () => void;
  onAlreadyDonePress: () => void;
  onPracticeAgainPress: () => void;
};

function PracticeTimerCard({
  secondsRemaining,
  timerStatus,
  savedToday,
  onPrimaryPress,
  onAlreadyDonePress,
  onPracticeAgainPress
}: PracticeTimerCardProps) {
  const buttonLabel = savedToday ? "View saved reset" : getTimerButtonLabel(timerStatus);
  const statusCopy = savedToday ? "You completed your reset practice for today." : getTimerStatusCopy(timerStatus);
  const title = savedToday ? "Today’s reset is already saved." : null;

  return (
    <AppCard style={styles.timerCard}>
      {title ? (
        <View style={styles.savedCopy}>
          <AppText variant="title" align="center" style={styles.savedTitle}>
            {title}
          </AppText>
        </View>
      ) : null}
      <View style={styles.timerVisual}>
        <View style={styles.timerInner}>
          <AppText variant="heading" style={styles.timerText}>
            {formatTime(secondsRemaining)}
          </AppText>
          <AppText variant="caption" tone="secondary">
            reset
          </AppText>
        </View>
      </View>
      <AppText tone="secondary" align="center" style={styles.timerCopy}>
        Put the phone down. Relax your belly and jaw. Breathe slowly.
      </AppText>
      {statusCopy ? (
        <AppText variant="bodySmall" align="center">
          {statusCopy}
        </AppText>
      ) : null}
      <View style={styles.timerActions}>
        <AppButton onPress={onPrimaryPress}>{buttonLabel}</AppButton>
        <Pressable
          accessibilityRole="button"
          onPress={savedToday ? onPracticeAgainPress : onAlreadyDonePress}
          style={styles.textAction}
        >
          <AppText variant="label" tone="secondary" align="center">
            {savedToday ? "Practice again" : "I already did it"}
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

function getTimerButtonLabel(timerStatus: TimerStatus) {
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

function getTimerStatusCopy(timerStatus: TimerStatus) {
  switch (timerStatus) {
    case "paused":
      return "Paused. Resume when you are ready.";
    case "completed":
      return "Reset complete";
    case "running":
    case "idle":
    default:
      return null;
  }
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
  savedCopy: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm
  },
  savedTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
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
