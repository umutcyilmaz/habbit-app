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
  type ArousalControlPracticeLog,
  type BloomLocalState,
  type RecommendedFirstAction
} from "../../../storage/bloomState";

const resetDayMarkers = Array.from({ length: 10 }, (_, index) => index + 1);
const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

type AppRoute = (typeof routes)[keyof typeof routes];
type RoadmapStatus = "done" | "current" | "next";

type RoadmapStep = {
  title: string;
  description: string;
  status: RoadmapStatus;
};

type CurrentAction = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  route: AppRoute;
};

export function ProgressScreen() {
  const router = useRouter();
  const { state, resetDay, resetTodayCompleted } = useBloomLocalState();
  const quizResult = state.onboarding.quizResult;
  const completedResetDays = getCompletedResetDayCount(state.tenDayReset);
  const latestArousalLog = getLatestArousalControlLog(state.arousalControl.logs);
  const resetStarted = state.tenDayReset.startedAt !== null;
  const resetComplete = completedResetDays >= 10;
  const roadmapSteps = getRoadmapSteps({
    state,
    resetComplete,
    resetStarted,
    latestArousalLog
  });
  const currentAction = getCurrentAction({
    state,
    resetStarted,
    resetTodayCompleted
  });
  const showResetProgress =
    resetStarted ||
    completedResetDays > 0 ||
    (quizResult !== null &&
      (state.activePlan.recommendedFirstAction === "setupProtection" ||
        state.activePlan.recommendedFirstAction === "startReset"));

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        title="Progress"
        subtitle="Your plan updates as you complete each step."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <CurrentPlanCard
          title={quizResult?.resultTitle ?? "Starting plan"}
          body={
            quizResult?.resultBody ??
            "Complete onboarding to personalize your plan."
          }
          chips={quizResult?.chips ?? []}
          {...(quizResult !== null ? { planName: quizResult.planName } : {})}
          {...(quizResult === null
            ? { onStartOnboarding: () => router.push(routes.onboarding) }
            : {})}
        />

        <RoadmapCard steps={roadmapSteps} />

        <CurrentActionCard
          action={
            quizResult === null
              ? {
                  eyebrow: "NEXT STEP",
                  title: "Complete onboarding.",
                  body: "Answer a few private questions so Bloom can suggest your first path.",
                  cta: "Start onboarding",
                  route: routes.onboarding
                }
              : currentAction
          }
          onPress={(route) => router.push(route)}
        />

        {showResetProgress ? (
          <ResetProgressCard
            resetStarted={resetStarted}
            resetDay={resetDay}
            completedResetDays={completedResetDays}
            resetTodayCompleted={resetTodayCompleted}
            startedAt={state.tenDayReset.startedAt}
            onPress={(route) => router.push(route)}
          />
        ) : null}

        <PracticeSummaryCard
          latestLog={latestArousalLog}
          logCount={state.arousalControl.logs.length}
          onPress={(route) => router.push(route)}
        />

        {isDevelopment ? (
          <AppCard style={styles.debugCard}>
            <View style={styles.cardStack}>
              <View style={styles.sectionHeader}>
                <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
                  DEVELOPER TOOLS
                </AppText>
                <AppText variant="title">Bloom local state</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Inspect plan, reset, protection, and practice data while testing on device.
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

type RoadmapInput = {
  state: BloomLocalState;
  resetComplete: boolean;
  resetStarted: boolean;
  latestArousalLog: ArousalControlPracticeLog | null;
};

function getRoadmapSteps({
  state,
  resetComplete,
  resetStarted,
  latestArousalLog
}: RoadmapInput): RoadmapStep[] {
  const quizResult = state.onboarding.quizResult;
  const sourceSteps = quizResult?.firstPlanSteps ?? [
    {
      title: "Complete onboarding",
      description: "Personalize your starting plan."
    },
    {
      title: "Start the first step",
      description: "Bloom will suggest one clear action."
    },
    {
      title: "Track what changes",
      description: "Progress will update from local practice."
    }
  ];

  if (quizResult === null) {
    return sourceSteps.map((step, index) => ({
      title: step.title,
      description: step.description,
      status: index === 0 ? "current" : "next"
    }));
  }

  const hasPracticeLog = latestArousalLog !== null;
  const hasReflectedPractice =
    latestArousalLog?.afterwardFeeling !== undefined ||
    latestArousalLog?.firmnessChange !== undefined ||
    latestArousalLog?.durationPreference !== undefined;
  const steps = ensureThreeSteps(sourceSteps);

  switch (quizResult.recommendedFirstAction) {
    case "startReset":
      return [
        {
          ...steps[0],
          status: resetComplete ? "done" : "current"
        },
        {
          ...steps[1],
          status: resetComplete ? "done" : resetStarted ? "current" : "next"
        },
        {
          ...steps[2],
          status: getPracticeAfterResetStatus(resetComplete, hasPracticeLog)
        }
      ];
    case "startArousalPractice":
      return [
        {
          ...steps[0],
          status: hasPracticeLog ? "done" : "current"
        },
        {
          ...steps[1],
          status: hasPracticeLog ? "current" : "next"
        },
        {
          ...steps[2],
          status: hasReflectedPractice ? "done" : hasPracticeLog ? "current" : "next"
        }
      ];
    case "setupProtection":
    default:
      return [
        {
          ...steps[0],
          status: state.protection.isEnabled ? "done" : "current"
        },
        {
          ...steps[1],
          status: resetComplete ? "done" : state.protection.isEnabled ? "current" : "next"
        },
        {
          ...steps[2],
          status: getPracticeAfterResetStatus(resetComplete, hasPracticeLog)
        }
      ];
  }
}

type PlanStepContent = {
  title: string;
  description: string;
};

function ensureThreeSteps(
  steps: readonly PlanStepContent[]
): [PlanStepContent, PlanStepContent, PlanStepContent] {
  const fallbackSteps: [PlanStepContent, PlanStepContent, PlanStepContent] = [
    {
      title: "Start your plan",
      description: "Take the first recommended step."
    },
    {
      title: "Keep today simple",
      description: "Use one clear support action."
    },
    {
      title: "Review what changes",
      description: "Save practice context when it exists."
    }
  ];

  return [
    steps[0] ?? fallbackSteps[0],
    steps[1] ?? fallbackSteps[1],
    steps[2] ?? fallbackSteps[2]
  ];
}

function getPracticeAfterResetStatus(resetComplete: boolean, hasPracticeLog: boolean): RoadmapStatus {
  if (resetComplete && hasPracticeLog) {
    return "done";
  }

  if (resetComplete) {
    return "current";
  }

  return "next";
}

type CurrentActionInput = {
  state: BloomLocalState;
  resetStarted: boolean;
  resetTodayCompleted: boolean;
};

function getCurrentAction({
  state,
  resetStarted,
  resetTodayCompleted
}: CurrentActionInput): CurrentAction {
  if (resetStarted && resetTodayCompleted) {
    return {
      eyebrow: "CURRENT ACTION",
      title: "Today’s reset is saved.",
      body: "You can review today’s saved reset or keep the day simple.",
      cta: "View saved reset",
      route: routes.tenDayResetSaved
    };
  }

  if (resetStarted) {
    return {
      eyebrow: "CURRENT ACTION",
      title: "Continue today’s reset.",
      body: "A two-minute reset is available for today.",
      cta: "Start today’s reset",
      route: routes.tenDayResetPractice
    };
  }

  return getPlanAction(state.activePlan.recommendedFirstAction, state.protection.isEnabled);
}

function getPlanAction(
  action: RecommendedFirstAction,
  protectionEnabled: boolean
): CurrentAction {
  if (action === "startReset") {
    return {
      eyebrow: "CURRENT ACTION",
      title: "Start your reset.",
      body: "Begin the 10-day plan with one simple day.",
      cta: "Start 10-Day Reset",
      route: routes.tenDayReset
    };
  }

  if (action === "startArousalPractice") {
    return {
      eyebrow: "CURRENT ACTION",
      title: "Start guided practice.",
      body: "Use guided practice to notice arousal before it feels too late.",
      cta: "Start Arousal Control Practice",
      route: routes.arousalControl
    };
  }

  if (protectionEnabled) {
    return {
      eyebrow: "CURRENT ACTION",
      title: "Your pause layer is ready.",
      body: "The next step is to start the 10-Day Reset.",
      cta: "Start 10-Day Reset",
      route: routes.tenDayReset
    };
  }

  return {
    eyebrow: "CURRENT ACTION",
    title: "Set up your pause layer.",
    body: "Create a short pause before the automatic loop begins.",
    cta: "Set up Protection",
    route: routes.protectSetup
  };
}

type CurrentPlanCardProps = {
  title: string;
  planName?: string;
  body: string;
  chips: string[];
  onStartOnboarding?: () => void;
};

function CurrentPlanCard({
  title,
  planName,
  body,
  chips,
  onStartOnboarding
}: CurrentPlanCardProps) {
  return (
    <AppCard style={styles.planCard}>
      <View style={styles.cardStack}>
        <View style={styles.sectionHeader}>
          <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
            CURRENT PLAN
          </AppText>
          <AppText variant="heading">{title}</AppText>
          {planName ? (
            <AppText variant="label">{planName}</AppText>
          ) : null}
          <AppText tone="secondary">{body}</AppText>
        </View>

        {chips.length > 0 ? (
          <View style={styles.chipWrap}>
            {chips.map((chip) => (
              <StatusPill key={chip} label={chip} />
            ))}
          </View>
        ) : null}

        {onStartOnboarding ? (
          <AppButton onPress={onStartOnboarding}>Start onboarding</AppButton>
        ) : null}
      </View>
    </AppCard>
  );
}

type RoadmapCardProps = {
  steps: RoadmapStep[];
};

function RoadmapCard({ steps }: RoadmapCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <View style={styles.sectionHeader}>
          <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
            PLAN ROADMAP
          </AppText>
          <AppText variant="title">Where you are now</AppText>
        </View>
        <View style={styles.roadmapStack}>
          {steps.map((step, index) => (
            <RoadmapStepRow
              key={`${step.title}-${index}`}
              number={index + 1}
              step={step}
              isLast={index === steps.length - 1}
            />
          ))}
        </View>
      </View>
    </AppCard>
  );
}

type RoadmapStepRowProps = {
  number: number;
  step: RoadmapStep;
  isLast: boolean;
};

function RoadmapStepRow({ number, step, isLast }: RoadmapStepRowProps) {
  return (
    <View style={[styles.roadmapRow, isLast ? styles.roadmapRowLast : undefined]}>
      <View style={styles.roadmapRail}>
        <View style={[styles.roadmapNumber, statusNumberStyles[step.status]]}>
          <AppText variant="caption">{number}</AppText>
        </View>
        {!isLast ? <View style={styles.roadmapLine} /> : null}
      </View>
      <View style={styles.roadmapCopy}>
        <View style={styles.roadmapTitleRow}>
          <AppText variant="label" style={styles.roadmapTitle}>
            {step.title}
          </AppText>
          <StatusChip status={step.status} />
        </View>
        <AppText variant="bodySmall" tone="secondary">
          {step.description}
        </AppText>
      </View>
    </View>
  );
}

type CurrentActionCardProps = {
  action: CurrentAction;
  onPress: (route: AppRoute) => void;
};

function CurrentActionCard({ action, onPress }: CurrentActionCardProps) {
  return (
    <AppCard style={styles.actionCard}>
      <View style={styles.cardStack}>
        <View style={styles.sectionHeader}>
          <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
            {action.eyebrow}
          </AppText>
          <AppText variant="title">{action.title}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {action.body}
          </AppText>
        </View>
        <AppButton onPress={() => onPress(action.route)}>{action.cta}</AppButton>
      </View>
    </AppCard>
  );
}

type ResetProgressCardProps = {
  resetStarted: boolean;
  resetDay: number;
  completedResetDays: number;
  resetTodayCompleted: boolean;
  startedAt: string | null;
  onPress: (route: AppRoute) => void;
};

function ResetProgressCard({
  resetStarted,
  resetDay,
  completedResetDays,
  resetTodayCompleted,
  startedAt,
  onPress
}: ResetProgressCardProps) {
  const action = getResetAction(resetStarted, resetTodayCompleted);

  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <View style={styles.cardTopRow}>
          <View style={styles.sectionHeader}>
            <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
              10-DAY RESET
            </AppText>
            <AppText variant="title">
              {resetStarted ? `Day ${resetDay} of 10` : "Reset not started"}
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

        <View style={styles.detailGrid}>
          <DetailCell label="Completed days" value={`${completedResetDays}/10`} />
          <DetailCell label="Today" value={resetTodayCompleted ? "Saved" : "Not saved"} />
          <DetailCell label="Started" value={startedAt ?? "Not started"} />
        </View>

        <AppButton variant="subtle" onPress={() => onPress(action.route)}>
          {action.cta}
        </AppButton>
      </View>
    </AppCard>
  );
}

function getResetAction(resetStarted: boolean, resetTodayCompleted: boolean) {
  if (!resetStarted) {
    return {
      cta: "Start 10-Day Reset",
      route: routes.tenDayReset
    };
  }

  if (resetTodayCompleted) {
    return {
      cta: "View saved reset",
      route: routes.tenDayResetSaved
    };
  }

  return {
    cta: "Start today’s reset",
    route: routes.tenDayResetPractice
  };
}

type PracticeSummaryCardProps = {
  latestLog: ArousalControlPracticeLog | null;
  logCount: number;
  onPress: (route: AppRoute) => void;
};

function PracticeSummaryCard({ latestLog, logCount, onPress }: PracticeSummaryCardProps) {
  if (latestLog === null) {
    return (
      <AppCard style={styles.practiceCard}>
        <View style={styles.cardStack}>
          <View style={styles.sectionHeader}>
            <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
              GUIDED PRACTICE
            </AppText>
            <AppText variant="title">No guided practice saved yet.</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Start Arousal Control Practice when you are ready to notice the rise earlier.
            </AppText>
          </View>
          <AppButton onPress={() => onPress(routes.arousalControl)}>
            Start Arousal Control Practice
          </AppButton>
        </View>
      </AppCard>
    );
  }

  return (
    <AppCard style={styles.practiceCard}>
      <View style={styles.cardStack}>
        <View style={styles.cardTopRow}>
          <View style={styles.sectionHeader}>
            <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
              GUIDED PRACTICE
            </AppText>
            <AppText variant="title">Latest practice saved</AppText>
          </View>
          <View style={styles.countBadge}>
            <AppText variant="caption">{logCount} total</AppText>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <DetailCell label="Latest practice" value={latestLog.dateKey} />
          <DetailCell label="Mode" value="Arousal control" />
          <DetailCell label="Duration" value={formatDuration(latestLog)} />
          <DetailCell label="Saved reflection" value={getReflectionStatus(latestLog)} />
        </View>

        <View style={styles.metricStrip}>
          <CompactMetric label="Peak" value={formatScore(latestLog.highestArousal)} />
          <CompactMetric label="Pauses" value={formatCount(latestLog.pauseCount)} />
          <CompactMetric label="Control" value={formatScore(latestLog.controlFeeling)} />
        </View>

        <AppText variant="bodySmall" tone="secondary">
          These are personal context points, not performance scores.
        </AppText>

        <AppButton variant="secondary" onPress={() => onPress(routes.arousalControlProgressPreview)}>
          View practice preview
        </AppButton>
      </View>
    </AppCard>
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

type StatusChipProps = {
  status: RoadmapStatus;
};

function StatusChip({ status }: StatusChipProps) {
  return (
    <View style={[styles.statusChip, statusChipStyles[status]]}>
      <AppText variant="caption">{formatStatus(status)}</AppText>
    </View>
  );
}

type DetailCellProps = {
  label: string;
  value: string;
};

function DetailCell({ label, value }: DetailCellProps) {
  return (
    <View style={styles.detailCell}>
      <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
        {label}
      </AppText>
      <AppText variant="bodySmall">{value}</AppText>
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

function formatStatus(status: RoadmapStatus) {
  switch (status) {
    case "done":
      return "Done";
    case "current":
      return "Current";
    case "next":
    default:
      return "Next";
  }
}

function formatScore(value: number | null | undefined) {
  return value !== undefined && value !== null ? `${value}/10` : "Not logged";
}

function formatCount(value: number | null | undefined) {
  return value !== undefined && value !== null ? String(value) : "Not logged";
}

function formatDuration(log: ArousalControlPracticeLog) {
  if (log.durationPreference === "notLogged") {
    return "Not logged";
  }

  if (log.durationSeconds !== undefined && log.durationSeconds !== null) {
    const minutes = Math.max(1, Math.round(log.durationSeconds / 60));
    return `About ${minutes} min`;
  }

  return "Not logged";
}

function getReflectionStatus(log: ArousalControlPracticeLog) {
  return log.afterwardFeeling !== undefined ||
    log.firmnessChange !== undefined ||
    log.pressureRushing !== undefined
    ? "Saved"
    : "Not logged";
}

const statusChipStyles = StyleSheet.create({
  done: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  current: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface
  },
  next: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted
  }
});

const statusNumberStyles = StyleSheet.create({
  done: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  current: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface
  },
  next: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted
  }
});

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
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
  actionCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl
  },
  practiceCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.lavenderDeep,
    backgroundColor: theme.colors.lavender,
    padding: theme.spacing.xl
  },
  debugCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  chipWrap: {
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
  statusChip: {
    flexShrink: 0,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4
  },
  roadmapStack: {
    gap: 0
  },
  roadmapRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg
  },
  roadmapRowLast: {
    paddingBottom: 0
  },
  roadmapRail: {
    width: 32,
    alignItems: "center"
  },
  roadmapNumber: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1
  },
  roadmapLine: {
    flex: 1,
    width: 1,
    minHeight: theme.spacing.xl,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.border
  },
  roadmapCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
    paddingTop: 2
  },
  roadmapTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  roadmapTitle: {
    flex: 1,
    minWidth: 0
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
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  detailCell: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
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
