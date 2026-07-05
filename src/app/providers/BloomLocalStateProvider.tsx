import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import {
  clearOnboardingResultState,
  completeArousalControlPracticeState,
  completeTodayResetState,
  defaultBloomLocalState,
  disableProtectionState,
  enableProtectionState,
  getResetDay,
  getTodayKey,
  isTodayCompleted,
  loadBloomLocalState,
  recordProtectionPauseState,
  saveOnboardingResultForFreshJourneyState,
  saveOnboardingResultState,
  saveBloomLocalState,
  startTenDayResetState,
  updateArousalControlDraftState,
  type ArousalControlDraft,
  type BloomLocalState,
  type ProtectionWindow,
  type QuizResult
} from "../../storage/bloomState";

type BloomLocalStateContextValue = {
  state: BloomLocalState;
  isLoading: boolean;
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
  const [state, setState] = useState<BloomLocalState>(defaultBloomLocalState);
  const [isLoading, setIsLoading] = useState(true);
  const todayKey = getTodayKey(state.debug.dateOffsetDays);
  const resetDay = getResetDay(state.tenDayReset, todayKey);
  const resetTodayCompleted = isTodayCompleted(state.tenDayReset, todayKey);

  useEffect(() => {
    let isMounted = true;

    loadBloomLocalState()
      .then((loadedState) => {
        if (isMounted) {
          setState(loadedState);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    saveBloomLocalState(state).catch((error) => {
      console.warn("Failed to save Bloom local state.", error);
    });
  }, [isLoading, state]);

  const resetBloomLocalData = useCallback(() => {
    setState(defaultBloomLocalState);
  }, []);

  const saveOnboardingResult = useCallback(
    (quizAnswers: Record<string, unknown>, quizResult: QuizResult) => {
      setState((currentState) => saveOnboardingResultState(currentState, quizAnswers, quizResult));
    },
    []
  );

  const saveOnboardingResultForFreshJourney = useCallback(
    (quizAnswers: Record<string, unknown>, quizResult: QuizResult) => {
      setState((currentState) =>
        saveOnboardingResultForFreshJourneyState(currentState, quizAnswers, quizResult)
      );
    },
    []
  );

  const clearOnboardingResult = useCallback(() => {
    setState((currentState) => clearOnboardingResultState(currentState));
  }, []);

  const startTenDayReset = useCallback(() => {
    setState((currentState) => startTenDayResetState(currentState));
  }, []);

  const completeTodayReset = useCallback(() => {
    setState((currentState) => completeTodayResetState(currentState));
  }, []);

  const simulateNextDay = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      debug: {
        ...currentState.debug,
        dateOffsetDays: currentState.debug.dateOffsetDays + 1
      }
    }));
  }, []);

  const simulatePreviousDay = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      debug: {
        ...currentState.debug,
        dateOffsetDays: Math.max(currentState.debug.dateOffsetDays - 1, -30)
      }
    }));
  }, []);

  const enableProtection = useCallback((preferredWindow: ProtectionWindow = "evening") => {
    setState((currentState) => enableProtectionState(currentState, preferredWindow));
  }, []);

  const disableProtection = useCallback(() => {
    setState((currentState) => disableProtectionState(currentState));
  }, []);

  const recordProtectionPause = useCallback(() => {
    setState((currentState) => recordProtectionPauseState(currentState));
  }, []);

  const updateArousalControlDraft = useCallback((patch: Partial<ArousalControlDraft>) => {
    setState((currentState) => updateArousalControlDraftState(currentState, patch));
  }, []);

  const completeArousalControlPractice = useCallback(
    (completedAt?: string, patch?: Partial<ArousalControlDraft>) => {
      setState((currentState) => {
        const patchedState =
          patch !== undefined
            ? updateArousalControlDraftState(currentState, patch)
            : currentState;

        return completeArousalControlPracticeState(patchedState, completedAt);
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      state,
      isLoading,
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
      isLoading,
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
