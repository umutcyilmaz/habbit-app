import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { ArousalLevelPicker } from "../components/ArousalLevelPicker";
import { PracticeQuestionCard } from "../components/PracticeQuestionCard";
import { PracticeSelectableCard } from "../components/PracticeSelectableCard";

type FirmnessChangeOption =
  | "noChange"
  | "slightlyDecreased"
  | "decreasedCouldContinue"
  | "decreasedDifficult"
  | "notSure";

type NextStepOption = "continueGently" | "pauseMore" | "finishToday";

const firmnessOptions: readonly { value: FirmnessChangeOption; title: string }[] = [
  { value: "noChange", title: "No change" },
  { value: "slightlyDecreased", title: "Slightly decreased" },
  { value: "decreasedCouldContinue", title: "Decreased, but I could continue" },
  { value: "decreasedDifficult", title: "Decreased and continuing felt difficult" },
  { value: "notSure", title: "Not sure" }
];

const nextStepOptions: readonly { value: NextStepOption; title: string }[] = [
  { value: "continueGently", title: "Continue gently" },
  { value: "pauseMore", title: "Pause 30 seconds more" },
  { value: "finishToday", title: "Finish today’s practice" }
];

export function AfterPauseCheckInScreen() {
  const router = useRouter();
  const { updateArousalControlDraft, incrementArousalControlPauseCount } = useBloomLocalState();
  const [arousalNow, setArousalNow] = useState(5);
  const [firmnessChange, setFirmnessChange] = useState<FirmnessChangeOption>("notSure");
  const [anxiety, setAnxiety] = useState(3);
  const [nextStep, setNextStep] = useState<NextStepOption>("continueGently");
  const showSupportNote = firmnessChange === "decreasedDifficult" || anxiety >= 7;

  const continueFromSelection = () => {
    updateArousalControlDraft({
      afterPauseArousal: arousalNow,
      anxietyLevel: anxiety,
      afterPauseNextStep: nextStep,
      firmnessChange
    });

    if (nextStep === "continueGently") {
      router.replace(routes.arousalControlPractice);
      return;
    }

    if (nextStep === "pauseMore") {
      incrementArousalControlPauseCount();
      router.replace(routes.arousalControlPause);
      return;
    }

    router.push(routes.arousalControlFinish);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="AFTER PAUSE"
        icon="✓"
        title="What changed?"
        subtitle="Notice what is here now. There is no right answer."
        onBackPress={() => router.replace(routes.arousalControlPause)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <PracticeQuestionCard title="Arousal now" body="0 = calm · 10 = very close to climax">
          <ArousalLevelPicker value={arousalNow} onChange={setArousalNow} />
        </PracticeQuestionCard>

        <PracticeQuestionCard title="Did firmness change during the pause?">
          <View style={styles.optionStack}>
            {firmnessOptions.map((option) => (
              <PracticeSelectableCard
                key={option.value}
                value={option.value}
                title={option.title}
                selected={firmnessChange === option.value}
                onSelect={setFirmnessChange}
              />
            ))}
          </View>
        </PracticeQuestionCard>

        <PracticeQuestionCard title="How anxious did that feel?" body="0 = not anxious · 10 = very anxious">
          <ArousalLevelPicker
            value={anxiety}
            onChange={setAnxiety}
            minLabel="0 = not anxious"
            maxLabel="10 = very anxious"
            groups={[]}
          />
        </PracticeQuestionCard>

        {showSupportNote ? (
          <View style={styles.supportNote}>
            <View style={styles.noteCopy}>
              <AppText variant="title" align="center">
                Finishing here is okay.
              </AppText>
              <AppText tone="secondary" align="center">
                Today’s practice still gave you useful information about your body response.
              </AppText>
            </View>
          </View>
        ) : null}

        <PracticeQuestionCard title="What would feel right now?">
          <View style={styles.optionStack}>
            {nextStepOptions.map((option) => (
              <PracticeSelectableCard
                key={option.value}
                value={option.value}
                title={option.title}
                selected={nextStep === option.value}
                onSelect={setNextStep}
              />
            ))}
          </View>
        </PracticeQuestionCard>

        <AppButton onPress={continueFromSelection}>Continue</AppButton>
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
  optionStack: {
    gap: theme.spacing.sm
  },
  supportNote: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.peach,
    borderWidth: 1,
    backgroundColor: theme.colors.peachMuted,
    padding: theme.spacing.lg
  },
  noteCopy: {
    gap: theme.spacing.sm
  }
});
