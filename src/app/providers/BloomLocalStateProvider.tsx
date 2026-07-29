import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

import {
  addPauseSessionDurationState,
  clearOnboardingResultState,
  completeArousalSessionState,
  completePauseSessionState,
  completeTodayResetState,
  configureProtectionState,
  createBloomRecordId,
  createDefaultBloomState,
  discardArousalSessionState,
  discardPauseSessionState,
  editCompletedArousalLogState,
  getResetDay,
  getTodayKey,
  isValidBloomCheckInRecord,
  isTodayCompleted,
  pauseProtectionState,
  prepareBloomNoteSubmission,
  recordProtectionPauseState,
  resumeArousalSessionState,
  resumeProtectionState,
  saveOnboardingResultForFreshJourneyState,
  saveOnboardingResultState,
  saveBloomCheckInRecordState,
  startArousalSessionState,
  startPauseSessionState,
  startTenDayResetState,
  turnOffProtectionState,
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

export type BloomHydrationStatus = "loading" | "ready" | "error";

export type BloomHydrationError = {
  code: "corrupt" | "unsupported-version" | "storage-unavailable";
  message: string;
};

type BloomStateMutation = (state: BloomLocalState) => BloomLocalState;

type BloomLocalStateContextValue = {
  state: BloomLocalState;
  isLoading: boolean;
  hasHydrated: boolean;
  hydrationStatus: BloomHydrationStatus;
  hydrationError: BloomHydrationError | null;
  persistenceError: string | null;
  todayKey: string;
  resetDay: number;
  resetTodayCompleted: boolean;
  retryHydration: () => Promise<void>;
  deleteAllBloomLocalData: () => Promise<void>;
  finishBloomLocalDataReset: () => void;
  saveOnboardingResult: (
    quizAnswers: Record<string, unknown>,
    quizResult: QuizResult
  ) => void;
  saveOnboardingResultForFreshJourney: (
    quizAnswers: Record<string, unknown>,
    quizResult: QuizResult
  ) => void;
  clearOnboardingResult: () => void;
  startTenDayReset: () => void;
  completeTodayReset: () => void;
  simulateNextDay: () => void;
  simulatePreviousDay: () => void;
  configureProtection: (configuration: ProtectionConfiguration) => void;
  pauseProtection: () => void;
  resumeProtection: () => void;
  turnOffProtection: () => void;
  recordProtectionPause: () => void;
  saveCheckInRecord: (record: BloomCheckInRecord) => BloomMutationResult;
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
  ) => BloomMutationResult;
  discardPauseSession: (id: string) => void;
  startArousalSession: (initialData: ArousalSessionPatch) => string;
  resumeArousalSession: (id: string) => void;
  updateArousalSession: (
    id: string,
    patch: ArousalSessionPatch
  ) => BloomMutationResult;
  discardArousalSession: (id: string) => void;
  completeArousalSession: (
    id: string,
    completionData: ArousalSessionPatch,
    completedAt?: string
  ) => BloomMutationResult;
  editCompletedArousalLog: (
    id: string,
    patch: Pick<ArousalControlSessionValues, "note">
  ) => BloomMutationResult;
};

const BloomLocalStateContext = createContext<BloomLocalStateContextValue | undefined>(undefined);

export function BloomLocalStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BloomLocalState>(createDefaultBloomState);
  const [hydrationStatus, setHydrationStatus] =
    useState<BloomHydrationStatus>("loading");
  const [hydrationError, setHydrationError] =
    useState<BloomHydrationError | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const hydrationStatusRef = useRef<BloomHydrationStatus>("loading");
  const pendingMutationsRef = useRef<BloomStateMutation[]>([]);
  const skipAutosaveForStateRef = useRef<BloomLocalState | null>(null);
  const isMountedRef = useRef(false);
  const hydrationAttemptRef = useRef(0);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  const deletionPromiseRef = useRef<Promise<void> | null>(null);
  const writesBlockedRef = useRef(false);
  const awaitingResetNavigationRef = useRef(false);
  const isLoading = hydrationStatus === "loading";
  const hasHydrated = hydrationStatus === "ready";
  const todayKey = getTodayKey(state.debug.dateOffsetDays);
  const resetDay = getResetDay(state.tenDayReset, todayKey);
  const resetTodayCompleted = isTodayCompleted(state.tenDayReset, todayKey);

  const runHydration = useCallback((): Promise<void> => {
    if (hydrationPromiseRef.current !== null) {
      return hydrationPromiseRef.current;
    }

    const attemptId = hydrationAttemptRef.current + 1;
    hydrationAttemptRef.current = attemptId;
    hydrationStatusRef.current = "loading";
    setHydrationStatus("loading");
    setHydrationError(null);

    const hydrationPromise = loadBloomLocalState()
      .then((loadResult) => {
        if (
          !isMountedRef.current ||
          attemptId !== hydrationAttemptRef.current ||
          writesBlockedRef.current
        ) {
          return;
        }

        if (loadResult.status === "success") {
          const pendingMutations = pendingMutationsRef.current;
          const loadedState = pendingMutations.reduce(
            (currentState, mutation) => mutation(currentState),
            loadResult.state
          );

          pendingMutationsRef.current = [];
          skipAutosaveForStateRef.current =
            pendingMutations.length === 0 && !loadResult.needsPersist
              ? loadedState
              : null;
          hydrationStatusRef.current = "ready";
          stateRef.current = loadedState;
          setState(loadedState);
          setPersistenceError(loadResult.persistenceError);
          setHydrationError(null);
          setHydrationStatus("ready");
          return;
        }

        pendingMutationsRef.current = [];
        hydrationStatusRef.current = "error";
        setPersistenceError(null);
        setHydrationError(toHydrationError(loadResult));
        setHydrationStatus("error");

        if (__DEV__) {
          console.warn("Bloom local state could not be hydrated. Stored data was preserved.");
        }
      })
      .catch(() => {
        if (
          !isMountedRef.current ||
          attemptId !== hydrationAttemptRef.current ||
          writesBlockedRef.current
        ) {
          return;
        }

        pendingMutationsRef.current = [];
        hydrationStatusRef.current = "error";
        setPersistenceError(null);
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
        if (attemptId === hydrationAttemptRef.current) {
          hydrationPromiseRef.current = null;
        }
      });

    hydrationPromiseRef.current = hydrationPromise;
    return hydrationPromise;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void runHydration();

    return () => {
      isMountedRef.current = false;
      hydrationAttemptRef.current += 1;
      hydrationPromiseRef.current = null;
    };
  }, [runHydration]);

  useEffect(() => {
    if (hydrationStatus !== "ready" || writesBlockedRef.current) {
      return;
    }

    if (skipAutosaveForStateRef.current === state) {
      skipAutosaveForStateRef.current = null;
      return;
    }

    let isCurrentState = true;

    saveBloomLocalState(state)
      .then(() => {
        if (isCurrentState) {
          setPersistenceError(null);
        }
      })
      .catch(() => {
        if (isCurrentState) {
          setPersistenceError("Bloom local changes could not be saved yet.");
        }

        if (__DEV__) {
          console.warn("Failed to save Bloom local state.");
        }
      });

    return () => {
      isCurrentState = false;
    };
  }, [hydrationStatus, state]);

  const applyStateMutation = useCallback(
    (mutation: BloomStateMutation): BloomMutationResult => {
      if (writesBlockedRef.current) {
        return { ok: false, reason: "stateUnavailable" };
      }

      if (hydrationStatusRef.current === "loading") {
        pendingMutationsRef.current.push(mutation);
        return { ok: true };
      }

      if (hydrationStatusRef.current === "ready") {
        const currentState = stateRef.current;
        const nextState = mutation(currentState);

        if (nextState === currentState) {
          return { ok: false, reason: "invalidSession" };
        }

        stateRef.current = nextState;
        setState(nextState);
        return { ok: true };
      }

      return { ok: false, reason: "stateUnavailable" };
    },
    []
  );

  const deleteAllBloomLocalData = useCallback((): Promise<void> => {
    if (deletionPromiseRef.current !== null) {
      return deletionPromiseRef.current;
    }

    writesBlockedRef.current = true;
    awaitingResetNavigationRef.current = false;
    pendingMutationsRef.current = [];
    hydrationAttemptRef.current += 1;
    hydrationPromiseRef.current = null;

    const deletionPromise = deleteAllPersistedBloomData()
      .then(() => {
        if (!isMountedRef.current) {
          return;
        }

        const freshState = createDefaultBloomState();
        skipAutosaveForStateRef.current = freshState;
        hydrationStatusRef.current = "ready";
        stateRef.current = freshState;
        setState(freshState);
        setPersistenceError(null);
        setHydrationError(null);
        setHydrationStatus("ready");
        awaitingResetNavigationRef.current = true;
      })
      .catch(() => {
        awaitingResetNavigationRef.current = false;

        if (isMountedRef.current) {
          setPersistenceError("Bloom local data could not be deleted.");
        }

        if (__DEV__) {
          console.warn("Failed to delete Bloom local data.");
        }

        throw new Error("Bloom local data could not be deleted.");
      })
      .finally(() => {
        if (!awaitingResetNavigationRef.current) {
          writesBlockedRef.current = false;
        }

        if (deletionPromiseRef.current === deletionPromise) {
          deletionPromiseRef.current = null;
        }
      });

    deletionPromiseRef.current = deletionPromise;
    return deletionPromise;
  }, []);

  const finishBloomLocalDataReset = useCallback(() => {
    if (!awaitingResetNavigationRef.current) {
      return;
    }

    awaitingResetNavigationRef.current = false;
    writesBlockedRef.current = false;
  }, []);

  const saveOnboardingResult = useCallback(
    (quizAnswers: Record<string, unknown>, quizResult: QuizResult) => {
      applyStateMutation((currentState) =>
        saveOnboardingResultState(currentState, quizAnswers, quizResult)
      );
    },
    [applyStateMutation]
  );

  const saveOnboardingResultForFreshJourney = useCallback(
    (quizAnswers: Record<string, unknown>, quizResult: QuizResult) => {
      applyStateMutation((currentState) =>
        saveOnboardingResultForFreshJourneyState(currentState, quizAnswers, quizResult)
      );
    },
    [applyStateMutation]
  );

  const clearOnboardingResult = useCallback(() => {
    applyStateMutation((currentState) => clearOnboardingResultState(currentState));
  }, [applyStateMutation]);

  const startTenDayReset = useCallback(() => {
    applyStateMutation((currentState) => startTenDayResetState(currentState));
  }, [applyStateMutation]);

  const completeTodayReset = useCallback(() => {
    applyStateMutation((currentState) => completeTodayResetState(currentState));
  }, [applyStateMutation]);

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

  const configureProtection = useCallback((configuration: ProtectionConfiguration) => {
    applyStateMutation((currentState) =>
      configureProtectionState(currentState, configuration)
    );
  }, [applyStateMutation]);

  const pauseProtection = useCallback(() => {
    applyStateMutation((currentState) => pauseProtectionState(currentState));
  }, [applyStateMutation]);

  const resumeProtection = useCallback(() => {
    applyStateMutation((currentState) => resumeProtectionState(currentState));
  }, [applyStateMutation]);

  const turnOffProtection = useCallback(() => {
    applyStateMutation((currentState) => turnOffProtectionState(currentState));
  }, [applyStateMutation]);

  const recordProtectionPause = useCallback(() => {
    applyStateMutation((currentState) => recordProtectionPauseState(currentState));
  }, [applyStateMutation]);

  const saveCheckInRecord = useCallback((record: BloomCheckInRecord) => {
    if (!isValidBloomCheckInRecord(record)) {
      return {
        ok: false,
        reason:
          record.note !== undefined &&
          !prepareBloomNoteSubmission(record.note).ok
            ? "noteTooLong"
            : "invalidRecord"
      } satisfies BloomMutationResult;
    }

    return applyStateMutation((currentState) =>
      saveBloomCheckInRecordState(currentState, record)
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
        timerDurationSeconds: 90,
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
      return applyStateMutation((currentState) =>
        completePauseSessionState(currentState, id, completionData)
      );
    },
    [applyStateMutation]
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
        return {
          ok: false,
          reason: "noteTooLong"
        } satisfies BloomMutationResult;
      }

      return applyStateMutation((currentState) =>
        completeArousalSessionState(
          currentState,
          id,
          completionData,
          completedAt
        )
      );
    },
    [applyStateMutation]
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
        return {
          ok: false,
          reason: "noteTooLong"
        } satisfies BloomMutationResult;
      }

      return applyStateMutation((currentState) =>
        editCompletedArousalLogState(currentState, id, patch)
      );
    },
    [applyStateMutation]
  );

  const value = useMemo(
    () => ({
      state,
      isLoading,
      hasHydrated,
      hydrationStatus,
      hydrationError,
      persistenceError,
      todayKey,
      resetDay,
      resetTodayCompleted,
      retryHydration: runHydration,
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
      discardPauseSession,
      startArousalSession,
      resumeArousalSession,
      updateArousalSession,
      discardArousalSession,
      completeArousalSession,
      editCompletedArousalLog
    }),
    [
      completeArousalSession,
      completePauseSession,
      addPauseSessionDuration,
      clearOnboardingResult,
      completeTodayReset,
      configureProtection,
      deleteAllBloomLocalData,
      discardArousalSession,
      discardPauseSession,
      editCompletedArousalLog,
      finishBloomLocalDataReset,
      hasHydrated,
      hydrationError,
      hydrationStatus,
      isLoading,
      persistenceError,
      pauseProtection,
      recordProtectionPause,
      resumeArousalSession,
      resumeProtection,
      resetDay,
      resetTodayCompleted,
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
