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
import { getCompletedResetDayCount, getLatestArousalControlLog } from "../../../storage/bloomState";

const resetDayMarkers = Array.from({ length: 10 }, (_, index) => index + 1);
const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

export function ProgressScreen() {
  const router = useRouter();
  const { state, resetDay, resetTodayCompleted } = useBloomLocalState();
  const completedResetDays = getCompletedResetDayCount(state.tenDayReset);
  const latestArousalLog = getLatestArousalControlLog(state.arousalControl.logs);
  const resetStarted = state.tenDayReset.startedAt !== null;

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        title="Progress"
        subtitle="Gentle observations from your current plan."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.planCard}>
          <View style={styles.cardStack}>
            <View style={styles.sectionHeader}>
              <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
                CURRENT PLAN
              </AppText>
              <AppText variant="heading">{state.activePlan.planName}</AppText>
              <AppText tone="secondary">
                A quiet reset focused on protection, small pauses, and noticing pressure earlier.
              </AppText>
            </View>

            <View style={styles.planStatusRow}>
              <StatusPill label={state.protection.isEnabled ? "Protection ready" : "Protection not set up"} />
              <StatusPill
                label={
                  resetTodayCompleted
                    ? "Today saved"
                    : resetStarted
                      ? `Day ${resetDay}`
                      : "Reset not started"
                }
              />
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.resetCard}>
          <View style={styles.cardStack}>
            <View style={styles.cardTopRow}>
              <View style={styles.sectionHeader}>
                <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
                  10-DAY RESET
                </AppText>
                <AppText variant="title">
                  {resetStarted ? `Day ${resetDay} of 10` : "Ready when you are"}
                </AppText>
              </View>
              <View style={styles.countBadge}>
                <AppText variant="caption">{completedResetDays}/10 saved</AppText>
              </View>
            </View>

            <View style={styles.segmentRow}>
              {resetDayMarkers.map((day) => (
                <View
                  key={day}
                  style={[
                    styles.segment,
                    day <= completedResetDays ? styles.segmentComplete : undefined,
                    resetStarted && day === resetDay ? styles.segmentCurrent : undefined
                  ]}
                />
              ))}
            </View>

            <AppText variant="bodySmall" tone="secondary">
              {resetTodayCompleted
                ? "Today’s reset is saved. You can view it or keep the day simple."
                : resetStarted
                  ? "A two-minute reset is available for today."
                  : "Start with a short, low-pressure reset plan."}
            </AppText>

            <AppButton
              onPress={() =>
                router.push(resetTodayCompleted ? routes.tenDayResetSaved : routes.tenDayResetPractice)
              }
            >
              {resetTodayCompleted ? "View saved reset" : resetStarted ? "Do today’s reset" : "Start reset"}
            </AppButton>
          </View>
        </AppCard>

        <AppCard style={styles.practiceCard}>
          <View style={styles.cardStack}>
            <View style={styles.cardTopRow}>
              <View style={styles.sectionHeader}>
                <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
                  AROUSAL CONTROL
                </AppText>
                <AppText variant="title">
                  {latestArousalLog ? "Latest practice saved" : "No practice logged yet"}
                </AppText>
              </View>
              <View style={styles.countBadge}>
                <AppText variant="caption">{state.arousalControl.logs.length} total</AppText>
              </View>
            </View>

            <View style={styles.metricStrip}>
              <CompactMetric label="Peak" value={formatScore(latestArousalLog?.highestArousal)} />
              <CompactMetric label="Pauses" value={formatCount(latestArousalLog?.pauseCount)} />
              <CompactMetric label="Control" value={formatScore(latestArousalLog?.controlFeeling)} />
            </View>

            <AppText variant="bodySmall" tone="secondary">
              {latestArousalLog
                ? "These are personal context points, not performance scores."
                : "Complete one practice to see a private snapshot here."}
            </AppText>

            <AppButton
              variant={latestArousalLog ? "secondary" : "primary"}
              onPress={() =>
                router.push(
                  latestArousalLog ? routes.arousalControlProgressPreview : routes.arousalControl
                )
              }
            >
              {latestArousalLog ? "View practice preview" : "Start practice"}
            </AppButton>
          </View>
        </AppCard>

        <AppCard style={styles.protectionCard}>
          <View style={styles.cardStack}>
            <View style={styles.sectionHeader}>
              <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
                PROTECTION
              </AppText>
              <AppText variant="title">
                {state.protection.isEnabled ? "Protection is ready" : "Protection is not set up"}
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                {state.protection.isEnabled
                  ? "Adult-content pause support is ready for your selected window."
                  : "Set up a pause before the loop starts."}
              </AppText>
            </View>
            <AppButton
              variant="subtle"
              onPress={() =>
                router.push(state.protection.isEnabled ? routes.protectActive : routes.protectSetup)
              }
            >
              {state.protection.isEnabled ? "View protection" : "Set up protection"}
            </AppButton>
          </View>
        </AppCard>

        {isDevelopment ? (
          <AppCard style={styles.debugCard}>
            <View style={styles.cardStack}>
              <View style={styles.sectionHeader}>
                <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
                  DEVELOPER TOOLS
                </AppText>
                <AppText variant="title">Bloom local state</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Inspect reset, protection, and practice data while testing on device.
                </AppText>
              </View>
              <AppButton variant="ghost" onPress={() => router.push(routes.debugBloomState)}>
                Open debug state
              </AppButton>
            </View>
          </AppCard>
        ) : null}
      </View>
    </AppScreen>
  );
}

type StatusPillProps = {
  label: string;
};

function StatusPill({ label }: StatusPillProps) {
  return (
    <View style={styles.statusPill}>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

type CompactMetricProps = {
  label: string;
  value: string;
};

function CompactMetric({ label, value }: CompactMetricProps) {
  return (
    <View style={styles.metricColumn}>
      <AppText variant="label" align="center">
        {value}
      </AppText>
      <AppText variant="caption" tone="secondary" align="center">
        {label}
      </AppText>
    </View>
  );
}

function formatScore(value: number | null | undefined) {
  return value !== undefined && value !== null ? `${value}/10` : "Not logged";
}

function formatCount(value: number | null | undefined) {
  return value !== undefined && value !== null ? String(value) : "Not logged";
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  sectionHeader: {
    flex: 1,
    gap: theme.spacing.sm
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  planCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.xl
  },
  resetCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
  },
  practiceCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.lavenderDeep,
    backgroundColor: theme.colors.lavender,
    padding: theme.spacing.xl
  },
  protectionCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
  },
  debugCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  planStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  countBadge: {
    flexShrink: 0,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  segmentRow: {
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted
  },
  segmentComplete: {
    backgroundColor: theme.colors.sage
  },
  segmentCurrent: {
    borderColor: theme.colors.primary,
    borderWidth: 1
  },
  metricStrip: {
    flexDirection: "row",
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md
  },
  metricColumn: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs
  }
});
