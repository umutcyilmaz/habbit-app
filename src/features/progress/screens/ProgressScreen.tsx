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
import {
  getCompletedResetDayCount,
  getLatestArousalControlLog,
  type ArousalControlPracticeLog
} from "../../../storage/bloomState";

export function ProgressScreen() {
  const router = useRouter();
  const {
    state,
    isLoading,
    resetDay,
    resetTodayCompleted
  } = useBloomLocalState();
  const resetStarted = state.tenDayReset.startedAt !== null;
  const completedDayCount = getCompletedResetDayCount(state.tenDayReset);
  const latestArousalLog = getLatestArousalControlLog(state.arousalControl.logs);

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        title="Progress"
        subtitle="A simple view of what is changing over time."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        {isLoading ? (
          <AppCard style={styles.card}>
            <View style={styles.cardStack}>
              <AppText variant="title">Loading progress</AppText>
              <AppText tone="secondary">Bloom is checking your local reset state.</AppText>
            </View>
          </AppCard>
        ) : (
          <>
            <CurrentPlanCard planName={state.activePlan.planName} />
            <ResetProgressCard
              resetStarted={resetStarted}
              resetDay={resetDay}
              completedDayCount={completedDayCount}
              onActionPress={() => router.push(routes.tenDayReset)}
            />
            <TodayStatusCard
              resetStarted={resetStarted}
              resetTodayCompleted={resetTodayCompleted}
              onActionPress={() => {
                if (!resetStarted) {
                  router.push(routes.tenDayReset);
                  return;
                }

                router.push(resetTodayCompleted ? routes.tenDayResetSaved : routes.tenDayResetPractice);
              }}
            />
            <NextStepCard
              resetStarted={resetStarted}
              resetTodayCompleted={resetTodayCompleted}
              onActionPress={() => {
                if (!resetStarted) {
                  router.push(routes.tenDayReset);
                  return;
                }

                router.push(resetTodayCompleted ? routes.home : routes.tenDayResetPractice);
              }}
            />
            <ArousalControlPracticeCard
              logsCount={state.arousalControl.logs.length}
              latestLog={latestArousalLog}
              onStartPractice={() => router.push(routes.arousalControl)}
              onViewPreview={() => router.push(routes.arousalControlProgressPreview)}
            />
            {__DEV__ ? (
              <DeveloperToolsCard onPress={() => router.push(routes.debugBloomState)} />
            ) : null}
          </>
        )}
      </View>
    </AppScreen>
  );
}

type ArousalControlPracticeCardProps = {
  logsCount: number;
  latestLog: ArousalControlPracticeLog | null;
  onStartPractice: () => void;
  onViewPreview: () => void;
};

function ArousalControlPracticeCard({
  logsCount,
  latestLog,
  onStartPractice,
  onViewPreview
}: ArousalControlPracticeCardProps) {
  const hasLogs = logsCount > 0;

  return (
    <AppCard style={styles.arousalCard}>
      <View style={styles.cardStack}>
        <View style={styles.cardTitleCopy}>
          <AppText variant="title">Arousal Control Practice</AppText>
          <AppText tone="secondary">
            {hasLogs
              ? "A quiet snapshot from your latest saved practice."
              : "No practice logged yet."}
          </AppText>
        </View>

        {hasLogs ? (
          <View style={styles.arousalMetricStack}>
            <ProgressMetricRow label="Practices logged" value={String(logsCount)} />
            <ProgressMetricRow
              label="Latest peak awareness"
              value={formatProgressScore(latestLog?.highestArousal)}
            />
            <ProgressMetricRow
              label="Latest pause count"
              value={latestLog?.pauseCount !== undefined ? String(latestLog.pauseCount) : "Not logged"}
            />
            <ProgressMetricRow
              label="Latest control feeling"
              value={formatProgressScore(latestLog?.controlFeeling)}
            />
          </View>
        ) : null}

        <AppButton onPress={hasLogs ? onViewPreview : onStartPractice}>
          {hasLogs ? "View latest preview" : "Start practice"}
        </AppButton>
      </View>
    </AppCard>
  );
}

type ProgressMetricRowProps = {
  label: string;
  value: string;
};

function ProgressMetricRow({ label, value }: ProgressMetricRowProps) {
  return (
    <View style={styles.arousalMetricRow}>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label" style={styles.arousalMetricValue}>
        {value}
      </AppText>
    </View>
  );
}

function formatProgressScore(value: number | undefined) {
  return value === undefined ? "Not logged" : `${value}/10`;
}

type CurrentPlanCardProps = {
  planName: string;
};

function CurrentPlanCard({ planName }: CurrentPlanCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
          CURRENT PLAN
        </AppText>
        <AppText variant="title">{planName}</AppText>
        <AppText tone="secondary">
          Your current plan focuses on creating a pause before porn and stepping away from
          pressure-based patterns.
        </AppText>
      </View>
    </AppCard>
  );
}

type ResetProgressCardProps = {
  resetStarted: boolean;
  resetDay: number;
  completedDayCount: number;
  onActionPress: () => void;
};

function ResetProgressCard({
  resetStarted,
  resetDay,
  completedDayCount,
  onActionPress
}: ResetProgressCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleCopy}>
            <AppText variant="title">10-Day Reset</AppText>
            <AppText tone="secondary">
              {resetStarted
                ? `Day ${resetDay} of 10`
                : "Not started yet"}
            </AppText>
          </View>
          <View style={styles.valuePill}>
            <AppText variant="label">
              {resetStarted ? `${completedDayCount} / 10` : "0 / 10"}
            </AppText>
          </View>
        </View>

        <ResetProgressSegments
          resetStarted={resetStarted}
          resetDay={resetDay}
          completedDayCount={completedDayCount}
        />

        <AppText variant="bodySmall" tone="secondary">
          {resetStarted
            ? `Completed days: ${completedDayCount}`
            : "Start the reset when you are ready to create a clean pause from the pattern."}
        </AppText>

        <AppButton onPress={onActionPress}>
          {resetStarted ? "Continue reset" : "Start reset"}
        </AppButton>
      </View>
    </AppCard>
  );
}

type ResetProgressSegmentsProps = {
  resetStarted: boolean;
  resetDay: number;
  completedDayCount: number;
};

function ResetProgressSegments({
  resetStarted,
  resetDay,
  completedDayCount
}: ResetProgressSegmentsProps) {
  return (
    <View style={styles.progressRow} accessibilityRole="image">
      {Array.from({ length: 10 }, (_, index) => {
        const day = index + 1;
        const isCompleted = day <= completedDayCount;
        const isCurrent = resetStarted && day === resetDay;

        return (
          <View
            key={day}
            style={[
              styles.progressSegment,
              isCompleted ? styles.progressSegmentCompleted : undefined,
              isCurrent ? styles.progressSegmentCurrent : undefined
            ]}
          />
        );
      })}
    </View>
  );
}

type TodayStatusCardProps = {
  resetStarted: boolean;
  resetTodayCompleted: boolean;
  onActionPress: () => void;
};

function TodayStatusCard({
  resetStarted,
  resetTodayCompleted,
  onActionPress
}: TodayStatusCardProps) {
  const copy = getTodayStatusCopy(resetStarted, resetTodayCompleted);

  return (
    <AppCard style={[styles.card, resetTodayCompleted ? styles.completedCard : undefined]}>
      <View style={styles.cardStack}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleCopy}>
            <AppText variant="title">Today</AppText>
            <AppText tone="secondary">{copy.text}</AppText>
          </View>
          {resetTodayCompleted ? (
            <View style={styles.completedPill}>
              <AppText variant="caption" tone="secondary">
                Completed
              </AppText>
            </View>
          ) : null}
        </View>
        <AppButton onPress={onActionPress}>{copy.action}</AppButton>
      </View>
    </AppCard>
  );
}

function getTodayStatusCopy(resetStarted: boolean, resetTodayCompleted: boolean) {
  if (!resetStarted) {
    return {
      text: "Your reset has not started yet.",
      action: "Start reset"
    };
  }

  if (resetTodayCompleted) {
    return {
      text: "Today’s reset is completed.",
      action: "View saved reset"
    };
  }

  return {
    text: "Today’s reset is still open.",
    action: "Start today’s reset"
  };
}

type NextStepCardProps = {
  resetStarted: boolean;
  resetTodayCompleted: boolean;
  onActionPress: () => void;
};

function NextStepCard({
  resetStarted,
  resetTodayCompleted,
  onActionPress
}: NextStepCardProps) {
  const copy = getNextStepCopy(resetStarted, resetTodayCompleted);

  return (
    <AppCard style={styles.nextStepCard}>
      <View style={styles.cardStack}>
        <AppText variant="title">Next step</AppText>
        <AppText tone="secondary">{copy.text}</AppText>
        {copy.secondary ? (
          <AppText variant="bodySmall" tone="secondary">
            {copy.secondary}
          </AppText>
        ) : null}
        <AppButton onPress={onActionPress}>{copy.action}</AppButton>
      </View>
    </AppCard>
  );
}

function getNextStepCopy(resetStarted: boolean, resetTodayCompleted: boolean) {
  if (!resetStarted) {
    return {
      text: "Start with Day 1 and keep the first goal simple: no porn, no masturbation, no checking.",
      action: "Start 10-Day Reset"
    };
  }

  if (resetTodayCompleted) {
    return {
      text: "Come back tomorrow and repeat the same reset.",
      secondary: "If real desire is present later, use Arousal Control Practice after the reset.",
      action: "Back to Today"
    };
  }

  return {
    text: "Complete today’s 2-minute reset practice.",
    action: "Start practice"
  };
}

type DeveloperToolsCardProps = {
  onPress: () => void;
};

function DeveloperToolsCard({ onPress }: DeveloperToolsCardProps) {
  return (
    <AppCard style={styles.devToolsCard}>
      <View style={styles.cardStack}>
        <AppText variant="title">Developer tools</AppText>
        <AppText tone="secondary">Inspect and reset local Bloom state.</AppText>
        <AppButton variant="subtle" onPress={onPress}>
          Open debug state
        </AppButton>
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
  eyebrow: {
    textTransform: "uppercase"
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  cardTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  valuePill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  progressRow: {
    flexDirection: "row",
    gap: 4
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted
  },
  progressSegmentCompleted: {
    backgroundColor: theme.colors.sage
  },
  progressSegmentCurrent: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.primary,
    borderWidth: 1
  },
  completedCard: {
    borderColor: theme.colors.sage
  },
  completedPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  nextStepCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: 28
  },
  arousalCard: {
    borderRadius: theme.radius.xxl,
    padding: 24
  },
  arousalMetricStack: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  arousalMetricRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  arousalMetricValue: {
    flexShrink: 0,
    textAlign: "right"
  },
  devToolsCard: {
    borderRadius: theme.radius.xl,
    borderStyle: "dashed",
    padding: theme.spacing.lg
  }
});
