import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from "react-native";

import { theme } from "../design-system/theme";
import { AppText } from "./AppText";

type AppChipProps<TValue extends string> = Omit<PressableProps, "style" | "onPress"> & {
  label: string;
  value: TValue;
  selected: boolean;
  onPress: (value: TValue) => void;
  style?: ViewStyle;
};

export function AppChip<TValue extends string>({
  label,
  value,
  selected,
  onPress,
  accessibilityLabel,
  style,
  ...props
}: AppChipProps<TValue>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(value)}
      {...props}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : undefined,
        pressed ? styles.pressed : undefined,
        style
      ]}
    >
      <AppText variant="label" tone={selected ? "inverse" : "primary"} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm
  },
  selected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  pressed: {
    opacity: 0.82
  }
});
