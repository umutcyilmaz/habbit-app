import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TriggerChipGroupProps<TValue extends string> = {
  values: readonly TValue[];
  selectedValues: readonly TValue[];
  onToggle: (value: TValue) => void;
  getLabel?: (value: TValue) => string;
};

export function TriggerChipGroup<TValue extends string>({
  values,
  selectedValues,
  onToggle,
  getLabel = (value) => value
}: TriggerChipGroupProps<TValue>) {
  return (
    <View style={styles.grid}>
      {values.map((value) => {
        const isSelected = selectedValues.includes(value);

        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onToggle(value)}
            style={({ pressed }) => [
              styles.chip,
              isSelected ? styles.selectedChip : undefined,
              pressed ? styles.pressedChip : undefined
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
  }
});
