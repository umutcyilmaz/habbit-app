import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function ProgressObservationCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Gentle observation</AppText>
        <AppText tone="secondary">
          Boredom and evening time appear together in recent logs. This may be worth noticing
          without judgment.
        </AppText>
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
  stack: {
    gap: theme.spacing.sm
  }
});
