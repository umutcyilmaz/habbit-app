import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ProgressMetric } from "../types";

type ProgressMetricCardProps = {
  metric: ProgressMetric;
};

export function ProgressMetricCard({ metric }: ProgressMetricCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <AppText style={styles.value}>{metric.value}</AppText>
        <AppText variant="bodySmall" tone="secondary" align="center">
          {metric.label}
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 112,
    padding: theme.spacing.lg
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.sm
  },
  value: {
    color: theme.colors.primary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: theme.typography.weight.bold
  }
});
