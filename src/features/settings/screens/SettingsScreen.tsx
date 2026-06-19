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

export function SettingsScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();

  return (
    <AppScreen>
      <AppHeader
        title="Settings"
        subtitle="Demo privacy and preference controls."
        eyebrow="Settings"
      />

      <View style={styles.stack}>
        <AppCard style={styles.trustCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Your space, your control</AppText>
            <AppText tone="secondary">
              You choose what to record, what to skip, and what to delete when real data controls
              are added.
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Demo preferences</AppText>
            <PreferenceRow
              label="Personalized recommendations"
              value={state.settings.personalizationEnabled}
              onToggle={() =>
                dispatch({
                  type: "TOGGLE_PERSONALIZATION"
                })
              }
            />
            <PreferenceRow
              label="Pause reminder previews"
              value={state.settings.notificationsPaused}
              onToggle={() =>
                dispatch({
                  type: "TOGGLE_NOTIFICATION_PREFERENCE",
                  payload: "notificationsPaused"
                })
              }
            />
            <PreferenceRow
              label="Use discreet notification wording"
              value={state.settings.useDiscreetNotifications}
              onToggle={() =>
                dispatch({
                  type: "TOGGLE_NOTIFICATION_PREFERENCE",
                  payload: "useDiscreetNotifications"
                })
              }
            />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Data Controls</AppText>
            <AppText tone="secondary">
              Export and deletion flows are still skeletons. This screen only updates in-memory
              demo preferences.
            </AppText>
            <AppButton variant="secondary" onPress={() => router.replace(routes.home)}>
              Back to Today
            </AppButton>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

type PreferenceRowProps = {
  label: string;
  value: boolean;
  onToggle: () => void;
};

function PreferenceRow({ label, value, onToggle }: PreferenceRowProps) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {value ? "On" : "Off"}
        </AppText>
      </View>
      <AppButton variant={value ? "primary" : "secondary"} onPress={onToggle}>
        {value ? "On" : "Off"}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  trustCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  preferenceCopy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
