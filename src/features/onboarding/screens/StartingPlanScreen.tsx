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

const recommendedTools = [
  "Quick Check-In",
  "90-Second Pause",
  "Basic Log",
  "Private Reflection",
  "Optional Evening Support"
];

const rhythmItems = ["3 check-ins", "2 pause practices", "1 private reflection"];

const learningItems = ["common triggers", "sensitive windows", "helpful tools", "rushing patterns"];

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <AppCard>
      <View style={styles.cardContent}>
        <AppText variant="title">{title}</AppText>
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item} style={styles.listItem}>
              <View style={styles.dot} />
              <AppText>{item}</AppText>
            </View>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

export function StartingPlanScreen() {
  const router = useRouter();
  const { draft, setCurrentStep } = useOnboarding();

  useEffect(() => {
    setCurrentStep("startingPlan");
  }, [setCurrentStep]);

  const goToToday = () => {
    // TODO: Persist onboarding completion and draft answers before routing to Today.
    router.replace("/(tabs)/today");
  };

  return (
    <AppScreen>
      <OnboardingProgress currentStepId={draft.currentStepId} />
      <OnboardingStepHeader title="Your starting plan" subtitle="A gentle plan for your first week." />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardContent}>
            <AppText variant="title">Build your awareness baseline.</AppText>
            <AppText tone="secondary">
              Start with small moments that help you notice patterns before changing anything big.
            </AppText>
          </View>
        </AppCard>

        <ListCard title="Recommended tools" items={recommendedTools} />
        <ListCard title="Suggested rhythm" items={rhythmItems} />
        <ListCard title="What the app will learn" items={learningItems} />

        <View style={styles.actions}>
          <AppButton onPress={goToToday}>Go to Today</AppButton>
          <AppButton variant="secondary" onPress={goToToday}>
            Customize later
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
    gap: theme.spacing.md
  },
  list: {
    gap: theme.spacing.md
  },
  listItem: {
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
