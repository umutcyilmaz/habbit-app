import { getPracticeAvailability } from "../../domain/productPolicy/getPracticeAvailability";
import type { createBloomLocalStateMutationRuntime } from "./bloomLocalStateMutationRuntime";

type PracticeRuntimeRead = Pick<ReturnType<typeof createBloomLocalStateMutationRuntime>, "getState" | "getDurableState" | "getHydrationStatus" | "isWritesBlocked">;
// Event-time policy reads cannot depend on an earlier React context render.
export function readPracticeAvailability(runtime:PracticeRuntimeRead) {
  return getPracticeAvailability(runtime.getDurableState(),runtime.getHydrationStatus()==="ready"&&!runtime.isWritesBlocked(),runtime.getState());
}
