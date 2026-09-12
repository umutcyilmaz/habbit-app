import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren
} from "react";

import {
  addPauseSessionDurationState,
  clearOnboardingResultState,
  completeArousalSessionState,
  completePauseSessionState,
  completeTodayResetState,
  createBloomRecordId,
  createDefaultBloomState,
  discardArousalSessionState,
  discardPauseSessionState,
  editCompletedArousalLogState,
  getResetDay,
  getTodayKey,
  isTodayCompleted,
  prepareBloomNoteSubmission,
  recordProtectionPauseState,
  resumeArousalSessionState,
  saveOnboardingResultForFreshJourneyState,
  saveOnboardingResultState,
  startArousalSessionState,
  startPauseSessionState,
  startTenDayResetState,
  updateArousalSessionState,
  updatePauseSessionState,
  type ArousalControlDraft,
  type ArousalControlSessionValues,
  type ArousalSessionPatch,
  type BloomMutationResult,
  type BloomLocalState,
  type BloomCheckInRecord,
  type PauseSessionCompletionData,
  type PauseSessionPatch,
  type ProtectionConfiguration,
  type QuizResult
} from "../../storage/bloomState";
import {
  deleteAllPersistedBloomData,
  loadBloomLocalState,
  saveBloomLocalState,
  type BloomStateLoadResult
} from "../../storage/bloomStateStorage";
import { pauseRoundDurationSeconds } from "../../shared/runtime/e2eMode";
import { createBloomLocalStateAcknowledgedActions } from "./bloomLocalStateAcknowledgedActions";
import {
  createBloomProductAcknowledgedActions,
  type BloomProductAcknowledgedActions
} from "./bloomProductAcknowledgedActions";
import {
  createBloomLocalStateMutationRuntime,
  type BloomMutationRuntimeHydrationStatus,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "./bloomLocalStateMutationRuntime";
import { createBloomLocalStateProjection } from "./bloomLocalStateProjection";
import { waitForBloomLocalDataDeletion } from "./bloomLocalDataDeletionWatchdog";
import {
  getBloomLocalStateHydrationTimeoutRecovery,
  waitForBloomLocalStateHydration
} from "./bloomLocalStateHydrationWatchdog";

export type {
  BloomPersistedMutationResult,
  BloomPersistenceRetryToken
} from "./bloomLocalStateMutationRuntime";

export type BloomHydrationStatus = BloomMutationRuntimeHydrationStatus;

export type BloomHydrationError = {
  code: "corrupt" | "unsupported-version" | "storage-unavailable";
  message: string;
};

type BloomStateMutation = (state: BloomLocalState) => BloomLocalState;

export type BloomLocalDataDeletionRequest = {
  acknowledgement: Promise<void>;
  settlement: Promise<void>;
};

type BloomLocalStateContextValue = {
  state: BloomLocalState;
  durableState: BloomLocalState;
  productActions: BloomProductAcknowledgedActions;
  isLoading: boolean;
  hasHydrated: boolean;
  hydrationStatus: BloomHydrationStatus;
  hydrationError: BloomHydrationError | null;
  persistenceError: string | null;
  todayKey: string;
  resetDay: number;
  resetTodayCompleted: boolean;
  durableTodayKey: string;
  durableResetDay: number;
  durableTodayCompleted: boolean;
  retryHydration: () => Promise<void>;
  retryPersistedMutation: (
    token: BloomPersistenceRetryToken
  ) => Promise<BloomPersistedMutationResult>;
  deleteAllBloomLocalData: () => BloomLocalDataDeletionRequest;
  finishBloomLocalDataReset: () => void;
  saveOnboardingResult: (
    quizAnswers: Record<string, unknown>,
    quizResult: QuizResult
  ) => Promise<BloomPersistedMutationResult>;
  saveOnboardingResultForFreshJourney: (
    quizAnswers: Record<string, unknown>,
    quizResult: QuizResult
  ) => Promise<BloomPersistedMutationResult>;
  clearOnboardingResult: () => void;
  startTenDayReset: () => void;
  completeTodayReset: () => Promise<BloomPersistedMutationResult>;
  simulateNextDay: () => void;
  simulatePreviousDay: () => void;
  configureProtection: (
    configuration: ProtectionConfiguration
  ) => Promise<BloomPersistedMutationResult>;
  pauseProtection: () => Promise<BloomPersistedMutationResult>;
  resumeProtection: () => Promise<BloomPersistedMutationResult>;
  turnOffProtection: () => Promise<BloomPersistedMutationResult>;
  recordProtectionPause: () => BloomMutationResult;
  saveCheckInRecord: (
    record: BloomCheckInRecord
  ) => Promise<BloomPersistedMutationResult>;
  startPauseSession: (initialPatch?: PauseSessionPatch) => string;
  updatePauseSession: (
    id: string,
    patch: PauseSessionPatch
  ) => BloomMutationResult;
  addPauseSessionDuration: (
    id: string,
    seconds: number
  ) => BloomMutationResult;
  completePauseSession: (
    id: string,
    completionData: PauseSessionCompletionData
  ) => Promise<BloomPersistedMutationResult>;
  saveAndClosePauseSession: (
    recordId: string,
    sessionPatch: PauseSessionPatch,
    completionData: PauseSessionCompletionData
  ) => Promise<BloomPersistedMutationResult>;
  discardPauseSession: (id: string) => void;
  startArousalSession: (initialData: ArousalSessionPatch) => string;
  resumeArousalSession: (id: string) => void;
  updateArousalSession: (
    id: string,
    patch: ArousalSessionPatch
  ) => BloomMutationResult;
  updateArousalSessionAndPersist: (
    id: string,
    patch: ArousalSessionPatch
  ) => Promise<BloomPersistedMutationResult>;
  discardArousalSession: (id: string) => void;
  completeArousalSession: (
    id: string,
    completionData: ArousalSessionPatch,
    completedAt?: string
  ) => Promise<BloomPersistedMutationResult>;
  editCompletedArousalLog: (
    id: string,
    patch: Pick<ArousalControlSessionValues, "note">
  ) => Promise<BloomPersistedMutationResult>;
};

const BloomLocalStateContext = createContext<BloomLocalStateContextValue | undefined>(undefined);

export function BloomLocalStateProvider({ children }: PropsWithChildren) {
  const initialStateRef = useRef<BloomLocalState | null>(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = createDefaultBloomState();
  }

  const projectionRef = useRef<
    ReturnType<typeof createBloomLocalStateProjection> | null
  >(null);
  if (projectionRef.current === null) {
    projectionRef.current = createBloomLocalStateProjection(
      initialStateRef.current
    );
  }

  const projection = projectionRef.current;
  const projectionSnapshot = useSyncExternalStore(
    projection.subscribe,
    projection.getSnapshot,
    projection.getSnapshot
  );
  const state = projectionSnapshot.acceptedState;
  const durableState = projectionSnapshot.durableState;
  const persistenceError = projectionSnapshot.persistenceMessage;
  const [hydrationStatus, setHydrationStatus] =
    useState<BloomHydrationStatus>("loading");
  const [hydrationError, setHydrationError] =
    useState<BloomHydrationError | null>(null);
  const isMountedRef = useRef(false);
  const hydrationAttemptRef = useRef(0);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  const hydrationOperationRef = useRef<Promise<void> | null>(null);
  const deletionPromiseRef = useRef<Promise<void> | null>(null);
  const mutationRuntimeRef = useRef<
    ReturnType<typeof createBloomLocalStateMutationRuntime> | null
  >(null);

  if (mutationRuntimeRef.current === null) {
    mutationRuntimeRef.current = createBloomLocalStateMutationRuntime({
      initialState: initialStateRef.current,
      persistState: saveBloomLocalState,
      onStateChange(nextState) {
        projection.setAcceptedState(nextState);
      },
      onDurableStateChange(nextState) {
        projection.setDurableState(nextState);
      },
      onPersistenceErrorChange(message) {
        projection.setPersistenceMessage(message);
      }
    });
  }

  const mutationRuntime = mutationRuntimeRef.current;
  const isLoading = hydrationStatus === "loading";
  const hasHydrated = hydrationStatus === "ready";
  const todayKey = getTodayKey(state.debug.dateOffsetDays);
  const resetDay = getResetDay(state.tenDayReset, todayKey);
  const resetTodayCompleted = isTodayCompleted(state.tenDayReset, todayKey);
  const durableTodayKey = getTodayKey(durableState.debug.dateOffsetDays);
  const durableResetDay = getResetDay(
    durableState.tenDayReset,
    durableTodayKey
  );
  const durableTodayCompleted = isTodayCompleted(
    durableState.tenDayReset,
    durableTodayKey
  );

  const runHydration = useCallback((): Promise<void> => {
    if (hydrationPromiseRef.current !== null) {
      return hydrationPromiseRef.current;
    }

    if (mutationRuntime.isAwaitingResetNavigation()) {
      return Promise.resolve();
    }

    const hydrationRuntimeOperation = mutationRuntime.beginHydration();
    setHydrationStatus("loading");
    setHydrationError(null);

    let hydrationOperation = hydrationOperationRef.current;

    if (hydrationOperation === null) {
      const attemptId = hydrationAttemptRef.current + 1;
      hydrationAttemptRef.current = attemptId;
      const operation = loadBloomLocalState()
        .then((loadResult) => {
          if (
            !isMountedRef.current ||
            attemptId !== hydrationAttemptRef.current
          ) {
            return;
          }

          if (loadResult.status === "success") {
            const didComplete = mutationRuntime.completeHydration(
              hydrationRuntimeOperation,
              loadResult.state,
              {
                needsPersist: loadResult.needsPersist,
                persistenceError: loadResult.persistenceError
              }
            );

            if (!didComplete) {
              return;
            }

            setHydrationError(null);
            setHydrationStatus("ready");
            return;
          }

          if (!mutationRuntime.failHydration(hydrationRuntimeOperation)) {
            return;
          }

          setHydrationError(toHydrationError(loadResult));
          setHydrationStatus("error");

          if (__DEV__) {
            console.warn("Bloom local state could not be hydrated. Stored data was preserved.");
          }
        })
        .catch(() => {
          if (
            !isMountedRef.current ||
            attemptId !== hydrationAttemptRef.current
          ) {
            return;
          }

          if (!mutationRuntime.failHydration(hydrationRuntimeOperation)) {
            return;
          }

          setHydrationError({
            code: "storage-unavailable",
            message: "Bloom local data is temporarily unavailable."
          });
          setHydrationStatus("error");

          if (__DEV__) {
            console.warn("Bloom local state storage is unavailable.");
          }
        })
        .finally(() => {
          if (hydrationOperationRef.current === operation) {
            hydrationOperationRef.current = null;
          }
        });

      hydrationOperationRef.current = operation;
      hydrationOperation = operation;
    }

    const watchedHydration = waitForBloomLocalStateHydration(
      hydrationOperation
    )
      .catch((error: unknown) => {
        const recovery = getBloomLocalStateHydrationTimeoutRecovery(error, {
          isMounted: isMountedRef.current,
          isCurrentOperation:
            hydrationOperationRef.current === hydrationOperation
        });

        if (recovery === null) {
          return;
        }

        if (!mutationRuntime.failHydration(hydrationRuntimeOperation)) {
          return;
        }

        setHydrationError(recovery.hydrationError);
        setHydrationStatus(recovery.hydrationStatus);
      })
      .finally(() => {
        if (hydrationPromiseRef.current === watchedHydration) {
          hydrationPromiseRef.current = null;
        }
      });

    hydrationPromiseRef.current = watchedHydration;
    return watchedHydration;
  }, [mutationRuntime]);

  useEffect(() => {
    isMountedRef.current = true;
    void runHydration();

    return () => {
      isMountedRef.current = false;
    };
  }, [runHydration]);

  const applyStateMutation = useCallback(
    (mutation: BloomStateMutation): BloomMutationResult =>
      mutationRuntime.applyMutation(mutation),
    [mutationRuntime]
  );

  const applyAcknowledgedStateMutation = useCallback(
    (mutation: BloomStateMutation): Promise<BloomPersistedMutationResult> =>
      mutationRuntime.applyAcknowledgedMutation(mutation),
    [mutationRuntime]
  );

  const retryPersistedMutation = useCallback(
    (token: BloomPersistenceRetryToken) =>
      mutationRuntime.retryPersistence(token),
    [mutationRuntime]
  );

  const productActions = useMemo(
    () =>
      createBloomProductAcknowledgedActions({
        applyAcknowledgedMutation: applyAcknowledgedStateMutation
      }),
    [applyAcknowledgedStateMutation]
  );

  const {
    configureProtection,
    pauseProtection,
    resumeProtection,
    turnOffProtection,
    saveCheckInRecord,
    saveAndClosePauseSession
  } = useMemo(
    () =>
      createBloomLocalStateAcknowledgedActions({
        applyAcknowledgedMutation: applyAcknowledgedStateMutation,
        rejectAcknowledgedMutation: mutationRuntime.rejectAcknowledgedMutation
      }),
    [applyAcknowledgedStateMutation, mutationRuntime]
  );

  const deleteAllBloomLocalData = useCallback((): BloomLocalDataDeletionRequest => {
    if (deletionPromiseRef.current !== null) {
      return {
        acknowledgement: waitForBloomLocalDataDeletion(
          deletionPromiseRef.current
        ),
        settlement: deletionPromiseRef.current
      };
    }

    const wasHydrationLoading =
      mutationRuntime.getHydrationStatus() === "loading";
    mutationRuntime.beginDeletion();
    hydrationAttemptRef.current += 1;
    hydrationPromiseRef.current = null;
    hydrationOperationRef.current = null;

    if (wasHydrationLoading) {
      setHydrationError({
        code: "storage-unavailable",
        message:
          "Bloom is still confirming local data deletion. You can try again when it finishes."
      });
      setHydrationStatus("error");
    }

    const deletionPromise = deleteAllPersistedBloomData()
      .then(() => {
        if (!isMountedRef.current) {
          return;
        }

        hydrationAttemptRef.current += 1;
        hydrationPromiseRef.current = null;
        hydrationOperationRef.current = null;
        mutationRuntime.completeDeletion(createDefaultBloomState());
        setHydrationError(null);
        setHydrationStatus("ready");
      })
      .catch(() => {
        mutationRuntime.failDeletion();

        if (__DEV__) {
          console.warn("Failed to delete Bloom local data.");
        }

        throw new Error("Bloom local data could not be deleted.");
      })
      .finally(() => {
        if (deletionPromiseRef.current === deletionPromise) {
          deletionPromiseRef.current = null;
        }
      });

    deletionPromiseRef.current = deletionPromise;
    return {
      acknowledgement: waitForBloomLocalDataDeletion(deletionPromise),
      settlement: deletionPromise
    };
  }, [mutationRuntime]);

  const finishBloomLocalDataReset = useCallback(() => {
    mutationRuntime.finishResetNavigation();
  }, [mutationRuntime]);

  const saveOnboardingResult = useCallback(
    (quizAnswers: Record<string, unknown>, quizResult: QuizResult) => {
      return applyAcknowledgedStateMutation((currentState) =>
        saveOnboardingResultState(currentState, quizAnswers, quizResult)
      );
    },
    [applyAcknowledgedStateMutation]
  );

  const saveOnboardingResultForFreshJourney = useCallback(
    (quizAnswers: Record<string, unknown>, quizResult: QuizResult) => {
      return applyAcknowledgedStateMutation((currentState) =>
        saveOnboardingResultForFreshJourneyState(currentState, quizAnswers, quizResult)
      );
    },
    [applyAcknowledgedStateMutation]
  );

  const clearOnboardingResult = useCallback(() => {
    applyStateMutation((currentState) => clearOnboardingResultState(currentState));
  }, [applyStateMutation]);

  const startTenDayReset = useCallback(() => {
    applyStateMutation((currentState) => startTenDayResetState(currentState));
  }, [applyStateMutation]);

  const completeTodayReset = useCallback(() => {
    return applyAcknowledgedStateMutation((currentState) =>
      completeTodayResetState(currentState)
    );
  }, [applyAcknowledgedStateMutation]);

  const simulateNextDay = useCallback(() => {
    applyStateMutation((currentState) => ({
      ...currentState,
      debug: {
        ...currentState.debug,
        dateOffsetDays: currentState.debug.dateOffsetDays + 1
      }
    }));
  }, [applyStateMutation]);

  const simulatePreviousDay = useCallback(() => {
    applyStateMutation((currentState) => ({
      ...currentState,
      debug: {
        ...currentState.debug,
        dateOffsetDays: Math.max(currentState.debug.dateOffsetDays - 1, -30)
      }
    }));
  }, [applyStateMutation]);

  const recordProtectionPause = useCallback(() => {
    return applyStateMutation((currentState) =>
      recordProtectionPauseState(currentState)
    );
  }, [applyStateMutation]);

  const startPauseSession = useCallback(
    (initialPatch: PauseSessionPatch = {}) => {
      const now = new Date();
      const id = createBloomRecordId("pause", now);
      const session = {
        id,
        startedAt: now.toISOString(),
        phase: "checkIn" as const,
        triggers: [],
        timerDurationSeconds: pauseRoundDurationSeconds,
        elapsedDurationSeconds: 0,
        ...initialPatch
      };

      applyStateMutation((currentState) =>
        startPauseSessionState(currentState, session)
      );

      return id;
    },
    [applyStateMutation]
  );

  const updatePauseSession = useCallback(
    (id: string, patch: PauseSessionPatch) => {
      return applyStateMutation((currentState) =>
        updatePauseSessionState(currentState, id, patch)
      );
    },
    [applyStateMutation]
  );

  const addPauseSessionDuration = useCallback(
    (id: string, seconds: number) => {
      if (!Number.isSafeInteger(seconds) || seconds <= 0) {
        return {
          ok: false,
          reason: "invalidSession"
        } satisfies BloomMutationResult;
      }

      return applyStateMutation((currentState) =>
        addPauseSessionDurationState(currentState, id, seconds)
      );
    },
    [applyStateMutation]
  );

  const completePauseSession = useCallback(
    (id: string, completionData: PauseSessionCompletionData) => {
      return applyAcknowledgedStateMutation((currentState) =>
        completePauseSessionState(currentState, id, completionData)
      );
    },
    [applyAcknowledgedStateMutation]
  );

  const discardPauseSession = useCallback(
    (id: string) => {
      applyStateMutation((currentState) =>
        discardPauseSessionState(currentState, id)
      );
    },
    [applyStateMutation]
  );

  const startArousalSession = useCallback(
    (initialData: ArousalSessionPatch) => {
      const now = new Date();
      const id = createBloomRecordId("arousal", now);

      applyStateMutation((currentState) =>
        startArousalSessionState(currentState, {
          id,
          startedAt: now.toISOString(),
          dateKey: getTodayKey(currentState.debug.dateOffsetDays, now),
          ...initialData
        } satisfies ArousalControlDraft)
      );

      return id;
    },
    [applyStateMutation]
  );

  const resumeArousalSession = useCallback(
    (id: string) => {
      applyStateMutation((currentState) =>
        resumeArousalSessionState(currentState, id)
      );
    },
    [applyStateMutation]
  );

  const updateArousalSession = useCallback(
    (id: string, patch: ArousalSessionPatch) => {
      if (
        patch.note !== undefined &&
        !prepareBloomNoteSubmission(patch.note).ok
      ) {
        return {
          ok: false,
          reason: "noteTooLong"
        } satisfies BloomMutationResult;
      }

      return applyStateMutation((currentState) =>
        updateArousalSessionState(currentState, id, patch)
      );
    },
    [applyStateMutation]
  );

  const updateArousalSessionAndPersist = useCallback(
    (id: string, patch: ArousalSessionPatch) => {
      if (
        patch.note !== undefined &&
        !prepareBloomNoteSubmission(patch.note).ok
      ) {
        return mutationRuntime.rejectAcknowledgedMutation("noteTooLong");
      }

      return applyAcknowledgedStateMutation((currentState) =>
        updateArousalSessionState(currentState, id, patch)
      );
    },
    [applyAcknowledgedStateMutation, mutationRuntime]
  );

  const discardArousalSession = useCallback(
    (id: string) => {
      applyStateMutation((currentState) =>
        discardArousalSessionState(currentState, id)
      );
    },
    [applyStateMutation]
  );

  const completeArousalSession = useCallback(
    (
      id: string,
      completionData: ArousalSessionPatch,
      completedAt?: string
    ) => {
      if (
        completionData.note !== undefined &&
        !prepareBloomNoteSubmission(completionData.note).ok
      ) {
        return mutationRuntime.rejectAcknowledgedMutation("noteTooLong");
      }

      return applyAcknowledgedStateMutation((currentState) =>
        completeArousalSessionState(
          currentState,
          id,
          completionData,
          completedAt
        )
      );
    },
    [applyAcknowledgedStateMutation, mutationRuntime]
  );

  const editCompletedArousalLog = useCallback(
    (
      id: string,
      patch: Pick<ArousalControlSessionValues, "note">
    ) => {
      if (
        patch.note !== undefined &&
        !prepareBloomNoteSubmission(patch.note).ok
      ) {
        return mutationRuntime.rejectAcknowledgedMutation("noteTooLong");
      }

      return applyAcknowledgedStateMutation((currentState) =>
        editCompletedArousalLogState(currentState, id, patch)
      );
    },
    [applyAcknowledgedStateMutation, mutationRuntime]
  );

  const value = useMemo(
    () => ({
      state,
      durableState,
      productActions,
      isLoading,
      hasHydrated,
      hydrationStatus,
      hydrationError,
      persistenceError,
      todayKey,
      resetDay,
      resetTodayCompleted,
      durableTodayKey,
      durableResetDay,
      durableTodayCompleted,
      retryHydration: runHydration,
      retryPersistedMutation,
      deleteAllBloomLocalData,
      finishBloomLocalDataReset,
      saveOnboardingResult,
      saveOnboardingResultForFreshJourney,
      clearOnboardingResult,
      startTenDayReset,
      completeTodayReset,
      simulateNextDay,
      simulatePreviousDay,
      configureProtection,
      pauseProtection,
      resumeProtection,
      turnOffProtection,
      recordProtectionPause,
      saveCheckInRecord,
      startPauseSession,
      updatePauseSession,
      addPauseSessionDuration,
      completePauseSession,
      saveAndClosePauseSession,
      discardPauseSession,
      startArousalSession,
      resumeArousalSession,
      updateArousalSession,
      updateArousalSessionAndPersist,
      discardArousalSession,
      completeArousalSession,
      editCompletedArousalLog
    }),
    [
      completeArousalSession,
      completePauseSession,
      saveAndClosePauseSession,
      addPauseSessionDuration,
      clearOnboardingResult,
      completeTodayReset,
      configureProtection,
      deleteAllBloomLocalData,
      durableResetDay,
      durableState,
      durableTodayCompleted,
      durableTodayKey,
      discardArousalSession,
      discardPauseSession,
      editCompletedArousalLog,
      finishBloomLocalDataReset,
      hasHydrated,
      hydrationError,
      hydrationStatus,
      isLoading,
      persistenceError,
      productActions,
      pauseProtection,
      recordProtectionPause,
      resumeArousalSession,
      resumeProtection,
      resetDay,
      resetTodayCompleted,
      retryPersistedMutation,
      runHydration,
      saveOnboardingResultForFreshJourney,
      saveOnboardingResult,
      saveCheckInRecord,
      simulateNextDay,
      simulatePreviousDay,
      startTenDayReset,
      startArousalSession,
      startPauseSession,
      state,
      todayKey,
      turnOffProtection,
      updateArousalSession,
      updateArousalSessionAndPersist,
      updatePauseSession
    ]
  );

  return (
    <BloomLocalStateContext.Provider value={value}>
      {children}
    </BloomLocalStateContext.Provider>
  );
}

export function useBloomLocalState() {
  const context = useContext(BloomLocalStateContext);

  if (context === undefined) {
    throw new Error("useBloomLocalState must be used inside BloomLocalStateProvider.");
  }

  return context;
}

function toHydrationError(
  loadResult: Exclude<BloomStateLoadResult, { status: "success" }>
): BloomHydrationError {
  if (loadResult.status === "unsupported-version") {
    return {
      code: "unsupported-version",
      message: "Bloom local data was created by a newer app version and was preserved."
    };
  }

  return {
    code: "corrupt",
    message: "Bloom local data could not be loaded safely and was preserved."
  };
}
