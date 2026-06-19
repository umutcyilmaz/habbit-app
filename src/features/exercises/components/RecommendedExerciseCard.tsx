import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { RecommendedExercise } from "../types";
import { ExerciseDurationBadge } from "./ExerciseDurationBadge";

type RecommendedExerciseCardProps = {
  recommendation: RecommendedExercise;
  onStart: () => void;
};

export function RecommendedExerciseCard({
  recommendation,
  onStart
}: RecommendedExerciseCardProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="caption" tone="secondary">
            {recommendation.title}
          </AppText>
          <AppText variant="title">{recommendation.exercise.title}</AppText>
          <AppText tone="secondary">{recommendation.reason}</AppText>
          <ExerciseDurationBadge duration={recommendation.exercise.duration} />
        </View>

        {showHelp ? (
          <View style={styles.helpBox}>
            <AppText variant="bodySmall" tone="secondary">
              {recommendation.helpCopy}
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton onPress={onStart}>{recommendation.primaryCta}</AppButton>
          <AppButton variant="secondary" onPress={() => setShowHelp((current) => !current)}>
            {recommendation.secondaryCta}
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  },
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  helpBox: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  }
});
