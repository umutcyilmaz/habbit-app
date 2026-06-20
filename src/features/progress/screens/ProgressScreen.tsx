import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import {
  selectGentleInsights,
  selectHasLowProgressData,
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
  const metrics = selectProgressSummary(state);
  const insights = selectGentleInsights(state);
  const hasLowProgressData = selectHasLowProgressData(state);

  return (
    <AppScreen>
      <AppHeader
        title="Progress"
        subtitle="Gentle observations from recent activity."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        {metrics.map((metric) => (
          <AppCard key={metric.label}>
            <View style={styles.cardStack}>
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

        {hasLowProgressData ? (
          <AppCard style={styles.insightCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">Gentle observations</AppText>
              <AppText tone="secondary">
                A few more check-ins will help patterns become clearer.
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                For now, focus on noticing the moment and taking one useful next step.
              </AppText>
            </View>
          </AppCard>
        ) : (
          <AppCard style={styles.insightCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">Gentle observations</AppText>
              {insights.map((insight) => (
                <AppText key={insight} tone="secondary">
                  {insight}
                </AppText>
              ))}
            </View>
          </AppCard>
        )}

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Next useful action</AppText>
            <View style={styles.actions}>
              <AppButton onPress={() => router.push(routes.pause)}>Start Pause</AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.log)}>
                Start Check-In
              </AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.home)}>
                Continue with Today
              </AppButton>
              <AppButton variant="ghost" onPress={() => router.push(routes.protect)}>
                Set Up Support
              </AppButton>
            </View>
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
  cardStack: {
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  },
  insightCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
