import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType
} from "react-native";

import { theme } from "../../design-system/v4/theme";

const DISABLED_OPACITY = 0.35;
const FOCUS_RING_WIDTH = 3;

const variantConfig = {
  filled: {
    base: {
      backgroundColor: theme.colors.action.primary
    },
    pressed: {
      backgroundColor: theme.colors.action.primaryPressed
    }
  },
  outline: {
    base: {
      backgroundColor: theme.colors.bg.surfaceElevated,
      borderColor: theme.colors.border.strong,
      borderWidth: theme.size.stroke.hairline
    },
    pressed: {
      backgroundColor: theme.colors.bg.surfaceHover
    }
  },
  plain: {
    base: {
      backgroundColor: "transparent"
    },
    pressed: {
      backgroundColor: theme.colors.bg.surfaceHover
    }
  }
} as const;

export type AppIconButtonVariant = keyof typeof variantConfig;

export type AppIconButtonProps = Omit<PressableProps, "children"> & {
  /**
   * Caller-provided icon content. The custom SVG icon set is not delivered
   * yet, so no icon system lives here; the element is passed through
   * untouched and the caller remains responsible for rendering.
   * Canonical guidance:
   * - visual icon size: theme.size.icon.sm (20)
   * - filled variant: icon in a semantic on-primary color
   * - outline/plain variants: icon in an appropriate semantic foreground
   */
  icon: ReactNode;
  accessibilityLabel: string;
  variant?: AppIconButtonVariant;
};

export function AppIconButton({
  icon,
  accessibilityLabel,
  variant = "plain",
  disabled,
  accessibilityRole = "button",
  accessibilityState,
  onFocus,
  onBlur,
  style,
  ...props
}: AppIconButtonProps) {
  const [focused, setFocused] = useState(false);

  const isDisabled = Boolean(disabled || accessibilityState?.disabled);

  const resolvedAccessibilityState = {
    ...accessibilityState,
    disabled: isDisabled
  };

  const resolveStyle = (state: PressableStateCallbackType) => [
    styles.base,
    variantConfig[variant].base,
    state.pressed && !isDisabled ? variantConfig[variant].pressed : undefined,
    isDisabled ? styles.disabled : undefined,
    typeof style === "function" ? style(state) : style
  ];

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={resolvedAccessibilityState}
      disabled={isDisabled}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={resolveStyle}
    >
      {focused && !isDisabled ? (
        <View pointerEvents="none" style={styles.focusRing} />
      ) : null}
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusRing: {
    borderColor: theme.colors.border.focus,
    borderRadius: theme.radius.pill,
    borderWidth: FOCUS_RING_WIDTH,
    bottom: -FOCUS_RING_WIDTH,
    left: -FOCUS_RING_WIDTH,
    position: "absolute",
    right: -FOCUS_RING_WIDTH,
    top: -FOCUS_RING_WIDTH
  },
  disabled: {
    opacity: DISABLED_OPACITY
  },
  base: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    height: theme.size.touch.min,
    justifyContent: "center",
    minHeight: theme.size.touch.min,
    minWidth: theme.size.touch.min,
    position: "relative",
    width: theme.size.touch.min
  }
});
