import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  useBloomLocalState,
  type BloomPersistenceRetryToken
} from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { resolveBloomMutationFeedback } from "../../../shared/utils/bloomMutationFeedback";
import {
  MAX_BLOOM_NOTE_LENGTH,
  prepareBloomNoteSubmission,
  type ArousalControlPracticeLog
} from "../../../storage/bloomState";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import {
  getArousalSavedRouteIntent,
  resolveArousalSavedRoute
} from "../arousalSavedRoute";
import { formatArousalPauseCount } from "../practiceSubmission";

export function PracticeSavedScreen() {
  const router = useRouter();
  const { logId } = useLocalSearchParams<{
    logId?: string | string[];
  }>();
  const {
    state,
    durableState,
    editCompletedArousalLog,
    retryPersistedMutation
  } = useBloomLocalState();
  const resolution = resolveArousalSavedRoute(
    state.arousalControl,
    durableState.arousalControl,
    getArousalSavedRouteIntent(logId)
  );
  const displayLog =
    resolution.status === "show-completion" ||
    resolution.status === "show-history"
      ? resolution.log
      : null;
  const presentationMode =
    resolution.status === "show-completion"
      ? "completion"
      : "history";
  const [noteVisible, setNoteVisible] = useState(false);
  const [note, setNote] = useState(displayLog?.note ?? "");
  const [noteMessage, setNoteMessage] = useState<string | undefined>();
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [noteRetryToken, setNoteRetryToken] =
    useState<BloomPersistenceRetryToken | null>(null);
  const [noteMutationAccepted, setNoteMutationAccepted] = useState(false);
  const noteSaveInFlightRef = useRef(false);
  const noteMutationAcceptedRef = useRef(false);
  const noteRetryTokenRef = useRef<BloomPersistenceRetryToken | null>(null);
  const isMountedRef = useRef(true);
  const notePersistenceLocked = isNoteSaving;
  usePersistenceNavigationGuard(notePersistenceLocked);
  const sessionSummary = getSessionSummary(displayLog);
  const insight = getGentleInsight(displayLog);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resolution.status === "redirect") {
      router.replace(routes.arousalControl);
    }
  }, [resolution.status, router]);

  useEffect(() => {
    setNote(displayLog?.note ?? "");
  }, [displayLog?.id]);

  const saveNote = async () => {
    if (noteSaveInFlightRef.current) {
      return;
    }

    const retryToken = noteRetryTokenRef.current;
    let preparedNote: string | null = null;

    if (retryToken === null) {
      if (noteMutationAcceptedRef.current) {
        return;
      }

      const noteResult = prepareBloomNoteSubmission(note);

      if (!noteResult.ok) {
        setNoteMessage("That note is too long to save.");
        return;
      }

      if (displayLog === null || noteResult.note === null) {
        setNoteMessage("No note added. This practice is still saved.");
        return;
      }

      preparedNote = noteResult.note;
    }

    noteSaveInFlightRef.current = true;
    setIsNoteSaving(true);
    setNoteMessage(undefined);

    try {
      const result =
        retryToken !== null
          ? await retryPersistedMutation(retryToken)
          : displayLog !== null && preparedNote !== null
            ? await editCompletedArousalLog(displayLog.id, {
                note: preparedNote
              })
            : null;

      if (!isMountedRef.current) {
        return;
      }

      if (result === null) {
        setNoteMessage("This note could not be saved yet.");
        return;
      }

      if (result.ok) {
        noteRetryTokenRef.current = null;
        noteMutationAcceptedRef.current = false;
        setNoteRetryToken(null);
        setNoteMutationAccepted(false);
      } else if (result.accepted) {
        noteMutationAcceptedRef.current = true;
        noteRetryTokenRef.current = result.retryable
          ? result.retryToken
          : null;
        setNoteMutationAccepted(true);
        setNoteRetryToken(result.retryable ? result.retryToken : null);
      } else {
        noteMutationAcceptedRef.current = false;
        noteRetryTokenRef.current = null;
        setNoteMutationAccepted(false);
        setNoteRetryToken(null);
      }

      const feedback = resolveBloomMutationFeedback(
        result,
        "Private note saved for this practice.",
        !result.ok && result.reason === "persistenceUnknown"
          ? "Bloom is still confirming this note in local storage. You can leave safely or try again; it is not shown as saved yet."
          : !result.ok && result.reason === "persistenceSuperseded"
            ? "A newer change replaced this note save request. This request did not mark the note as saved."
            : !result.ok && result.accepted && result.retryable
              ? "Note updated this session, but couldn’t be saved to local storage. Try again."
              : "This note could not be saved yet."
      );
      setNoteMessage(feedback.message);
    } catch {
      if (!isMountedRef.current) {
        return;
      }

      noteMutationAcceptedRef.current = false;
      noteRetryTokenRef.current = null;
      setNoteMutationAccepted(false);
      setNoteRetryToken(null);
      setNoteMessage(
        "Bloom couldn’t confirm that this note was saved to local storage."
      );
    } finally {
      noteSaveInFlightRef.current = false;

      if (isMountedRef.current) {
        setIsNoteSaving(false);
      }
    }
  };

  if (resolution.status === "unconfirmed") {
    return (
      <ArousalSaveUnconfirmed
        onReturn={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace(routes.arousalControl);
        }}
        onClose={() => router.replace(routes.exercises)}
      />
    );
  }

  if (displayLog === null) {
    return <AppScreen />;
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label={
          presentationMode === "completion"
            ? "PRACTICE SAVED"
            : "PRACTICE HISTORY"
        }
        icon={presentationMode === "completion" ? "✓" : "◷"}
        title={
          presentationMode === "completion"
            ? "You practiced noticing the rise."
            : "Practice history"
        }
        subtitle={
          presentationMode === "completion"
            ? "This session adds useful context to your awareness pattern."
            : "Review a practice previously saved on this device."
        }
        backDisabled={notePersistenceLocked}
        closeDisabled={notePersistenceLocked}
        busy={isNoteSaving}
        onBackPress={() => {
          if (!noteSaveInFlightRef.current) {
            router.replace(routes.exercises);
          }
        }}
        onClosePress={() => {
          if (!noteSaveInFlightRef.current) {
            router.replace(routes.exercises);
          }
        }}
      />

      <View style={styles.stack}>
        <AppCard
          testID="bloom.arousal.saved"
          style={
            presentationMode === "completion"
              ? styles.successCard
              : styles.summaryCard
          }
        >
          {presentationMode === "completion" ? (
            <View style={styles.successGlow} />
          ) : null}
          <View style={styles.successContent}>
            <View style={styles.successMark}>
              <AppText
                variant={
                  presentationMode === "completion" ? "title" : "caption"
                }
              >
                {presentationMode === "completion" ? "✓" : "History"}
              </AppText>
            </View>
            <View style={styles.successCopy}>
              <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
                {presentationMode === "completion"
                  ? "PRACTICE SAVED"
                  : "PRACTICE HISTORY"}
              </AppText>
              <AppText variant="title" align="center">
                {presentationMode === "completion"
                  ? "Practice saved"
                  : "Saved practice record"}
              </AppText>
              <AppText tone="secondary" align="center">
                {presentationMode === "completion"
                  ? "You practiced noticing your arousal level and learning your body’s response without judging the outcome."
                  : "This is an earlier completed practice from your local history."}
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
              <ContextRow label="Practice mode" value={sessionSummary.mode} />
              <View style={styles.contextDivider} />
              <ContextRow label="Focus" value={sessionSummary.focus} />
              <View style={styles.contextDivider} />
              <ContextRow label="Ending" value={sessionSummary.ending} />
            </View>

            <View style={styles.contextPanel}>
              <ContextRow label="Starting arousal" value={sessionSummary.startingArousal} />
              <View style={styles.contextDivider} />
              <ContextRow label="Pause zone" value={sessionSummary.pauseZone} />
              <View style={styles.contextDivider} />
              <ContextRow label="After pause" value={sessionSummary.afterPause} />
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
                onChangeText={(value) => {
                  setNote(value);
                  setNoteMessage(undefined);
                }}
                editable={!isNoteSaving && !noteMutationAccepted}
                placeholder="What do you want to remember about this practice?"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                textAlignVertical="top"
                maxLength={MAX_BLOOM_NOTE_LENGTH}
              />
              {noteMessage ? (
                <AppText
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  variant="bodySmall"
                  tone="secondary"
                >
                  {noteMessage}
                </AppText>
              ) : null}
              <AppButton
                variant="subtle"
                loading={isNoteSaving}
                disabled={noteMutationAccepted && noteRetryToken === null}
                onPress={() => void saveNote()}
              >
                {noteRetryToken === null ? "Save note" : "Try saving again"}
              </AppButton>
            </View>
          </AppCard>
        ) : null}

        <View style={styles.actions}>
          <AppButton
            disabled={notePersistenceLocked}
            onPress={() => router.replace(routes.home)}
          >
            Back to Today
          </AppButton>
          <AppButton
            variant="secondary"
            disabled={notePersistenceLocked}
            onPress={() => router.push(routes.arousalControlProgressPreview)}
          >
            View Progress
          </AppButton>
          {!noteVisible ? (
            <AppButton
              variant="subtle"
              disabled={notePersistenceLocked}
              onPress={() => setNoteVisible(true)}
            >
              Add private note
            </AppButton>
          ) : null}
          <AppButton
            variant="ghost"
            disabled={notePersistenceLocked}
            onPress={() => router.replace(routes.exercises)}
          >
            Back to Exercises
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

type ArousalSaveUnconfirmedProps = {
  onReturn: () => void;
  onClose: () => void;
};

function ArousalSaveUnconfirmed({
  onReturn,
  onClose
}: ArousalSaveUnconfirmedProps) {
  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="SAVE NOT CONFIRMED"
        icon="!"
        title="Practice save not confirmed"
        subtitle="Bloom could not match this screen to a practice saved in local storage."
        onBackPress={onReturn}
        onClosePress={onClose}
      />

      <View style={styles.stack}>
        <AppCard
          testID="bloom.arousal.saved-unconfirmed"
          accessibilityRole="alert"
        >
          <View style={styles.cardStack}>
            <AppText variant="title">
              This practice is not shown as saved
            </AppText>
            <AppText tone="secondary">
              Go back to retry if the save option is still available, or return
              safely to Exercises.
            </AppText>
          </View>
        </AppCard>

        <View style={styles.actions}>
          <AppButton onPress={onReturn}>Go back</AppButton>
          <AppButton variant="ghost" onPress={onClose}>
            Back to Exercises
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

function getSessionSummary(log: ArousalControlPracticeLog | null) {
  return {
    mode: formatMode(log?.mode),
    focus: formatFocus(log?.focus),
    ending: formatEnding(log?.endingChoice),
    startingArousal: formatScore(log?.startingArousalLevel),
    pauseZone: formatScore(log?.pauseZoneLevel),
    afterPause: formatScore(log?.afterPauseLevel),
    pauses: formatArousalPauseCount(
      log?.pauseCount,
      log?.pauseCountBucket
    ),
    highestArousal: formatScore(log?.highestArousal),
    controlFeeling: formatScore(log?.controlFeeling),
    pleasureQuality: formatScore(log?.pleasureQuality),
    pressure: formatOption(log?.pressureRushing),
    firmness: formatFirmness(log?.firmnessChange),
    duration: formatDuration(log)
  };
}

function getGentleInsight(log: ArousalControlPracticeLog | null) {
  if (log?.pauseZoneLevel !== undefined && log.pauseZoneLevel !== null) {
    return {
      body: `You chose to pause around ${log.pauseZoneLevel}/10. A pause can still be useful when the session ends differently than expected.`,
      footer: "Next time, the practice can be noticing the rise a little earlier."
    };
  }

  if (log?.highestArousal !== undefined && log.highestArousal !== null) {
    return {
      body: `You noticed a high point around ${log.highestArousal}/10. That context can help make the rise easier to recognize next time.`,
      footer: "One clearly noticed moment is enough for a useful practice."
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

function formatMode(value: ArousalControlPracticeLog["mode"]) {
  const labels = {
    softAwareness: "Soft Awareness",
    onePause: "One Pause Practice",
    practicePlus: "Practice+"
  } as const;

  return value !== undefined ? labels[value] : "Not logged";
}

function formatFocus(value: ArousalControlPracticeLog["focus"]) {
  const labels = {
    noticeRising: "Notice arousal rising",
    onePause: "Try one pause",
    reduceRushing: "Reduce rushing",
    stayRelaxed: "Stay more relaxed",
    withoutAdultContent: "Practice without adult content",
    justObserve: "Just observe"
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

function formatFirmness(value: ArousalControlPracticeLog["firmnessChange"]) {
  const labels = {
    noChange: "No change",
    slightlyDecreased: "Slightly decreased",
    decreasedCouldContinue: "Decreased, but I could continue",
    decreasedDifficult: "Decreased and continuing felt difficult",
    notSure: "Not sure"
  } as const;

  return value !== undefined ? labels[value] : "Not logged";
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
