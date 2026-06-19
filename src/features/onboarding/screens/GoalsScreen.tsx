import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { OnboardingProgress } from "../components/OnboardingProgress";
import { OnboardingStepHeader } from "../components/OnboardingStepHeader";
import { SelectableChip } from "../components/SelectableChip";
import { useOnboarding } from "../OnboardingContext";
import type { OnboardingGoalId } from "../types";

const goalOptions: Array<{ id: OnboardingGoalId; label: string }> = [
  { id: "pauseBeforeAutomaticHabits", label: "Pause before automatic habits" },
  { id: "reduceAdultContentLoops", label: "Reduce adult-content loops" },
  { id: "masturbateMoreMindfully", label: "Masturbate more mindfully" },
  { id: "reduceRushing", label: "Reduce rushing" },
  { id: "understandTriggers", label: "Understand triggers" },
  { id: "improveArousalAwareness", label: "Improve arousal awareness" },
  { id: "buildCalmerRoutine", label: "Build a calmer routine" },
  { id: "notSureYet", label: "Not sure yet" }
];

export function GoalsScreen() {
  const router = useRouter();
  const { draft, setCurrentStep, toggleGoal } = useOnboarding();

  useEffect(() => {
    setCurrentStep("goals");
  }, [setCurrentStep]);

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader title="Your goals" subtitle="What would you like support with?" />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.chipWrap}>
            {goalOptions.map((goal) => (
              <SelectableChip
                key={goal.id}
                label={goal.label}
                value={goal.id}
                selected={draft.selectedGoals.includes(goal.id)}
                onToggle={toggleGoal}
              />
            ))}
          </View>
        </AppCard>

        <AppText variant="bodySmall" tone="secondary">
          You can update your goals anytime.
        </AppText>

        <AppButton onPress={() => router.push("/onboarding/starting-point")}>Continue</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  }
});
