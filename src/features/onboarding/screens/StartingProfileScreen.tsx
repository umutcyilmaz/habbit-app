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
import type { OnboardingSupportStyle, TriggerId } from "../types";

const triggerLabels: Record<TriggerId, string> = {
  boredom: "boredom",
  nighttime: "nighttime",
  socialMedia: "social media",
  emptyTime: "empty time",
  stress: "stress",
  desire: "desire",
  notSure: "unclear moments"
};

const supportProfiles: Record<OnboardingSupportStyle, { title: string; copy: string }> = {
  gentle: {
    title: "Gentle Support Style",
    copy: "A gentle style offers a short pause and light reflection while keeping the next step fully optional."
  },
  balanced: {
    title: "Balanced Support Style",
    copy: "A balanced style adds a short pause and suggests a support tool while keeping you in control."
  },
  strong: {
    title: "Strong Support Style",
    copy: "A strong style makes the pause more visible and suggests a support tool while keeping you in control."
  }
};

function formatTriggerSummary(triggers: TriggerId[]) {
  if (triggers.length === 0) {
    return "boredom, evening time, or social media";
  }

  const labels = triggers.slice(0, 3).map((trigger) => triggerLabels[trigger]);

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

export function StartingProfileScreen() {
  const router = useRouter();
  const { draft, setCurrentStep } = useOnboarding();

  useEffect(() => {
    setCurrentStep("startingProfile");
  }, [setCurrentStep]);
  const supportProfile = supportProfiles[draft.supportStyle];
  const triggerSummary = formatTriggerSummary(draft.triggers);

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader
        title="Your starting profile"
        subtitle="This is a starting point, not a label. You can change it anytime."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardContent}>
            <AppText variant="title">Automatic Content Loop</AppText>
            <AppText tone="secondary">
              Your answers suggest that automatic habits may show up around {triggerSummary}. Your first plan
              will help you create a short pause before the loop continues.
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardContent}>
            <AppText variant="title">{supportProfile.title}</AppText>
            <AppText tone="secondary">{supportProfile.copy}</AppText>
          </View>
        </AppCard>

        <View style={styles.actions}>
          <AppButton onPress={() => router.push("/onboarding/starting-plan")}>View My Plan</AppButton>
          <AppButton variant="secondary" onPress={() => router.push("/onboarding/starting-point")}>
            Edit Answers
          </AppButton>
        </View>
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
  },
  actions: {
    gap: theme.spacing.md
  }
});
