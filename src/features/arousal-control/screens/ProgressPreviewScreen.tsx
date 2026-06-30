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
  getLatestArousalControlLog,
  type ArousalControlPracticeLog
} from "../../../storage/bloomState";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";

const notLoggedText = "Not logged";

const firmnessLabels: Record<string, string> = {
  noChange: "No change noticed",
  slightlyDecreased: "Slightly decreased",
  decreasedCouldContinue: "Decreased, could continue",
  decreasedDifficult: "Decreased, continuing felt difficult",
  notSure: "Not sure"
};

const pressureLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  veryHigh: "Very high"
};

export function ProgressPreviewScreen() {
  const router = useRouter();
  const { state } = useBloomLocalState();
  const latestLog = getLatestArousalControlLog(state.arousalControl.logs);
  const previousLog = getPreviousArousalControlLog(state.arousalControl.logs, latestLog);

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
        <ControlFeelingHeroCard latestLog={latestLog} previousLog={previousLog} />

        <PreviewMetricCard
          icon="Ⅱ"
          label="PAUSES TAKEN"
          value={formatNumber(latestLog?.pauseCount)}
          helper="A moment caught before continuing."
          {...(latestLog?.pauseCount !== undefined
            ? { valueDetail: "pause this practice" }
            : {})}
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
        <CoachInsightCard latestLog={latestLog} />

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

type ControlFeelingHeroCardProps = {
  latestLog: ArousalControlPracticeLog | null;
  previousLog: ArousalControlPracticeLog | null;
};

function ControlFeelingHeroCard({ latestLog, previousLog }: ControlFeelingHeroCardProps) {
  return (
    <AppCard style={styles.controlCard}>
      <View style={styles.cardTopRow}>
        <IconLabel icon="≋" label="CONTROL FEELING" />
        <View style={styles.sageBadge}>
          <AppText variant="caption">{getControlFeelingBadge(latestLog, previousLog)}</AppText>
        </View>
      </View>

      <View style={styles.controlCopy}>
        <AppText variant="heading" style={styles.controlTitle}>
          Perceived sense of regulation
        </AppText>
      </View>

      <ControlFeelingComparison latestLog={latestLog} previousLog={previousLog} />
    </AppCard>
  );
}

function ControlFeelingComparison({ latestLog, previousLog }: ControlFeelingHeroCardProps) {
  const latestValue = latestLog?.controlFeeling;
  const previousValue = previousLog?.controlFeeling;
  const hasPreviousComparison = latestValue !== undefined && previousValue !== undefined;

  return (
    <View style={styles.comparisonPanel}>
      <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
        Recent practice
      </AppText>

      <View style={styles.comparisonRow}>
        {hasPreviousComparison ? (
          <>
            <ComparisonValue label="Previous practice" value={formatScore(previousValue)} />
            <View style={styles.comparisonArrow}>
              <AppText variant="bodySmall" tone="secondary">
                →
              </AppText>
            </View>
            <ComparisonValue label="Recent practice" value={formatScore(latestValue)} emphasized />
          </>
        ) : (
          <ComparisonValue
            label="Control feeling"
            value={formatScore(latestValue)}
            emphasized={latestValue !== undefined}
          />
        )}
      </View>

      <View style={styles.comparisonInsight}>
        <AppText variant="bodySmall">{getControlFeelingInsight(latestLog, previousLog)}</AppText>
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
  const isMissing = value === notLoggedText;

  return (
    <View style={[styles.comparisonValue, emphasized ? styles.comparisonValueEmphasized : undefined]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText
        variant="heading"
        style={[styles.comparisonNumber, isMissing ? styles.comparisonNumberMissing : undefined]}
      >
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
  const isMissing = value === notLoggedText;

  return (
    <AppCard style={[styles.metricCard, tone === "peach" ? styles.peakCard : undefined]}>
      <IconLabel icon={icon} label={label} {...(tone !== undefined ? { tone } : {})} />
      <View style={styles.metricValueGroup}>
        <AppText
          variant="heading"
          style={[styles.metricValue, isMissing ? styles.metricValueMissing : undefined]}
        >
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
  firmnessChange: string | undefined;
};

function PhysicalResponseCard({ firmnessChange }: PhysicalResponseCardProps) {
  const response = getFirmnessResponse(firmnessChange);

  return (
    <AppCard style={styles.infoCard}>
      <View style={styles.cardTopRow}>
        <IconLabel icon="○" label="PHYSICAL RESPONSE" />
        <View style={styles.sageBadge}>
          <AppText variant="caption">{response.badge}</AppText>
        </View>
      </View>

      <View style={styles.infoCopy}>
        <AppText variant="label" style={styles.responseTitle}>
          {response.title}
        </AppText>
        <View style={styles.responseLine}>
          <View style={[styles.responseLineFill, { width: response.fillWidth }]} />
        </View>
        <AppText variant="bodySmall" tone="secondary">
          {response.helper}
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
            {pressureRushing === undefined
              ? "Save a practice to see pacing context here."
              : "Next practice can focus on slowing down earlier."}
          </AppText>
        </View>
        <View style={styles.neutralBadge}>
          <AppText variant="caption">{formatOption(pressureRushing, pressureLabels)}</AppText>
        </View>
      </View>
    </AppCard>
  );
}

type DurationContextCardProps = {
  log: ArousalControlPracticeLog | null;
};

function DurationContextCard({ log }: DurationContextCardProps) {
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

type CoachInsightCardProps = {
  latestLog: ArousalControlPracticeLog | null;
};

function CoachInsightCard({ latestLog }: CoachInsightCardProps) {
  return (
    <AppCard style={styles.coachCard}>
      <View style={styles.coachAccent} />
      <View style={styles.coachCopy}>
        <IconLabel icon="✦" label="Coach Insight" neutral />
        <AppText tone="secondary">
          {getCoachInsight(latestLog)}
        </AppText>
      </View>
    </AppCard>
  );
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

function getPreviousArousalControlLog(
  logs: readonly ArousalControlPracticeLog[],
  latestLog: ArousalControlPracticeLog | null
) {
  if (latestLog === null) {
    return null;
  }

  return sortArousalControlLogs(logs.filter((log) => log.id !== latestLog.id))[0] ?? null;
}

function getControlFeelingBadge(
  latestLog: ArousalControlPracticeLog | null,
  previousLog: ArousalControlPracticeLog | null
) {
  if (latestLog?.controlFeeling === undefined) {
    return notLoggedText;
  }

  if (previousLog?.controlFeeling === undefined) {
    return "Steady";
  }

  return latestLog.controlFeeling > previousLog.controlFeeling ? "Improving" : "Steady";
}

function getControlFeelingInsight(
  latestLog: ArousalControlPracticeLog | null,
  previousLog: ArousalControlPracticeLog | null
) {
  if (latestLog?.controlFeeling === undefined) {
    return "Save a practice to see regulation context here.";
  }

  if (previousLog?.controlFeeling === undefined) {
    return "Created a local reference point for future practice.";
  }

  if (latestLog.controlFeeling > previousLog.controlFeeling) {
    return "Created more space before continuing.";
  }

  return "Recent practice stayed steady. Keep noticing without judging.";
}

function getFirmnessResponse(firmnessChange: string | undefined): {
  badge: string;
  title: string;
  helper: string;
  fillWidth: `${number}%`;
} {
  if (firmnessChange === undefined) {
    return {
      badge: notLoggedText,
      title: notLoggedText,
      helper: "Save a practice to see body-response context here.",
      fillWidth: "0%"
    };
  }

  const firmnessResponseByValue: Record<string, {
    title: string;
    helper: string;
    fillWidth: `${number}%`;
  }> = {
    noChange: {
      title: "No firmness change noticed",
      helper: "No change during pause can still be useful information.",
      fillWidth: "24%"
    },
    slightlyDecreased: {
      title: "Slight firmness change during pause",
      helper: "A small change during pause can still give useful information.",
      fillWidth: "44%"
    },
    decreasedCouldContinue: {
      title: "Firmness changed, continuing felt possible",
      helper: "A change during pause can still leave room to continue gently.",
      fillWidth: "62%"
    },
    decreasedDifficult: {
      title: "Firmness changed, continuing felt difficult",
      helper: "Finishing here can still give useful information about your body response.",
      fillWidth: "78%"
    },
    notSure: {
      title: "Firmness change was unclear",
      helper: "Not being sure is still useful context for future practice.",
      fillWidth: "36%"
    }
  };
  const response = firmnessResponseByValue[firmnessChange] ?? {
    title: formatOption(firmnessChange, firmnessLabels),
    helper: "A change during pause can still give useful information.",
    fillWidth: "50%" as const
  };

  return {
    badge: "Normal response",
    ...response
  };
}

function getCoachInsight(log: ArousalControlPracticeLog | null) {
  if (log?.highestArousal !== undefined) {
    return `You noticed arousal around ${log.highestArousal}/10. Recognizing this point is a useful step in learning your body’s response.`;
  }

  return "Save a practice to build a quiet record of what helps you notice the rise earlier.";
}

function formatNumber(value: number | undefined) {
  return value === undefined ? notLoggedText : String(value);
}

function formatScore(value: number | undefined) {
  return value === undefined ? notLoggedText : `${value}/10`;
}

function formatOption(value: string | undefined, labels: Record<string, string>) {
  if (value === undefined) {
    return notLoggedText;
  }

  return labels[value] ?? value;
}

function formatDuration(log: ArousalControlPracticeLog | null) {
  if (log === null || log.durationPreference === undefined || log.durationPreference === "notLogged") {
    return notLoggedText;
  }

  if (log.durationSeconds === undefined || log.durationSeconds === null) {
    return log.durationPreference === "exact" ? "Exact time logged" : "Estimated";
  }

  if (log.durationPreference === "exact") {
    const minutes = Math.floor(log.durationSeconds / 60);
    const seconds = String(log.durationSeconds % 60).padStart(2, "0");

    return `${minutes}:${seconds}`;
  }

  if (log.durationSeconds < 60) {
    return "About 1 min";
  }

  return `About ${Math.round(log.durationSeconds / 60)} min`;
}

function sortArousalControlLogs(logs: readonly ArousalControlPracticeLog[]) {
  return [...logs].sort((first, second) => {
    const firstTime = Date.parse(first.completedAt);
    const secondTime = Date.parse(second.completedAt);

    return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
  });
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
  comparisonNumberMissing: {
    fontSize: 22,
    lineHeight: 28
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
  metricValueMissing: {
    fontSize: 26,
    lineHeight: 32
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
