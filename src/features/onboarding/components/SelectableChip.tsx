import { Pressable, StyleSheet } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type SelectableChipProps<TValue extends string> = {
  label: string;
  value: TValue;
  selected: boolean;
  onToggle: (value: TValue) => void;
};

export function SelectableChip<TValue extends string>({
  label,
  value,
  selected,
  onToggle
}: SelectableChipProps<TValue>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onToggle(value)}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : undefined,
        pressed ? styles.chipPressed : undefined
      ]}
    >
      <AppText variant="label" tone={selected ? "inverse" : "primary"}>
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
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  chipPressed: {
    opacity: 0.82
  }
});
