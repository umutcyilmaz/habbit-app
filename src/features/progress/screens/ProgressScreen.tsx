import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import {
  selectGentleInsights,
  selectProgressSummary
} from "../../../domain/demo/demoSelectors";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function ProgressScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const summary = selectProgressSummary(state);
  const insights = selectGentleInsights(state);

  return (
    <AppScreen>
      <AppHeader
        title="Progress"
        subtitle="Gentle observations from the shared demo state."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <View style={styles.metricGrid}>
          {summary.metrics.map((metric) => (
            <AppCard key={metric.label}>
              <View style={styles.metricCard}>
                <AppText variant="caption" tone="secondary">
                  {metric.label}
                </AppText>
                <AppText variant="heading">{metric.value}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {metric.detail}
                </AppText>
              </View>
            </AppCard>
          ))}
        </View>

        <AppCard style={styles.insightCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Gentle observations</AppText>
            {insights.map((insight) => (
              <View key={insight} style={styles.listItem}>
                <View style={styles.dot} />
                <AppText tone="secondary">{insight}</AppText>
              </View>
            ))}
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Helpful tools</AppText>
            {summary.helpfulTools.map((tool) => (
              <AppText key={tool} tone="secondary">
                {tool}
              </AppText>
            ))}
            <AppButton variant="secondary" onPress={() => router.push(routes.pause)}>
              Start a pause
            </AppButton>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  metricGrid: {
    gap: theme.spacing.md
  },
  metricCard: {
    gap: theme.spacing.sm
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  insightCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
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
  }
});
