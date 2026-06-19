import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { pauseSupportLabels, pauseTriggerLabels } from "../data/pauseMockData";
import type { PauseSessionSummary } from "../types";

type PauseSavedSummaryProps = {
  summary: PauseSessionSummary;
  onBackToToday: () => void;
  onViewProgress: () => void;
  onLogMoment: () => void;
};

export function PauseSavedSummary({
  summary,
  onBackToToday,
  onViewProgress,
  onLogMoment
}: PauseSavedSummaryProps) {
  const triggers = summary.triggers.map((trigger) => pauseTriggerLabels[trigger]).join(", ");

  return (
    <View style={styles.stack}>
      <AppText tone="secondary">
        You noticed the loop and created a pause. That is useful progress.
      </AppText>

      <AppCard>
        <View style={styles.summaryStack}>
          <SummaryRow label="Urge before" value={`${summary.urgeBefore} / 10`} />
          <SummaryRow label="Urge after" value={`${summary.urgeAfter} / 10`} />
          <SummaryRow label="Triggers" value={triggers} />
          <SummaryRow label="Tool" value={pauseSupportLabels[summary.tool]} />
        </View>
      </AppCard>

      <AppCard style={styles.observation}>
        <View style={styles.observationContent}>
          <AppText variant="title">Gentle observation</AppText>
          <AppText tone="secondary">{summary.observation}</AppText>
        </View>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={onBackToToday}>Back to Today</AppButton>
        <AppButton variant="secondary" onPress={onViewProgress}>
          View Progress
        </AppButton>
        <AppButton variant="ghost" onPress={onLogMoment}>
          Log this moment
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
