import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function PauseIntroScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        title="Pause"
        subtitle="Take a short moment before choosing what comes next."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.card}>
          <View style={styles.cardStack}>
            <AppText variant="caption" tone="secondary">
              90 seconds
            </AppText>
            <AppText variant="title">Create a little space</AppText>
            <AppText tone="secondary">
              A short pause can help you notice the moment before the next choice.
            </AppText>
            <AppButton onPress={() => router.push(routes.pauseCheckIn)}>Begin</AppButton>
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
  card: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  }
});
