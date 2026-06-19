import { StyleSheet, Switch, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PreferenceToggleRowProps = {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
};

export function PreferenceToggleRow({
  label,
  description,
  value,
  disabled,
  onValueChange
}: PreferenceToggleRowProps) {
  return (
    <View style={[styles.row, disabled ? styles.disabled : undefined]}>
      <View style={styles.copy}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {description}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={value ? theme.colors.primary : theme.colors.white}
        trackColor={{
          false: theme.colors.surfaceMuted,
          true: theme.colors.sageMuted
        }}
        value={value}
      />
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
  disabled: {
    opacity: 0.6
  }
});
