import {
  isValidElement,
  type PropsWithChildren,
  type ReactNode
} from "react";
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
  style,
  ...props
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const accessibilityLabel =
    props.accessibilityLabel ?? getAccessibleButtonLabel(children);
  const accessibilityState = {
    ...props.accessibilityState,
    disabled: Boolean(isDisabled || props.accessibilityState?.disabled),
    busy: Boolean(loading || props.accessibilityState?.busy)
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      {...props}
      {...(accessibilityLabel !== undefined ? { accessibilityLabel } : {})}
      accessibilityState={accessibilityState}
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

function getAccessibleButtonLabel(
  children: ReactNode
): string | undefined {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    const labels: string[] = children
      .map(getAccessibleButtonLabel)
      .filter((label): label is string => label !== undefined);

    return labels.length > 0 ? labels.join(" ") : undefined;
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    return getAccessibleButtonLabel(children.props.children);
  }

  return undefined;
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
