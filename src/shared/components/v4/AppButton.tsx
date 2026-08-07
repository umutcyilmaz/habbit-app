import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType
} from "react-native";

import { theme } from "../../design-system/v4/theme";
import { AppText } from "./AppText";

const DISABLED_OPACITY = 0.4;
const DESTRUCTIVE_PRESSED_OPACITY = 0.85;
const FOCUS_RING_WIDTH = 3;
const INDICATOR_SIZE = 18;

const variantConfig = {
  primary: {
    base: {
      minHeight: theme.size.control.lg,
      backgroundColor: theme.colors.action.primary,
      paddingVertical: theme.spacing.md
    },
    pressed: {
      backgroundColor: theme.colors.action.primaryPressed
    },
    disabled: {
      backgroundColor: theme.colors.action.primaryDisabled
    },
    labelVariant: "label",
    labelTone: "onPrimary"
  },
  secondary: {
    base: {
      minHeight: theme.size.control.lg,
      backgroundColor: theme.colors.action.secondary,
      borderColor: theme.colors.border.strong,
      borderWidth: theme.size.stroke.hairline,
      paddingVertical: theme.spacing.md
    },
    pressed: {
      backgroundColor: theme.colors.action.secondaryPressed
    },
    disabled: {
      opacity: DISABLED_OPACITY
    },
    labelVariant: "label",
    labelTone: "primary"
  },
  ghost: {
    base: {
      minHeight: theme.size.touch.min,
      backgroundColor: "transparent",
      paddingVertical: theme.spacing.xs
    },
    pressed: {
      backgroundColor: theme.colors.bg.surfaceHover
    },
    disabled: {
      opacity: DISABLED_OPACITY
    },
    labelVariant: "body",
    labelTone: "secondary"
  },
  destructive: {
    base: {
      minHeight: theme.size.control.lg,
      backgroundColor: theme.colors.bg.dangerSubtle,
      borderColor: theme.colors.border.danger,
      borderWidth: 1.5,
      paddingVertical: theme.spacing.md
    },
    // The design system has no canonical dangerPressed token yet. A small
    // opacity change on the semantic destructive colors is the temporary
    // native press-feedback fallback; no raw color is invented here.
    pressed: {
      opacity: DESTRUCTIVE_PRESSED_OPACITY
    },
    disabled: {
      opacity: DISABLED_OPACITY
    },
    labelVariant: "label",
    labelTone: "danger"
  }
} as const;

export type AppButtonVariant = keyof typeof variantConfig;

export type AppButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  loadingLabel?: string;
  variant?: AppButtonVariant;
  loading?: boolean;
};

export function AppButton({
  label,
  loadingLabel,
  variant = "primary",
  loading = false,
  disabled,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  onFocus,
  onBlur,
  style,
  ...props
}: AppButtonProps) {
  const [focused, setFocused] = useState(false);

  const isDisabled = Boolean(disabled || loading);
  const config = variantConfig[variant];
  const displayedLabel = loading && loadingLabel !== undefined ? loadingLabel : label;

  const resolvedAccessibilityState = {
    ...accessibilityState,
    disabled: Boolean(accessibilityState?.disabled || isDisabled),
    busy: Boolean(accessibilityState?.busy || loading)
  };

  const resolveStyle = (state: PressableStateCallbackType) => [
    styles.base,
    config.base,
    state.pressed && !isDisabled ? config.pressed : undefined,
    isDisabled ? config.disabled : undefined,
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
      <View style={styles.content}>
        <View style={styles.indicatorSlot}>
          {loading ? (
            <ActivityIndicator
              size={INDICATOR_SIZE}
              color={theme.colors.text[config.labelTone]}
            />
          ) : null}
        </View>
        <AppText
          variant={config.labelVariant}
          tone={config.labelTone}
          style={styles.label}
        >
          {displayedLabel}
        </AppText>
        <View style={styles.indicatorSlot} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  focusRing: {
    position: "absolute",
    top: -FOCUS_RING_WIDTH,
    right: -FOCUS_RING_WIDTH,
    bottom: -FOCUS_RING_WIDTH,
    left: -FOCUS_RING_WIDTH,
    borderWidth: FOCUS_RING_WIDTH,
    borderColor: theme.colors.border.focus,
    borderRadius: theme.radius.lg + FOCUS_RING_WIDTH
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.layout.inlineGap,
    justifyContent: "center",
    width: "100%"
  },
  indicatorSlot: {
    alignItems: "center",
    height: INDICATOR_SIZE,
    justifyContent: "center",
    width: INDICATOR_SIZE
  },
  label: {
    flexShrink: 1,
    textAlign: "center"
  },
  base: {
    alignItems: "center",
    borderRadius: theme.radius.lg,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    position: "relative",
    width: "100%"
  }
});
