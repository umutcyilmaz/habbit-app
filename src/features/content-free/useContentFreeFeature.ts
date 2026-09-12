import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";

import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { createContentFreeController } from "./contentFreeController";
import { getContentFreeFeatureView } from "./contentFreeView";

export function useContentFreeFeature() {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hasHydrated, hydrationStatus } = useBloomLocalState();
  const [nowMilliseconds, setNowMilliseconds] = useState(Date.now);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const currentController = useRef<ReturnType<typeof createContentFreeController> | null>(null);
  const controller = useMemo(() => createContentFreeController({
    flowActions, getState: getAcceptedState, retryPersistedMutation
  }), [flowActions, getAcceptedState, retryPersistedMutation]);
  currentController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const allowNavigation = usePersistenceNavigationGuard(operation.busy);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  // Display-only clock: the selector derives progress from canonical facts.
  // No flow command or persisted counter is updated on mount or on a tick.
  useEffect(() => {
    const interval = setInterval(() => setNowMilliseconds(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const content = state.contentFree;
  const view = hasHydrated
    ? getContentFreeFeatureView(content, new Date(nowMilliseconds).toISOString())
    : { progress: null, activationId: null, history: [], manualUndoCandidateId: null };
  const locked = !hasHydrated || operation.busy ||
    (operation.result !== null && !operation.result.ok && operation.result.accepted);
  const canRetry = !operation.busy && operation.result !== null && !operation.result.ok && operation.result.retryable;
  const saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed" = !hasHydrated
    ? hydrationStatus === "error" ? "unavailable" : "loading"
    : operation.busy ? "saving" :
    content === durableState.contentFree ? "saved" : "unconfirmed";

  const invoke = (command: () => ReturnType<typeof controller.activate>) => {
    if (!mounted.current || currentController.current !== controller) return;
    setNavigationError(null);
    const pending = command();
    // Expected persistence failures remain result objects; unexpected failures
    // are already represented by the controller's sanitized feedback.
    if (pending !== null) void pending.catch(() => {});
  };

  return {
    view, busy: operation.busy, locked, canRetry, saveState,
    message: navigationError ?? operation.message,
    actions: {
      activate: () => invoke(() => controller.activate(content)),
      deactivate: () => invoke(() => controller.deactivate(content)),
      recordManualViolation: () => invoke(() => controller.recordManualViolation(content)),
      undoManualViolation: (violationId: string) => invoke(() => controller.undoManualViolation(violationId, content)),
      retry: () => invoke(controller.retry),
      close: () => {
        if (!mounted.current || currentController.current !== controller || controller.getSnapshot().busy) return;
        try {
          allowNavigation();
          router.replace(routes.home);
        } catch {
          setNavigationError("This screen could not close. Please try Close again.");
        }
      }
    }
  };
}
