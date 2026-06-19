import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { TodayRecommendation } from "../types";

type TodayRecommendationCardProps = {
  recommendation: TodayRecommendation;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

export function TodayRecommendationCard({
  recommendation,
  onPrimaryPress,
  onSecondaryPress
}: TodayRecommendationCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <AppText variant="caption" tone="secondary">
            Today’s recommendation
          </AppText>
        </View>

        <View style={styles.copyStack}>
          <AppText variant="title">{recommendation.goal}</AppText>
          <AppText tone="secondary">{recommendation.reason}</AppText>
        </View>

        <View style={styles.toolRow}>
          <AppText variant="caption" tone="secondary">
            Recommended tool
          </AppText>
          <AppText variant="label">{recommendation.recommendedTool}</AppText>
        </View>

        <View style={styles.actions}>
          <AppButton onPress={onPrimaryPress}>{recommendation.primaryCta}</AppButton>
          <AppButton variant="secondary" onPress={onSecondaryPress}>
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
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  copyStack: {
    gap: theme.spacing.sm
  },
  toolRow: {
    gap: theme.spacing.xs
  },
  actions: {
    gap: theme.spacing.md
  }
});
