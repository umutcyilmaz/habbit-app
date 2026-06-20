import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const cards = [
  {
    title: "You choose what to answer",
    body: "Sensitive questions can be skipped anytime."
  },
  {
    title: "You control what is saved",
    body: "You can review and delete your history from Data Controls."
  },
  {
    title: "Patterns, not judgment",
    body: "The app uses small signals to support awareness, not to judge you."
  }
] as const;

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
        {cards.map((card) => (
          <AppCard key={card.title}>
            <View style={styles.cardStack}>
              <AppText variant="title">{card.title}</AppText>
              <AppText tone="secondary">{card.body}</AppText>
            </View>
          </AppCard>
        ))}

        <AppButton onPress={() => router.push(routes.settingsDataControls)}>Open Data Controls</AppButton>
        <AppButton variant="secondary" onPress={() => router.push(routes.settings)}>
          Back to Settings
        </AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.sm
  }
});
