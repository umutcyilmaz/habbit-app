import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export type SelectableChipOption<T extends string> = {
  value: T;
  label: string;
};

type SelectableChipGroupProps<T extends string> = {
  title: string;
  options: readonly SelectableChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function SelectableChipGroup<T extends string>({
  title,
  options,
  value,
  onChange,
  disabled = false
}: SelectableChipGroupProps<T>) {
  return (
    <View style={styles.group}>
      <AppText variant="label">{title}</AppText>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: isSelected }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                isSelected ? styles.chipSelected : undefined,
                pressed && !disabled ? styles.chipPressed : undefined,
                disabled ? styles.chipDisabled : undefined
              ]}
            >
              <AppText variant="label" tone="primary" numberOfLines={1}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: theme.spacing.sm
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  chip: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm
  },
  chipSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  chipPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  chipDisabled: {
    opacity: 0.55
  }
});
