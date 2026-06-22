import { Pressable, StyleSheet, View } from "react-native";

import type { ProtectionSchedule } from "../types";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionScheduleRowProps = {
  id: ProtectionSchedule;
  title: string;
  description: string;
  iconLabel?: string;
  selected: boolean;
  onSelect: (id: ProtectionSchedule) => void;
};

export function ProtectionScheduleRow({
  id,
  title,
  description,
  iconLabel = "•",
  selected,
  onSelect
}: ProtectionScheduleRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(id)}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.selectedRow : undefined,
        pressed ? styles.pressedRow : undefined
      ]}
    >
      <View style={styles.iconCircle}>
        <AppText variant="label">{iconLabel}</AppText>
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {description}
        </AppText>
      </View>
      <View style={[styles.selectionPill, selected ? styles.selectedPill : undefined]}>
        <AppText variant="caption" tone={selected ? "primary" : "secondary"}>
          {selected ? "✓ Selected" : "Choose"}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  selectedRow: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  pressedRow: {
    backgroundColor: theme.colors.surfaceMuted
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  iconCircle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep,
    borderWidth: 1
  },
  selectionPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  selectedPill: {
    backgroundColor: theme.colors.surface
  }
});
