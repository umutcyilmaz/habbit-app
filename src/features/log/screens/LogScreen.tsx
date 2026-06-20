import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import type { DemoMoment, DemoMood } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const moodOptions: readonly DemoMood[] = ["neutral", "bored", "restless", "stressed", "calm"];
const momentOptions: readonly DemoMoment[] = ["evening", "boredom", "alone", "stress", "scrolling"];

const moodLabels: Record<DemoMood, string> = {
  calm: "Calm",
  bored: "Bored",
  stressed: "Stressed",
  tired: "Tired",
  restless: "Restless",
  neutral: "Neutral"
};

const momentLabels: Record<DemoMoment, string> = {
  boredom: "Boredom",
  evening: "Evening",
  alone: "Alone",
  stress: "Stress",
  scrolling: "Scrolling"
};

export function LogScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const [mood, setMood] = useState<DemoMood>("neutral");
  const [moment, setMoment] = useState<DemoMoment>("evening");
  const [savedSummary, setSavedSummary] = useState<string | undefined>();

  const handleSave = () => {
    const createdAt = new Date().toISOString();

    dispatch({
      type: "ADD_CHECK_IN",
      payload: {
        id: `check-in-${createdAt}`,
        createdAt,
        mood,
        moment
      }
    });

    setSavedSummary(
      `Saved a ${moodLabels[mood].toLowerCase()} check-in around ${momentLabels[
        moment
      ].toLowerCase()}.`
    );
  };

  return (
    <AppScreen>
      <AppHeader
        title="Log"
        subtitle="A private place to capture a moment without judgment."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        {savedSummary ? (
          <AppCard style={styles.savedCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">Saved summary</AppText>
              <AppText tone="secondary">{savedSummary}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Check-ins now total {state.checkIns.length}.
              </AppText>
              <View style={styles.actions}>
                <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
                <AppButton variant="secondary" onPress={() => router.push(routes.progress)}>
                  View Progress
                </AppButton>
                <AppButton variant="ghost" onPress={() => setSavedSummary(undefined)}>
                  Log another moment
                </AppButton>
              </View>
            </View>
          </AppCard>
        ) : (
          <AppCard>
            <View style={styles.cardStack}>
              <AppText variant="title">Quick Check-In</AppText>
              <AppText tone="secondary">
                Choose the closest fit. This check-in stays private to your app experience.
              </AppText>

              <View style={styles.optionGroup}>
                <AppText variant="label">Mood</AppText>
                <View style={styles.optionGrid}>
                  {moodOptions.map((option) => (
                    <AppButton
                      key={option}
                      variant={mood === option ? "primary" : "subtle"}
                      style={styles.optionButton}
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
                      variant={moment === option ? "primary" : "subtle"}
                      style={styles.optionButton}
                      onPress={() => setMoment(option)}
                    >
                      {momentLabels[option]}
                    </AppButton>
                  ))}
                </View>
              </View>

              <AppButton onPress={handleSave}>Save Check-In</AppButton>
            </View>
          </AppCard>
        )}
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  optionButton: {
    minWidth: 104,
    flexGrow: 1
  },
  actions: {
    gap: theme.spacing.md
  },
  savedCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
