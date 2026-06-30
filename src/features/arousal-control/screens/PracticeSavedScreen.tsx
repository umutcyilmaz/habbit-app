import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  createArousalControlPracticeLogFromDraft,
  getLatestArousalControlLog,
  type ArousalControlPracticeLog
} from "../../../storage/bloomState";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";

export function PracticeSavedScreen() {
  const router = useRouter();
  const { state, completeArousalControlPractice } = useBloomLocalState();
  const [noteVisible, setNoteVisible] = useState(false);
  const [note, setNote] = useState("");
  const [noteMessage, setNoteMessage] = useState<string | undefined>();
  const [justCompletedLog, setJustCompletedLog] = useState<ArousalControlPracticeLog | null>(null);
  const latestLog = getLatestArousalControlLog(state.arousalControl.logs);
  const displayLog = justCompletedLog ?? latestLog;
  const sessionSummary = getSessionSummary(displayLog);
  const insight = getGentleInsight(displayLog);

  useEffect(() => {
    const draft = state.arousalControl.draft;

    if (draft === null) {
      return;
    }

    const completedAt = new Date().toISOString();
    setJustCompletedLog(createArousalControlPracticeLogFromDraft(draft, completedAt));
    completeArousalControlPractice(completedAt);
  }, [completeArousalControlPractice, state.arousalControl.draft]);

  const saveNote = () => {
    setNoteMessage(
      note.trim().length > 0
        ? "Private note saved for this practice."
        : "No note added. This practice is still saved."
    );
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PRACTICE SAVED"
        icon="✓"
        title="You practiced noticing the rise."
        subtitle="This session adds useful context to your awareness pattern."
        onBackPress={() => router.replace(routes.arousalControlDuration)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.successCard}>
          <View style={styles.successGlow} />
          <View style={styles.successContent}>
            <View style={styles.successMark}>
              <AppText variant="title">✓</AppText>
            </View>
            <View style={styles.successCopy}>
              <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
                PRACTICE SAVED
              </AppText>
              <AppText variant="title" align="center">
                Practice saved
              </AppText>
              <AppText tone="secondary" align="center">
                You practiced noticing your arousal level and learning your body’s response without
                judging the outcome.
              </AppText>
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.summaryCard}>
          <View style={styles.cardStack}>
            <View style={styles.sectionHeader}>
              <AppText variant="title">Session summary</AppText>
              <AppText variant="bodySmall" tone="secondary">
                A neutral snapshot of what you noticed.
              </AppText>
            </View>

            <View style={styles.featureMetric}>
              <View style={styles.featureColumn}>
                <AppText variant="caption" tone="secondary">
                  Highest arousal
                </AppText>
                <AppText variant="heading">{sessionSummary.highestArousal}</AppText>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureColumn}>
                <AppText variant="caption" tone="secondary">
                  Pauses
                </AppText>
                <AppText variant="heading">{sessionSummary.pauses}</AppText>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <SummaryMetric label="Control feeling" value={sessionSummary.controlFeeling} />
              <SummaryMetric label="Pleasure quality" value={sessionSummary.pleasureQuality} />
              <SummaryMetric label="Pressure" value={sessionSummary.pressure} />
            </View>

            <View style={styles.contextPanel}>
              <ContextRow label="Firmness during pause" value={sessionSummary.firmness} />
              <View style={styles.contextDivider} />
              <ContextRow
                label="Duration"
                value={sessionSummary.duration}
                detail="Private context, not a score."
              />
            </View>
          </View>
        </AppCard>

        <View style={styles.insightCard}>
          <View style={styles.insightAccent} />
          <View style={styles.insightCopy}>
            <AppText variant="title">Gentle insight</AppText>
            <AppText tone="secondary">
              {insight.body}
            </AppText>
            <View style={styles.insightFooter}>
              <AppText variant="bodySmall" tone="secondary">
                {insight.footer}
              </AppText>
            </View>
          </View>
        </View>

        {noteVisible ? (
          <AppCard style={styles.noteCard}>
            <View style={styles.cardStack}>
              <View style={styles.sectionHeader}>
                <AppText variant="title">Private note</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Add one detail you want to remember.
                </AppText>
              </View>
              <TextInput
                multiline
                value={note}
                onChangeText={setNote}
                placeholder="What do you want to remember about this practice?"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                textAlignVertical="top"
              />
              {noteMessage ? (
                <AppText variant="bodySmall" tone="secondary">
                  {noteMessage}
                </AppText>
              ) : null}
              <AppButton variant="subtle" onPress={saveNote}>
                Save note
              </AppButton>
            </View>
          </AppCard>
        ) : null}

        <View style={styles.actions}>
          <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
          <AppButton
            variant="secondary"
            onPress={() => router.push(routes.arousalControlProgressPreview)}
          >
            View Progress
          </AppButton>
          {!noteVisible ? (
            <AppButton variant="subtle" onPress={() => setNoteVisible(true)}>
              Add private note
            </AppButton>
          ) : null}
          <AppButton variant="ghost" onPress={() => router.replace(routes.exercises)}>
            Back to Exercises
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

function getSessionSummary(log: ArousalControlPracticeLog | null) {
  return {
    pauses: formatCount(log?.pauseCount),
    highestArousal: formatScore(log?.highestArousal),
    controlFeeling: formatScore(log?.controlFeeling),
    pleasureQuality: formatText(log?.pleasureQuality),
    pressure: formatOption(log?.pressureRushing),
    firmness: formatText(log?.firmnessChange),
    duration: formatDuration(log)
  };
}

function getGentleInsight(log: ArousalControlPracticeLog | null) {
  if (log?.highestArousal !== undefined && log.highestArousal !== null) {
    return {
      body: `You noticed your pause zone around ${log.highestArousal}/10. A pause can still be useful when the session ends differently than expected.`,
      footer: "Next time, the practice can be noticing the rise a little earlier."
    };
  }

  return {
    body: "This practice still saved useful context about noticing your body’s response.",
    footer: "Next time, one small detail is enough to build the pattern."
  };
}

function formatScore(value: number | null | undefined) {
  return value !== undefined && value !== null ? `${value}/10` : "Not logged";
}

function formatCount(value: number | null | undefined) {
  return value !== undefined && value !== null ? String(value) : "Not logged";
}

function formatText(value: string | null | undefined) {
  return value !== undefined && value !== null && value.trim().length > 0 ? value : "Not logged";
}

function formatOption(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return "Not logged";
  }

  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    veryHigh: "Very high",
    calm: "Calm",
    satisfied: "Satisfied",
    neutral: "Neutral",
    empty: "Empty",
    uneasy: "Uneasy",
    anxious: "Anxious",
    frustrated: "Frustrated",
    notSure: "Not sure"
  };

  return labels[value] ?? value;
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

type SummaryMetricProps = {
  label: string;
  value: string;
};

function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <View style={styles.metricTile}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

type ContextRowProps = {
  label: string;
  value: string;
  detail?: string;
};

function ContextRow({ label, value, detail }: ContextRowProps) {
  return (
    <View style={styles.contextRow}>
      <View style={styles.contextCopy}>
        <AppText variant="bodySmall" tone="secondary">
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" tone="secondary">
            {detail}
          </AppText>
        ) : null}
      </View>
      <AppText variant="label" style={styles.contextValue}>
        {value}
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
  successCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl
  },
  successGlow: {
    position: "absolute",
    top: -52,
    alignSelf: "center",
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: theme.colors.sageMuted
  },
  successContent: {
    alignItems: "center",
    gap: theme.spacing.lg
  },
  successMark: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  successCopy: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  summaryCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  sectionHeader: {
    gap: theme.spacing.sm
  },
  featureMetric: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
  },
  featureColumn: {
    flex: 1
  },
  featureDivider: {
    width: 1,
    height: 58,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.sage
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  metricTile: {
    minHeight: 82,
    flexGrow: 1,
    flexBasis: "30%",
    justifyContent: "space-between",
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  contextPanel: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  contextRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  contextCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  contextValue: {
    flexShrink: 1,
    textAlign: "right"
  },
  contextDivider: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  insightCard: {
    flexDirection: "row",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.lavenderDeep,
    borderWidth: 1,
    backgroundColor: theme.colors.lavender,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  insightAccent: {
    width: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary
  },
  insightCopy: {
    flex: 1,
    gap: theme.spacing.md
  },
  insightFooter: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  noteCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  noteCopy: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 104,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.sm
  }
});
