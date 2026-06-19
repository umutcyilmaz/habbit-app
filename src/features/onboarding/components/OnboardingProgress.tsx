import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { OnboardingStepId } from "../types";

const stepOrder: OnboardingStepId[] = [
  "welcome",
  "safetyNote",
  "privacyTrust",
  "goals",
  "startingPoint",
  "startingProfile",
  "startingPlan"
];

type OnboardingProgressProps = {
  currentStepId: OnboardingStepId;
};

export function OnboardingProgress({ currentStepId }: OnboardingProgressProps) {
  const currentIndex = stepOrder.indexOf(currentStepId);
  const progressText = `Step ${currentIndex + 1} of ${stepOrder.length}`;

  return (
    <View style={styles.container} accessibilityLabel={progressText}>
      <View style={styles.track}>
        {stepOrder.map((stepId, index) => (
          <View
            key={stepId}
            style={[styles.segment, index <= currentIndex ? styles.segmentActive : undefined]}
          />
        ))}
      </View>
      <AppText variant="caption" tone="secondary">
        {progressText}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl
  },
  track: {
    flexDirection: "row",
    gap: theme.spacing.xs
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted
  },
  segmentActive: {
    backgroundColor: theme.colors.primary
  }
});
