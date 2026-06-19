import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import type { DemoMomentTag, DemoMood } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const moodOptions: readonly DemoMood[] = ["neutral", "bored", "restless", "stressed", "calm"];
const momentOptions: readonly DemoMomentTag[] = ["evening", "boredom", "alone", "stress", "scrolling"];

const moodLabels: Record<DemoMood, string> = {
  calm: "Calm",
  bored: "Bored",
  stressed: "Stressed",
  tired: "Tired",
  restless: "Restless",
  neutral: "Neutral"
};

const momentLabels: Record<DemoMomentTag, string> = {
  boredom: "Boredom",
  evening: "Evening",
  alone: "Alone",
  stress: "Stress",
  scrolling: "Scrolling",
  unclear: "Unclear"
};

export function LogScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const [mood, setMood] = useState<DemoMood>("neutral");
  const [momentTag, setMomentTag] = useState<DemoMomentTag>("evening");
  const [savedSummary, setSavedSummary] = useState<string | undefined>();

  const handleSave = () => {
    const createdAt = new Date().toISOString();

    dispatch({
      type: "ADD_CHECK_IN",
      payload: {
        id: `demo-check-in-${createdAt}`,
        createdAt,
        mood,
        momentTag,
        intention: "pause"
      }
    });

    setSavedSummary(`Saved a ${moodLabels[mood].toLowerCase()} check-in around ${momentLabels[momentTag].toLowerCase()}.`);
  };

  return (
    <AppScreen>
      <AppHeader
        title="Log"
        subtitle="A private place to capture a moment without judgment."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Quick check-in</AppText>
            <AppText tone="secondary">
              Choose the closest fit. This demo saves only in memory and resets on refresh.
            </AppText>

            <View style={styles.optionGroup}>
              <AppText variant="label">Mood</AppText>
              <View style={styles.optionGrid}>
                {moodOptions.map((option) => (
                  <AppButton
                    key={option}
                    variant={mood === option ? "primary" : "secondary"}
                    onPress={() => setMood(option)}
                  >
                    {moodLabels[option]}
                  </AppButton>
                ))}
              </View>
            </View>

            <View style={styles.optionGroup}>
              <AppText variant="label">Moment</AppText>
              <View style={styles.optionGrid}>
                {momentOptions.map((option) => (
                  <AppButton
                    key={option}
                    variant={momentTag === option ? "primary" : "secondary"}
                    onPress={() => setMomentTag(option)}
                  >
                    {momentLabels[option]}
                  </AppButton>
                ))}
              </View>
            </View>

            <AppButton onPress={handleSave}>Save check-in</AppButton>
          </View>
        </AppCard>

        {savedSummary ? (
          <AppCard style={styles.savedCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">Saved for this demo</AppText>
              <AppText tone="secondary">{savedSummary}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Shared check-ins now total {state.checkIns.length}.
              </AppText>
            </View>
          </AppCard>
        ) : null}
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
  optionGroup: {
    gap: theme.spacing.sm
  },
  optionGrid: {
    gap: theme.spacing.sm
  },
  savedCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
