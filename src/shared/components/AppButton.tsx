import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle
} from "react-native";

import { theme } from "../design-system/theme";
import { AppText } from "./AppText";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "subtle";

type AppButtonProps = PropsWithChildren<
  Omit<PressableProps, "style"> & {
    variant?: AppButtonVariant;
    loading?: boolean;
    style?: ViewStyle;
  }
>;

export function AppButton({
  children,
  variant = "primary",
  loading = false,
  disabled,
  accessibilityLabel,
  accessibilityState,
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (loading && (typeof children === "string" || typeof children === "number")
      ? String(children)
      : undefined);

  const resolvedAccessibilityState = {
    ...accessibilityState,
    disabled: isDisabled,
    busy: loading ? true : accessibilityState?.busy,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityState={resolvedAccessibilityState}
      disabled={isDisabled}
      {...props}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled ? pressedStyles[variant] : undefined,
        isDisabled ? styles.disabled : undefined,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.colors.white : theme.colors.primary} />
      ) : (
        <AppText variant="label" tone={variant === "primary" ? "inverse" : "primary"}>
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md
  },
  disabled: {
    opacity: 0.5
  }
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.primary
  },
  secondary: {
    backgroundColor: theme.colors.lavender,
    borderWidth: 1,
    borderColor: theme.colors.lavenderDeep
  },
  ghost: {
    backgroundColor: "transparent"
  },
  subtle: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  }
});

const pressedStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.primaryPressed
  },
  secondary: {
    backgroundColor: theme.colors.surfaceMuted
  },
  ghost: {
    backgroundColor: theme.colors.surfaceMuted
  },
  subtle: {
    backgroundColor: theme.colors.surfaceMuted
  }
});
