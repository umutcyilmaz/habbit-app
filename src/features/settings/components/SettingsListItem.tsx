import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type SettingsListItemProps = {
  title: string;
  description: string;
  disabled: boolean;
  statusLabel?: string;
  onPress?: () => void;
};

export function SettingsListItem({
  title,
  description,
  disabled,
  statusLabel,
  onPress
}: SettingsListItemProps) {
  const isInteractive = onPress !== undefined && !disabled;
  const content = (
    <>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {description}
        </AppText>
      </View>
      <View style={styles.trailing}>
        {statusLabel ? (
          <View style={styles.status}>
            <AppText variant="caption" tone="secondary">
              {statusLabel}
            </AppText>
          </View>
        ) : null}
        {isInteractive ? (
          <AppText variant="title" tone="secondary" accessibilityElementsHidden>
            &gt;
          </AppText>
        ) : null}
      </View>
    </>
  );

  if (isInteractive) {
    return (
      <Pressable
        accessibilityLabel={`${title}. ${description}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : undefined]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`${title}. ${description}${statusLabel ? ` ${statusLabel}` : ""}`}
      style={[styles.row, disabled ? styles.disabled : undefined]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  trailing: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: theme.spacing.xs
  },
  status: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  disabled: {
    opacity: 0.72
  }
});
