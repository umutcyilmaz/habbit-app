import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { GentleInsightCard } from "../components/GentleInsightCard";
import { HelpfulToolCard } from "../components/HelpfulToolCard";
import { ProgressSection } from "../components/ProgressSection";
import { ProgressSummaryCard } from "../components/ProgressSummaryCard";
import { SensitiveWindowCard } from "../components/SensitiveWindowCard";
import { WeeklyReviewPreview } from "../components/WeeklyReviewPreview";
import { progressMockData } from "../data/progressMockData";
import type { GentleInsight, HelpfulTool, ProgressRouteTarget } from "../types";

export function ProgressScreen() {
  const router = useRouter();
  const data = progressMockData;

  const navigateTo = (route: ProgressRouteTarget) => {
    router.push(route);
  };

  const renderInsight = (insight: GentleInsight) => {
    if (insight.category === "sensitiveWindow") {
      return <SensitiveWindowCard key={insight.id} insight={insight} />;
    }

    return <GentleInsightCard key={insight.id} insight={insight} />;
  };

  const handleToolPress = (tool: HelpfulTool) => {
    navigateTo(tool.route);
  };

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader
          title="Progress"
          subtitle="A quiet look at what your recent check-ins may be showing."
          onSettingsPress={() => router.push(routes.settings)}
        />

        <View style={styles.note}>
          <AppText variant="bodySmall" tone="secondary">
            {data.note}
          </AppText>
        </View>

        {data.lowData?.enabled ? (
          <AppCard>
            <View style={styles.lowDataContent}>
              <AppText tone="secondary">{data.lowData.copy}</AppText>
              <AppButton onPress={() => navigateTo(data.lowData?.route ?? routes.log)}>
                {data.lowData.ctaLabel}
              </AppButton>
            </View>
          </AppCard>
        ) : null}

        <ProgressSummaryCard
          title={`${data.periodLabel} so far`}
          metrics={data.metrics}
          activitySummary={data.activitySummary}
        />

        <ProgressSection title="Gentle observations">
          <View style={styles.cardStack}>{data.insights.map(renderInsight)}</View>
        </ProgressSection>

        <ProgressSection title="What may be helping">
          <View style={styles.cardStack}>
            {data.helpfulTools.map((tool) => (
              <HelpfulToolCard key={tool.id} tool={tool} onPress={handleToolPress} />
            ))}
          </View>
        </ProgressSection>

        <WeeklyReviewPreview
          review={data.weeklyReview}
          onPrimaryPress={() => navigateTo(data.weeklyReview.primaryRoute)}
          onSecondaryPress={() => navigateTo(data.weeklyReview.secondaryRoute)}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  note: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm
  },
  lowDataContent: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.md
  }
});
