import { StyleSheet, View } from "react-native";

import type { AppStateCardProps, AppStateVariant } from "../../types/appState";
import { AppButton } from "../AppButton";
import { AppCard } from "../AppCard";
import { AppText } from "../AppText";
import { theme } from "../../design-system/theme";

export function AppStateCard({
  variant,
  title,
  body,
  action,
  secondaryAction,
  children
}: AppStateCardProps) {
  return (
    <AppCard
      accessibilityRole="summary"
      style={[styles.card, variantStyles[variant]]}
    >
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">{title}</AppText>
          <AppText tone="secondary">{body}</AppText>
        </View>

        {children}

        {action || secondaryAction ? (
          <View style={styles.actions}>
            {action ? <AppButton onPress={action.onPress}>{action.label}</AppButton> : null}
            {secondaryAction ? (
              <AppButton variant="secondary" onPress={secondaryAction.onPress}>
                {secondaryAction.label}
              </AppButton>
            ) : null}
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

type VariantStyleMap = Record<AppStateVariant, object>;

const styles = StyleSheet.create({
  card: {
    shadowOpacity: 0
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

const variantStyles: VariantStyleMap = StyleSheet.create({
  empty: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  lowData: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  error: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  },
  offline: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  comingNext: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border
  }
});
