import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { PracticeQuestionCard } from "../components/PracticeQuestionCard";
import { PracticeSelectableCard } from "../components/PracticeSelectableCard";

type PracticeEndingOption =
  | "finishedBeforeClimax"
  | "climaxed"
  | "firmnessDecreased"
  | "feltAnxious"
  | "stoppedByChoice"
  | "other";

const endingOptions: readonly { value: PracticeEndingOption; title: string }[] = [
  { value: "finishedBeforeClimax", title: "I finished before climax" },
  { value: "climaxed", title: "I climaxed" },
  { value: "firmnessDecreased", title: "I stopped because firmness decreased" },
  { value: "feltAnxious", title: "I stopped because I felt anxious" },
  { value: "stoppedByChoice", title: "I stopped by choice" },
  { value: "other", title: "Other" }
];

export function FinishPracticeScreen() {
  const router = useRouter();
  const { state, updateArousalSession, discardArousalSession } =
    useBloomLocalState();
  const draft = state.arousalControl.draft;
  const [ending, setEnding] = useState<PracticeEndingOption>(
    draft?.endingChoice ?? "stoppedByChoice"
  );

  useEffect(() => {
    if (draft === null) {
      router.replace(routes.arousalControl);
    }
  }, [draft, router]);

  const continueToReflection = () => {
    if (draft === null) {
      return;
    }

    updateArousalSession(draft.id, { endingChoice: ending });
    router.push(routes.arousalControlReflection);
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
        label="FINISH PRACTICE"
        icon="✓"
        title="Any ending is okay."
        subtitle="This log is for learning your pattern, not judging it."
        onBackPress={() => router.back()}
        onClosePress={closePractice}
      />

      <View style={styles.stack}>
        <PracticeQuestionCard title="How did the practice end?">
          <View style={styles.optionStack}>
            {endingOptions.map((option) => (
              <PracticeSelectableCard
                key={option.value}
                value={option.value}
                title={option.title}
                selected={ending === option.value}
                onSelect={setEnding}
              />
            ))}
          </View>
        </PracticeQuestionCard>

        <View style={styles.supportNote}>
          <View style={styles.noteCopy}>
            <AppText variant="title" align="center">
              This still counts as practice.
            </AppText>
            <AppText tone="secondary" align="center">
              Stopping, continuing, or finishing can all give useful information about your body
              response.
            </AppText>
          </View>
        </View>

        <AppButton onPress={continueToReflection}>Continue</AppButton>
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
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
  },
  noteCopy: {
    gap: theme.spacing.sm
  }
});
