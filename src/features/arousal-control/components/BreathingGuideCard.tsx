import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const guideRows = [
  "Relax your jaw",
  "Let your belly soften",
  "Release the pelvic floor",
  "Let the urge rise and fall"
] as const;

export function BreathingGuideCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">During the pause</AppText>
        <View style={styles.rows}>
          {guideRows.map((row) => (
            <View key={row} style={styles.row}>
              <View style={styles.dot}>
                <AppText variant="caption">✓</AppText>
              </View>
              <AppText variant="bodySmall">{row}</AppText>
            </View>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.md
  },
  rows: {
    gap: theme.spacing.sm
  },
  row: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  dot: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  }
});
