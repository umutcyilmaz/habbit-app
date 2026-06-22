import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function TodayObservationCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <AppText variant="label">◦</AppText>
        </View>
        <View style={styles.copy}>
          <AppText variant="title">Gentle observation</AppText>
          <AppText tone="secondary">
            Evening appears often in recent activity. A short pause before continuing may help.
          </AppText>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.peachMuted,
    padding: theme.spacing.lg
  },
  row: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  iconCircle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderColor: theme.colors.peach,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  copy: {
    flex: 1,
    gap: theme.spacing.sm
  }
});
