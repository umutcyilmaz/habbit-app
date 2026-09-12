import { useState, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import type {
  ErectionQuality,
  MasturbationEndingReason,
  MasturbationSessionFeedback
} from "../../../domain/models/MasturbationSession";
import type { MasturbationTrackingStartBlockReason } from "../../../domain/productPolicy/getMasturbationTrackingAvailability";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { formatMasturbationElapsedSeconds } from "../masturbationSessionView";
import { useMasturbationSessionFeature } from "../useMasturbationSessionFeature";

type SessionFeature = ReturnType<typeof useMasturbationSessionFeature>;

const erectionQualities: readonly ErectionQuality[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const endingReasons: ReadonlyArray<{ value: MasturbationEndingReason; label: string }> = [
  { value: "climaxed", label: "Climaxed" },
  { value: "stoppedBeforeClimax", label: "Stopped before climax" },
  { value: "firmnessDecreased", label: "Firmness decreased" },
  { value: "feltAnxious", label: "Felt anxious" },
  { value: "stoppedByChoice", label: "Chose to stop" },
  { value: "other", label: "Another reason" }
];

export function MasturbationSessionStartScreen() {
  const feature = useMasturbationSessionFeature("start");
  const { view, availability, busy, locked, actions } = feature;

  return (
    <SessionPage feature={feature} title="Masturbation session" testID="bloom.masturbation.start">
      {view.kind === "active" || view.kind === "awaitingFeedback" ? (
        <ContinueSessionCard feature={feature} />
      ) : view.kind === "completed" ? (
        <CompletedSessionCard feature={feature} />
      ) : view.kind === "invalid" || view.kind === "mismatch" ? (
        <UnavailableSessionCard kind={view.kind} />
      ) : (
        <AppCard style={styles.stack}>
          <AppText variant="title">Start when you’re ready</AppText>
          <AppText tone="secondary">
            Track the session and reflect afterward. Pauses are optional.
          </AppText>
          {availability?.canStartSession !== true ? (
            <AppText testID="bloom.masturbation.start.unavailable" variant="bodySmall" tone="secondary">
              {getStartBlockMessage(availability?.blockReason)}
            </AppText>
          ) : null}
          <AppButton
            testID="bloom.masturbation.start.begin"
            disabled={locked || availability?.canStartSession !== true}
            loading={busy}
            onPress={actions.start}
          >
            Start session
          </AppButton>
        </AppCard>
      )}
    </SessionPage>
  );
}

export function MasturbationSessionActiveScreen() {
  const feature = useMasturbationSessionFeature("active");
  const { view, locked, actions } = feature;

  return (
    <SessionPage feature={feature} title="Your session" testID="bloom.masturbation.active">
      {view.kind === "active" ? (
        <AppCard style={styles.stack}>
          <View style={styles.timerBlock}>
            <AppText variant="label" tone="secondary">{view.paused ? "Pause in progress" : "Session in progress"}</AppText>
            <AppText testID="bloom.masturbation.timer" style={styles.timer} align="center">
              {formatMasturbationElapsedSeconds(view.elapsedSeconds)}
            </AppText>
            <AppText variant="bodySmall" tone="secondary" align="center">
              Total elapsed time includes pauses.
            </AppText>
          </View>
          {view.paused ? (
            <AppButton testID="bloom.masturbation.active.resume" variant="secondary" disabled={locked} onPress={actions.endPause}>
              Resume session
            </AppButton>
          ) : (
            <AppButton testID="bloom.masturbation.active.pause" variant="secondary" disabled={locked} onPress={actions.startPause}>
              Pause
            </AppButton>
          )}
          <AppButton testID="bloom.masturbation.active.end" disabled={locked} onPress={actions.end}>
            End session
          </AppButton>
          <AppText variant="caption" tone="secondary" align="center">
            You can close this screen and continue your session later.
          </AppText>
        </AppCard>
      ) : view.kind === "awaitingFeedback" ? (
        <ContinueSessionCard feature={feature} />
      ) : view.kind === "completed" ? (
        <CompletedSessionCard feature={feature} />
      ) : (
        <UnavailableSessionCard kind={view.kind} />
      )}
    </SessionPage>
  );
}

export function MasturbationSessionFeedbackScreen() {
  const feature = useMasturbationSessionFeature("feedback");
  const { view, locked, actions } = feature;

  return (
    <SessionPage feature={feature} title="Session feedback" testID="bloom.masturbation.feedback">
      {view.kind === "awaitingFeedback" ? (
        <FeedbackForm
          key={view.session.id}
          durationSeconds={view.session.durationSeconds}
          locked={locked}
          onSubmit={actions.completeFeedback}
        />
      ) : view.kind === "active" ? (
        <ContinueSessionCard feature={feature} />
      ) : view.kind === "completed" ? (
        <CompletedSessionCard feature={feature} />
      ) : (
        <UnavailableSessionCard kind={view.kind} />
      )}
    </SessionPage>
  );
}

function SessionPage({ feature, title, testID, children }: PropsWithChildren<{
  feature: SessionFeature;
  title: string;
  testID: string;
}>) {
  return (
    <AppScreen>
      <View testID={testID} style={styles.stack}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="caption" tone="secondary">MASTURBATION TRACKING</AppText>
            <AppText variant="heading" accessibilityRole="header">{title}</AppText>
          </View>
          <AppButton testID="bloom.masturbation.close" variant="ghost" disabled={feature.busy} onPress={feature.actions.close}>
            Close
          </AppButton>
        </View>
        {feature.busy || feature.message !== null || feature.canRetry ? (
          <AppCard style={styles.stack}>
            {feature.busy ? (
              <AppText accessibilityLiveRegion="polite" variant="bodySmall">Saving to this device…</AppText>
            ) : null}
            {feature.message !== null ? (
              <AppText testID="bloom.masturbation.message" accessibilityLiveRegion="polite" accessibilityRole="alert" variant="bodySmall" tone="danger">
                {feature.message}
              </AppText>
            ) : null}
            {feature.canRetry ? (
              <AppButton testID="bloom.masturbation.retry" variant="secondary" disabled={feature.busy} loading={feature.busy} onPress={feature.actions.retry}>
                Try saving again
              </AppButton>
            ) : null}
          </AppCard>
        ) : null}
        {children}
      </View>
    </AppScreen>
  );
}

function ContinueSessionCard({ feature }: { feature: SessionFeature }) {
  const { view } = feature;
  if (view.kind !== "active" && view.kind !== "awaitingFeedback") return null;
  const awaitingFeedback = view.kind === "awaitingFeedback";

  return (
    <AppCard style={styles.stack}>
      <AppText variant="title">{awaitingFeedback ? "Your session has ended" : "You have a session in progress"}</AppText>
      <AppText tone="secondary">
        {awaitingFeedback ? "Complete your feedback to finish this record." : "Continue the existing session whenever you’re ready."}
      </AppText>
      <AppText variant="bodySmall" tone="secondary">
        {awaitingFeedback ? "Session duration: " : "Elapsed time: "}
        {formatMasturbationElapsedSeconds(view.kind === "active" ? view.elapsedSeconds : view.session.durationSeconds)}
      </AppText>
      <AppButton testID="bloom.masturbation.continue" disabled={feature.locked || !feature.canContinue} onPress={feature.actions.continueSession}>
        {awaitingFeedback ? "Continue to feedback" : "Continue session"}
      </AppButton>
    </AppCard>
  );
}

function CompletedSessionCard({ feature }: { feature: SessionFeature }) {
  return (
    <AppCard style={styles.stack}>
      <AppText variant="title">{feature.isDurablyCompleted ? "Session saved" : "Save not yet confirmed"}</AppText>
      <AppText tone="secondary">
        {feature.isDurablyCompleted
          ? "Your session and feedback are saved on this device."
          : "Your feedback is in this session. Saving to this device still needs confirmation."}
      </AppText>
      <AppButton disabled={feature.busy} onPress={feature.actions.close}>
        {feature.isDurablyCompleted ? "Done" : "Close"}
      </AppButton>
    </AppCard>
  );
}

function UnavailableSessionCard({ kind }: { kind: "missing" | "invalid" | "mismatch" }) {
  return (
    <AppCard style={styles.stack} testID="bloom.masturbation.unavailable">
      <AppText variant="title">Session unavailable</AppText>
      <AppText tone="secondary">
        {kind === "missing"
          ? "There’s no unfinished session at this link. You can close this screen."
          : "This link doesn’t match an available session. Close this screen and use the current session’s link."}
      </AppText>
    </AppCard>
  );
}

function FeedbackForm({ durationSeconds, locked, onSubmit }: {
  durationSeconds: number;
  locked: boolean;
  onSubmit: (feedback: MasturbationSessionFeedback) => void;
}) {
  const [erectionQuality, setErectionQuality] = useState<ErectionQuality | null>(null);
  const [usedExplicitContent, setUsedExplicitContent] = useState<boolean | null>(null);
  const [endingReason, setEndingReason] = useState<MasturbationEndingReason | null>(null);
  const complete = erectionQuality !== null && usedExplicitContent !== null && endingReason !== null;

  const submit = () => {
    if (locked || erectionQuality === null || usedExplicitContent === null || endingReason === null) return;
    onSubmit({ erectionQuality, usedExplicitContent, endingReason });
  };

  return (
    <View style={styles.stack}>
      <AppText tone="secondary">Session duration: {formatMasturbationElapsedSeconds(durationSeconds)}</AppText>
      <AppCard style={styles.stack}>
        <AppText variant="title">Erection quality</AppText>
        <AppText variant="bodySmall" tone="secondary">Choose your own rating from 1 to 10.</AppText>
        <View style={styles.ratingGrid} accessibilityRole="radiogroup" accessibilityLabel="Erection quality">
          {erectionQualities.map((value) => (
            <AppButton
              key={value}
              testID={`bloom.masturbation.feedback.erection.${value}`}
              accessibilityRole="radio"
              accessibilityLabel={`Erection quality ${value} of 10`}
              accessibilityState={{ checked: erectionQuality === value }}
              variant={erectionQuality === value ? "primary" : "subtle"}
              style={styles.ratingButton}
              disabled={locked}
              onPress={() => setErectionQuality(value)}
            >
              {value}
            </AppButton>
          ))}
        </View>
      </AppCard>
      <AppCard style={styles.stack}>
        <AppText variant="title">Did you intentionally use explicit content?</AppText>
        <AppText variant="bodySmall" tone="secondary">Accidental exposure doesn’t count.</AppText>
        <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Intentional explicit-content use">
          {[false, true].map((value) => (
            <AppButton
              key={String(value)}
              testID={`bloom.masturbation.feedback.content.${value ? "yes" : "no"}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: usedExplicitContent === value }}
              variant={usedExplicitContent === value ? "primary" : "subtle"}
              style={styles.choiceButton}
              disabled={locked}
              onPress={() => setUsedExplicitContent(value)}
            >
              {value ? "Yes" : "No"}
            </AppButton>
          ))}
        </View>
      </AppCard>
      <AppCard style={styles.stack}>
        <AppText variant="title">How did the session end?</AppText>
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Session ending reason">
          {endingReasons.map(({ value, label }) => (
            <AppButton
              key={value}
              testID={`bloom.masturbation.feedback.ending.${value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: endingReason === value }}
              variant={endingReason === value ? "primary" : "subtle"}
              disabled={locked}
              onPress={() => setEndingReason(value)}
            >
              {label}
            </AppButton>
          ))}
        </View>
      </AppCard>
      {!complete ? <AppText variant="bodySmall" tone="secondary">Choose an answer for each question to save.</AppText> : null}
      <AppButton testID="bloom.masturbation.feedback.submit" disabled={locked || !complete} onPress={submit}>
        Save session
      </AppButton>
    </View>
  );
}

function getStartBlockMessage(reason: MasturbationTrackingStartBlockReason | undefined): string {
  switch (reason) {
    case "trackingDisabled": return "Tracking is turned off. Starting a new session is unavailable.";
    case "activeSession": return "Continue your existing session before starting another.";
    case "awaitingFeedback": return "Finish feedback for your current session before starting another.";
    case "resetRestriction": return "Your Reset period is still in progress. Starting a session is unavailable during this period.";
    default: return "Session availability couldn’t be checked. Close this screen and try again.";
  }
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  headerText: { flex: 1, gap: theme.spacing.sm },
  timerBlock: { alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.xl },
  timer: { fontFamily: theme.typography.family.monoMedium, fontSize: 48, lineHeight: 64, fontVariant: ["tabular-nums"] },
  ratingGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  ratingButton: { flexBasis: "16%", flexGrow: 1, minWidth: 44, paddingHorizontal: theme.spacing.sm },
  choiceRow: { flexDirection: "row", gap: theme.spacing.sm },
  choiceButton: { flex: 1 },
  options: { gap: theme.spacing.sm }
});
