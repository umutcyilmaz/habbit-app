import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { SensitiveWindow } from "../types";

type SensitiveWindowCardProps = {
  window: SensitiveWindow;
  onSetup: () => void;
  onNotNow: () => void;
};

export function SensitiveWindowCard({ window, onSetup, onNotNow }: SensitiveWindowCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <AppText variant="title">{window.label}</AppText>
          <View style={styles.statusBadge}>
            <AppText variant="caption" tone="secondary">
              {window.statusLabel}
            </AppText>
          </View>
        </View>

        <View style={styles.details}>
          <AppText variant="label">
            {window.startTime}-{window.endTime}
          </AppText>
          <AppText tone="secondary">{window.reason}</AppText>
        </View>

        <View style={styles.actions}>
          <AppButton onPress={onSetup}>Set Up Support</AppButton>
          <AppButton variant="secondary" onPress={onNotNow}>
            Not Now
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
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  statusBadge: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  details: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  }
});
