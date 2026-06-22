import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TodayWeeklyPreviewCardProps = {
  checkInCount: number;
  pauseCount: number;
  insight: string;
};

function getMetricLabel(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function TodayWeeklyPreviewCard({
  checkInCount,
  pauseCount,
  insight
}: TodayWeeklyPreviewCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">This week so far</AppText>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <AppText variant="title">{checkInCount}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {getMetricLabel(checkInCount, "check-in", "check-ins")}
            </AppText>
          </View>
          <View style={styles.metric}>
            <AppText variant="title">{pauseCount}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {getMetricLabel(pauseCount, "pause", "pauses")}
            </AppText>
          </View>
        </View>
        <AppText tone="secondary">{insight}</AppText>
      </View>
    </AppCard>
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
  metrics: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  metric: {
    flex: 1,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md
  }
});
