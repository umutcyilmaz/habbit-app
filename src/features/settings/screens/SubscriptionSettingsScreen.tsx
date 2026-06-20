import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { ComingNextCard } from "../../../shared/components/states";
import { theme } from "../../../shared/design-system/theme";

export function SubscriptionSettingsScreen() {
  const router = useRouter();
  const [showComingNext, setShowComingNext] = useState(false);

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Subscription"
        subtitle="Manage optional premium features."
      />

      <View style={styles.stack}>
        <AppCard style={styles.essentialCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Essential support stays available</AppText>
            <AppText tone="secondary">
              Basic check-ins, pause tools, privacy overview, and deletion basics should remain
              available without premium.
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Premium later</AppText>
            <AppText tone="secondary">
              Premium may include deeper insights, long-term trends, custom routines, and expanded
              reports.
            </AppText>
            <AppButton onPress={() => setShowComingNext(true)}>View premium options</AppButton>
            <AppButton variant="secondary" onPress={() => setShowComingNext(true)}>
              Restore purchases
            </AppButton>
          </View>
        </AppCard>

        {showComingNext ? (
          <ComingNextCard
            body="This support tool is planned for a future version."
            action={{
              label: "Back",
              onPress: () => setShowComingNext(false)
            }}
          />
        ) : null}

        <AppButton variant="ghost" onPress={() => router.push(routes.settings)}>
          Back to Settings
        </AppButton>
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
  essentialCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
