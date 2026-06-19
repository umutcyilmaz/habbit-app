import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { feelingLabels, supportToolLabels } from "../data/logMockData";
import type { QuickCheckInSummary } from "../types";

type CheckInSavedSummaryProps = {
  summary: QuickCheckInSummary;
  onBackToToday: () => void;
  onViewProgress: () => void;
  onLogAnother: () => void;
};

export function CheckInSavedSummary({
  summary,
  onBackToToday,
  onViewProgress,
  onLogAnother
}: CheckInSavedSummaryProps) {
  const supportUsed = summary.supportTools.map((tool) => supportToolLabels[tool]).join(", ");

  return (
    <View style={styles.stack}>
      <AppText tone="secondary">This helps the app understand your patterns, not judge them.</AppText>

      <AppCard>
        <View style={styles.summaryStack}>
          <SummaryRow label="Awareness" value={`${summary.awarenessRating} / 10`} />
          <SummaryRow label="Grounded" value={`${summary.groundedRating} / 10`} />
          <SummaryRow label="Feeling" value={feelingLabels[summary.strongestFeeling]} />
          <SummaryRow label="Support used" value={supportUsed} />
        </View>
      </AppCard>

      <AppCard style={styles.observation}>
        <View style={styles.observationContent}>
          <AppText variant="title">Gentle observation</AppText>
          <AppText tone="secondary">
            Boredom showed up in this check-in. If it appears again, the app may suggest a short
            pause or evening support.
          </AppText>
        </View>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={onBackToToday}>Back to Today</AppButton>
        <AppButton variant="secondary" onPress={onViewProgress}>
          View Progress
        </AppButton>
        <AppButton variant="ghost" onPress={onLogAnother}>
          Log another moment
        </AppButton>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label" style={styles.summaryValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  summaryStack: {
    gap: theme.spacing.md
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.lg
  },
  summaryValue: {
    flex: 1,
    textAlign: "right"
  },
  observation: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  observationContent: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  }
});
