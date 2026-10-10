import { useMemo } from "react";

import { useBloomLocalState } from "../providers/BloomLocalStateProvider";
import {
  createBloomProductFlowActions,
  type BloomProductFlowActions
} from "./bloomProductFlowActions";

export function useBloomProductFlowActions(): BloomProductFlowActions {
  const { productActions, now } = useBloomLocalState();
  return useMemo(
    () => createBloomProductFlowActions({ productActions, now }),
    [productActions, now]
  );
}
