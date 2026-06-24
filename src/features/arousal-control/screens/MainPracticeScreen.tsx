import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { ArousalLevelPicker } from "../components/ArousalLevelPicker";
import { PauseZoneCard } from "../components/PauseZoneCard";

type Guidance = {
  title: string;
  body: string;
  tone: "neutral" | "pause" | "high";
  action?: {
    label: string;
    messageTitle: string;
    messageBody: string;
  };
};

type PracticeMessage = {
  title: string;
  body: string;
};

function getGuidance(level: number): Guidance {
  if (level >= 9) {
    return {
      title: "This may be too close for pause practice.",
      body: "That’s okay. You can finish today and save what you noticed. The useful part is learning where the rise became harder to slow down.",
      tone: "high",
      action: {
        label: "Finish today",
        messageTitle: "Practice noted.",
        messageBody: "You can return to Exercises for now."
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
        messageTitle: "Slow down now.",
        messageBody: "Let your body settle and notice what changes."
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
        messageTitle: "Pause started.",
        messageBody: "Take 30 seconds to slow down and notice your body response."
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
  const [level, setLevel] = useState(5);
  const [practiceMessage, setPracticeMessage] = useState<PracticeMessage | undefined>();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [noteMessage, setNoteMessage] = useState<string | undefined>();
  const guidance = getGuidance(level);
  const guidanceAction = guidance.action;
  const isFinishOriented = level >= 9;

  const showPauseMessage = () => {
    setPracticeMessage({
      title: "Pause started.",
      body: "Take 30 seconds to slow down and notice your body response."
    });
  };

  const showFinishMessage = () => {
    setPracticeMessage({
      title: "Practice noted.",
      body: "You can return to Exercises for now."
    });
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PRACTICE"
        icon="∿"
        title="Notice where you are."
        subtitle="Choose the closest arousal level. The goal is noticing the rise earlier, not reaching a target."
        onBackPress={() => router.replace(routes.arousalControlCheckIn)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.practiceCard}>
          <View style={styles.cardStack}>
            <View style={styles.copy}>
              <AppText variant="title">Current arousal level</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Tap the closest number. You can adjust it anytime.
              </AppText>
            </View>
            <ArousalLevelPicker value={level} onChange={setLevel} />
          </View>
        </AppCard>

        <PauseZoneCard
          title={guidance.title}
          body={guidance.body}
          tone={guidance.tone}
          {...(guidanceAction !== undefined
            ? {
                actionLabel: guidanceAction.label,
                onActionPress: () =>
                  setPracticeMessage({
                    title: guidanceAction.messageTitle,
                    body: guidanceAction.messageBody
                  })
              }
            : {})}
        />

        {practiceMessage ? (
          <View style={styles.localMessage}>
            <AppText variant="title" align="center">
              {practiceMessage.title}
            </AppText>
            <AppText tone="secondary" align="center">
              {practiceMessage.body}
            </AppText>
          </View>
        ) : null}

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
              />
              {noteMessage ? (
                <AppText variant="bodySmall" tone="secondary">
                  {noteMessage}
                </AppText>
              ) : null}
              <AppButton
                variant="subtle"
                onPress={() =>
                  setNoteMessage(
                    note.trim().length > 0
                      ? "Note saved for this practice."
                      : "Nothing added. You can keep practicing without a note."
                  )
                }
              >
                Save note
              </AppButton>
            </View>
          </AppCard>
        ) : null}

        <View style={styles.actions}>
          {isFinishOriented ? (
            <>
              <AppButton onPress={showFinishMessage}>Finish today</AppButton>
              <AppButton variant="secondary" onPress={() => setShowNote(true)}>
                Add Quick Note
              </AppButton>
            </>
          ) : (
            <>
              <AppButton onPress={showPauseMessage}>Start Pause</AppButton>
              <AppButton variant="secondary" onPress={showFinishMessage}>
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
  localMessage: {
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.md
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
