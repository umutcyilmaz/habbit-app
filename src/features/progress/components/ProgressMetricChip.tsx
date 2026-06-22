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
      <AppText variant="title">{value}</AppText>
      <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs
  }
});
