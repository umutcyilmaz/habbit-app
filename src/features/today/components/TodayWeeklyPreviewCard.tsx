import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TodayWeeklyPreviewCardProps = {
  checkInCount: number;
  pauseCount: number;
  onViewProgressPress: () => void;
};

function getMetricLabel(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function TodayWeeklyPreviewCard({
  checkInCount,
  pauseCount,
  onViewProgressPress
}: TodayWeeklyPreviewCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">This week so far</AppText>
          <AppText tone="secondary">
            Recent logs suggest boredom and evenings may be connected.
          </AppText>
        </View>
        <View style={styles.metrics}>
          <MetricChip value={checkInCount} label={getMetricLabel(checkInCount, "check-in", "check-ins")} />
          <MetricChip value={pauseCount} label={getMetricLabel(pauseCount, "pause", "pauses")} />
        </View>
        <AppButton variant="secondary" onPress={onViewProgressPress}>
          View Progress
        </AppButton>
      </View>
    </AppCard>
  );
}

type MetricChipProps = {
  value: number;
  label: string;
};

function MetricChip({ value, label }: MetricChipProps) {
  return (
    <View style={styles.metric}>
      <AppText variant="label">{value}</AppText>
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
    gap: theme.spacing.md
  },
  copy: {
    gap: theme.spacing.sm
  },
  metrics: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  metric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  }
});
