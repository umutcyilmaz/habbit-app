import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionActionRowProps = {
  title: string;
  description?: string;
  value?: string;
  iconLabel?: string;
  accent?: "sage" | "lavender" | "peach" | "navy";
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function ProtectionActionRow({
  title,
  description,
  value,
  iconLabel = "•",
  accent = "sage",
  disabled = false,
  loading = false,
  onPress
}: ProtectionActionRowProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && !isDisabled ? styles.pressed : undefined,
        isDisabled ? styles.disabled : undefined
      ]}
    >
      <View style={[styles.iconCircle, iconAccentStyles[accent]]}>
        <AppText variant="label" tone={accent === "navy" ? "inverse" : "primary"}>
          {iconLabel}
        </AppText>
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        {description ? (
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <View style={styles.valuePill}>
          <AppText variant="caption" tone="secondary">
            {value}
          </AppText>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <AppText variant="body" tone="secondary">
          ›
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  disabled: {
    opacity: 0.5
  },
  iconCircle: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: 1
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  valuePill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  }
});

const iconAccentStyles = StyleSheet.create({
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
  },
  navy: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  }
});
