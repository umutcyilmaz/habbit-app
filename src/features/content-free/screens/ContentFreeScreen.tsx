import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { formatContentFreeEventTime, formatContentFreeStreakSeconds } from "../contentFreeView";
import { useContentFreeFeature } from "../useContentFreeFeature";

type ContentFreeFeature = ReturnType<typeof useContentFreeFeature>;

const saveStateLabels: Record<ContentFreeFeature["saveState"], string> = {
  loading: "Loading your saved state…",
  unavailable: "Local data is unavailable",
  saving: "Saving to this device…",
  saved: "Saved on this device",
  unconfirmed: "Save not yet confirmed"
};

export function ContentFreeScreen() {
  const feature = useContentFreeFeature();
  const { view, busy, locked, actions } = feature;
  const { progress } = view;

  return (
    <AppScreen>
      <View testID="bloom.content-free" style={styles.stack}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="heading" accessibilityRole="header">Content-Free</AppText>
            <AppText variant="bodySmall" tone="secondary">Track time without intentional explicit-content use.</AppText>
          </View>
          <AppButton testID="bloom.content-free.close" variant="ghost" disabled={busy} onPress={actions.close}>
            Close
          </AppButton>
        </View>
        <SaveStatus feature={feature} />
        {progress === null ? (
          <AppCard style={styles.stack}>
            <AppText variant="title">{feature.saveState === "loading" ? "Loading Content-Free" : "Content-Free is unavailable"}</AppText>
            <AppText tone="secondary">
              {feature.saveState === "loading" ? "Your saved data is loading." : "Your current progress couldn’t be checked. Close this screen and try again."}
            </AppText>
          </AppCard>
        ) : progress.status === "inactive" ? (
          <AppCard style={styles.stack}>
            <AppText testID="bloom.content-free.status" variant="title">Content-Free is inactive</AppText>
            <AppText tone="secondary">
              Activate it when you’re ready. Content-Free works independently from Masturbation Tracking.
            </AppText>
            <BestStreak seconds={progress.effectiveBestStreakSeconds} />
            <AppButton testID="bloom.content-free.activate" disabled={locked} onPress={actions.activate}>
              Activate Content-Free
            </AppButton>
          </AppCard>
        ) : (
          <>
            <AppCard style={styles.stack}>
              <AppText testID="bloom.content-free.status" variant="label">Content-Free is active</AppText>
              <View style={styles.streak}>
                <AppText variant="bodySmall" tone="secondary">Current streak</AppText>
                <AppText testID="bloom.content-free.current-streak" style={styles.currentStreak}>
                  {formatContentFreeStreakSeconds(progress.currentStreakSeconds)}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {progress.currentCompletedDays} {progress.currentCompletedDays === 1 ? "full day" : "full days"} completed
                </AppText>
              </View>
              <BestStreak seconds={progress.effectiveBestStreakSeconds} />
            </AppCard>
            <ManualViolationAction
              key={view.activationId}
              locked={locked}
              onRecord={actions.recordManualViolation}
            />
            <AppButton testID="bloom.content-free.deactivate" variant="subtle" disabled={locked} onPress={actions.deactivate}>
              Deactivate Content-Free
            </AppButton>
          </>
        )}
        <ViolationHistory feature={feature} />
      </View>
    </AppScreen>
  );
}

function SaveStatus({ feature }: { feature: ContentFreeFeature }) {
  return (
    <AppCard style={styles.stack}>
      <AppText testID="bloom.content-free.save-state" accessibilityLiveRegion="polite" variant="bodySmall" tone="secondary">
        {saveStateLabels[feature.saveState]}
      </AppText>
      {feature.message !== null ? (
        <AppText testID="bloom.content-free.message" accessibilityLiveRegion="polite" accessibilityRole="alert" variant="bodySmall" tone="danger">
          {feature.message}
        </AppText>
      ) : null}
      {feature.canRetry ? (
        <AppButton testID="bloom.content-free.retry" variant="secondary" disabled={feature.busy} loading={feature.busy} onPress={feature.actions.retry}>
          Try saving again
        </AppButton>
      ) : null}
    </AppCard>
  );
}

function BestStreak({ seconds }: { seconds: number }) {
  return (
    <View style={styles.streak}>
      <AppText variant="bodySmall" tone="secondary">Best streak</AppText>
      <AppText testID="bloom.content-free.best-streak" variant="title">
        {formatContentFreeStreakSeconds(seconds)}
      </AppText>
    </View>
  );
}

function ManualViolationAction({ locked, onRecord }: { locked: boolean; onRecord: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const confirmationOpen = useRef(false);
  const openConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = true;
    setConfirming(true);
  };
  const cancelConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = false;
    setConfirming(false);
  };
  const recordConfirmed = () => {
    if (locked || !confirmationOpen.current) return;
    // Consume this confirmation before dispatch, including before React has
    // rendered the closed card. Another event requires opening it again.
    confirmationOpen.current = false;
    setConfirming(false);
    onRecord();
  };

  return (
    <AppCard style={styles.stack}>
      {confirming ? (
        <>
          <AppText variant="title">Record intentional use now?</AppText>
          <AppText tone="secondary">
            This records intentional explicit-content use as happening now. Accidental exposure doesn’t count.
          </AppText>
          <AppButton testID="bloom.content-free.record.confirm" disabled={locked} onPress={recordConfirmed}>
            Record intentional use now
          </AppButton>
          <AppButton testID="bloom.content-free.record.cancel" variant="ghost" disabled={locked} onPress={cancelConfirmation}>
            Cancel
          </AppButton>
        </>
      ) : (
        <>
          <AppText variant="title">Log intentional use</AppText>
          <AppText variant="bodySmall" tone="secondary">Only intentional explicit-content use belongs in this log.</AppText>
          <AppButton testID="bloom.content-free.record" variant="secondary" disabled={locked} onPress={openConfirmation}>
            Record intentional explicit-content use
          </AppButton>
        </>
      )}
    </AppCard>
  );
}

function ViolationHistory({ feature }: { feature: ContentFreeFeature }) {
  const { view, locked, actions } = feature;
  return (
    <View style={styles.stack}>
      <AppText variant="title" accessibilityRole="header">History</AppText>
      {view.history.length === 0 ? (
        <AppText variant="bodySmall" tone="secondary">No intentional-use entries yet.</AppText>
      ) : view.history.map((violation) => (
        <AppCard key={violation.id} testID={`bloom.content-free.history.${violation.id}`} style={styles.stack}>
          <View style={styles.streak}>
            <AppText variant="label">Intentional explicit-content use</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {violation.source.kind === "masturbationSession" ? "From session feedback" : "Manual entry"}
              {violation.status === "undone" ? " · Undone" : " · Recorded"}
            </AppText>
          </View>
          <View style={styles.streak}>
            <AppText variant="bodySmall" tone="secondary">Occurred: {formatContentFreeEventTime(violation.occurredAt)}</AppText>
            <AppText variant="caption" tone="secondary">Recorded: {formatContentFreeEventTime(violation.recordedAt)}</AppText>
            {violation.status === "undone" ? (
              <AppText variant="caption" tone="secondary">Undone: {formatContentFreeEventTime(violation.undoneAt)}</AppText>
            ) : null}
          </View>
          {view.manualUndoCandidateId === violation.id ? (
            <AppButton
              testID={`bloom.content-free.undo.${violation.id}`}
              variant="subtle"
              disabled={locked}
              onPress={() => actions.undoManualViolation(violation.id)}
            >
              Undo this entry
            </AppButton>
          ) : null}
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  headerText: { flex: 1, gap: theme.spacing.sm },
  streak: { gap: theme.spacing.sm },
  currentStreak: { fontFamily: theme.typography.family.monoMedium, fontSize: 32, lineHeight: 44, fontVariant: ["tabular-nums"] }
});
