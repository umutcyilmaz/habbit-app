import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ProgressMetricChip } from "./ProgressMetricChip";

type ProgressHeroCardProps = {
  checkInCount: number;
  pauseCount: number;
  supportWindowCount: number;
};

export function ProgressHeroCard({
  checkInCount,
  pauseCount,
  supportWindowCount
}: ProgressHeroCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <AppText variant="caption">This week</AppText>
          </View>
          <View style={styles.marker}>
            <AppText variant="label">✦</AppText>
          </View>
        </View>

        <View style={styles.copy}>
          <AppText variant="title">You created space before continuing</AppText>
          <AppText tone="secondary">
            Two check-ins and one pause suggest you are starting to notice the evening loop
            earlier.
          </AppText>
        </View>

        <View style={styles.statsRow}>
          <ProgressMetricChip value={String(checkInCount)} label="Check-ins" />
          <View style={styles.statSeparator} />
          <ProgressMetricChip value={String(pauseCount)} label="Pause" />
          <View style={styles.statSeparator} />
          <ProgressMetricChip value={String(supportWindowCount)} label="Support" />
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.lg
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  badge: {
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  marker: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  copy: {
    gap: theme.spacing.sm
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md
  },
  statSeparator: {
    width: 1,
    height: 34,
    backgroundColor: theme.colors.border
  }
});
