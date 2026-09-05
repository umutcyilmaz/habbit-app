import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";

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
  prepareBloomNoteSubmission
} from "../../../storage/bloomState";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { ArousalLevelPicker } from "../components/ArousalLevelPicker";
import { PauseZoneCard } from "../components/PauseZoneCard";

type Guidance = {
  title: string;
  body: string;
  tone: "neutral" | "pause" | "high";
  action?: {
    label: string;
    type: "pause" | "finish";
  };
};

function getGuidance(level: number): Guidance {
  if (level >= 9) {
    return {
      title: "This may be too close for pause practice.",
      body: "That’s okay. You can finish today and save what you noticed. The useful part is learning where the rise became harder to slow down.",
      tone: "high",
      action: {
        label: "Finish today",
        type: "finish"
      }
    };
  }

  if (level === 8) {
    return {
      title: "This is already very high.",
      body: "If you can, stop stimulation and let your body settle. Next time, try noticing the rise a little earlier.",
      tone: "high",
      action: {
        label: "Slow down now",
        type: "pause"
      }
    };
  }

  if (level >= 6) {
    return {
      title: "You may be entering your pause zone.",
      body: "This can be a good time to slow down and take a short pause.",
      tone: "pause",
      action: {
        label: "Take a 30-second pause",
        type: "pause"
      }
    };
  }

  return {
    title: "Keep noticing.",
    body: "You can pause whenever you want.",
    tone: "neutral"
  };
}

export function MainPracticeScreen() {
  const router = useRouter();
  const {
    state,
    updateArousalSession,
    updateArousalSessionAndPersist,
    retryPersistedMutation,
    discardArousalSession
  } = useBloomLocalState();
  const draft = state.arousalControl.draft;
  const [level, setLevel] = useState(
    draft?.currentArousalLevel ?? draft?.startingArousalLevel ?? 5
  );
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(draft?.note ?? "");
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
  usePersistenceNavigationGuard(isNoteSaving);
  const guidance = getGuidance(level);
  const guidanceAction = guidance.action;
  const isFinishOriented = level >= 9;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (draft === null) {
      router.replace(routes.arousalControl);
    }
  }, [draft, router]);

  const updateCurrentLevel = (isPause: boolean) => {
    if (draft === null) {
      return;
    }

    updateArousalSession(draft.id, {
      currentArousalLevel: level,
      startingArousalLevel:
        draft.startingArousalLevel ?? level,
      highestArousal: Math.max(draft.highestArousal ?? level, level),
      ...(isPause
        ? {
            pauseZoneLevel: level,
            pauseCount: (draft.pauseCount ?? 0) + 1
          }
        : {})
    });
  };

  const startPause = () => {
    if (noteSaveInFlightRef.current) {
      return;
    }

    updateCurrentLevel(true);
    router.push(routes.arousalControlPause);
  };

  const finishPractice = () => {
    if (noteSaveInFlightRef.current) {
      return;
    }

    updateCurrentLevel(false);
    router.push(routes.arousalControlFinish);
  };

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

      if (draft === null || noteResult.note === null) {
        setNoteMessage(
          "Nothing added. You can keep practicing without a note."
        );
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
          : draft !== null && preparedNote !== null
            ? await updateArousalSessionAndPersist(draft.id, {
                note: preparedNote,
                currentArousalLevel: level,
                startingArousalLevel:
                  draft.startingArousalLevel ?? level,
                highestArousal: Math.max(
                  draft.highestArousal ?? level,
                  level
                )
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
        "Note saved for this practice.",
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

  const closePractice = () => {
    if (noteSaveInFlightRef.current) {
      return;
    }

    if (draft !== null) {
      discardArousalSession(draft.id);
    }

    router.replace(routes.exercises);
  };

  if (draft === null) {
    return <AppScreen />;
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PRACTICE"
        icon="∿"
        title="Notice where you are."
        subtitle="Choose the closest arousal level. The goal is noticing the rise earlier, not reaching a target."
        backDisabled={isNoteSaving}
        closeDisabled={isNoteSaving}
        busy={isNoteSaving}
        onBackPress={() => router.replace(routes.arousalControlCheckIn)}
        onClosePress={closePractice}
      />

      <View style={styles.stack}>
        <AppCard testID="bloom.arousal.practice" style={styles.practiceCard}>
          <View
            testID="bloom.arousal.practice.mode"
            style={styles.cardStack}
          >
            <View style={styles.copy}>
              <AppText variant="title">Current arousal level</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Tap the closest number. You can adjust it anytime.
              </AppText>
            </View>
            <ArousalLevelPicker
              value={level}
              disabled={notePersistenceLocked}
              onChange={setLevel}
              testIDPrefix="bloom.arousal.practice.level"
            />
          </View>
        </AppCard>

        <PauseZoneCard
          title={guidance.title}
          body={guidance.body}
          tone={guidance.tone}
          disabled={notePersistenceLocked}
          {...(guidanceAction !== undefined
            ? {
                actionLabel: guidanceAction.label,
                onActionPress:
                  guidanceAction.type === "pause" ? startPause : finishPractice
              }
            : {})}
        />

        {showNote ? (
          <AppCard style={styles.noteCard}>
            <View style={styles.cardStack}>
              <View style={styles.copy}>
                <AppText variant="title">Quick note</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  A few words for reflection, only if useful.
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
                placeholder="What do you want to remember about this moment?"
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
          {isFinishOriented ? (
            <>
              <AppButton disabled={notePersistenceLocked} onPress={finishPractice}>
                Finish today
              </AppButton>
              <AppButton
                variant="secondary"
                disabled={notePersistenceLocked}
                onPress={() => setShowNote(true)}
              >
                Add Quick Note
              </AppButton>
            </>
          ) : (
            <>
              <AppButton
                testID="bloom.arousal.practice.pause"
                disabled={notePersistenceLocked}
                onPress={startPause}
              >
                Start Pause
              </AppButton>
              <AppButton
                variant="secondary"
                disabled={notePersistenceLocked}
                onPress={finishPractice}
              >
                Finish Practice
              </AppButton>
              <AppButton
                variant="ghost"
                disabled={notePersistenceLocked}
                onPress={() => setShowNote(true)}
              >
                Add Quick Note
              </AppButton>
            </>
          )}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  practiceCard: {
    borderRadius: 26,
    padding: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  noteCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  input: {
    minHeight: 96,
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
