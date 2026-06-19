import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import { selectTodayDashboardData } from "../../../domain/demo/demoSelectors";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function TodayScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dashboard = selectTodayDashboardData(state);

  return (
    <AppScreen>
      <AppHeader
        title={`Hi ${dashboard.userName}`}
        subtitle={`Week ${dashboard.currentWeek}, day ${dashboard.currentDay}. A calm place to choose the next useful action.`}
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.recommendationCard}>
          <View style={styles.cardStack}>
            <AppText variant="caption" tone="secondary">
              Today
            </AppText>
            <AppText variant="title">{dashboard.recommendationTitle}</AppText>
            <AppText tone="secondary">{dashboard.recommendationBody}</AppText>
            <View style={styles.actions}>
              <AppButton onPress={() => router.push(routes.pause)}>Start pause</AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.log)}>
                Quick check-in
              </AppButton>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Weekly preview</AppText>
            <AppText tone="secondary">{dashboard.weeklyPreview}</AppText>
            <AppButton variant="secondary" onPress={() => router.push(routes.progress)}>
              View progress
            </AppButton>
          </View>
        </AppCard>

        <AppCard style={styles.insightCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Coach insight</AppText>
            <AppText tone="secondary">{dashboard.coachInsight}</AppText>
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
  recommendationCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  insightCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  }
});
