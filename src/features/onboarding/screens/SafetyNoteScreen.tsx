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

const checklistItems = [
  "I confirm I am an adult.",
  "I understand this app is not medical care.",
  "I want to use this app for personal reflection and habit awareness."
];

export function SafetyNoteScreen() {
  const router = useRouter();
  const { draft, setCurrentStep } = useOnboarding();

  useEffect(() => {
    setCurrentStep("safetyNote");
  }, [setCurrentStep]);

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader title="Before we begin" />

      <View style={styles.stack}>
        <AppText tone="secondary">
          This app is for adults using it for personal wellness. It may include questions about adult
          content, masturbation, arousal, and body response. You can skip sensitive questions anytime.
        </AppText>

        <AppCard>
          <View style={styles.list}>
            {checklistItems.map((item) => (
              <View key={item} style={styles.row}>
                <View style={styles.dot} />
                <AppText style={styles.rowText}>{item}</AppText>
              </View>
            ))}
          </View>
        </AppCard>

        <AppButton onPress={() => router.push("/onboarding/privacy-trust")}>I Understand</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  list: {
    gap: theme.spacing.lg
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  rowText: {
    flex: 1
  },
  dot: {
    width: 10,
    height: 10,
    marginTop: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  }
});
