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
  const checkInCount = state.checkIns.length;
  const pauseCount = state.pauseSessions.length;
  const isFirstUse = checkInCount === 0 && pauseCount === 0;
  const protectionIsActive = protection.status === "active";
  const protectionTitle = protectionIsActive ? "Protection is active" : "Protection is off";
  const protectionBody = protectionIsActive
    ? "Support is ready during selected hours."
    : "You can add gentle support during selected hours.";
  const protectionCta = protectionIsActive ? "Manage Protection" : "Enable Protection";
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
          badge={isFirstUse ? "Start here" : "Today’s focus"}
          title={
            isFirstUse
              ? "Context awaits"
              : "Create a short pause before the evening loop"
          }
          body={
            isFirstUse
              ? "Nothing is wrong. Bloom just needs a little more context."
              : "Recent activity suggests evenings between 22:00 and 00:00 may be a sensitive window."
          }
          primaryLabel={isFirstUse ? "Start First Check-In" : "Start 90-Second Pause"}
          secondaryLabel={isFirstUse ? "Explore Pause" : "Set up Night Protection"}
          onPrimaryPress={() => router.push(isFirstUse ? routes.log : routes.pause)}
          onSecondaryPress={() => router.push(isFirstUse ? routes.pause : routes.protectNightSetup)}
        />

        <TodayQuickActionGrid actions={quickActions} />

        <TodayWeeklyPreviewCard
          checkInCount={checkInCount}
          pauseCount={pauseCount}
          insight={
            isFirstUse
              ? "Your first check-in will help this weekly view feel more personal."
              : "Recent logs suggest boredom and evenings may be connected."
          }
        />

        <TodayObservationCard
          body={
            isFirstUse
              ? "A first check-in can help Bloom understand what support feels useful today."
              : "Evening appears often in recent activity. A short pause before continuing may help."
          }
          onViewProgressPress={() => router.push(routes.progress)}
        />

        <TodayProtectionPreviewCard
          title={protectionTitle}
          body={protectionBody}
          ctaLabel={protectionCta}
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
