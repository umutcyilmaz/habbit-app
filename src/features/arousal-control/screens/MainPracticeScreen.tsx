import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
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
  const { state, updateArousalSession, discardArousalSession } =
    useBloomLocalState();
  const draft = state.arousalControl.draft;
  const [level, setLevel] = useState(
    draft?.currentArousalLevel ?? draft?.startingArousalLevel ?? 5
  );
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(draft?.note ?? "");
  const [noteMessage, setNoteMessage] = useState<string | undefined>();
  const guidance = getGuidance(level);
  const guidanceAction = guidance.action;
  const isFinishOriented = level >= 9;

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
    updateCurrentLevel(true);
    router.push(routes.arousalControlPause);
  };

  const finishPractice = () => {
    updateCurrentLevel(false);
    router.push(routes.arousalControlFinish);
  };

  const saveNote = () => {
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

    const result = updateArousalSession(draft.id, {
      note: noteResult.note,
      currentArousalLevel: level,
      startingArousalLevel: draft.startingArousalLevel ?? level,
      highestArousal: Math.max(draft.highestArousal ?? level, level)
    });
    const feedback = resolveBloomMutationFeedback(
      result,
      "Note saved for this practice.",
      "This note could not be saved yet."
    );
    setNoteMessage(feedback.message);
  };

  const closePractice = () => {
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
              onChange={setLevel}
              testIDPrefix="bloom.arousal.practice.level"
            />
          </View>
        </AppCard>

        <PauseZoneCard
          title={guidance.title}
          body={guidance.body}
          tone={guidance.tone}
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
                onChangeText={setNote}
                placeholder="What do you want to remember about this moment?"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                textAlignVertical="top"
                maxLength={MAX_BLOOM_NOTE_LENGTH}
              />
              {noteMessage ? (
                <AppText variant="bodySmall" tone="secondary">
                  {noteMessage}
                </AppText>
              ) : null}
              <AppButton
                variant="subtle"
                onPress={saveNote}
              >
                Save note
              </AppButton>
            </View>
          </AppCard>
        ) : null}

        <View style={styles.actions}>
          {isFinishOriented ? (
            <>
              <AppButton onPress={finishPractice}>Finish today</AppButton>
              <AppButton variant="secondary" onPress={() => setShowNote(true)}>
                Add Quick Note
              </AppButton>
            </>
          ) : (
            <>
              <AppButton
                testID="bloom.arousal.practice.pause"
                onPress={startPause}
              >
                Start Pause
              </AppButton>
              <AppButton variant="secondary" onPress={finishPractice}>
                Finish Practice
              </AppButton>
              <AppButton variant="ghost" onPress={() => setShowNote(true)}>
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
