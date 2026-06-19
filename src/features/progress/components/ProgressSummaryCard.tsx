import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ProgressMetric } from "../types";
import { ProgressMetricCard } from "./ProgressMetricCard";

type ProgressSummaryCardProps = {
  title: string;
  metrics: ProgressMetric[];
  activitySummary: string[];
};

export function ProgressSummaryCard({
  title,
  metrics,
  activitySummary
}: ProgressSummaryCardProps) {
  return (
    <AppCard>
      <View style={styles.stack}>
        <AppText variant="title">{title}</AppText>
        <View style={styles.metrics}>
          {metrics.map((metric) => (
            <ProgressMetricCard key={metric.id} metric={metric} />
          ))}
        </View>
        <View style={styles.activityList}>
          {activitySummary.map((item) => (
            <View key={item} style={styles.activityItem}>
              <View style={styles.dot} />
              <AppText variant="bodySmall" tone="secondary" style={styles.activityText}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  activityList: {
    gap: theme.spacing.sm
  },
  activityItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  activityText: {
    flex: 1
  }
});
