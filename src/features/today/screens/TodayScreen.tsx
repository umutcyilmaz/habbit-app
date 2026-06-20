import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import {
  selectIsFirstUse,
  selectTodayDashboardData
} from "../../../domain/demo/demoSelectors";
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
  const isFirstUse = selectIsFirstUse(state);

  return (
    <AppScreen>
      <AppHeader
        title={`Hi ${dashboard.userName}`}
        subtitle={`${dashboard.weekLabel}. A calm place to choose the next useful action.`}
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        {state.isOfflinePreview ? (
          <AppCard style={styles.offlineCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">Offline</AppText>
              <AppText tone="secondary">
                Some updates may wait until you are back online. You can still review current guidance.
              </AppText>
            </View>
          </AppCard>
        ) : null}

        <AppCard style={styles.primaryCard}>
          <View style={styles.cardStack}>
            <AppText variant="caption" tone="secondary">
              Today
            </AppText>
            <AppText variant="title">
              {isFirstUse ? "Start with your first check-in" : dashboard.recommendationTitle}
            </AppText>
            <AppText tone="secondary">
              {isFirstUse
                ? "A quick check-in helps shape this space around what is actually happening today."
                : dashboard.recommendationBody}
            </AppText>
            <View style={styles.actions}>
              <AppButton onPress={() => router.push(routes.pause)}>Pause Now</AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.log)}>
                Check-In
              </AppButton>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Quick actions</AppText>
            <View style={styles.actions}>
              <AppButton variant="secondary" onPress={() => router.push(routes.log)}>
                Log Today
              </AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.exercises)}>
                Exercises
              </AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.protect)}>
                Protect
              </AppButton>
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.infoCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Weekly preview</AppText>
            <AppText tone="secondary">
              {isFirstUse
                ? "Your first few check-ins will shape this weekly view."
                : dashboard.weeklyPreview}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {isFirstUse
                ? "Patterns appear after a little activity. For now, start with one small entry."
                : dashboard.coachInsight}
            </AppText>
            <AppButton variant="secondary" onPress={() => router.push(routes.progress)}>
              View Progress
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
  cardStack: {
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  },
  primaryCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  infoCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  offlineCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border
  }
});
