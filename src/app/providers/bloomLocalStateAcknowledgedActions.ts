import { pauseRoundDurationSeconds } from "../../shared/runtime/e2eMode";
import {
  completeNewPauseSessionState,
  completePauseSessionState,
  configureProtectionState,
  isValidBloomCheckInRecord,
  pauseProtectionState,
  prepareBloomNoteSubmission,
  resumeProtectionState,
  saveBloomCheckInRecordState,
  turnOffProtectionState,
  updatePauseSessionState,
  type BloomCheckInRecord,
  type BloomLocalState,
  type BloomMutationFailureReason,
  type PauseSessionCompletionData,
  type PauseSessionPatch,
  type ProtectionConfiguration
} from "../../storage/bloomState";
import type { BloomPersistedMutationResult } from "./bloomLocalStateMutationRuntime";

type BloomStateMutation = (state: BloomLocalState) => BloomLocalState;

type BloomLocalStateAcknowledgedActionOptions = {
  applyAcknowledgedMutation: (
    mutation: BloomStateMutation
  ) => Promise<BloomPersistedMutationResult>;
  rejectAcknowledgedMutation: (
    reason: BloomMutationFailureReason
  ) => Promise<BloomPersistedMutationResult>;
  now?: () => Date;
  // Kept as an accepted option for deterministic callers that share this
  // action factory. Pause completion identity is now supplied by its caller.
  random?: () => number;
};

export function createBloomLocalStateAcknowledgedActions({
  applyAcknowledgedMutation,
  rejectAcknowledgedMutation,
  now = () => new Date()
}: BloomLocalStateAcknowledgedActionOptions) {
  const configureProtection = (configuration: ProtectionConfiguration) => {
    const configuredAt = now().toISOString();
    return applyAcknowledgedMutation((currentState) =>
      configureProtectionState(currentState, configuration, configuredAt)
    );
  };

  const pauseProtection = () =>
    applyAcknowledgedMutation((currentState) =>
      pauseProtectionState(currentState)
    );

  const resumeProtection = () =>
    applyAcknowledgedMutation((currentState) =>
      resumeProtectionState(currentState)
    );

  const turnOffProtection = () =>
    applyAcknowledgedMutation((currentState) =>
      turnOffProtectionState(currentState)
    );

  const saveCheckInRecord = (record: BloomCheckInRecord) => {
    if (!isValidBloomCheckInRecord(record)) {
      return rejectAcknowledgedMutation(
        record.note !== undefined &&
          !prepareBloomNoteSubmission(record.note).ok
          ? "noteTooLong"
          : "invalidRecord"
      );
    }

    return applyAcknowledgedMutation((currentState) =>
      saveBloomCheckInRecordState(currentState, record)
    );
  };

  const saveAndClosePauseSession = (
    recordId: string,
    sessionPatch: PauseSessionPatch,
    completionData: PauseSessionCompletionData
  ) => {
    const operationTime = now();
    const completedAt = operationTime.toISOString();

    return applyAcknowledgedMutation((currentState) => {
      const activeSession = currentState.pause.activeSession;

      if (activeSession === null) {
        return completeNewPauseSessionState(
          currentState,
          {
            id: recordId,
            startedAt: completedAt,
            phase: "checkIn",
            triggers: [],
            timerDurationSeconds: pauseRoundDurationSeconds,
            elapsedDurationSeconds: 0,
            ...sessionPatch
          },
          completionData,
          completedAt
        );
      }

      if (activeSession.id !== recordId) {
        return currentState;
      }

      if (
        currentState.pause.records.some(
          (record) => record.id === activeSession.id
        )
      ) {
        return currentState;
      }

      const updatedState = updatePauseSessionState(
        currentState,
        activeSession.id,
        sessionPatch
      );

      if (updatedState === currentState) {
        return currentState;
      }

      const completedState = completePauseSessionState(
        updatedState,
        activeSession.id,
        completionData,
        completedAt
      );

      return completedState.pause.activeSession === null &&
        completedState.pause.records.some(
          (record) =>
            record.id === activeSession.id &&
            record.completedAt === completedAt
        )
        ? completedState
        : currentState;
    });
  };

  return {
    configureProtection,
    pauseProtection,
    resumeProtection,
    turnOffProtection,
    saveCheckInRecord,
    saveAndClosePauseSession
  };
}

export type BloomLocalStateAcknowledgedActions = ReturnType<
  typeof createBloomLocalStateAcknowledgedActions
>;
