import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { LogEntryOption } from "../types";

type LogOptionCardProps = {
  option: LogEntryOption;
  onPress: (option: LogEntryOption) => void;
};

export function LogOptionCard({ option, onPress }: LogOptionCardProps) {
  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="button"
      onPress={() => onPress(option)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : undefined]}
    >
      <View style={styles.copy}>
        <AppText variant="label">{option.label}</AppText>
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
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  pressed: {
    backgroundColor: theme.colors.lavender
  },
  copy: {
    gap: theme.spacing.xs
  }
});
