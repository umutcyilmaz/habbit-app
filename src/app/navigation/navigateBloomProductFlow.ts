import type { Router } from "expo-router";

import type { BloomProductFlowIntent } from "../flows/mapBloomHomeActionToFlowIntent";
import { mapBloomProductFlowIntentToRouteDestination } from "./mapBloomProductFlowIntentToRouteDestination";

// Only this thin adapter executes a resolved destination. Mapping itself is
// pure, and unimplemented feature destinations never reach the router.
export function navigateBloomProductFlow(
  router: Pick<Router, "push" | "replace">,
  intent: BloomProductFlowIntent,
  method: "push" | "replace" = "push"
): boolean {
  const result = mapBloomProductFlowIntentToRouteDestination(intent);
  if (result.status !== "ready") return false;
  router[method](result.destination);
  return true;
}
