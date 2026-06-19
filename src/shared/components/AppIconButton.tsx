import type { ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from "react-native";

import { theme } from "../design-system/theme";
import { AppText } from "./AppText";

type AppIconButtonProps = Omit<PressableProps, "children" | "style"> & {
  accessibilityLabel: string;
  icon?: ReactNode;
  style?: ViewStyle;
};

export function AppIconButton({ accessibilityLabel, icon, style, ...props }: AppIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      {...props}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : undefined, style]}
    >
      {icon ?? <AppText variant="label">...</AppText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted
  }
});
