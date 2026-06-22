import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseImpactCardProps = {
  onStartPausePress: () => void;
};

export function PauseImpactCard({ onStartPausePress }: PauseImpactCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">Pause impact</AppText>
          <AppText tone="secondary">
            Recent pauses suggest that creating space before continuing may help.
          </AppText>
        </View>

        <View style={styles.metricRow}>
          <ImpactMetric label="Urge before" value="8/10" />
          <ImpactMetric label="Urge after" value="5/10" />
        </View>

        <View style={styles.statusPill}>
          <AppText variant="caption">Reduced</AppText>
        </View>

        <AppButton onPress={onStartPausePress}>Start 90-Second Pause</AppButton>
      </View>
    </AppCard>
  );
}

type ImpactMetricProps = {
  label: string;
  value: string;
};

function ImpactMetric({ label, value }: ImpactMetricProps) {
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
  copy: {
    gap: theme.spacing.sm
  },
  metricRow: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  metric: {
    flex: 1,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  }
});
