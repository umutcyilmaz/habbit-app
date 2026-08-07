import { StyleSheet, View, type ViewProps } from "react-native";

import { theme } from "../../design-system/v4/theme";

const variantConfig = {
  standard: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    minHeight: 88,
    padding: theme.spacing.layout.cardPadding,
    ...theme.shadows.card
  },
  hero: {
    backgroundColor: theme.colors.bg.surfaceRaised,
    borderRadius: theme.radius.xxl,
    minHeight: 132,
    padding: theme.spacing.xl,
    ...theme.shadows.floating
  }
} as const;

export type AppCardVariant = keyof typeof variantConfig;

export type AppCardProps = ViewProps & {
  variant?: AppCardVariant;
  selected?: boolean;
  disabled?: boolean;
};

export function AppCard({
  variant = "standard",
  selected = false,
  disabled = false,
  accessibilityState,
  style,
  ...props
}: AppCardProps) {
  const isSelected = Boolean(selected || accessibilityState?.selected);
  const isDisabled = Boolean(disabled || accessibilityState?.disabled);

  const resolvedAccessibilityState = {
    ...accessibilityState,
    selected: isSelected,
    disabled: isDisabled
  };

  return (
    <View
      {...props}
      accessibilityState={resolvedAccessibilityState}
      style={[
        styles.base,
        variantConfig[variant],
        isSelected ? styles.selected : undefined,
        isDisabled ? styles.disabled : undefined,
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%"
  },
  selected: {
    borderColor: theme.colors.border.accent,
    borderWidth: theme.size.stroke.hairline
  },
  disabled: {
    opacity: 0.45
  }
});
