import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { CoachInsightCard } from "../components/CoachInsightCard";
import { QuickActionGrid } from "../components/QuickActionGrid";
import { TodayGreeting } from "../components/TodayGreeting";
import { TodayRecommendationCard } from "../components/TodayRecommendationCard";
import { TodaySection } from "../components/TodaySection";
import { WeeklyProgressPreview } from "../components/WeeklyProgressPreview";
import { todayMockData } from "../data/todayMockData";
import type { TodayQuickAction, TodayRouteTarget } from "../types";

export function TodayScreen() {
  const router = useRouter();
  const data = todayMockData;

  const navigateTo = (route: TodayRouteTarget) => {
    router.push(route);
  };

  const handleQuickActionPress = (action: TodayQuickAction) => {
    // TODO: Replace tab routing with dedicated flows as Check-In, Pause, and Log screens are implemented.
    navigateTo(action.route);
  };

  return (
    <AppScreen>
      <View style={styles.stack}>
        <TodayGreeting
          userName={data.userName}
          periodLabel={data.periodLabel}
          planNote={data.planNote}
          onSettingsPress={() => router.push(routes.settings)}
        />

        {data.firstUse?.enabled ? (
          <AppCard>
            <AppText tone="secondary">{data.firstUse.copy}</AppText>
          </AppCard>
        ) : null}

        <TodayRecommendationCard
          recommendation={data.recommendation}
          onPrimaryPress={() => navigateTo(data.recommendation.primaryRoute)}
          onSecondaryPress={() => navigateTo(data.recommendation.secondaryRoute)}
        />

        <TodaySection title="Quick actions" subtitle="Small next steps, always optional.">
          <QuickActionGrid actions={data.quickActions} onActionPress={handleQuickActionPress} />
        </TodaySection>

        <TodaySection title="This week" subtitle="A simple preview of your starting rhythm.">
          <WeeklyProgressPreview items={data.weeklyProgress} />
        </TodaySection>

        <CoachInsightCard
          insight={data.coachInsight}
          onPress={() => navigateTo(data.coachInsight.route)}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  }
});
