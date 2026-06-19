import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { PrivacyPrincipleCard } from "../components/PrivacyPrincipleCard";
import { privacyPrinciples } from "../data/settingsMockData";

export function PrivacyOverviewScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Privacy Overview"
        subtitle="A simple view of how this app handles personal reflections."
      />

      <View style={styles.stack}>
        {privacyPrinciples.map((principle) => (
          <PrivacyPrincipleCard key={principle.id} principle={principle} />
        ))}

        <View style={styles.actions}>
          <AppButton onPress={() => router.push(routes.settingsDataControls)}>Open Data Controls</AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.settings)}>
            Back to Settings
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  }
});
