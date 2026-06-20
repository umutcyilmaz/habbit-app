import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function DataControlsScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Data Controls"
        subtitle="Review, export, or delete your app history."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">What this app stores</AppText>
            <AppText tone="secondary">
              Check-ins, pause sessions, and protection preferences may be used to personalize your
              experience.
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Personalization controls</AppText>
            <AppText tone="secondary">
              Personalized recommendations are {state.settings.personalizationEnabled ? "on" : "off"}.
            </AppText>
            <AppButton
              variant="secondary"
              onPress={() =>
                dispatch({
                  type: "TOGGLE_PERSONALIZATION"
                })
              }
            >
              Toggle personalization
            </AppButton>
          </View>
        </AppCard>

        <AppCard style={styles.cautionCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Delete history preview</AppText>
            <AppText tone="secondary">
              Deletion controls are planned for a future version. Nothing is removed from this
              screen yet.
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
  },
  cautionCard: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  }
});
