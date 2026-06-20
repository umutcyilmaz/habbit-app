import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppDispatch } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function PauseTimerScreen() {
  const router = useRouter();
  const dispatch = useDemoAppDispatch();

  const handleComplete = () => {
    const completedAt = new Date().toISOString();

    dispatch({
      type: "ADD_PAUSE_SESSION",
      payload: {
        id: `pause-${completedAt}`,
        completedAt,
        durationSeconds: 90,
        nextChoice: "Reflect"
      }
    });

    router.replace(routes.pauseSaved);
  };

  return (
    <AppScreen>
      <AppHeader
        title="90-Second Pause"
        subtitle="Breathe, notice, and let the moment settle."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.timerCard}>
          <View style={styles.cardStack}>
            <AppText variant="heading" align="center">
              90
            </AppText>
            <AppText tone="secondary" align="center">
              Take the time you need. You remain in control.
            </AppText>
            <AppButton onPress={handleComplete}>Complete Pause</AppButton>
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
  timerCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
