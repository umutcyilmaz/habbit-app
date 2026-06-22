import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppState } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import { selectProtectionState } from "../../../domain/demo/demoSelectors";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { HelpfulToolsCard } from "../components/HelpfulToolsCard";
import { NextFocusCard } from "../components/NextFocusCard";
import { PauseImpactCard } from "../components/PauseImpactCard";
import { ProgressObservationCard } from "../components/ProgressObservationCard";
import { ProgressWeeklySummaryCard } from "../components/ProgressWeeklySummaryCard";
import { SensitiveWindowInsightCard } from "../components/SensitiveWindowInsightCard";

export function ProgressScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const checkInCount = state.checkIns.length;
  const pauseCount = state.pauseSessions.length;
  const protection = selectProtectionState(state);
  const hasLowData = checkInCount < 2;

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        title="Progress"
        subtitle="Gentle observations from recent activity."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        {hasLowData ? (
          <AppCard style={styles.lowDataCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">Growth takes time</AppText>
              <AppText tone="secondary">
                Complete a few check-ins to see your first pattern.
              </AppText>
              <AppButton onPress={() => router.push(routes.log)}>Start Check-In</AppButton>
            </View>
          </AppCard>
        ) : (
          <>
            <ProgressWeeklySummaryCard
              checkInCount={checkInCount}
              pauseCount={pauseCount}
              supportWindowCount={1}
            />
            <PauseImpactCard onStartPausePress={() => router.push(routes.pause)} />
            <SensitiveWindowInsightCard
              onSetupPress={() => router.push(routes.protectNightSetup)}
            />
            <ProgressObservationCard />
            <HelpfulToolsCard
              pauseCount={pauseCount}
              checkInCount={checkInCount}
              protectionStatus={protection.status}
            />
            <NextFocusCard
              onTodayPress={() => router.push(routes.home)}
              onEnableProtectionPress={() => router.push(routes.protectSetup)}
            />
          </>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  lowDataCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.xl
  }
});
