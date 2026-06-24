import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseTimerCardProps = {
  secondsLeft: number;
};

export function PauseTimerCard({ secondsLeft }: PauseTimerCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.outerCircle}>
        <View style={styles.innerCircle}>
          <AppText variant="heading" style={styles.timer}>
            {secondsLeft}
          </AppText>
          <AppText variant="caption" tone="secondary">
            seconds
          </AppText>
        </View>
      </View>
      <AppText variant="bodySmall" tone="secondary" align="center">
        Let the pause be simple. You do not have to decide anything yet.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: theme.spacing.lg,
    borderRadius: 28,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    ...theme.shadows.card
  },
  outerCircle: {
    width: 208,
    height: 208,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 104,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  innerCircle: {
    width: 148,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 74,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  timer: {
    fontSize: 48,
    lineHeight: 56
  }
});
