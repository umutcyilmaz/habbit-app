import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { pauseSupportLines } from "../data/pauseMockData";

export function PauseBreathingGuide() {
  return (
    <View style={styles.stack}>
      <AppCard style={styles.guideCard}>
        <View style={styles.guideContent}>
          <AppText variant="title">Breathe in gently.</AppText>
          <AppText variant="title">Exhale slowly.</AppText>
          <AppText tone="secondary">Notice what is present without rushing.</AppText>
        </View>
      </AppCard>

      <View style={styles.lines}>
        {pauseSupportLines.map((line) => (
          <AppText key={line} variant="bodySmall" tone="secondary">
            {line}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  guideCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  guideContent: {
    gap: theme.spacing.sm
  },
  lines: {
    gap: theme.spacing.sm
  }
});
