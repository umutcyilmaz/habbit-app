import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function ExercisesScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        title="Exercises"
        subtitle="Short practices for pausing, resetting, and noticing the moment."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.featuredCard}>
          <View style={styles.cardStack}>
            <AppText variant="caption" tone="secondary">
              Recommended
            </AppText>
            <AppText variant="title">90-Second Pause</AppText>
            <AppText tone="secondary">
              A brief reset before choosing what comes next.
            </AppText>
            <AppButton onPress={() => router.push(routes.pause)}>Start 90-Second Pause</AppButton>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Quick support</AppText>
            <AppText tone="secondary">
              Check in first if you want to name what is present.
            </AppText>
            <AppButton variant="secondary" onPress={() => router.push(routes.log)}>
              Quick Check-In
            </AppButton>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Coming next</AppText>
            <AppText tone="secondary">
              Breathing reset, arousal awareness, and custom routines will be added later.
            </AppText>
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
  featuredCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  }
});
