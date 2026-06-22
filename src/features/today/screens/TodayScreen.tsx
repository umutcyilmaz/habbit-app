import { useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import {
  selectProtectionState,
  selectTodayDashboardData
} from "../../../domain/demo/demoSelectors";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { TodayObservationCard } from "../components/TodayObservationCard";
import {
  TodayQuickActionGrid,
  type TodayQuickAction
} from "../components/TodayQuickActionGrid";
import { TodayProtectionPreviewCard } from "../components/TodayProtectionPreviewCard";
import { TodayRecommendationCard } from "../components/TodayRecommendationCard";
import { TodayWeeklyPreviewCard } from "../components/TodayWeeklyPreviewCard";

export function TodayScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dashboard = selectTodayDashboardData(state);
  const protection = selectProtectionState(state);
  const protectionIsActive = protection.status === "active";
  const quickActions: readonly TodayQuickAction[] = [
    {
      title: "Quick Check-In",
      description: "Notice what is here.",
      iconLabel: "✓",
      accent: "sage",
      onPress: () => router.push(routes.log)
    },
    {
      title: "Pause Now",
      description: "Take 90 seconds.",
      iconLabel: "Ⅱ",
      accent: "lavender",
      onPress: () => router.push(routes.pause)
    },
    {
      title: "Protection",
      description: "Review support.",
      iconLabel: "◇",
      accent: "peach",
      onPress: () => router.push(routes.protect)
    },
    {
      title: "Exercises",
      description: "Short practices.",
      iconLabel: "↻",
      accent: "lavender",
      onPress: () => router.push(routes.exercises)
    }
  ];

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="caption" tone="secondary">
            Bloom
          </AppText>
          <AppText variant="heading" style={styles.greeting}>
            Hi {dashboard.userName}
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            {dashboard.weekLabel}. Choose one helpful next step for today.
          </AppText>
        </View>
        <AppIconButton
          accessibilityLabel="Open settings"
          icon={<AppText variant="title">⚙</AppText>}
          onPress={() => router.push(routes.settings)}
        />
      </View>

      <View style={styles.stack}>
        <TodayRecommendationCard
          title="Create a short pause before the evening loop"
          body="Recent activity suggests evenings between 22:00 and 00:00 may be a sensitive window."
          onPrimaryPress={() => router.push(routes.pause)}
          onSecondaryPress={() => router.push(routes.protectNightSetup)}
        />

        <TodayQuickActionGrid actions={quickActions} />

        <TodayWeeklyPreviewCard
          checkInCount={state.checkIns.length}
          pauseCount={state.pauseSessions.length}
          onViewProgressPress={() => router.push(routes.progress)}
        />

        <TodayObservationCard />

        <TodayProtectionPreviewCard
          active={protectionIsActive}
          onPress={() => router.push(protectionIsActive ? routes.protect : routes.protectSetup)}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  greeting: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 34,
    lineHeight: 42
  },
  stack: {
    gap: theme.spacing.xl
  }
});
