import { Pressable, StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export type TodayQuickAction = {
  title: string;
  description: string;
  iconLabel: string;
  accent: "sage" | "lavender" | "peach";
  onPress: () => void;
};

type TodayQuickActionGridProps = {
  actions: readonly TodayQuickAction[];
};

export function TodayQuickActionGrid({ actions }: TodayQuickActionGridProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Quick actions</AppText>
        <View style={styles.grid}>
          {actions.map((action) => (
            <Pressable
              key={action.title}
              accessibilityRole="button"
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionCard,
                pressed ? styles.actionCardPressed : undefined
              ]}
            >
              <View style={[styles.iconCircle, accentStyles[action.accent]]}>
                <AppText variant="label">{action.iconLabel}</AppText>
              </View>
              <View style={styles.actionCopy}>
                <AppText variant="label">{action.title}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {action.description}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.md
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  actionCard: {
    minWidth: 140,
    flex: 1,
    minHeight: 112,
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  actionCardPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  iconCircle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1
  },
  actionCopy: {
    gap: theme.spacing.xs
  }
});

const accentStyles = StyleSheet.create({
  sage: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  lavender: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  peach: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  }
});
