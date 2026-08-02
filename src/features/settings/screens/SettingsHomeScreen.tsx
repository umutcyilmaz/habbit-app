import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function SettingsHomeScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Settings" subtitle="Manage privacy and preferences." />

      <View style={styles.stack}>
        <AppCard style={styles.trustCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Your data controls</AppText>
            <AppText tone="secondary">
              Choose optional details to record, and use Data Controls to delete Bloom’s data from
              this app’s or browser’s local storage.
            </AppText>
          </View>
        </AppCard>

        <SettingsSection title="Privacy">
          <AppButton variant="secondary" onPress={() => router.push(routes.settingsPrivacy)}>
            Privacy Overview
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.settingsDataControls)}>
            Data Controls
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.settingsAppLock)}>
            App Lock
          </AppButton>
        </SettingsSection>

        <SettingsSection title="Preferences">
          <AppButton variant="secondary" onPress={() => router.push(routes.settingsNotifications)}>
            Notifications
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.settingsSubscription)}>
            Subscription
          </AppButton>
        </SettingsSection>

        <AppButton variant="ghost" onPress={() => router.replace(routes.home)}>
          Return to Today
        </AppButton>
      </View>
    </AppScreen>
  );
}

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <AppCard>
      <View style={styles.cardStack}>
        <AppText variant="title">{title}</AppText>
        {children}
      </View>
    </AppCard>
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
  }
});
