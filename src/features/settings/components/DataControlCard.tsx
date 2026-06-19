import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { DataControlItem } from "../types";

type DataControlCardProps = PropsWithChildren<{
  item: DataControlItem;
  onAction?: () => void;
}>;

export function DataControlCard({ item, onAction, children }: DataControlCardProps) {
  const actionLabel = item.actionLabel;
  const hasAction = actionLabel !== undefined && onAction !== undefined;

  return (
    <AppCard style={item.caution ? styles.cautionCard : undefined}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <View style={styles.headingRow}>
            <AppText variant="title">{item.title}</AppText>
            {item.statusLabel ? (
              <View style={styles.status}>
                <AppText variant="caption" tone="secondary">
                  {item.statusLabel}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText tone="secondary">{item.body}</AppText>
        </View>

        {children}

        {hasAction ? (
          <AppButton variant={item.caution ? "secondary" : "primary"} onPress={onAction}>
            {actionLabel}
          </AppButton>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg
  },
  copy: {
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
  cautionCard: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  }
});
