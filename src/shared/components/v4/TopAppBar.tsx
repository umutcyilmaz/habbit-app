import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps
} from "react-native";
import type { ReactNode } from "react";

import { theme } from "../../design-system/v4/theme";
import { AppText } from "./AppText";

const DISABLED_OPACITY = 0.35;

// Title hierarchy (the screen decides the combination, never this component):
// - root tabs -> ScreenHeader
// - pushed screens -> titled TopAppBar
// - flow steps -> action-only TopAppBar + ScreenHeader

export type TopAppBarAction = {
  /**
   * Visual icon/content supplied by the caller. TopAppBar owns the 34x34
   * circular surface (control.xs, pill, surfaceElevated, border.strong).
   * The eventual Bloom SVG icon should render at the spec's icon size.
   */
  content: ReactNode;
  accessibilityLabel: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  disabled?: boolean;
  testID?: string;
};

export type TopAppBarProps = ViewProps & {
  title?: string;
  leftAction?: TopAppBarAction;
  rightAction?: TopAppBarAction;
};

function ActionSlot({ action }: { action: TopAppBarAction | undefined }) {
  if (action === undefined) {
    return <View style={styles.slot} />;
  }

  const isDisabled = action.disabled === true;

  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={isDisabled ? { disabled: true } : undefined}
      disabled={action.disabled}
      onPress={action.onPress}
      testID={action.testID}
      style={styles.slot}
    >
      {({ pressed }) => (
        <View
          pointerEvents="none"
          style={[
            styles.actionVisual,
            pressed && !isDisabled ? styles.actionVisualPressed : undefined,
            isDisabled ? styles.actionVisualDisabled : undefined
          ]}
        >
          {action.content}
        </View>
      )}
    </Pressable>
  );
}

export function TopAppBar({
  title = "",
  leftAction,
  rightAction,
  style,
  ...props
}: TopAppBarProps) {
  return (
    <View {...props} style={[styles.bar, style]}>
      <ActionSlot action={leftAction} />
      <View style={styles.titleContainer}>
        {title !== "" ? (
          <AppText
            variant="titleSmall"
            tone="primary"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.title}
          >
            {title}
          </AppText>
        ) : null}
      </View>
      <ActionSlot action={rightAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: theme.colors.bg.surface,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    width: "100%"
  },
  slot: {
    alignItems: "center",
    height: theme.size.touch.min,
    justifyContent: "center",
    minHeight: theme.size.touch.min,
    minWidth: theme.size.touch.min,
    width: theme.size.touch.min
  },
  actionVisual: {
    alignItems: "center",
    backgroundColor: theme.colors.bg.surfaceElevated,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.pill,
    borderWidth: theme.size.stroke.hairline,
    height: theme.size.control.xs,
    justifyContent: "center",
    width: theme.size.control.xs
  },
  actionVisualPressed: {
    backgroundColor: theme.colors.bg.surfaceHover
  },
  actionVisualDisabled: {
    opacity: DISABLED_OPACITY
  },
  titleContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  title: {
    textAlign: "center"
  }
});
