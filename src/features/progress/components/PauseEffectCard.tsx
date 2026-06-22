import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseEffectCardProps = {
  onStartPausePress: () => void;
};

export function PauseEffectCard({ onStartPausePress }: PauseEffectCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <AppText variant="label">Ⅱ</AppText>
          </View>
          <View style={styles.copy}>
            <AppText variant="title">Pause effect</AppText>
            <AppText tone="secondary">
              Recent pauses suggest that creating space before continuing may help.
            </AppText>
          </View>
        </View>

        <View style={styles.comparisonPanel}>
          <View style={styles.comparisonRow}>
            <ComparisonMetric label="Before" value="8/10" />
            <View style={styles.arrowCircle}>
              <AppText variant="bodySmall" tone="secondary">
                →
              </AppText>
            </View>
            <ComparisonMetric label="After" value="5/10" />
          </View>
          <View style={styles.badge}>
            <AppText variant="caption">Reduced</AppText>
          </View>
        </View>

        <AppButton onPress={onStartPausePress}>Start 90-Second Pause</AppButton>
      </View>
    </AppCard>
  );
}

type ComparisonMetricProps = {
  label: string;
  value: string;
};

function ComparisonMetric({ label, value }: ComparisonMetricProps) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.lg
  },
  headerRow: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  iconCircle: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  copy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  comparisonPanel: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: theme.spacing.xs
  },
  arrowCircle: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: theme.colors.sageMuted
  },
  badge: {
    alignSelf: "center",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  }
});
