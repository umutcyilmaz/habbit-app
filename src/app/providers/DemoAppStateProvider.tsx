import {
  createContext,
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
};

const DemoAppStateContext = createContext<DemoAppStateContextValue | undefined>(undefined);

export function DemoAppStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(demoAppStateReducer, demoInitialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

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

export function useDemoAppStateValue() {
  const context = useContext(DemoAppStateContext);

  if (context === undefined) {
    throw new Error("useDemoAppStateValue must be used inside DemoAppStateProvider.");
  }

  return context;
}
