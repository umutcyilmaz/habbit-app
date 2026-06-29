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

export function TenDayResetPracticeScreen() {
  const router = useRouter();
  const { startTenDayReset, completeTodayReset } = useBloomLocalState();
  const [timerStarted, setTimerStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(resetDurationSeconds);

  useEffect(() => {
    if (!timerStarted || secondsLeft <= 0) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [secondsLeft, timerStarted]);

  const startTimer = () => {
    startTenDayReset();
    if (secondsLeft === 0) {
      setSecondsLeft(resetDurationSeconds);
    }
    setTimerStarted(true);
  };

  const saveToday = () => {
    completeTodayReset();
    router.replace(routes.tenDayResetSaved);
  };

  const timerComplete = secondsLeft === 0;

  return (
    <AppScreen contentStyle={styles.content}>
      <ResetPracticeHeader
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <PracticeTimerCard
          secondsLeft={secondsLeft}
          timerStarted={timerStarted}
          timerComplete={timerComplete}
          onStartPress={startTimer}
          onAlreadyDonePress={saveToday}
        />

        <DuringResetCard />

        <View style={styles.bottomActions}>
          <AppButton onPress={saveToday}>
            Finish today’s reset
          </AppButton>
        </View>
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
  secondsLeft: number;
  timerStarted: boolean;
  timerComplete: boolean;
  onStartPress: () => void;
  onAlreadyDonePress: () => void;
};

function PracticeTimerCard({
  secondsLeft,
  timerStarted,
  timerComplete,
  onStartPress,
  onAlreadyDonePress
}: PracticeTimerCardProps) {
  const buttonLabel = timerComplete ? "Restart timer" : timerStarted ? "Timer running" : "Start timer";

  return (
    <AppCard style={styles.timerCard}>
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
        Put the phone down. Relax your belly and jaw. Breathe slowly.
      </AppText>
      {timerComplete ? (
        <AppText variant="bodySmall" align="center">
          The reset is complete. Save today when you are ready.
        </AppText>
      ) : null}
      <View style={styles.timerActions}>
        <AppButton onPress={onStartPress}>{buttonLabel}</AppButton>
        <Pressable accessibilityRole="button" onPress={onAlreadyDonePress} style={styles.textAction}>
          <AppText variant="label" tone="secondary" align="center">
            I already did it
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
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
