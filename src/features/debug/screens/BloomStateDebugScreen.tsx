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
import { getCompletedResetDayCount, getTodayKey } from "../../../storage/bloomState";

export function BloomStateDebugScreen() {
  const router = useRouter();
  const {
    state,
    isLoading,
    todayKey,
    resetDay,
    resetTodayCompleted,
    resetBloomLocalData,
    clearTenDayResetProgress,
    simulateNextDay,
    simulatePreviousDay
  } = useBloomLocalState();
  const completedDateCount = getCompletedResetDayCount(state.tenDayReset);

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        eyebrow="Developer tools"
        title="Bloom local state"
        subtitle="Inspect reset progress and simulate day changes."
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
                ["Completed dates count", String(completedDateCount)],
                ["Completed dates", state.tenDayReset.completedDates.join(", ") || "none"],
                ["Last completed at", state.tenDayReset.lastCompletedAt ?? "none"]
              ]}
            />

            <AppCard style={styles.card}>
              <View style={styles.cardStack}>
                <AppText variant="title">Date simulation</AppText>
                <AppText tone="secondary">
                  Change the simulated local date without editing completed dates.
                </AppText>
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
                <AppText variant="title">Reset data</AppText>
                <AppText tone="secondary">
                  Use these controls when testing the reset flow on a phone.
                </AppText>
                <View style={styles.actionStack}>
                  <AppButton variant="subtle" onPress={clearTenDayResetProgress}>
                    Clear reset progress
                  </AppButton>
                  <AppButton variant="secondary" onPress={resetBloomLocalData}>
                    Reset Bloom local data
                  </AppButton>
                </View>
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
