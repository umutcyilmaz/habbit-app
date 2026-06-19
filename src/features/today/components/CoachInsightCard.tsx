import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { CoachInsight } from "../types";

type CoachInsightCardProps = {
  insight: CoachInsight;
  onPress: () => void;
};

export function CoachInsightCard({ insight, onPress }: CoachInsightCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">{insight.title}</AppText>
          <AppText tone="secondary">{insight.copy}</AppText>
        </View>
        <AppButton variant="secondary" onPress={onPress}>
          {insight.ctaLabel}
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});
