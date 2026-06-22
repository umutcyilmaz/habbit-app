import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionModeCardProps = {
  title: string;
  value: string;
  iconLabel?: string;
  enabled?: boolean;
  onPress?: () => void;
};

export function ProtectionModeCard({
  title,
  value,
  iconLabel = "•",
  enabled = true,
  onPress
}: ProtectionModeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: enabled }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        enabled ? styles.enabledRow : undefined,
        pressed ? styles.pressedRow : undefined
      ]}
    >
      <View style={[styles.iconCircle, enabled ? styles.iconCircleEnabled : undefined]}>
        <AppText variant="label">{iconLabel}</AppText>
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {value}
        </AppText>
      </View>
      <View style={[styles.toggle, enabled ? styles.toggleEnabled : undefined]}>
        <AppText variant="caption" tone={enabled ? "inverse" : "secondary"}>
          {enabled ? "On" : "Off"}
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
  enabledRow: {
    borderColor: theme.colors.sage
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
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  iconCircleEnabled: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  toggle: {
    minWidth: 52,
    alignItems: "center",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  toggleEnabled: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  }
});
