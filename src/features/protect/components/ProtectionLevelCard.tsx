import { Pressable, StyleSheet, View } from "react-native";

import type { DemoSupportLevel } from "../../../domain/demo/demoTypes";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionLevelCardProps = {
  id: DemoSupportLevel;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (id: DemoSupportLevel) => void;
};

export function ProtectionLevelCard({
  id,
  title,
  description,
  selected,
  onSelect
}: ProtectionLevelCardProps) {
  const icon = id === "gentle" ? "◡" : id === "balanced" ? "◇" : "◆";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(id)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selectedCard : undefined,
        pressed ? styles.pressedCard : undefined
      ]}
    >
      <View style={[styles.iconCircle, selected ? styles.selectedIconCircle : undefined]}>
        <AppText variant="label">{icon}</AppText>
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">{description}</AppText>
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
  card: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  selectedCard: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  pressedCard: {
    backgroundColor: theme.colors.surfaceMuted
  },
  iconCircle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  selectedIconCircle: {
    backgroundColor: theme.colors.surface
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
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
