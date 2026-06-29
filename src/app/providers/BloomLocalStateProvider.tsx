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
  resetTodayCompleted: boolean;
  resetDay: number;
};

const BloomLocalStateContext = createContext<BloomLocalStateContextValue | undefined>(undefined);

export function BloomLocalStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BloomLocalState>(defaultBloomLocalState);
  const [isLoading, setIsLoading] = useState(true);
  const resetTodayCompleted = isTodayCompleted(state.tenDayReset);
  const resetDay = getResetDay(state.tenDayReset);

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

  const value = useMemo(
    () => ({
      state,
      isLoading,
      startTenDayReset,
      completeTodayReset,
      resetTodayCompleted,
      resetDay
    }),
    [
      completeTodayReset,
      isLoading,
      resetDay,
      resetTodayCompleted,
      startTenDayReset,
      state
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
