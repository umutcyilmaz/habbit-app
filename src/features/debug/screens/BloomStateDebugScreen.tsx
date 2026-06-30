import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { getCompletedResetDayCount, getLatestArousalControlLog, getTodayKey } from "../../../storage/bloomState";

export function BloomStateDebugScreen() {
  const router = useRouter();
  const {
    state,
    isLoading,
    todayKey,
    resetDay,
    resetTodayCompleted,
    resetBloomLocalData,
    simulateNextDay,
    simulatePreviousDay
  } = useBloomLocalState();
  const latestArousalLog = getLatestArousalControlLog(state.arousalControl.logs);

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        eyebrow="Developer tools"
        title="Bloom local state"
        subtitle="Inspect MVP state and simulate day changes."
      />

      <View style={styles.stack}>
        {isLoading ? (
          <AppCard style={styles.card}>
            <AppText tone="secondary">Loading local state…</AppText>
          </AppCard>
        ) : (
          <>
            <SummaryCard
              rows={[
                ["Active plan", state.activePlan.planName],
                ["Real date", getTodayKey()],
                ["Simulated today", todayKey],
                ["Date offset days", String(state.debug.dateOffsetDays)],
                ["Reset started at", state.tenDayReset.startedAt ?? "not started"],
                ["Reset day", `Day ${resetDay} of 10`],
                ["Today completed", resetTodayCompleted ? "yes" : "no"],
                ["Completed reset days", String(getCompletedResetDayCount(state.tenDayReset))],
                ["Completed dates", state.tenDayReset.completedDates.join(", ") || "none"],
                ["Protection enabled", state.protection.isEnabled ? "yes" : "no"],
                ["Preferred window", state.protection.preferredWindow ?? "none"],
                [
                  "Adult content pause enabled",
                  state.protection.adultContentPauseEnabled ? "yes" : "no"
                ],
                ["Setup completed at", state.protection.setupCompletedAt ?? "none"],
                ["Last protection pause at", state.protection.lastProtectionPauseAt ?? "none"],
                ["Arousal logs count", String(state.arousalControl.logs.length)],
                ["Latest arousal log date", latestArousalLog?.dateKey ?? "none"],
                [
                  "Latest highest arousal",
                  latestArousalLog?.highestArousal !== undefined
                    ? `${latestArousalLog.highestArousal}/10`
                    : "none"
                ],
                [
                  "Latest pause count",
                  latestArousalLog?.pauseCount !== undefined ? String(latestArousalLog.pauseCount) : "none"
                ],
                [
                  "Latest control feeling",
                  latestArousalLog?.controlFeeling !== undefined
                    ? `${latestArousalLog.controlFeeling}/10`
                    : "none"
                ],
                ["Latest pressure/rushing", latestArousalLog?.pressureRushing ?? "none"],
                [
                  "Latest duration seconds",
                  latestArousalLog?.durationSeconds !== undefined &&
                  latestArousalLog.durationSeconds !== null
                    ? String(latestArousalLog.durationSeconds)
                    : "none"
                ],
                [
                  "Latest duration preference",
                  latestArousalLog?.durationPreference ?? "none"
                ]
              ]}
            />

            <AppCard style={styles.card}>
              <View style={styles.cardStack}>
                <AppText variant="title">Date simulation</AppText>
                <View style={styles.actionStack}>
                  <AppButton onPress={simulateNextDay}>Simulate next day</AppButton>
                  <AppButton variant="subtle" onPress={simulatePreviousDay}>
                    Simulate previous day
                  </AppButton>
                </View>
              </View>
            </AppCard>

            <AppCard style={styles.card}>
              <View style={styles.cardStack}>
                <AppText variant="title">Reset local data</AppText>
                <AppText tone="secondary">
                  Clears reset, protection, arousal logs, and debug date offset.
                </AppText>
                <AppButton variant="secondary" onPress={resetBloomLocalData}>
                  Reset Bloom local data
                </AppButton>
              </View>
            </AppCard>

            <View style={styles.footerActions}>
              <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
              <AppButton variant="subtle" onPress={() => router.replace(routes.progress)}>
                Back to Progress
              </AppButton>
            </View>
          </>
        )}
      </View>
    </AppScreen>
  );
}

type SummaryCardProps = {
  rows: Array<[string, string]>;
};

function SummaryCard({ rows }: SummaryCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title">State summary</AppText>
        <View style={styles.summaryStack}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <AppText variant="caption" tone="secondary" style={styles.summaryLabel}>
                {label}
              </AppText>
              <AppText variant="bodySmall" style={styles.summaryValue}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  card: {
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  summaryStack: {
    gap: theme.spacing.sm
  },
  summaryRow: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  summaryLabel: {
    textTransform: "uppercase"
  },
  summaryValue: {
    flexShrink: 1
  },
  actionStack: {
    gap: theme.spacing.sm
  },
  footerActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
