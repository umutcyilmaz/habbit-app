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
  completeTodayResetState,
  defaultBloomLocalState,
  getTodayKey,
  getResetDay,
  isTodayCompleted,
  loadBloomLocalState,
  saveBloomLocalState,
  startTenDayResetState,
  type BloomLocalState
} from "../../storage/bloomState";

type BloomLocalStateContextValue = {
  state: BloomLocalState;
  isLoading: boolean;
  startTenDayReset: () => void;
  completeTodayReset: () => void;
  resetBloomLocalData: () => void;
  clearTenDayResetProgress: () => void;
  simulateNextDay: () => void;
  simulatePreviousDay: () => void;
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

  const resetBloomLocalData = useCallback(() => {
    setState(defaultBloomLocalState);
  }, []);

  const clearTenDayResetProgress = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      tenDayReset: defaultBloomLocalState.tenDayReset
    }));
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
      resetBloomLocalData,
      clearTenDayResetProgress,
      simulateNextDay,
      simulatePreviousDay,
      resetTodayCompleted,
      resetDay,
      todayKey
    }),
    [
      clearTenDayResetProgress,
      completeTodayReset,
      isLoading,
      resetDay,
      resetBloomLocalData,
      resetTodayCompleted,
      simulateNextDay,
      simulatePreviousDay,
      startTenDayReset,
      state,
      todayKey
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
