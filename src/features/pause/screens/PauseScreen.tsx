import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import type { DemoPauseChoice } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const pauseChoices: ReadonlyArray<{
  id: DemoPauseChoice;
  label: string;
}> = [
  {
    id: "reflect",
    label: "Reflect"
  },
  {
    id: "doSomethingElse",
    label: "Do something else"
  },
  {
    id: "continueMindfully",
    label: "Continue mindfully"
  },
  {
    id: "skip",
    label: "Skip"
  }
];

export function PauseScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const [choice, setChoice] = useState<DemoPauseChoice>("reflect");
  const [savedSummary, setSavedSummary] = useState<string | undefined>();

  const handleFinish = () => {
    const completedAt = new Date().toISOString();
    const selectedLabel = pauseChoices.find((option) => option.id === choice)?.label ?? "Reflect";

    dispatch({
      type: "ADD_PAUSE_SESSION",
      payload: {
        id: `demo-pause-${completedAt}`,
        completedAt,
        durationSeconds: 90,
        choice
      }
    });

    setSavedSummary(`Saved a 90-second pause. Next choice: ${selectedLabel.toLowerCase()}.`);
  };

  return (
    <AppScreen>
      <AppHeader
        title="Pause"
        subtitle="Take a short moment before choosing what comes next."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.pauseCard}>
          <View style={styles.cardStack}>
            <AppText variant="caption" tone="secondary">
              90 seconds
            </AppText>
            <AppText variant="title">Notice the moment</AppText>
            <AppText tone="secondary">
              This demo records a completed pause when you finish. No timer or storage is connected
              yet.
            </AppText>
            <View style={styles.optionGroup}>
              {pauseChoices.map((option) => (
                <AppButton
                  key={option.id}
                  variant={choice === option.id ? "primary" : "secondary"}
                  onPress={() => setChoice(option.id)}
                >
                  {option.label}
                </AppButton>
              ))}
            </View>
            <AppButton onPress={handleFinish}>Finish pause</AppButton>
          </View>
        </AppCard>

        {savedSummary ? (
          <AppCard>
            <View style={styles.cardStack}>
              <AppText variant="title">Pause saved</AppText>
              <AppText tone="secondary">{savedSummary}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Shared pauses now total {state.pauseSessions.length}.
              </AppText>
              <AppButton variant="secondary" onPress={() => router.replace(routes.home)}>
                Back to Today
              </AppButton>
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
  pauseCard: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  }
});
