import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { TodayQuickAction } from "../types";

type QuickActionGridProps = {
  actions: TodayQuickAction[];
  onActionPress: (action: TodayQuickAction) => void;
};

export function QuickActionGrid({ actions, onActionPress }: QuickActionGridProps) {
  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          onPress={() => onActionPress(action)}
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : undefined]}
        >
          <AppText variant="label" align="center">
            {action.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  action: {
    minHeight: 72,
    width: "31.5%",
    minWidth: 96,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  actionPressed: {
    backgroundColor: theme.colors.lavender
  }
});
