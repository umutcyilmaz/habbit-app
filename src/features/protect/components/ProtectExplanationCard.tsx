import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { protectExplanation } from "../data/protectMockData";

export function ProtectExplanationCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <AppText variant="title">{protectExplanation.title}</AppText>
        <AppText tone="secondary">{protectExplanation.copy}</AppText>
        <View style={styles.note}>
          <AppText variant="bodySmall" tone="secondary">
            {protectExplanation.note}
          </AppText>
        </View>
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
    gap: theme.spacing.md
  },
  note: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  }
});
