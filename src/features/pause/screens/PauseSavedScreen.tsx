import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { NextStepOptionCard } from "../components/NextStepOptionCard";
import { PauseFlowHeader } from "../components/PauseFlowHeader";
import { PauseObservationCard } from "../components/PauseObservationCard";
import { PauseSummaryMetricCard } from "../components/PauseSummaryMetricCard";

const urgeAfterOptions = ["Lower", "About the same", "Higher"] as const;
const truthOptions = [
  "I feel calmer",
  "I can wait longer",
  "I still feel pulled",
  "I want support",
  "Not sure"
] as const;
const nextStepOptions = [
  "Save this pause",
  "3-min breathing",
  "Leave the room",
  "Put phone away",
  "Message support",
  "Continue mindfully"
] as const;

type UrgeAfterOption = (typeof urgeAfterOptions)[number];
type TruthOption = (typeof truthOptions)[number];
type NextStepOption = (typeof nextStepOptions)[number];

function getUrgeAfterSummary(urgeAfter: UrgeAfterOption) {
  switch (urgeAfter) {
    case "Higher":
      return {
        value: "9 / 10",
        detail: "Still present"
      };
    case "About the same":
      return {
        value: "8 / 10",
        detail: "About the same"
      };
    case "Lower":
    default:
      return {
        value: "5 / 10",
        detail: "Reduced"
      };
  }
}

export function PauseSavedScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const [isSaved, setIsSaved] = useState(false);
  const [urgeAfter, setUrgeAfter] = useState<UrgeAfterOption>("Lower");
  const [truth, setTruth] = useState<TruthOption>("I feel calmer");
  const [nextStep, setNextStep] = useState<NextStepOption>("Save this pause");
  const urgeAfterSummary = getUrgeAfterSummary(urgeAfter);

  const savePause = () => {
    const completedAt = new Date().toISOString();

    dispatch({
      type: "ADD_PAUSE_SESSION",
      payload: {
        id: `pause-${completedAt}`,
        completedAt,
        durationSeconds: 90,
        nextChoice: nextStep
      }
    });

    setIsSaved(true);
  };

  if (!isSaved) {
    return (
      <AppScreen>
        <PauseFlowHeader
          title="How is it now?"
          subtitle="You created a pause. Notice what changed."
          onBackPress={() => router.back()}
          onClosePress={() => router.replace(routes.home)}
        />

        <View style={styles.stack}>
          <AppCard>
            <View style={styles.cardStack}>
              <AppText variant="title">How is the urge now?</AppText>
              <View style={styles.optionStack}>
                {urgeAfterOptions.map((option) => (
                  <NextStepOptionCard
                    key={option}
                    value={option}
                    title={option}
                    selected={urgeAfter === option}
                    onSelect={setUrgeAfter}
                  />
                ))}
              </View>
            </View>
          </AppCard>

          <AppCard>
            <View style={styles.cardStack}>
              <AppText variant="title">What feels true right now?</AppText>
              <View style={styles.optionStack}>
                {truthOptions.map((option) => (
                  <NextStepOptionCard
                    key={option}
                    value={option}
                    title={option}
                    selected={truth === option}
                    onSelect={setTruth}
                  />
                ))}
              </View>
            </View>
          </AppCard>

          <AppCard>
            <View style={styles.cardStack}>
              <AppText variant="title">What do you want to do next?</AppText>
              <View style={styles.optionStack}>
                {nextStepOptions.map((option) => (
                  <NextStepOptionCard
                    key={option}
                    value={option}
                    title={option}
                    selected={nextStep === option}
                    onSelect={setNextStep}
                  />
                ))}
              </View>
              <View style={styles.actions}>
                <AppButton onPress={savePause}>Save Pause</AppButton>
                <AppButton variant="ghost" onPress={() => router.replace(routes.pauseTimer)}>
                  Pause Again
                </AppButton>
              </View>
            </View>
          </AppCard>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PauseFlowHeader
        title="Pause saved"
        subtitle="You noticed the loop and created a pause. That is useful progress."
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.savedCard} accessibilityRole="summary">
          <View style={styles.cardStack}>
            <View style={styles.successCircle}>
              <AppText variant="title">✓</AppText>
            </View>
            <AppText variant="title">Pause saved</AppText>
            <AppText tone="secondary">
              Pauses saved this week: {state.pauseSessions.length}.
            </AppText>
          </View>
        </AppCard>

        <View style={styles.metricGrid}>
          <PauseSummaryMetricCard label="Urge before" value="8 / 10" detail="Before pause" />
          <PauseSummaryMetricCard
            label="Urge after"
            value={urgeAfterSummary.value}
            detail={urgeAfterSummary.detail}
          />
        </View>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Trigger Context</AppText>
            <AppText tone="secondary">Nighttime</AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Tool Applied</AppText>
            <AppText tone="secondary">90-Second Pause</AppText>
          </View>
        </AppCard>

        <PauseObservationCard
          title="Observation"
          body="Evening seems to be a sensitive window. Night Protection may help later."
        />

        <View style={styles.actions}>
          <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.progress)}>
            View Progress
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push(routes.protect)}>
            Set Up Night Protection
          </AppButton>
        </View>
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
  optionStack: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  successCircle: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  savedCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage
  }
});
