import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProgressWeeklySummaryCardProps = {
  checkInCount: number;
  pauseCount: number;
  supportWindowCount: number;
};

function getLabel(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function ProgressWeeklySummaryCard({
  checkInCount,
  pauseCount,
  supportWindowCount
}: ProgressWeeklySummaryCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">This week so far</AppText>
          <AppText tone="secondary">
            Small moments of awareness can make the next choice feel less automatic.
          </AppText>
        </View>

        <View style={styles.metricGrid}>
          <MetricPill value={checkInCount} label={getLabel(checkInCount, "check-in", "check-ins")} />
          <MetricPill value={pauseCount} label={getLabel(pauseCount, "pause", "pauses")} />
          <MetricPill
            value={supportWindowCount}
            label={getLabel(supportWindowCount, "support window", "support windows")}
          />
        </View>
      </View>
    </AppCard>
  );
}

type MetricPillProps = {
  value: number;
  label: string;
};

function MetricPill({ value, label }: MetricPillProps) {
  return (
    <View style={styles.metric}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  metric: {
    minWidth: 96,
    flex: 1,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md
  }
});
