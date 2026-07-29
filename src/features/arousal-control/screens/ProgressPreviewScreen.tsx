import { useEffect } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getLatestValidArousalLog,
  type ArousalControlPracticeLog
} from "../../../storage/bloomState";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { formatArousalPauseCount } from "../practiceSubmission";

export function ProgressPreviewScreen() {
  const router = useRouter();
  const { state } = useBloomLocalState();
  const latestLog = getLatestValidArousalLog(state.arousalControl.logs);

  useEffect(() => {
    if (latestLog === null) {
      router.replace(routes.arousalControl);
    }
  }, [latestLog, router]);

  if (latestLog === null) {
    return <AppScreen />;
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PROGRESS PREVIEW"
        title="Progress Preview"
        subtitle="A quiet reflection on your recent practice sessions. Notice the shifts in your awareness and control."
        onBackPress={() => router.replace(routes.arousalControlSaved)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <ControlFeelingHeroCard log={latestLog} />
        <PracticePathCard log={latestLog} />

        <PreviewMetricCard
          icon="Ⅱ"
          label="PAUSES TAKEN"
          value={formatArousalPauseCount(
            latestLog.pauseCount,
            latestLog.pauseCountBucket
          )}
          valueDetail={getPauseDetail(latestLog?.pauseCount)}
          helper="A moment caught before continuing."
        />

        <PreviewMetricCard
          icon="◉"
          label="PEAK AWARENESS"
          value={formatScore(latestLog?.highestArousal)}
          helper="Highest arousal level noticed before pausing in this practice."
          tone="peach"
        />

        <PhysicalResponseCard firmnessChange={latestLog?.firmnessChange} />
        <InternalPacingCard pressureRushing={latestLog?.pressureRushing} />
        <DurationContextCard log={latestLog} />
        <CoachInsightCard log={latestLog} />

        <View style={styles.actions}>
          <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
          <AppButton variant="subtle" onPress={() => router.replace(routes.progress)}>
            View overall progress
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.replace(routes.arousalControl)}>
            Start another practice
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

type LogCardProps = {
  log: ArousalControlPracticeLog | null;
};

function ControlFeelingHeroCard({ log }: LogCardProps) {
  const hasControlFeeling = log?.controlFeeling !== undefined && log.controlFeeling !== null;

  return (
    <AppCard style={styles.controlCard}>
      <View style={styles.cardTopRow}>
        <IconLabel icon="≋" label="CONTROL FEELING" />
        <View style={styles.sageBadge}>
          <AppText variant="caption">{hasControlFeeling ? "Saved" : "Not logged"}</AppText>
        </View>
      </View>

      <View style={styles.controlCopy}>
        <AppText variant="heading" style={styles.controlTitle}>
          Perceived sense of regulation
        </AppText>
      </View>

      <ControlFeelingComparison controlFeeling={log?.controlFeeling} />
    </AppCard>
  );
}

type ControlFeelingComparisonProps = {
  controlFeeling: number | undefined;
};

function ControlFeelingComparison({ controlFeeling }: ControlFeelingComparisonProps) {
  const hasControlFeeling = controlFeeling !== undefined && controlFeeling !== null;

  return (
    <View style={styles.comparisonPanel}>
      <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
        Recent practice
      </AppText>

      <View style={styles.comparisonRow}>
        <ComparisonValue
          label="Control feeling"
          value={formatScore(controlFeeling)}
          emphasized={hasControlFeeling}
        />
      </View>

      <View style={styles.comparisonInsight}>
        <AppText variant="bodySmall">
          {hasControlFeeling
            ? "Saved as awareness context from recent practice."
            : "Complete a practice to see this reflection."}
        </AppText>
      </View>
    </View>
  );
}

type ComparisonValueProps = {
  label: string;
  value: string;
  emphasized?: boolean;
};

function ComparisonValue({ label, value, emphasized = false }: ComparisonValueProps) {
  return (
    <View style={[styles.comparisonValue, emphasized ? styles.comparisonValueEmphasized : undefined]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="heading" style={styles.comparisonNumber}>
        {value}
      </AppText>
    </View>
  );
}

type PreviewMetricCardProps = {
  icon: string;
  label: string;
  value: string;
  valueDetail?: string;
  helper: string;
  tone?: "peach";
};

function PreviewMetricCard({
  icon,
  label,
  value,
  valueDetail,
  helper,
  tone
}: PreviewMetricCardProps) {
  return (
    <AppCard style={[styles.metricCard, tone === "peach" ? styles.peakCard : undefined]}>
      <IconLabel icon={icon} label={label} {...(tone !== undefined ? { tone } : {})} />
      <View style={styles.metricValueGroup}>
        <AppText variant="heading" style={styles.metricValue}>
          {value}
        </AppText>
        {valueDetail ? (
          <AppText variant="bodySmall" tone="secondary">
            {valueDetail}
          </AppText>
        ) : null}
      </View>
      <View style={styles.metricRule} />
      <AppText variant="bodySmall" tone="secondary">
        {helper}
      </AppText>
    </AppCard>
  );
}

type PhysicalResponseCardProps = {
  firmnessChange: ArousalControlPracticeLog["firmnessChange"];
};

function PhysicalResponseCard({ firmnessChange }: PhysicalResponseCardProps) {
  const hasFirmnessChange = firmnessChange !== undefined && firmnessChange !== null;

  return (
    <AppCard style={styles.infoCard}>
      <View style={styles.cardTopRow}>
        <IconLabel icon="○" label="PHYSICAL RESPONSE" />
        <View style={styles.sageBadge}>
          <AppText variant="caption">{hasFirmnessChange ? "Recorded" : "Not logged"}</AppText>
        </View>
      </View>

      <View style={styles.infoCopy}>
        <AppText variant="label" style={styles.responseTitle}>
          {hasFirmnessChange
            ? formatFirmness(firmnessChange)
            : "No body-response detail yet"}
        </AppText>
        <View style={styles.responseLine}>
          <View
            style={[
              styles.responseLineFill,
              { width: hasFirmnessChange ? "56%" : "24%" }
            ]}
          />
        </View>
        <AppText variant="bodySmall" tone="secondary">
          A change during pause can still give useful information.
        </AppText>
      </View>
    </AppCard>
  );
}

type InternalPacingCardProps = {
  pressureRushing: string | undefined;
};

function InternalPacingCard({ pressureRushing }: InternalPacingCardProps) {
  return (
    <AppCard style={styles.infoCard}>
      <IconLabel icon="↘" label="INTERNAL PACING" />
      <View style={styles.pacingRow}>
        <View style={styles.infoCopy}>
          <AppText variant="label" style={styles.responseTitle}>
            Sense of rushing
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            Next practice can focus on slowing down earlier.
          </AppText>
        </View>
        <View style={styles.neutralBadge}>
          <AppText variant="caption">{formatOption(pressureRushing)}</AppText>
        </View>
      </View>
    </AppCard>
  );
}

function DurationContextCard({ log }: LogCardProps) {
  return (
    <View style={styles.durationCard}>
      <IconLabel icon="◷" label="Session Duration" neutral />
      <AppText variant="label">{formatDuration(log)}</AppText>
      <AppText variant="caption" tone="secondary">
        Duration is private context, not a score. Focus on awareness, not time.
      </AppText>
    </View>
  );
}

function CoachInsightCard({ log }: LogCardProps) {
  const insight =
    log?.pauseZoneLevel !== undefined && log.pauseZoneLevel !== null
      ? `You chose to pause around ${log.pauseZoneLevel}/10. Recognizing this point is a useful step in learning your body’s response.`
      : "Complete a practice to build a clearer picture of where the rise becomes easier to notice.";

  return (
    <AppCard style={styles.coachCard}>
      <View style={styles.coachAccent} />
      <View style={styles.coachCopy}>
        <IconLabel icon="✦" label="Coach Insight" neutral />
        <AppText tone="secondary">
          {insight}
        </AppText>
      </View>
    </AppCard>
  );
}

function PracticePathCard({ log }: LogCardProps) {
  return (
    <AppCard style={styles.infoCard}>
      <IconLabel icon="○" label="PRACTICE PATH" />
      <View style={styles.pathRows}>
        <PathRow label="Mode" value={formatMode(log?.mode)} />
        <PathRow
          label="Starting arousal"
          value={formatScore(log?.startingArousalLevel)}
        />
        <PathRow
          label="Pause zone"
          value={formatScore(log?.pauseZoneLevel)}
        />
        <PathRow
          label="After pause"
          value={formatScore(log?.afterPauseLevel)}
        />
        <PathRow label="Ending" value={formatEnding(log?.endingChoice)} />
      </View>
    </AppCard>
  );
}

type PathRowProps = {
  label: string;
  value: string;
};

function PathRow({ label, value }: PathRowProps) {
  return (
    <View style={styles.pathRow}>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label" style={styles.pathValue}>
        {value}
      </AppText>
    </View>
  );
}

function formatScore(value: number | null | undefined) {
  return value !== undefined && value !== null ? `${value}/10` : "Not logged";
}

function getPauseDetail(value: number | null | undefined) {
  if (value === undefined || value === null) {
    return "not logged yet";
  }

  return value === 1 ? "pause this practice" : "pauses this practice";
}

function formatOption(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return "Not logged";
  }

  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    veryHigh: "Very high"
  };

  return labels[value] ?? value;
}

function formatMode(value: ArousalControlPracticeLog["mode"]) {
  const labels = {
    softAwareness: "Soft Awareness",
    onePause: "One Pause Practice",
    practicePlus: "Practice+"
  } as const;

  return value !== undefined ? labels[value] : "Not logged";
}

function formatEnding(value: ArousalControlPracticeLog["endingChoice"]) {
  const labels = {
    finishedBeforeClimax: "Finished before climax",
    climaxed: "Climaxed",
    firmnessDecreased: "Stopped after firmness changed",
    feltAnxious: "Stopped after feeling anxious",
    stoppedByChoice: "Stopped by choice",
    other: "Other"
  } as const;

  return value !== undefined ? labels[value] : "Not logged";
}

function formatFirmness(
  value: NonNullable<ArousalControlPracticeLog["firmnessChange"]>
) {
  const labels = {
    noChange: "No change",
    slightlyDecreased: "Slightly decreased",
    decreasedCouldContinue: "Decreased, but I could continue",
    decreasedDifficult: "Decreased and continuing felt difficult",
    notSure: "Not sure"
  } as const;

  return labels[value];
}

function formatDuration(log: ArousalControlPracticeLog | null) {
  if (log === null || log.durationPreference === "notLogged") {
    return "Not logged";
  }

  if (log.durationSeconds !== undefined && log.durationSeconds !== null) {
    const minutes = Math.max(1, Math.round(log.durationSeconds / 60));
    return `About ${minutes} min`;
  }

  return "Not logged";
}

type IconLabelProps = {
  icon: string;
  label: string;
  tone?: "peach";
  neutral?: boolean;
};

function IconLabel({ icon, label, tone, neutral = false }: IconLabelProps) {
  return (
    <View style={styles.iconLabel}>
      <View
        style={[
          styles.iconCircle,
          tone === "peach" ? styles.iconCirclePeach : undefined,
          neutral ? styles.iconCircleNeutral : undefined
        ]}
      >
        <AppText variant="caption">{icon}</AppText>
      </View>
      <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  controlCard: {
    minHeight: 320,
    gap: theme.spacing.xl,
    borderRadius: 30,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  iconLabel: {
    minWidth: 0,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  iconCircle: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  iconCirclePeach: {
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.surface
  },
  iconCircleNeutral: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  sageBadge: {
    flexShrink: 0,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  controlCopy: {
    gap: theme.spacing.sm
  },
  controlTitle: {
    fontSize: 34,
    lineHeight: 40
  },
  comparisonPanel: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  comparisonValue: {
    flex: 1,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md
  },
  comparisonValueEmphasized: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  comparisonNumber: {
    fontSize: 34,
    lineHeight: 40
  },
  comparisonArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  comparisonInsight: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  metricCard: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg
  },
  peakCard: {
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.peachMuted
  },
  metricValueGroup: {
    gap: 2
  },
  metricValue: {
    fontSize: 48,
    lineHeight: 54
  },
  metricRule: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  infoCard: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg
  },
  infoCopy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  pathRows: {
    gap: theme.spacing.sm
  },
  pathRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingBottom: theme.spacing.sm
  },
  pathValue: {
    flex: 1,
    textAlign: "right"
  },
  responseTitle: {
    fontSize: 18,
    lineHeight: 24
  },
  responseLine: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden"
  },
  responseLineFill: {
    width: "56%",
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  pacingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  neutralBadge: {
    flexShrink: 0,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  durationCard: {
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  coachCard: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  coachAccent: {
    width: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  coachCopy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
