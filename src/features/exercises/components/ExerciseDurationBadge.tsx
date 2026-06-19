import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ExerciseDuration } from "../types";

type ExerciseDurationBadgeProps = {
  duration: ExerciseDuration;
};

export function ExerciseDurationBadge({ duration }: ExerciseDurationBadgeProps) {
  return (
    <View style={styles.badge}>
      <AppText variant="caption" tone="secondary">
        {duration.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  }
});
