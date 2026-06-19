import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function PauseSavedScreen() {
  const router = useRouter();
  const state = useDemoAppState();

  return (
    <AppScreen>
      <AppHeader
        title="Pause saved"
        subtitle="A short pause was added to demo progress."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.savedCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Nice. You created space.</AppText>
            <AppText tone="secondary">
              Shared pauses now total {state.pauseSessions.length}. This resets on refresh.
            </AppText>
            <View style={styles.actions}>
              <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.progress)}>
                View Progress
              </AppButton>
              <AppButton variant="ghost" onPress={() => router.push(routes.log)}>
                Log this moment
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
    gap: theme.spacing.md
  },
  savedCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
