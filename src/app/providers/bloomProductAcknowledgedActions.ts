import {
  acceptProductOnboardingRecommendationState,
  activateContentFreeState,
  completeElapsedResetPeriodState,
  completeMasturbationSessionFeedbackState,
  completePostResetAssessmentState,
  completeUrgeControlEventState,
  completeUrgeControlInterruptState,
  deactivateContentFreeState,
  deleteCompletedMasturbationSessionState,
  disableMasturbationTrackingState,
  discardActiveMasturbationSessionState,
  discardActiveUrgeControlEventState,
  editCompletedMasturbationSessionFeedbackState,
  enableMasturbationTrackingState,
  endMasturbationPauseState,
  endMasturbationSessionState,
  endUrgeControlPhoneAwayState,
  recordActiveResetViolationState,
  recordManualContentFreeViolationState,
  recordUrgeControlOutcomeState,
  recordUrgeControlTriggerState,
  saveProductOnboardingResultState,
  selectUrgeControlSecondLineActionState,
  selectUrgeControlTechniqueState,
  startMasturbationPauseState,
  startMasturbationSessionState,
  startResetFromBaselineState,
  startUrgeControlEventState,
  startUrgeControlPhoneAwayState,
  undoActiveResetViolationState,
  undoManualContentFreeViolationState,
  type BloomLocalState
} from "../../storage/bloomState";
import type { BloomPersistedMutationResult } from "./bloomLocalStateMutationRuntime";

type BloomStateMutation = (state: BloomLocalState) => BloomLocalState;

type BloomProductAcknowledgedActionOptions = {
  applyAcknowledgedMutation: (
    mutation: BloomStateMutation
  ) => Promise<BloomPersistedMutationResult>;
};

export function createBloomProductAcknowledgedActions({
  applyAcknowledgedMutation
}: BloomProductAcknowledgedActionOptions) {
  // Preserve each transition's input signature and use the runtime's current
  // accepted state. Validation and no-op handling stay in their existing layers.
  const acknowledge = <Args extends unknown[]>(
    transition: (state: BloomLocalState, ...args: Args) => BloomLocalState
  ) => (...args: Args): Promise<BloomPersistedMutationResult> =>
    applyAcknowledgedMutation((currentState) =>
      transition(currentState, ...args)
    );

  return {
    onboarding: {
      saveProductOnboardingResult: acknowledge(saveProductOnboardingResultState),
      acceptRecommendation: acknowledge(acceptProductOnboardingRecommendationState)
    },
    reset: {
      startFromBaseline: acknowledge(startResetFromBaselineState),
      recordViolation: acknowledge(recordActiveResetViolationState),
      undoViolation: acknowledge(undoActiveResetViolationState),
      completeElapsed: acknowledge(completeElapsedResetPeriodState),
      completeAssessment: acknowledge(completePostResetAssessmentState)
    },
    tracking: {
      enable: acknowledge(enableMasturbationTrackingState),
      disable: acknowledge(disableMasturbationTrackingState),
      session: {
        start: acknowledge(startMasturbationSessionState),
        startPause: acknowledge(startMasturbationPauseState),
        endPause: acknowledge(endMasturbationPauseState),
        end: acknowledge(endMasturbationSessionState),
        completeFeedback: acknowledge(completeMasturbationSessionFeedbackState),
        discardActive: acknowledge(discardActiveMasturbationSessionState)
      },
      corrections: {
        editFeedback: acknowledge(editCompletedMasturbationSessionFeedbackState),
        deleteSession: acknowledge(deleteCompletedMasturbationSessionState)
      }
    },
    contentFree: {
      activate: acknowledge(activateContentFreeState),
      deactivate: acknowledge(deactivateContentFreeState),
      recordManualViolation: acknowledge(recordManualContentFreeViolationState),
      undoManualViolation: acknowledge(undoManualContentFreeViolationState)
    },
    urgeControl: {
      start: acknowledge(startUrgeControlEventState),
      completeInterrupt: acknowledge(completeUrgeControlInterruptState),
      selectTechnique: acknowledge(selectUrgeControlTechniqueState),
      startPhoneAway: acknowledge(startUrgeControlPhoneAwayState),
      endPhoneAway: acknowledge(endUrgeControlPhoneAwayState),
      recordOutcome: acknowledge(recordUrgeControlOutcomeState),
      recordTrigger: acknowledge(recordUrgeControlTriggerState),
      selectSecondLineAction: acknowledge(selectUrgeControlSecondLineActionState),
      complete: acknowledge(completeUrgeControlEventState),
      discardActive: acknowledge(discardActiveUrgeControlEventState)
    }
  };
}

export type BloomProductAcknowledgedActions = ReturnType<
  typeof createBloomProductAcknowledgedActions
>;
