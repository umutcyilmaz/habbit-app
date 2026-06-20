import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function AppLockSettingsScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="App Lock"
        subtitle="Add an extra layer of privacy when available."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Coming next</AppText>
            <AppText tone="secondary">
              App Lock is planned for a future version. No biometrics or protected storage are
              connected yet.
            </AppText>
            <AppButton variant="secondary" onPress={() => router.push(routes.settings)}>
              Back to Settings
            </AppButton>
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
  }
});
