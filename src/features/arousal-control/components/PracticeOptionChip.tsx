import { Pressable, StyleSheet } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PracticeOptionChipProps<T extends string> = {
  value: T;
  label: string;
  selected: boolean;
  onSelect: (value: T) => void;
  testID: string;
};

export function PracticeOptionChip<T extends string>({
  value,
  label,
  selected,
  onSelect,
  testID
}: PracticeOptionChipProps<T>) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : undefined,
        pressed ? styles.chipPressed : undefined
      ]}
    >
      <AppText variant="label" numberOfLines={2} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    minWidth: 132,
    flexGrow: 1,
    flexBasis: "45%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  chipSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  chipPressed: {
    backgroundColor: theme.colors.surfaceMuted
  }
});
