import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type PropsWithChildren
} from "react";

import { demoAppStateReducer, type DemoAppAction } from "../../domain/demo/demoActions";
import { demoInitialState } from "../../domain/demo/demoInitialState";
import type { DemoAppState } from "../../domain/demo/demoTypes";

type DemoAppStateContextValue = {
  state: DemoAppState;
  dispatch: Dispatch<DemoAppAction>;
  resetDemoAppState: () => void;
};

const DemoAppStateContext = createContext<DemoAppStateContextValue | undefined>(undefined);

export function DemoAppStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(demoAppStateReducer, demoInitialState);
  const resetDemoAppState = useCallback(() => {
    dispatch({ type: "RESET_DEMO_STATE" });
  }, []);
  const value = useMemo(
    () => ({ state, dispatch, resetDemoAppState }),
    [resetDemoAppState, state]
  );

  return <DemoAppStateContext.Provider value={value}>{children}</DemoAppStateContext.Provider>;
}

export function useDemoAppState() {
  const context = useContext(DemoAppStateContext);

  if (context === undefined) {
    throw new Error("useDemoAppState must be used inside DemoAppStateProvider.");
  }

  return context.state;
}

export function useDemoAppDispatch() {
  const context = useContext(DemoAppStateContext);

  if (context === undefined) {
    throw new Error("useDemoAppDispatch must be used inside DemoAppStateProvider.");
  }

  return context.dispatch;
}

export function useResetDemoAppState() {
  const context = useContext(DemoAppStateContext);

  if (context === undefined) {
    throw new Error("useResetDemoAppState must be used inside DemoAppStateProvider.");
  }

  return context.resetDemoAppState;
}
