import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { GentleInsight } from "../types";

type GentleInsightCardProps = {
  insight: GentleInsight;
};

export function GentleInsightCard({ insight }: GentleInsightCardProps) {
  const cardStyle = insight.tone === "sensitive" ? styles.sensitive : styles.neutral;

  return (
    <AppCard style={cardStyle}>
      <View style={styles.content}>
        <AppText variant="caption" tone="secondary">
          {formatCategory(insight.category)}
        </AppText>
        <AppText variant="title">{insight.title}</AppText>
        <AppText tone="secondary">{insight.copy}</AppText>
      </View>
    </AppCard>
  );
}

function formatCategory(category: GentleInsight["category"]) {
  switch (category) {
    case "sensitiveWindow":
      return "Sensitive window";
    case "trigger":
      return "Trigger";
    case "helpfulTool":
      return "Helpful tool";
    case "rushingPattern":
      return "Rushing pattern";
  }
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.sm
  },
  neutral: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  sensitive: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  }
});
