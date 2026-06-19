import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function OnboardingWelcomeScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        title="Welcome"
        subtitle="Set up a calm, private starting point for the app."
      />

      <View style={styles.stack}>
        <AppCard style={styles.card}>
          <View style={styles.cardStack}>
            <AppText variant="title">Quick Path</AppText>
            <AppText tone="secondary">
              Onboarding remains available here during development. The final action enters Today.
            </AppText>
            <AppButton onPress={() => router.replace(routes.home)}>Continue to Today</AppButton>
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
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
