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
import { useOnboarding } from "../OnboardingContext";

const trustCards = [
  {
    title: "Private by design",
    copy: "Your reflections are designed to stay private and under your control."
  },
  {
    title: "You choose what to answer",
    copy: "Sensitive questions can be skipped anytime."
  },
  {
    title: "No judgment scores",
    copy: "The app looks for patterns, not failure."
  },
  {
    title: "Not medical care",
    copy: "This app cannot diagnose or treat medical or psychological conditions."
  }
];

export function PrivacyTrustScreen() {
  const router = useRouter();
  const { draft, setCurrentStep } = useOnboarding();

  useEffect(() => {
    setCurrentStep("privacyTrust");
  }, [setCurrentStep]);

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader title="Your reflections belong to you." />

      <View style={styles.stack}>
        {trustCards.map((card) => (
          <AppCard key={card.title}>
            <View style={styles.cardContent}>
              <AppText variant="title">{card.title}</AppText>
              <AppText tone="secondary">{card.copy}</AppText>
            </View>
          </AppCard>
        ))}

        <AppButton onPress={() => router.push("/onboarding/goals")}>Continue</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardContent: {
    gap: theme.spacing.sm
  }
});
