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

const notes = ["Private by design", "No shame", "No scoring"];

export function WelcomeScreen() {
  const router = useRouter();
  const { draft, setCurrentStep } = useOnboarding();

  useEffect(() => {
    setCurrentStep("welcome");
  }, [setCurrentStep]);

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader
        title="Build awareness before automatic habits."
        subtitle="A private space for pauses, reflection, and more intentional routines."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.noteList}>
            {notes.map((note) => (
              <View key={note} style={styles.noteRow}>
                <View style={styles.dot} />
                <AppText>{note}</AppText>
              </View>
            ))}
          </View>
        </AppCard>

        <View style={styles.actions}>
          <AppButton onPress={() => router.push("/onboarding/safety-note")}>Get Started</AppButton>
          {/* TODO: Connect this to account recovery or future auth only if the product adds accounts. */}
          <AppButton variant="ghost" disabled>
            I already have an account
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  noteList: {
    gap: theme.spacing.md
  },
  noteRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  actions: {
    gap: theme.spacing.md
  }
});
