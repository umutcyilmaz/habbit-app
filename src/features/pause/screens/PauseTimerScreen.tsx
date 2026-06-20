import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { PauseCircleTimer } from "../components/PauseCircleTimer";
import { PauseFlowHeader } from "../components/PauseFlowHeader";

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
  const [remainingSeconds, setRemainingSeconds] = useState(90);
  const hasRoutedRef = useRef(false);

  const routeToSaved = useCallback(() => {
    if (hasRoutedRef.current) {
      return;
    }

    hasRoutedRef.current = true;
    router.replace(routes.pauseSaved);
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((currentSeconds) =>
        currentSeconds > 0 ? currentSeconds - 1 : currentSeconds
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remainingSeconds === 0) {
      routeToSaved();
    }
  }, [remainingSeconds, routeToSaved]);

  const addTime = () => {
    setRemainingSeconds((currentSeconds) => currentSeconds + 60);
  };

  return (
    <AppScreen>
      <PauseFlowHeader
        title="90-Second Pause"
        subtitle="Breathe, notice, and let the moment settle before continuing."
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.timerCard}>
          <View style={styles.cardStack}>
            <PauseCircleTimer
              remainingSeconds={remainingSeconds}
              phaseLabel={getBreathingPhase(remainingSeconds)}
            />
            <AppText tone="secondary" align="center">
              An urge can feel intense and still pass.
            </AppText>
            <View style={styles.actions}>
              <AppButton variant="secondary" onPress={addTime}>
                Add 60 seconds
              </AppButton>
              <AppButton onPress={routeToSaved}>Finish early</AppButton>
              <AppButton variant="ghost" onPress={routeToSaved}>
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
