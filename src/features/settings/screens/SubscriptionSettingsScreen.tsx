import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { subscriptionSettingsContent } from "../data/settingsMockData";
import type { SubscriptionOptionId } from "../types";

export function SubscriptionSettingsScreen() {
  const [message, setMessage] = useState<string | undefined>();

  const handleOptionPress = (id: SubscriptionOptionId) => {
    if (id === "viewPremium") {
      setMessage("Premium options are coming next.");
      return;
    }

    setMessage("Purchase restore is coming next.");
  };

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Subscription"
        subtitle="Manage optional premium features."
      />

      <View style={styles.stack}>
        <AppCard style={styles.essentialCard}>
          <View style={styles.cardContent}>
            <AppText variant="title">{subscriptionSettingsContent.essentialTitle}</AppText>
            <AppText tone="secondary">{subscriptionSettingsContent.essentialBody}</AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardContent}>
            <AppText variant="title">{subscriptionSettingsContent.premiumTitle}</AppText>
            <AppText tone="secondary">{subscriptionSettingsContent.premiumBody}</AppText>
            <View style={styles.actions}>
              {subscriptionSettingsContent.options.map((option) => (
                <AppButton
                  key={option.id}
                  variant={option.id === "viewPremium" ? "primary" : "secondary"}
                  onPress={() => handleOptionPress(option.id)}
                >
                  {option.label}
                </AppButton>
              ))}
            </View>
          </View>
        </AppCard>

        {message ? (
          <AppCard style={styles.infoCard}>
            <View style={styles.cardContent}>
              <AppText variant="title">Coming next</AppText>
              <AppText tone="secondary">{message}</AppText>
            </View>
          </AppCard>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardContent: {
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  },
  essentialCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  infoCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  }
});
