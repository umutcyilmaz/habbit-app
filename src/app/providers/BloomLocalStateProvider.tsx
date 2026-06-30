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
  clearArousalControlLogsState,
  clearProtectionState,
  completeArousalControlPracticeState,
  completeTodayResetState,
  defaultBloomLocalState,
  disableProtectionState,
  enableProtectionState,
  getTodayKey,
  getResetDay,
  incrementArousalControlPauseCountState,
  isTodayCompleted,
  loadBloomLocalState,
  recordProtectionPauseState,
  saveBloomLocalState,
  startArousalControlDraftState,
  startTenDayResetState,
  updateProtectionWindowState,
  updateArousalControlDraftState,
  type ArousalControlDraft,
  type BloomLocalState,
  type ProtectionWindow
} from "../../storage/bloomState";

type BloomLocalStateContextValue = {
  state: BloomLocalState;
  isLoading: boolean;
  startTenDayReset: () => void;
  completeTodayReset: () => void;
  resetBloomLocalData: () => void;
  clearTenDayResetProgress: () => void;
  clearArousalControlLogs: () => void;
  clearProtection: () => void;
  simulateNextDay: () => void;
  simulatePreviousDay: () => void;
  startArousalControlDraft: (initial?: Partial<ArousalControlDraft>) => void;
  updateArousalControlDraft: (patch: Partial<ArousalControlDraft>) => void;
  incrementArousalControlPauseCount: () => void;
  completeArousalControlPractice: (completedAt?: string) => void;
  enableProtection: (options?: { preferredWindow?: ProtectionWindow }) => void;
  disableProtection: () => void;
  updateProtectionWindow: (preferredWindow: ProtectionWindow) => void;
  recordProtectionPause: () => void;
  resetTodayCompleted: boolean;
  resetDay: number;
  todayKey: string;
};

const BloomLocalStateContext = createContext<BloomLocalStateContextValue | undefined>(undefined);

export function BloomLocalStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BloomLocalState>(defaultBloomLocalState);
  const [isLoading, setIsLoading] = useState(true);
  const todayKey = getTodayKey(state.debug.dateOffsetDays);
  const resetTodayCompleted = isTodayCompleted(state.tenDayReset, todayKey);
  const resetDay = getResetDay(state.tenDayReset, todayKey);

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

  const startTenDayReset = useCallback(() => {
    setState((currentState) => startTenDayResetState(currentState));
  }, []);

  const completeTodayReset = useCallback(() => {
    setState((currentState) => completeTodayResetState(currentState));
  }, []);

  const startArousalControlDraft = useCallback((initial: Partial<ArousalControlDraft> = {}) => {
    setState((currentState) => startArousalControlDraftState(currentState, initial));
  }, []);

  const updateArousalControlDraft = useCallback((patch: Partial<ArousalControlDraft>) => {
    setState((currentState) => updateArousalControlDraftState(currentState, patch));
  }, []);

  const incrementArousalControlPauseCount = useCallback(() => {
    setState((currentState) => incrementArousalControlPauseCountState(currentState));
  }, []);

  const completeArousalControlPractice = useCallback((completedAt?: string) => {
    setState((currentState) => completeArousalControlPracticeState(currentState, completedAt));
  }, []);

  const enableProtection = useCallback((options: { preferredWindow?: ProtectionWindow } = {}) => {
    setState((currentState) => enableProtectionState(currentState, options));
  }, []);

  const disableProtection = useCallback(() => {
    setState((currentState) => disableProtectionState(currentState));
  }, []);

  const updateProtectionWindow = useCallback((preferredWindow: ProtectionWindow) => {
    setState((currentState) => updateProtectionWindowState(currentState, preferredWindow));
  }, []);

  const recordProtectionPause = useCallback(() => {
    setState((currentState) => recordProtectionPauseState(currentState));
  }, []);

  const resetBloomLocalData = useCallback(() => {
    setState(defaultBloomLocalState);
  }, []);

  const clearTenDayResetProgress = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      tenDayReset: defaultBloomLocalState.tenDayReset
    }));
  }, []);

  const clearArousalControlLogs = useCallback(() => {
    setState((currentState) => clearArousalControlLogsState(currentState));
  }, []);

  const clearProtection = useCallback(() => {
    setState((currentState) => clearProtectionState(currentState));
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

  const value = useMemo(
    () => ({
      state,
      isLoading,
      startTenDayReset,
      completeTodayReset,
      startArousalControlDraft,
      updateArousalControlDraft,
      incrementArousalControlPauseCount,
      completeArousalControlPractice,
      enableProtection,
      disableProtection,
      updateProtectionWindow,
      recordProtectionPause,
      resetBloomLocalData,
      clearTenDayResetProgress,
      clearArousalControlLogs,
      clearProtection,
      simulateNextDay,
      simulatePreviousDay,
      resetTodayCompleted,
      resetDay,
      todayKey
    }),
    [
      clearArousalControlLogs,
      clearProtection,
      clearTenDayResetProgress,
      completeArousalControlPractice,
      completeTodayReset,
      disableProtection,
      enableProtection,
      incrementArousalControlPauseCount,
      isLoading,
      recordProtectionPause,
      resetDay,
      resetBloomLocalData,
      resetTodayCompleted,
      simulateNextDay,
      simulatePreviousDay,
      startArousalControlDraft,
      startTenDayReset,
      state,
      todayKey,
      updateProtectionWindow,
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
