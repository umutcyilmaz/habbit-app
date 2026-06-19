import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { SettingsListItem } from "../components/SettingsListItem";
import { SettingsSection } from "../components/SettingsSection";
import { settingsSections, settingsTrustCard } from "../data/settingsMockData";

export function SettingsHomeScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader title="Settings" subtitle="Manage privacy, preferences, and account options." />

      <View style={styles.stack}>
        <AppCard style={styles.trustCard}>
          <View style={styles.cardContent}>
            <AppText variant="title">{settingsTrustCard.title}</AppText>
            <AppText tone="secondary">{settingsTrustCard.body}</AppText>
          </View>
        </AppCard>

        {settingsSections.map((section) => (
          <SettingsSection key={section.id} title={section.title}>
            {section.items.map((item) => {
              const route = item.route;
              const onPress = route !== undefined ? () => router.push(route) : undefined;
              const statusLabel = item.status === "comingNext" ? "Coming next" : undefined;

              return (
                <SettingsListItem
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  disabled={item.status === "comingNext"}
                  {...(statusLabel !== undefined ? { statusLabel } : {})}
                  {...(onPress !== undefined ? { onPress } : {})}
                />
              );
            })}
          </SettingsSection>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  trustCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  cardContent: {
    gap: theme.spacing.sm
  }
});
