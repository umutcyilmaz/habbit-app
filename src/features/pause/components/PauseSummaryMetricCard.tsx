import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseSummaryMetricCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function PauseSummaryMetricCard({ label, value, detail }: PauseSummaryMetricCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText variant="title">{value}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {detail}
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 144,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  stack: {
    gap: theme.spacing.sm
  }
});
