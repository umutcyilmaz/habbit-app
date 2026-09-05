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
  isSaving?: boolean;
  completionLocked?: boolean;
  canRetry?: boolean;
  persistenceError?: string | null;
};

export function PauseAfterCheckInForm({
  onSave,
  onPauseAgain,
  isSaving = false,
  completionLocked = false,
  canRetry = false,
  persistenceError = null
}: PauseAfterCheckInFormProps) {
  const [urgeAfter, setUrgeAfter] =
    useState<PauseIntensityAfterChange>("lower");
  const [truth, setTruth] = useState<PauseTruthId>("calmer");
  const [nextStep, setNextStep] =
    useState<PauseNextStepId>("savePause");

  return (
    <View testID="bloom.pause.after-check-in" style={styles.stack}>
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
                disabled={isSaving || completionLocked}
                onSelect={setUrgeAfter}
                testIDPrefix="bloom.pause.after.intensity"
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
                disabled={isSaving || completionLocked}
                onSelect={setTruth}
                testIDPrefix="bloom.pause.after.truth"
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
                disabled={isSaving || completionLocked}
                onSelect={setNextStep}
                testIDPrefix="bloom.pause.after.next-step"
              />
            ))}
          </View>
          {persistenceError !== null ? (
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              variant="bodySmall"
              tone="danger"
            >
              {persistenceError}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <AppButton
              testID="bloom.pause.complete"
              disabled={completionLocked && !canRetry}
              loading={isSaving}
              onPress={() =>
                onSave({
                  intensityAfterChange: urgeAfter,
                  feltTruth: truth,
                  nextStep
                })
              }
            >
              {canRetry ? "Try saving again" : "Save Pause"}
            </AppButton>
            <AppButton
              testID="bloom.pause.timer.pause-again"
              variant="ghost"
              disabled={isSaving || completionLocked}
              onPress={onPauseAgain}
            >
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
