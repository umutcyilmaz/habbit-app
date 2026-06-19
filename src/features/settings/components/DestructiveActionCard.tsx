import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type DestructiveActionCardProps = {
  onClose: () => void;
  onBackToSettings: () => void;
};

export function DestructiveActionCard({ onClose, onBackToSettings }: DestructiveActionCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">Delete history preview</AppText>
          <AppText tone="secondary">
            In a future version, this action will remove saved app history. For now, no data is
            being deleted because real persistence is not enabled yet.
          </AppText>
        </View>
        <View style={styles.actions}>
          <AppButton variant="secondary" onPress={onClose}>
            Close preview
          </AppButton>
          <AppButton variant="ghost" onPress={onBackToSettings}>
            Back to Settings
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  },
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  }
});
