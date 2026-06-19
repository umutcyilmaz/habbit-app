import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function PauseIntroCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <AppText variant="title">A pause is not a rule.</AppText>
        <AppText tone="secondary">It simply creates space before the next choice.</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  content: {
    gap: theme.spacing.sm
  }
});
