import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { DataControlCard } from "../components/DataControlCard";
import { DestructiveActionCard } from "../components/DestructiveActionCard";
import { PreferenceToggleRow } from "../components/PreferenceToggleRow";
import { dataControlItems } from "../data/settingsMockData";
import type { DataControlItem } from "../types";

export function DataControlsScreen() {
  const router = useRouter();
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [message, setMessage] = useState<string | undefined>();
  const [showDeletePreview, setShowDeletePreview] = useState(false);

  const handleDataAction = (item: DataControlItem) => {
    if (item.id === "storedData") {
      setShowDeletePreview(false);
      setMessage("Stored data review is coming next.");
      return;
    }

    if (item.id === "deleteAll") {
      setMessage(undefined);
      setShowDeletePreview(true);
    }
  };

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Data Controls"
        subtitle="Review, export, or delete your app history."
      />

      <View style={styles.stack}>
        {dataControlItems.map((item) => {
          if (item.id === "personalization") {
            return (
              <DataControlCard key={item.id} item={item}>
                <PreferenceToggleRow
                  label="Use my activity for personalization"
                  description="Local preview only. Real preferences will be saved in a later version."
                  value={personalizationEnabled}
                  disabled={false}
                  onValueChange={setPersonalizationEnabled}
                />
              </DataControlCard>
            );
          }

          const onAction = item.actionLabel !== undefined ? () => handleDataAction(item) : undefined;

          return (
            <DataControlCard
              key={item.id}
              item={item}
              {...(onAction !== undefined ? { onAction } : {})}
            />
          );
        })}

        {message ? (
          <AppCard style={styles.infoCard}>
            <View style={styles.messageContent}>
              <AppText variant="title">Coming next</AppText>
              <AppText tone="secondary">{message}</AppText>
            </View>
          </AppCard>
        ) : null}

        {showDeletePreview ? (
          <DestructiveActionCard
            onClose={() => setShowDeletePreview(false)}
            onBackToSettings={() => router.push(routes.settings)}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  infoCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  messageContent: {
    gap: theme.spacing.sm
  }
});
