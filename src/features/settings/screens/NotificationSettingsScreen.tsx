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

export function NotificationSettingsScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Notifications"
        subtitle="Choose gentle reminders that stay discreet."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Discreet wording</AppText>
            <AppText tone="secondary">
              Reminder text should stay neutral, such as "A quiet moment is ready."
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Reminders paused: {state.settings.notificationsPaused ? "yes" : "no"}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Discreet wording: {state.settings.useDiscreetNotifications ? "on" : "off"}
            </AppText>
            <AppButton
              variant="secondary"
              onPress={() =>
                dispatch({
                  type: "TOGGLE_NOTIFICATION_PREFERENCE",
                  payload: "notificationsPaused"
                })
              }
            >
              Toggle pause all reminders
            </AppButton>
            <AppButton
              variant="secondary"
              onPress={() =>
                dispatch({
                  type: "TOGGLE_NOTIFICATION_PREFERENCE",
                  payload: "useDiscreetNotifications"
                })
              }
            >
              Toggle discreet wording
            </AppButton>
          </View>
        </AppCard>

        <AppButton variant="ghost" onPress={() => router.push(routes.settings)}>
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
    gap: theme.spacing.lg
  }
});
