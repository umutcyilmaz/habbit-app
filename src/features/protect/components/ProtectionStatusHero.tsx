import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionStatusHeroProps = {
  statusLabel: string;
  title: string;
  body: string;
  variant?: "active" | "off" | "paused";
};

export function ProtectionStatusHero({
  statusLabel,
  title,
  body,
  variant = "off"
}: ProtectionStatusHeroProps) {
  return (
    <AppCard style={[styles.card, variantStyles[variant]]}>
      <View style={styles.stack}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <View style={[styles.badgeDot, variantDotStyles[variant]]} />
            <AppText variant="caption">{statusLabel}</AppText>
          </View>
          <View style={styles.heroMark}>
            <AppText variant="label">P</AppText>
          </View>
        </View>
        <AppText variant="title">{title}</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: 26
  },
  stack: {
    gap: theme.spacing.lg
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  heroMark: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1
  }
});

const variantStyles = StyleSheet.create({
  active: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  off: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage
  },
  paused: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  }
});

const variantDotStyles = StyleSheet.create({
  active: {
    backgroundColor: theme.colors.sage
  },
  off: {
    backgroundColor: theme.colors.textSecondary
  },
  paused: {
    backgroundColor: theme.colors.lavenderDeep
  }
});
