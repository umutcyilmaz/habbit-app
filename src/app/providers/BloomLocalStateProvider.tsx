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
  clearOnboardingResultState,
  completeArousalControlPracticeState,
  completeTodayResetState,
  createDefaultBloomState,
  disableProtectionState,
  enableProtectionState,
  getResetDay,
  getTodayKey,
  isTodayCompleted,
  recordProtectionPauseState,
  saveOnboardingResultForFreshJourneyState,
  saveOnboardingResultState,
  startTenDayResetState,
  updateArousalControlDraftState,
  type ArousalControlDraft,
  type BloomLocalState,
  type ProtectionWindow,
  type QuizResult
} from "../../storage/bloomState";
import {
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
  resetBloomLocalData: () => void;
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
  enableProtection: (preferredWindow?: ProtectionWindow) => void;
  disableProtection: () => void;
  recordProtectionPause: () => void;
  updateArousalControlDraft: (patch: Partial<ArousalControlDraft>) => void;
  completeArousalControlPractice: (
    completedAt?: string,
    patch?: Partial<ArousalControlDraft>
  ) => void;
};

const BloomLocalStateContext = createContext<BloomLocalStateContextValue | undefined>(undefined);

export function BloomLocalStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BloomLocalState>(createDefaultBloomState);
  const [hydrationStatus, setHydrationStatus] =
    useState<BloomHydrationStatus>("loading");
  const [hydrationError, setHydrationError] =
    useState<BloomHydrationError | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const hydrationStatusRef = useRef<BloomHydrationStatus>("loading");
  const pendingMutationsRef = useRef<BloomStateMutation[]>([]);
  const skipAutosaveForStateRef = useRef<BloomLocalState | null>(null);
  const isLoading = hydrationStatus === "loading";
  const hasHydrated = hydrationStatus === "ready";
  const todayKey = getTodayKey(state.debug.dateOffsetDays);
  const resetDay = getResetDay(state.tenDayReset, todayKey);
  const resetTodayCompleted = isTodayCompleted(state.tenDayReset, todayKey);

  useEffect(() => {
    let isMounted = true;

    loadBloomLocalState()
      .then((loadResult) => {
        if (!isMounted) {
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
          setState(loadedState);
          setPersistenceError(loadResult.persistenceError);
          setHydrationError(null);
          setHydrationStatus("ready");
          return;
        }

        pendingMutationsRef.current = [];
        hydrationStatusRef.current = "error";
        setHydrationError(toHydrationError(loadResult));
        setHydrationStatus("error");

        if (__DEV__) {
          console.warn("Bloom local state could not be hydrated. Stored data was preserved.");
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        pendingMutationsRef.current = [];
        hydrationStatusRef.current = "error";
        setHydrationError({
          code: "storage-unavailable",
          message: "Bloom local data is temporarily unavailable."
        });
        setHydrationStatus("error");

        if (__DEV__) {
          console.warn("Bloom local state storage is unavailable.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrationStatus !== "ready") {
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

  const applyStateMutation = useCallback((mutation: BloomStateMutation) => {
    if (hydrationStatusRef.current === "loading") {
      pendingMutationsRef.current.push(mutation);
      return;
    }

    if (hydrationStatusRef.current === "ready") {
      setState(mutation);
    }
  }, []);

  const resetBloomLocalData = useCallback(() => {
    applyStateMutation(() => createDefaultBloomState());
  }, [applyStateMutation]);

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

  const enableProtection = useCallback((preferredWindow: ProtectionWindow = "evening") => {
    applyStateMutation((currentState) =>
      enableProtectionState(currentState, preferredWindow)
    );
  }, [applyStateMutation]);

  const disableProtection = useCallback(() => {
    applyStateMutation((currentState) => disableProtectionState(currentState));
  }, [applyStateMutation]);

  const recordProtectionPause = useCallback(() => {
    applyStateMutation((currentState) => recordProtectionPauseState(currentState));
  }, [applyStateMutation]);

  const updateArousalControlDraft = useCallback((patch: Partial<ArousalControlDraft>) => {
    applyStateMutation((currentState) =>
      updateArousalControlDraftState(currentState, patch)
    );
  }, [applyStateMutation]);

  const completeArousalControlPractice = useCallback(
    (completedAt?: string, patch?: Partial<ArousalControlDraft>) => {
      applyStateMutation((currentState) => {
        const patchedState =
          patch !== undefined
            ? updateArousalControlDraftState(currentState, patch)
            : currentState;

        return completeArousalControlPracticeState(patchedState, completedAt);
      });
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
      resetBloomLocalData,
      saveOnboardingResult,
      saveOnboardingResultForFreshJourney,
      clearOnboardingResult,
      startTenDayReset,
      completeTodayReset,
      simulateNextDay,
      simulatePreviousDay,
      enableProtection,
      disableProtection,
      recordProtectionPause,
      updateArousalControlDraft,
      completeArousalControlPractice
    }),
    [
      completeArousalControlPractice,
      clearOnboardingResult,
      completeTodayReset,
      disableProtection,
      enableProtection,
      hasHydrated,
      hydrationError,
      hydrationStatus,
      isLoading,
      persistenceError,
      recordProtectionPause,
      resetBloomLocalData,
      resetDay,
      resetTodayCompleted,
      saveOnboardingResultForFreshJourney,
      saveOnboardingResult,
      simulateNextDay,
      simulatePreviousDay,
      startTenDayReset,
      state,
      todayKey,
      updateArousalControlDraft
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
