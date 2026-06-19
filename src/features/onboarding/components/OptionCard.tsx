import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type OptionCardProps<TValue extends string> = {
  label: string;
  value: TValue;
  selected: boolean;
  onSelect: (value: TValue) => void;
};

export function OptionCard<TValue extends string>({
  label,
  value,
  selected,
  onSelect
}: OptionCardProps<TValue>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : undefined,
        pressed ? styles.cardPressed : undefined
      ]}
    >
      <View style={[styles.radio, selected ? styles.radioSelected : undefined]} />
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
  cardSelected: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.primary
  },
  cardPressed: {
    opacity: 0.86
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  radioSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary
  },
  label: {
    flex: 1
  }
});
