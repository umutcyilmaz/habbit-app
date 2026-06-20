import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseCircleTimerProps = {
  remainingSeconds: number;
  phaseLabel: string;
};

function formatRemainingTime(remainingSeconds: number) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PauseCircleTimer({ remainingSeconds, phaseLabel }: PauseCircleTimerProps) {
  return (
    <View style={styles.outerCircle}>
      <View style={styles.innerCircle}>
        <AppText variant="caption" tone="secondary" align="center">
          {phaseLabel}
        </AppText>
        <AppText variant="heading" align="center" style={styles.timerText}>
          {formatRemainingTime(remainingSeconds)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerCircle: {
    width: 248,
    height: 248,
    borderRadius: 124,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.sageMuted,
    borderWidth: 1,
    borderColor: theme.colors.sage
  },
  innerCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface
  },
  timerText: {
    fontSize: 48,
    lineHeight: 56
  }
});
