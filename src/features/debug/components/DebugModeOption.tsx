import { StyleSheet, View } from "react-native";

import type { DemoMode } from "../../../domain/demo/demoModes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { DebugModeOptionConfig } from "../types";

type DebugModeOptionProps = DebugModeOptionConfig & {
  currentMode: DemoMode;
  onSelect: (mode: DemoMode) => void;
};

export function DebugModeOption({
  mode,
  label,
  description,
  currentMode,
  onSelect
}: DebugModeOptionProps) {
  const isSelected = currentMode === mode;

  return (
    <AppCard style={isSelected ? styles.selectedCard : undefined}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">{label}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        </View>
        <AppButton variant={isSelected ? "primary" : "secondary"} onPress={() => onSelect(mode)}>
          {isSelected ? "Selected" : "Use"}
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.md
  },
  copy: {
    gap: theme.spacing.sm
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.lavender
  }
});
