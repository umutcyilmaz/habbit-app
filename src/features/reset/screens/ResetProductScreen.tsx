import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ResetViolation } from "../../../domain/models/ResetJourney";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ResetAssessmentAnswers, ResetBaselineAnswers } from "../resetController";
import { formatResetEventTime, formatResetRemainingSeconds } from "../resetView";
import { useResetFeature } from "../useResetFeature";

type ResetFeature = ReturnType<typeof useResetFeature>;
type ResetMode = Parameters<typeof useResetFeature>[0];
type ActiveResetView = Extract<ResetFeature["view"], { kind: "active" }>;
type Choice<T extends string> = { value: T; label: string };

const titles: Record<ResetMode, string> = {
  baseline: "Before your Reset",
  progress: "Your 15-day Reset",
  completion: "Finish your Reset period",
  assessment: "Reset assessment"
};
const saveStateLabels: Record<ResetFeature["saveState"], string> = {
  loading: "Loading your saved state…",
  unavailable: "Save status is unavailable",
  saving: "Saving to this device…",
  saved: "Saved on this device",
  unconfirmed: "Save not yet confirmed"
};
const uncertainChoices = [
  { value: "notSure", label: "Not sure" },
  { value: "preferNotToSay", label: "Prefer not to say" }
] as const;
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

export function ResetAssessmentScreen() {
  return <ResetProductScreen mode="assessment" />;
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
            <AppText tone="secondary">Continue to record the completed period and move on to your assessment.</AppText>
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
              <AppText variant="title">Ready for your assessment</AppText>
              <AppText tone="secondary">
                Your 15-day period has ended. Continue to save its completion and open your assessment.
              </AppText>
              <AppButton testID="bloom.reset.complete" disabled={locked} onPress={actions.completeElapsed}>
                Continue to assessment
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
  if (mode === "assessment" && view.kind === "assessment") {
    return <ResetAssessmentForm key={`${view.reset.id}:${view.reset.currentAttempt.id}:${view.reset.baseline.id}`} locked={locked} onSubmit={actions.completeAssessment} />;
  }
  if (view.kind === "completed") {
    return (
      <AppCard style={styles.stack}>
        <AppText variant="title">Reset assessment complete</AppText>
        <AppText tone="secondary">
          {feature.saveState === "saved" ? "Your assessment is saved on this device." : "Saving your assessment still needs confirmation."}
        </AppText>
      </AppCard>
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
    assessment: "Your next step is the post-Reset assessment.",
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
  const [urgeIntensity, setUrgeIntensity] = useState<ResetBaselineAnswers["urgeIntensity"] | null>(null);
  const [abilityToPause, setAbilityToPause] = useState<ResetBaselineAnswers["abilityToPause"] | null>(null);
  const [spontaneousOrMorningErections, setSpontaneousOrMorningErections] = useState<ResetBaselineAnswers["spontaneousOrMorningErections"] | null>(null);
  const complete = urgeIntensity !== null && abilityToPause !== null && spontaneousOrMorningErections !== null;
  const submit = () => {
    if (locked || urgeIntensity === null || abilityToPause === null || spontaneousOrMorningErections === null) return;
    onSubmit({ urgeIntensity, abilityToPause, spontaneousOrMorningErections });
  };

  return (
    <View style={styles.stack}>
      <AppText tone="secondary">Record your own observations before the 15-day Reset. Choose an answer for each question, including “Not sure” or “Prefer not to say” when that fits.</AppText>
      <ResetChoice
        title="How strong do your urges feel?"
        testIDPrefix="bloom.reset.baseline.urgeIntensity"
        value={urgeIntensity}
        onChange={setUrgeIntensity}
        locked={locked}
        options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, ...uncertainChoices]}
      />
      <ResetChoice
        title="How does pausing when an urge comes up feel?"
        testIDPrefix="bloom.reset.baseline.abilityToPause"
        value={abilityToPause}
        onChange={setAbilityToPause}
        locked={locked}
        options={[{ value: "difficult", label: "Difficult" }, { value: "sometimesPossible", label: "Sometimes possible" }, { value: "manageable", label: "Manageable" }, ...uncertainChoices]}
      />
      <ResetChoice
        title="How often do you notice spontaneous or morning erections?"
        testIDPrefix="bloom.reset.baseline.spontaneousOrMorningErections"
        value={spontaneousOrMorningErections}
        onChange={setSpontaneousOrMorningErections}
        locked={locked}
        options={[{ value: "often", label: "Often" }, { value: "sometimes", label: "Sometimes" }, { value: "rarely", label: "Rarely" }, ...uncertainChoices]}
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

function ResetAssessmentForm({ locked, onSubmit }: { locked: boolean; onSubmit: (answers: ResetAssessmentAnswers) => void }) {
  const [urgeIntensityChange, setUrgeIntensityChange] = useState<ResetAssessmentAnswers["urgeIntensityChange"] | null>(null);
  const [abilityToPauseChange, setAbilityToPauseChange] = useState<ResetAssessmentAnswers["abilityToPauseChange"] | null>(null);
  const [spontaneousErectionChange, setSpontaneousErectionChange] = useState<ResetAssessmentAnswers["spontaneousErectionChange"] | null>(null);
  const [overallSexualResponseChange, setOverallSexualResponseChange] = useState<ResetAssessmentAnswers["overallSexualResponseChange"] | null>(null);
  const [readinessToRestartTracking, setReadinessToRestartTracking] = useState<ResetAssessmentAnswers["readinessToRestartTracking"] | null>(null);
  const complete = urgeIntensityChange !== null && abilityToPauseChange !== null && spontaneousErectionChange !== null &&
    overallSexualResponseChange !== null && readinessToRestartTracking !== null;
  const submit = () => {
    if (locked || urgeIntensityChange === null || abilityToPauseChange === null || spontaneousErectionChange === null ||
      overallSexualResponseChange === null || readinessToRestartTracking === null) return;
    onSubmit({ urgeIntensityChange, abilityToPauseChange, spontaneousErectionChange, overallSexualResponseChange, readinessToRestartTracking });
  };

  return (
    <View style={styles.stack}>
      <AppText tone="secondary">The 15-day period has ended. Record what you noticed compared with before your Reset.</AppText>
      <ResetChoice
        title="How has your urge intensity changed?"
        testIDPrefix="bloom.reset.assessment.urgeIntensityChange"
        value={urgeIntensityChange}
        onChange={setUrgeIntensityChange}
        locked={locked}
        options={[{ value: "decreased", label: "Decreased" }, { value: "same", label: "Stayed the same" }, { value: "increased", label: "Increased" }, ...uncertainChoices]}
      />
      <ResetChoice
        title="How has your ability to pause changed?"
        testIDPrefix="bloom.reset.assessment.abilityToPauseChange"
        value={abilityToPauseChange}
        onChange={setAbilityToPauseChange}
        locked={locked}
        options={[{ value: "harder", label: "Harder" }, { value: "same", label: "Stayed the same" }, { value: "easier", label: "Easier" }, ...uncertainChoices]}
      />
      <ResetChoice
        title="How has the frequency of spontaneous erections changed?"
        testIDPrefix="bloom.reset.assessment.spontaneousErectionChange"
        value={spontaneousErectionChange}
        onChange={setSpontaneousErectionChange}
        locked={locked}
        options={[{ value: "lessFrequent", label: "Less frequent" }, { value: "same", label: "Stayed the same" }, { value: "moreFrequent", label: "More frequent" }, ...uncertainChoices]}
      />
      <ResetChoice
        title="How has your overall sexual response changed?"
        testIDPrefix="bloom.reset.assessment.overallSexualResponseChange"
        value={overallSexualResponseChange}
        onChange={setOverallSexualResponseChange}
        locked={locked}
        options={[{ value: "worse", label: "Worse" }, { value: "same", label: "Stayed the same" }, { value: "better", label: "Better" }, ...uncertainChoices]}
      />
      <ResetChoice
        title="How ready do you feel to restart tracking?"
        testIDPrefix="bloom.reset.assessment.readinessToRestartTracking"
        value={readinessToRestartTracking}
        onChange={setReadinessToRestartTracking}
        locked={locked}
        options={[{ value: "ready", label: "Ready" }, { value: "notReady", label: "Not ready" }, { value: "notSure", label: "Not sure" }]}
      />
      <AppText variant="bodySmall" tone="secondary">You can submit any readiness answer. This reflection does not extend the completed Reset period.</AppText>
      {!complete ? <AppText variant="bodySmall" tone="secondary">Choose an answer for each question to finish.</AppText> : null}
      <AppButton testID="bloom.reset.assessment.submit" disabled={locked || !complete} onPress={submit}>
        Save assessment
      </AppButton>
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
