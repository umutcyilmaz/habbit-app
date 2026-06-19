import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ExerciseStatus } from "../types";

type ExerciseStatusBadgeProps = {
  status: ExerciseStatus;
};

const statusLabels: Record<ExerciseStatus, string> = {
  available: "Available",
  comingNext: "Coming next",
  premiumLater: "Later"
};

export function ExerciseStatusBadge({ status }: ExerciseStatusBadgeProps) {
  const isAvailable = status === "available";

  return (
    <View style={[styles.badge, isAvailable ? styles.available : styles.muted]}>
      <AppText variant="caption" tone={isAvailable ? "primary" : "secondary"}>
        {statusLabels[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  available: {
    backgroundColor: theme.colors.sageMuted
  },
  muted: {
    backgroundColor: theme.colors.surfaceMuted
  }
});
