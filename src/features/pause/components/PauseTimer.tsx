import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { PAUSE_EXTENSION_SECONDS, PAUSE_INITIAL_SECONDS } from "../data/pauseMockData";
import { PauseBreathingGuide } from "./PauseBreathingGuide";

type PauseTimerProps = {
  onComplete: () => void;
};

export function PauseTimer({ onComplete }: PauseTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(PAUSE_INITIAL_SECONDS);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setRemainingSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [remainingSeconds]);

  const addTime = () => {
    setRemainingSeconds((current) => current + PAUSE_EXTENSION_SECONDS);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.timerBlock} accessibilityLabel={`Pause timer ${formatTime(remainingSeconds)}`}>
        <AppText style={styles.timerText}>{formatTime(remainingSeconds)}</AppText>
        {remainingSeconds === 0 ? (
          <AppText tone="secondary" align="center">
            You can choose the next step when you are ready.
          </AppText>
        ) : null}
      </View>

      <PauseBreathingGuide />

      <View style={styles.actions}>
        <AppButton variant="secondary" onPress={addTime}>
          Add 60 seconds
        </AppButton>
        <AppButton onPress={onComplete}>I'm ready to choose</AppButton>
        <AppButton variant="ghost" onPress={onComplete}>
          Finish for now
        </AppButton>
      </View>

      <AppText variant="caption" tone="secondary">
        Timer support is local to this screen for now. Background timer handling can be improved later.
      </AppText>
    </View>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  timerBlock: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxl
  },
  timerText: {
    color: theme.colors.primary,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: 0
  },
  actions: {
    gap: theme.spacing.md
  }
});
