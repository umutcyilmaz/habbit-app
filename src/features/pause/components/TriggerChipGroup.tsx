import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TriggerChipGroupProps<TValue extends string> = {
  values: readonly TValue[];
  selectedValues: readonly TValue[];
  disabled?: boolean;
  onToggle: (value: TValue) => void;
  getLabel?: (value: TValue) => string;
  testIDPrefix?: string;
};

export function TriggerChipGroup<TValue extends string>({
  values,
  selectedValues,
  disabled = false,
  onToggle,
  getLabel = (value) => value,
  testIDPrefix
}: TriggerChipGroupProps<TValue>) {
  return (
    <View style={styles.grid}>
      {values.map((value) => {
        const isSelected = selectedValues.includes(value);

        return (
          <Pressable
            key={value}
            {...(testIDPrefix !== undefined
              ? { testID: `${testIDPrefix}.${value}` }
              : {})}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: isSelected }}
            disabled={disabled}
            onPress={() => onToggle(value)}
            style={({ pressed }) => [
              styles.chip,
              isSelected ? styles.selectedChip : undefined,
              pressed && !disabled ? styles.pressedChip : undefined,
              disabled ? styles.disabledChip : undefined
            ]}
          >
            <AppText variant="label" tone={isSelected ? "primary" : "secondary"}>
              {getLabel(value)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
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
  selectedChip: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  pressedChip: {
    backgroundColor: theme.colors.surfaceMuted
  },
  disabledChip: {
    opacity: 0.6
  }
});
