import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProgressMetricChipProps = {
  value: string;
  label: string;
};

export function ProgressMetricChip({ value, label }: ProgressMetricChipProps) {
  return (
    <View style={styles.chip}>
      <AppText variant="label">{value}</AppText>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 90,
    alignItems: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md
  }
});
