import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { PreferenceToggleRow } from "../components/PreferenceToggleRow";
import { appLockOptions } from "../data/settingsMockData";

export function AppLockScreen() {
  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="App Lock"
        subtitle="Add an extra layer of privacy when available."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardContent}>
            <View style={styles.headingRow}>
              <AppText variant="title">App Lock</AppText>
              <View style={styles.status}>
                <AppText variant="caption" tone="secondary">
                  Coming next
                </AppText>
              </View>
            </View>
            <AppText tone="secondary">
              App Lock is planned for a future version. It can help protect access to your
              reflections.
            </AppText>
          </View>
        </AppCard>

        <View style={styles.options}>
          {appLockOptions.map((option) => (
            <PreferenceToggleRow
              key={option.id}
              label={option.label}
              description={option.description}
              value={option.enabled}
              disabled
              onValueChange={() => undefined}
            />
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardContent: {
    gap: theme.spacing.sm
  },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  status: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  options: {
    gap: theme.spacing.md
  }
});
