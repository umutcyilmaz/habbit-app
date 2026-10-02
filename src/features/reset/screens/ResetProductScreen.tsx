import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ResetViolation } from "../../../domain/models/ResetJourney";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ResetBaselineAnswers } from "../resetController";
import { formatResetEventTime, formatResetRemainingSeconds } from "../resetView";
import { useResetFeature } from "../useResetFeature";

type ResetFeature = ReturnType<typeof useResetFeature>;
type ResetMode = Parameters<typeof useResetFeature>[0];
type ActiveResetView = Extract<ResetFeature["view"], { kind: "active" }>;
type Choice<T extends string> = { value: T; label: string };

const titles: Record<ResetMode, string> = {
  baseline: "Before your Reset",
  progress: "Your 15-day Reset",
  completion: "Finish your Reset period"
};
const saveStateLabels: Record<ResetFeature["saveState"], string> = {
  loading: "Loading your saved state…",
  unavailable: "Save status is unavailable",
  saving: "Saving to this device…",
  saved: "Saved on this device",
  unconfirmed: "Save not yet confirmed"
};
const violationReasons: ReadonlyArray<Choice<ResetViolation["reason"]>> = [
  { value: "masturbation", label: "Masturbation" },
  { value: "intentionalExplicitContent", label: "Intentional explicit-content use" },
  { value: "masturbationWithExplicitContent", label: "Masturbation with explicit content" }
];

export function ResetBaselineScreen() {
  return <ResetProductScreen mode="baseline" />;
}

export function ResetProgressScreen() {
  return <ResetProductScreen mode="progress" />;
}

export function ResetCompletionScreen() {
  return <ResetProductScreen mode="completion" />;
}

function ResetProductScreen({ mode }: { mode: ResetMode }) {
  const feature = useResetFeature(mode);
  return (
    <AppScreen>
      <View testID={`bloom.reset.${mode}`} style={styles.stack}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="caption" tone="secondary">15-DAY RESET</AppText>
            <AppText variant="heading" accessibilityRole="header">{titles[mode]}</AppText>
          </View>
          <AppButton testID="bloom.reset.close" variant="ghost" disabled={feature.busy} onPress={feature.actions.close}>
            Close
          </AppButton>
        </View>
        <SaveStatus feature={feature} />
        <ResetContent mode={mode} feature={feature} />
      </View>
    </AppScreen>
  );
}

function ResetContent({ mode, feature }: { mode: ResetMode; feature: ResetFeature }) {
  const { view, locked, actions } = feature;
  // An accepted operation can change the route identity before its save is
  // acknowledged. Keep its recovery controls visible over the stale route.
  if (feature.recoveryTarget !== null) return <RecoveryCard feature={feature} />;
  if (mode === "baseline" && view.kind === "baseline") {
    return <ResetBaselineForm key={view.reset.id} locked={locked} onSubmit={actions.startFromBaseline} />;
  }
  if (mode === "progress" && view.kind === "active") {
    return (
      <>
        <ProgressSummary view={view} />
        {view.progress.isPeriodComplete ? (
          <AppCard style={styles.stack}>
            <AppText variant="title">Your 15-day period has ended</AppText>
            <AppText tone="secondary">Continue to save your completed Reset.</AppText>
            <AppButton testID="bloom.reset.continue" disabled={locked || !feature.canOpenCompletion} onPress={actions.continueToCompletion}>
              Continue to completion
            </AppButton>
          </AppCard>
        ) : (
          <ResetViolationForm key={`${view.reset.id}:${view.reset.currentAttempt.id}`} locked={locked} onRecord={actions.recordViolation} />
        )}
        <ResetViolationHistory view={view} locked={locked} onUndo={actions.undoViolation} />
      </>
    );
  }
  if (mode === "completion" && view.kind === "active") {
    return (
      <>
        <ProgressSummary view={view} />
        <AppCard style={styles.stack}>
          {view.progress.isPeriodComplete ? (
            <>
              <AppText variant="title">Your 15-day period has ended</AppText>
              <AppText tone="secondary">
                Your 15-day period has ended. Save its completion to return to Today.
              </AppText>
              <AppButton testID="bloom.reset.complete" disabled={locked} onPress={actions.completeElapsed}>
                Save completion
              </AppButton>
            </>
          ) : (
            <>
              <AppText variant="title">The period is still in progress</AppText>
              <AppText tone="secondary">Completion becomes available after the full 15-day period has elapsed.</AppText>
            </>
          )}
        </AppCard>
      </>
    );
  }
  return (
    <AppCard testID="bloom.reset.unavailable" style={styles.stack}>
      <AppText variant="title">Reset unavailable at this link</AppText>
      <AppText tone="secondary">This link doesn’t match an available Reset step. Close this screen and use the current Reset link.</AppText>
    </AppCard>
  );
}

function SaveStatus({ feature }: { feature: ResetFeature }) {
  return (
    <AppCard style={styles.stack}>
      <AppText testID="bloom.reset.save-state" accessibilityLiveRegion="polite" variant="bodySmall" tone="secondary">
        {saveStateLabels[feature.saveState]}
      </AppText>
      {feature.message !== null ? (
        <AppText testID="bloom.reset.message" accessibilityLiveRegion="polite" accessibilityRole="alert" variant="bodySmall" tone="danger">
          {feature.message}
        </AppText>
      ) : null}
      {feature.canRetry ? (
        <AppButton testID="bloom.reset.retry" variant="secondary" disabled={feature.busy} loading={feature.busy} onPress={feature.actions.retry}>
          Try saving again
        </AppButton>
      ) : null}
    </AppCard>
  );
}

function RecoveryCard({ feature }: { feature: ResetFeature }) {
  const target = feature.recoveryTarget;
  if (target === null) return null;
  const nextStep = {
    progress: "Your next step is the current Reset progress screen.",
    today: "Your next step is Today."
  };
  return (
    <AppCard testID="bloom.reset.recovery" style={styles.stack}>
      <AppText variant="title">Next step</AppText>
      <AppText tone="secondary">{nextStep[target]}</AppText>
      {!feature.canContinue ? (
        <AppText variant="bodySmall" tone="secondary">Continue becomes available once this change is saved.</AppText>
      ) : null}
      <AppButton testID="bloom.reset.continue" disabled={feature.locked || !feature.canContinue} onPress={feature.actions.continueAfterSave}>
        {target === "today" ? "Back to Today" : "Continue"}
      </AppButton>
    </AppCard>
  );
}

function ProgressSummary({ view }: { view: ActiveResetView }) {
  return (
    <AppCard style={styles.stack}>
      <AppText testID="bloom.reset.current-day" variant="title">
        {view.progress.isPeriodComplete ? "15-day period complete" : `Day ${view.progress.currentDay} of 15`}
      </AppText>
      <AppText tone="secondary">
        {view.restriction.isRestrictionActive ? "Your Reset period is in progress." : "Your Reset behavioral restriction has ended."}
      </AppText>
      <View style={styles.details}>
        <AppText testID="bloom.reset.completed-days" variant="bodySmall">Completed days: {view.progress.completedDays} of 15</AppText>
        <AppText testID="bloom.reset.best-days" variant="bodySmall">Best completed days: {view.bestCompletedDays} of 15</AppText>
        <AppText testID="bloom.reset.attempt-start" variant="bodySmall" tone="secondary">
          Current attempt started: {formatResetEventTime(view.reset.currentAttempt.startedAt)}
        </AppText>
      </View>
      <View style={styles.details}>
        <AppText variant="bodySmall" tone="secondary">Remaining period</AppText>
        <AppText testID="bloom.reset.remaining" style={styles.remaining}>
          {formatResetRemainingSeconds(view.progress.remainingSeconds)}
        </AppText>
      </View>
    </AppCard>
  );
}

function ResetBaselineForm({ locked, onSubmit }: { locked: boolean; onSubmit: (selfReport: ResetBaselineAnswers) => void }) {
  const [erectionDecline, setErectionDecline] = useState<ResetBaselineAnswers["erectionDecline"] | null>(null);
  const [needsStrongerOrFasterStimulation, setNeedsStrongerOrFasterStimulation] = useState<ResetBaselineAnswers["needsStrongerOrFasterStimulation"] | null>(null);
  const [climaxTakesLonger, setClimaxTakesLonger] = useState<ResetBaselineAnswers["climaxTakesLonger"] | null>(null);
  const [difficultyArousingWithoutExplicitContent, setDifficultyArousingWithoutExplicitContent] = useState<ResetBaselineAnswers["difficultyArousingWithoutExplicitContent"] | null>(null);
  const complete = erectionDecline !== null && needsStrongerOrFasterStimulation !== null &&
    climaxTakesLonger !== null && difficultyArousingWithoutExplicitContent !== null;
  const submit = () => {
    if (locked || erectionDecline === null || needsStrongerOrFasterStimulation === null ||
      climaxTakesLonger === null || difficultyArousingWithoutExplicitContent === null) return;
    onSubmit({ erectionDecline, needsStrongerOrFasterStimulation, climaxTakesLonger, difficultyArousingWithoutExplicitContent });
  };

  return (
    <View style={styles.stack}>
      <AppText tone="secondary">15 günlük Reset öncesinde kendi gözlemlerini kaydet. Her soru için bir yanıt seç.</AppText>
      <ResetChoice
        title="Ereksiyonunda bir düşüş fark ediyor musun?"
        testIDPrefix="bloom.reset.baseline.erectionDecline"
        value={erectionDecline}
        onChange={setErectionDecline}
        locked={locked}
        options={[{ value: "clear", label: "Evet, belirgin" }, { value: "mild", label: "Evet, hafif" }, { value: "none", label: "Hayır" }, { value: "notSure", label: "Emin değilim" }]}
      />
      <ResetChoice
        title="Aynı seviyede uyarılmak için daha sert ya da daha hızlı yapman gerekiyor mu?"
        testIDPrefix="bloom.reset.baseline.needsStrongerOrFasterStimulation"
        value={needsStrongerOrFasterStimulation}
        onChange={setNeedsStrongerOrFasterStimulation}
        locked={locked}
        options={[{ value: "clearly", label: "Evet, belirgin" }, { value: "somewhat", label: "Biraz" }, { value: "no", label: "Hayır" }]}
      />
      <ResetChoice
        title="Boşalmak eskisine göre daha mı uzun sürüyor?"
        testIDPrefix="bloom.reset.baseline.climaxTakesLonger"
        value={climaxTakesLonger}
        onChange={setClimaxTakesLonger}
        locked={locked}
        options={[{ value: "clearly", label: "Evet, belirgin" }, { value: "somewhat", label: "Biraz" }, { value: "no", label: "Hayır" }, { value: "notSure", label: "Emin değilim" }]}
      />
      <AppText variant="bodySmall" tone="secondary">Burada “içerik”, bilerek kullanılan açık cinsel içerik anlamına gelir.</AppText>
      <ResetChoice
        title="İçerik olmadan uyarılmakta zorlanıyor musun?"
        testIDPrefix="bloom.reset.baseline.difficultyArousingWithoutExplicitContent"
        value={difficultyArousingWithoutExplicitContent}
        onChange={setDifficultyArousingWithoutExplicitContent}
        locked={locked}
        options={[{ value: "yes", label: "Evet" }, { value: "sometimes", label: "Bazen" }, { value: "no", label: "Hayır" }, { value: "notTried", label: "Denemedim" }]}
      />
      {!complete ? <AppText variant="bodySmall" tone="secondary">Choose an answer for each question to begin.</AppText> : null}
      <AppButton testID="bloom.reset.baseline.submit" disabled={locked || !complete} onPress={submit}>
        Begin 15-day Reset
      </AppButton>
    </View>
  );
}

function ResetViolationForm({ locked, onRecord }: { locked: boolean; onRecord: (reason: ResetViolation["reason"]) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<ResetViolation["reason"] | null>(null);
  const confirmationOpen = useRef(false);
  const openConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = true;
    setReason(null);
    setConfirming(true);
  };
  const cancelConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = false;
    setConfirming(false);
    setReason(null);
  };
  const confirm = () => {
    if (locked || !confirmationOpen.current || reason === null) return;
    // Consume this explicit confirmation before dispatch, including before
    // React renders the closed form. A second event needs a new confirmation.
    confirmationOpen.current = false;
    setConfirming(false);
    setReason(null);
    onRecord(reason);
  };

  return confirming ? (
    <View style={styles.stack}>
      <ResetChoice
        title="What happened?"
        testIDPrefix="bloom.reset.violation.reason"
        value={reason}
        onChange={setReason}
        locked={locked}
        options={violationReasons}
      />
      <AppCard style={styles.stack}>
        <AppText variant="title">Restart this attempt from Day 1?</AppText>
        <AppText tone="secondary">Recording this event as happening now restarts the current Reset attempt from Day 1.</AppText>
        <AppText variant="bodySmall" tone="secondary">
          If the event includes intentional explicit-content use and Content-Free is active, its streak is updated together with this Reset entry. Accidental exposure doesn’t count.
        </AppText>
        <AppButton testID="bloom.reset.violation.confirm" disabled={locked || reason === null} onPress={confirm}>
          Record event and restart Day 1
        </AppButton>
        <AppButton testID="bloom.reset.violation.cancel" variant="ghost" disabled={locked} onPress={cancelConfirmation}>
          Cancel
        </AppButton>
      </AppCard>
    </View>
  ) : (
    <AppButton testID="bloom.reset.violation.open" variant="secondary" disabled={locked} onPress={openConfirmation}>
      Report a Reset violation
    </AppButton>
  );
}

function ResetViolationHistory({ view, locked, onUndo }: {
  view: ActiveResetView;
  locked: boolean;
  onUndo: (violationId: string) => void;
}) {
  return (
    <View style={styles.stack}>
      <AppText variant="title" accessibilityRole="header">Reset history</AppText>
      {view.history.length === 0 ? (
        <AppText variant="bodySmall" tone="secondary">No Reset violations recorded.</AppText>
      ) : view.history.map((violation) => (
        <AppCard key={violation.id} testID={`bloom.reset.history.${violation.id}`} style={styles.stack}>
          <View style={styles.details}>
            <AppText variant="label">{violationReasons.find((option) => option.value === violation.reason)?.label}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {violation.source.kind === "masturbationSession" ? "From a session" : "Manual entry"}
              {violation.status === "undone" ? " · Undone" : " · Recorded"}
            </AppText>
          </View>
          <View style={styles.details}>
            <AppText variant="bodySmall" tone="secondary">Occurred: {formatResetEventTime(violation.occurredAt)}</AppText>
            <AppText variant="caption" tone="secondary">Recorded: {formatResetEventTime(violation.recordedAt)}</AppText>
            {violation.status === "undone" ? (
              <AppText variant="caption" tone="secondary">Undone: {formatResetEventTime(violation.undoneAt)}</AppText>
            ) : null}
          </View>
          {view.undoCandidateId === violation.id ? (
            <AppButton testID={`bloom.reset.undo.${violation.id}`} variant="subtle" disabled={locked} onPress={() => onUndo(violation.id)}>
              Undo this entry
            </AppButton>
          ) : null}
        </AppCard>
      ))}
    </View>
  );
}

function ResetChoice<T extends string>({ title, testIDPrefix, value, onChange, options, locked }: {
  title: string;
  testIDPrefix: string;
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<Choice<T>>;
  locked: boolean;
}) {
  return (
    <AppCard style={styles.stack}>
      <AppText variant="title">{title}</AppText>
      <View style={styles.details} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {options.map((option) => (
          <AppButton
            key={option.value}
            testID={`${testIDPrefix}.${option.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.value }}
            variant={value === option.value ? "primary" : "subtle"}
            disabled={locked}
            onPress={() => { if (!locked) onChange(option.value); }}
          >
            {option.label}
          </AppButton>
        ))}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  headerText: { flex: 1, gap: theme.spacing.sm },
  details: { gap: theme.spacing.sm },
  remaining: { fontFamily: theme.typography.family.monoMedium, fontSize: 28, lineHeight: 40, fontVariant: ["tabular-nums"] }
});
