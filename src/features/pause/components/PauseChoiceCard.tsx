import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseChoiceCardProps<TValue extends string> = {
  label: string;
  value: TValue;
  selected: boolean;
  onSelect: (value: TValue) => void;
};

export function PauseChoiceCard<TValue extends string>({
  label,
  value,
  selected,
  onSelect
}: PauseChoiceCardProps<TValue>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : undefined,
        pressed ? styles.pressed : undefined
      ]}
    >
      <View style={[styles.marker, selected ? styles.markerSelected : undefined]} />
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  selected: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  pressed: {
    opacity: 0.86
  },
  marker: {
    width: 16,
    height: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  markerSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary
  },
  label: {
    flex: 1
  }
});
