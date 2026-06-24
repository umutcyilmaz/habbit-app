import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { BreathingGuideCard } from "../components/BreathingGuideCard";
import { PauseTimerCard } from "../components/PauseTimerCard";

const INITIAL_SECONDS = 30;

export function PauseScreen() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const extendPause = () => {
    setSecondsLeft((current) => current + INITIAL_SECONDS);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PAUSE"
        icon="Ⅱ"
        title="Stop for a short moment."
        subtitle="Let your breathing slow down. Relax your jaw, belly, and pelvic floor."
        onBackPress={() => router.replace(routes.arousalControlPractice)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <PauseTimerCard secondsLeft={secondsLeft} />

        <AppCard style={styles.supportCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Firmness changes are okay.</AppText>
            <AppText tone="secondary">
              If firmness decreases during a pause, that does not mean the practice failed. You can
              continue gently or finish today.
            </AppText>
          </View>
        </AppCard>

        <BreathingGuideCard />

        <View style={styles.actions}>
          <AppButton onPress={() => router.replace(routes.arousalControlAfterPause)}>
            I'm ready to check in
          </AppButton>
          <AppButton variant="secondary" onPress={extendPause}>
            Extend 30 seconds
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push(routes.arousalControlFinish)}>
            Finish practice
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  supportCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
