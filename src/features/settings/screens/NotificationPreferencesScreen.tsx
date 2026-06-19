import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { PreferenceToggleRow } from "../components/PreferenceToggleRow";
import { notificationPreferences } from "../data/settingsMockData";
import type { NotificationPreferenceId } from "../types";

type NotificationPreferenceState = Record<NotificationPreferenceId, boolean>;

function createInitialNotificationState() {
  return notificationPreferences.reduce<NotificationPreferenceState>(
    (state, preference) => ({
      ...state,
      [preference.id]: preference.defaultEnabled
    }),
    {} as NotificationPreferenceState
  );
}

function createPausedNotificationState() {
  return notificationPreferences.reduce<NotificationPreferenceState>(
    (state, preference) => ({
      ...state,
      [preference.id]: preference.id === "pauseAll"
    }),
    {} as NotificationPreferenceState
  );
}

export function NotificationPreferencesScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferenceState>(
    createInitialNotificationState
  );

  const handlePreferenceChange = (id: NotificationPreferenceId, value: boolean) => {
    setPreferences((current) => {
      if (id === "pauseAll" && value) {
        return createPausedNotificationState();
      }

      if (id === "pauseAll") {
        return {
          ...current,
          pauseAll: false
        };
      }

      return {
        ...current,
        [id]: value,
        pauseAll: false
      };
    });
  };

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Notifications"
        subtitle="Choose gentle reminders that stay discreet."
      />

      <View style={styles.stack}>
        {notificationPreferences.map((preference) => {
          const disabled = preferences.pauseAll && preference.id !== "pauseAll";

          return (
            <PreferenceToggleRow
              key={preference.id}
              label={preference.label}
              description={preference.description}
              value={preferences[preference.id]}
              disabled={disabled}
              onValueChange={(value) => handlePreferenceChange(preference.id, value)}
            />
          );
        })}

        <AppCard style={styles.noteCard}>
          <View style={styles.noteContent}>
            <AppText variant="title">Discreet wording</AppText>
            <AppText tone="secondary">
              Reminder text should stay neutral, such as "A quiet moment is ready."
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Notification permissions and scheduling are not connected yet.
            </AppText>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.md
  },
  noteCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  noteContent: {
    gap: theme.spacing.sm
  }
});
