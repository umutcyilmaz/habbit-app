import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

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
  const [ending, setEnding] = useState<PracticeEndingOption>("stoppedByChoice");
  const [endingConfirmed, setEndingConfirmed] = useState(false);

  const selectEnding = (value: PracticeEndingOption) => {
    setEnding(value);
    setEndingConfirmed(false);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="FINISH PRACTICE"
        icon="✓"
        title="Any ending is okay."
        subtitle="This log is for learning your pattern, not judging it."
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.exercises)}
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
                onSelect={selectEnding}
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

        {endingConfirmed ? (
          <View style={styles.confirmation}>
            <View style={styles.noteCopy}>
              <AppText variant="title" align="center">
                Ending noted.
              </AppText>
              <AppText tone="secondary" align="center">
                You can return to Exercises when ready.
              </AppText>
            </View>
            <AppButton onPress={() => router.replace(routes.exercises)}>Back to Exercises</AppButton>
          </View>
        ) : (
          <AppButton onPress={() => setEndingConfirmed(true)}>Continue</AppButton>
        )}
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
  confirmation: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  noteCopy: {
    gap: theme.spacing.sm
  }
});
