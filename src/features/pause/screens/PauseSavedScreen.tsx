import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { PauseRecord } from "../../../storage/bloomState";
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
import {
  getPauseSavedRouteIntent,
  resolvePauseSavedRoute
} from "../pauseSavedRoute";

export function PauseSavedScreen() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams<{
    recordId?: string | string[];
  }>();
  const { state, durableState } = useBloomLocalState();
  const resolution = resolvePauseSavedRoute(
    state.pause,
    durableState.pause,
    getPauseSavedRouteIntent(recordId)
  );
  const routeState = resolution.status;

  useEffect(() => {
    if (routeState === "collect-completion") {
      router.replace(routes.pauseTimer);
      return;
    }

    if (routeState === "redirect") {
      router.replace(routes.pause);
    }
  }, [routeState, router]);

  if (routeState === "unconfirmed") {
    return (
      <PauseSaveUnconfirmed
        onReturn={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace(routes.pause);
        }}
        onClose={() => router.replace(routes.home)}
      />
    );
  }

  if (
    resolution.status !== "show-completion" &&
    resolution.status !== "show-history"
  ) {
    return <AppScreen />;
  }

  return (
    <PauseRecordSummary
      mode={
        resolution.status === "show-completion"
          ? "completion"
          : "history"
      }
      record={resolution.record}
      recordCount={durableState.pause.records.length}
      onClose={() => router.replace(routes.home)}
      onViewProgress={() => router.push(routes.progress)}
      onOpenProtection={() => router.push(routes.protect)}
    />
  );
}

type PauseRecordSummaryProps = {
  mode: "completion" | "history";
  record: PauseRecord;
  recordCount: number;
  onClose: () => void;
  onViewProgress: () => void;
  onOpenProtection: () => void;
};

function PauseRecordSummary({
  mode,
  record,
  recordCount,
  onClose,
  onViewProgress,
  onOpenProtection
}: PauseRecordSummaryProps) {
  return (
    <AppScreen>
      <PauseFlowHeader
        title={mode === "completion" ? "Pause saved" : "Pause history"}
        subtitle={
          mode === "completion"
            ? "You noticed the moment and created space before continuing."
            : "Review a Pause previously saved on this device."
        }
        onClosePress={onClose}
      />

      <View style={styles.stack}>
        <AppCard
          testID="bloom.pause.saved"
          style={mode === "completion" ? styles.savedCard : undefined}
          accessibilityRole="summary"
        >
          <View style={styles.cardStack}>
            <View style={styles.successCircle}>
              <AppText variant={mode === "completion" ? "title" : "caption"}>
                {mode === "completion" ? "✓" : "History"}
              </AppText>
            </View>
            <AppText variant="title">
              {mode === "completion" ? "Pause saved" : "Saved Pause record"}
            </AppText>
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

type PauseSaveUnconfirmedProps = {
  onReturn: () => void;
  onClose: () => void;
};

function PauseSaveUnconfirmed({
  onReturn,
  onClose
}: PauseSaveUnconfirmedProps) {
  return (
    <AppScreen>
      <PauseFlowHeader
        title="Pause save not confirmed"
        subtitle="Bloom could not match this screen to a Pause saved in local storage."
        onClosePress={onClose}
      />

      <View style={styles.stack}>
        <AppCard
          testID="bloom.pause.saved-unconfirmed"
          accessibilityRole="alert"
        >
          <View style={styles.cardStack}>
            <AppText variant="title">This Pause is not shown as saved</AppText>
            <AppText tone="secondary">
              Go back to retry if the save option is still available, or return
              safely to Today.
            </AppText>
          </View>
        </AppCard>

        <View style={styles.actions}>
          <AppButton onPress={onReturn}>Go back</AppButton>
          <AppButton variant="ghost" onPress={onClose}>
            Back to Today
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
