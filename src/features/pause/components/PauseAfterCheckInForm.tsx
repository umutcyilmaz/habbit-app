import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type {
  PauseIntensityAfterChange,
  PauseNextStepId,
  PauseSessionCompletionData,
  PauseTruthId
} from "../../../storage/bloomState";
import {
  pauseIntensityAfterLabels,
  pauseNextStepLabels,
  pauseTruthLabels
} from "../pausePresentation";
import { NextStepOptionCard } from "./NextStepOptionCard";

const urgeAfterOptions = [
  "lower",
  "aboutTheSame",
  "higher"
] as const satisfies readonly PauseIntensityAfterChange[];
const truthOptions = [
  "calmer",
  "canWaitLonger",
  "stillPulled",
  "wantSupport",
  "notSure"
] as const satisfies readonly PauseTruthId[];
const nextStepOptions = [
  "savePause",
  "breathe3",
  "leaveRoom",
  "putPhoneAway",
  "messageSupport",
  "continueMindfully"
] as const satisfies readonly PauseNextStepId[];

type PauseAfterCheckInFormProps = {
  onSave: (completionData: PauseSessionCompletionData) => void;
  onPauseAgain: () => void;
};

export function PauseAfterCheckInForm({
  onSave,
  onPauseAgain
}: PauseAfterCheckInFormProps) {
  const [urgeAfter, setUrgeAfter] =
    useState<PauseIntensityAfterChange>("lower");
  const [truth, setTruth] = useState<PauseTruthId>("calmer");
  const [nextStep, setNextStep] =
    useState<PauseNextStepId>("savePause");

  return (
    <View style={styles.stack}>
      <AppCard>
        <View style={styles.cardStack}>
          <AppText variant="title">How is the urge now?</AppText>
          <View style={styles.optionStack}>
            {urgeAfterOptions.map((option) => (
              <NextStepOptionCard
                key={option}
                value={option}
                title={pauseIntensityAfterLabels[option]}
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
                title={pauseTruthLabels[option]}
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
                title={pauseNextStepLabels[option]}
                selected={nextStep === option}
                onSelect={setNextStep}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <AppButton
              onPress={() =>
                onSave({
                  intensityAfterChange: urgeAfter,
                  feltTruth: truth,
                  nextStep
                })
              }
            >
              Save Pause
            </AppButton>
            <AppButton variant="ghost" onPress={onPauseAgain}>
              Pause Again
            </AppButton>
          </View>
        </View>
      </AppCard>
    </View>
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
  }
});
