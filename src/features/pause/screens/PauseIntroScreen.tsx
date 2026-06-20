import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { PauseFlowHeader } from "../components/PauseFlowHeader";

export function PauseIntroScreen() {
  const router = useRouter();

  return (
    <AppScreen contentContainerStyle={styles.screenContent}>
      <PauseFlowHeader
        title="You do not have to decide immediately."
        subtitle="Take a short moment to notice what is happening before reacting."
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.card}>
          <View style={styles.cardStack}>
            <View style={styles.calmVisual} accessibilityRole="image">
              <View style={styles.innerCircle}>
                <AppText variant="caption" tone="secondary" align="center">
                  90 sec
                </AppText>
              </View>
            </View>
            <AppText variant="title">First, let’s check in</AppText>
            <AppText tone="secondary">
              A quick reflection can make the next step feel less automatic.
            </AppText>
            <View style={styles.actions}>
              <AppButton onPress={() => router.push(routes.pauseCheckIn)}>Start Check-In</AppButton>
              <AppButton variant="ghost" onPress={() => router.push(routes.pauseTimer)}>
                Skip to 90-Second Pause
              </AppButton>
            </View>
          </View>
        </AppCard>

        <AppText variant="bodySmall" tone="secondary" align="center">
          This is not a test. You can stop anytime.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "center"
  },
  stack: {
    gap: theme.spacing.xl
  },
  cardStack: {
    alignItems: "center",
    gap: theme.spacing.lg
  },
  actions: {
    alignSelf: "stretch",
    gap: theme.spacing.sm
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border
  },
  calmVisual: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 66,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  innerCircle: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    backgroundColor: theme.colors.surface
  }
});
