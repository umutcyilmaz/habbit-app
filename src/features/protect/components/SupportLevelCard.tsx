import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ProtectionLevelOption } from "../types";

type SupportLevelCardProps = {
  option: ProtectionLevelOption;
  selected: boolean;
  onSelect: (option: ProtectionLevelOption) => void;
};

export function SupportLevelCard({ option, selected, onSelect }: SupportLevelCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${option.title} support level`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(option)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : undefined,
        pressed ? styles.pressed : undefined
      ]}
    >
      <View style={[styles.marker, selected ? styles.markerSelected : undefined]} />
      <View style={styles.copy}>
        <AppText variant="label">{option.title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {option.description}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
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
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
