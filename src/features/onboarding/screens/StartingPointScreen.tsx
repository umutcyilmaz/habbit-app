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
import { OptionCard } from "../components/OptionCard";
import { SelectableChip } from "../components/SelectableChip";
import { useOnboarding } from "../OnboardingContext";
import type { FamiliarPatternId, OnboardingSupportStyle, TriggerId } from "../types";

const familiarOptions: Array<{ id: FamiliarPatternId; label: string }> = [
  { id: "automaticWhenBored", label: "I open content automatically when bored." },
  { id: "rushWithoutSignals", label: "I rush without noticing early signals." },
  { id: "understandPatterns", label: "I want to understand my patterns." },
  { id: "notSureYet", label: "I am not sure yet." }
];

const triggerOptions: Array<{ id: TriggerId; label: string }> = [
  { id: "boredom", label: "Boredom" },
  { id: "nighttime", label: "Nighttime" },
  { id: "socialMedia", label: "Social media" },
  { id: "emptyTime", label: "Empty time" },
  { id: "stress", label: "Stress" },
  { id: "desire", label: "Desire" },
  { id: "notSure", label: "Not sure" }
];

const supportOptions: Array<{ id: OnboardingSupportStyle; label: string }> = [
  { id: "gentle", label: "Gentle" },
  { id: "balanced", label: "Balanced" },
  { id: "strong", label: "Strong" }
];

export function StartingPointScreen() {
  const router = useRouter();
  const {
    draft,
    setCurrentStep,
    setFamiliarPattern,
    setSupportStyle,
    toggleTrigger
  } = useOnboarding();

  useEffect(() => {
    setCurrentStep("startingPoint");
  }, [setCurrentStep]);

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader title="Starting point" />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.section}>
            <AppText variant="title">Which feels most familiar?</AppText>
            <View style={styles.options}>
              {familiarOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  label={option.label}
                  value={option.id}
                  selected={draft.familiarPattern === option.id}
                  onSelect={setFamiliarPattern}
                />
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.section}>
            <AppText variant="title">What usually comes before an automatic loop?</AppText>
            <View style={styles.chipWrap}>
              {triggerOptions.map((trigger) => (
                <SelectableChip
                  key={trigger.id}
                  label={trigger.label}
                  value={trigger.id}
                  selected={draft.triggers.includes(trigger.id)}
                  onToggle={toggleTrigger}
                />
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.section}>
            <AppText variant="title">What kind of support feels right?</AppText>
            <View style={styles.options}>
              {supportOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  label={option.label}
                  value={option.id}
                  selected={draft.supportStyle === option.id}
                  onSelect={setSupportStyle}
                />
              ))}
            </View>
          </View>
        </AppCard>

        <AppButton onPress={() => router.push("/onboarding/starting-profile")}>Continue</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  section: {
    gap: theme.spacing.lg
  },
  options: {
    gap: theme.spacing.sm
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  }
});
