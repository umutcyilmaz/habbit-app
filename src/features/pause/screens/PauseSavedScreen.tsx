import { useEffect } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getLatestPauseRecord,
  getPauseSavedRouteState,
  type PauseRecord
} from "../../../storage/bloomState";
import { PauseFlowHeader } from "../components/PauseFlowHeader";
import { PauseObservationCard } from "../components/PauseObservationCard";
import { PauseSummaryMetricCard } from "../components/PauseSummaryMetricCard";
import {
  formatPauseDuration,
  pauseHelpfulActionLabels,
  pauseIntensityAfterLabels,
  pauseNextStepLabels,
  pauseTriggerLabels,
  pauseTruthLabels
} from "../pausePresentation";

export function PauseSavedScreen() {
  const router = useRouter();
  const { state } = useBloomLocalState();
  const latestRecord = getLatestPauseRecord(state.pause.records);
  const routeState = getPauseSavedRouteState(state.pause);

  useEffect(() => {
    if (routeState === "collect-completion") {
      router.replace(routes.pauseTimer);
      return;
    }

    if (routeState === "redirect") {
      router.replace(routes.pause);
    }
  }, [routeState, router]);

  if (routeState !== "show-record") {
    return <AppScreen />;
  }

  if (latestRecord === null) {
    return <AppScreen />;
  }

  return (
    <PauseRecordSummary
      record={latestRecord}
      recordCount={state.pause.records.length}
      onClose={() => router.replace(routes.home)}
      onViewProgress={() => router.push(routes.progress)}
      onOpenProtection={() => router.push(routes.protect)}
    />
  );
}

type PauseRecordSummaryProps = {
  record: PauseRecord;
  recordCount: number;
  onClose: () => void;
  onViewProgress: () => void;
  onOpenProtection: () => void;
};

function PauseRecordSummary({
  record,
  recordCount,
  onClose,
  onViewProgress,
  onOpenProtection
}: PauseRecordSummaryProps) {
  return (
    <AppScreen>
      <PauseFlowHeader
        title="Pause saved"
        subtitle="You noticed the moment and created space before continuing."
        onClosePress={onClose}
      />

      <View style={styles.stack}>
        <AppCard
          testID="bloom.pause.saved"
          style={styles.savedCard}
          accessibilityRole="summary"
        >
          <View style={styles.cardStack}>
            <View style={styles.successCircle}>
              <AppText variant="title">✓</AppText>
            </View>
            <AppText variant="title">Pause saved</AppText>
            <AppText tone="secondary">
              Saved pauses: {recordCount}.
            </AppText>
          </View>
        </AppCard>

        {record.intensityBefore !== undefined ||
        record.intensityAfterChange !== undefined ? (
          <View style={styles.metricGrid}>
            {record.intensityBefore !== undefined ? (
              <PauseSummaryMetricCard
                label="Urge before"
                value={`${record.intensityBefore} / 10`}
                detail="Before pause"
              />
            ) : null}
            {record.intensityAfterChange !== undefined ? (
              <PauseSummaryMetricCard
                label="Urge after"
                value={pauseIntensityAfterLabels[record.intensityAfterChange]}
                detail="After pause"
              />
            ) : null}
          </View>
        ) : null}

        <AppCard>
          <View style={styles.summaryRows}>
            <SummaryRow
              label="Completed"
              value={formatCompletedAt(record.completedAt)}
            />
            <SummaryRow
              label="Duration"
              value={formatPauseDuration(record.durationSeconds)}
            />
            {record.triggers.length > 0 ? (
              <SummaryRow
                label="Trigger context"
                value={record.triggers
                  .map((trigger) => pauseTriggerLabels[trigger])
                  .join(", ")}
              />
            ) : null}
            {record.selectedAction !== undefined ? (
              <SummaryRow
                label="Selected action"
                value={pauseHelpfulActionLabels[record.selectedAction]}
              />
            ) : null}
            {record.feltTruth !== undefined ? (
              <SummaryRow
                label="What felt true"
                value={pauseTruthLabels[record.feltTruth]}
              />
            ) : null}
            {record.nextStep !== undefined ? (
              <SummaryRow
                label="Next choice"
                value={pauseNextStepLabels[record.nextStep]}
              />
            ) : null}
          </View>
        </AppCard>

        <PauseObservationCard
          title="Observation"
          body="This saved pause is a record of what you noticed, not a score."
        />

        <View style={styles.actions}>
          <AppButton onPress={onClose}>Back to Today</AppButton>
          <AppButton variant="secondary" onPress={onViewProgress}>
            View Progress
          </AppButton>
          <AppButton variant="ghost" onPress={onOpenProtection}>
            Set Up Night Protection
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
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

function formatCompletedAt(completedAt: string) {
  return new Date(completedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  successCircle: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  savedCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage
  },
  summaryRows: {
    gap: theme.spacing.md
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  summaryValue: {
    flex: 1,
    textAlign: "right"
  }
});
