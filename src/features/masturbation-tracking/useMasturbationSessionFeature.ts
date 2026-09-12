import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { routes } from "../../constants/navigation";
import { getMasturbationTrackingAvailability } from "../../domain/productPolicy/getMasturbationTrackingAvailability";
import type { MasturbationSessionFeedback } from "../../domain/models/MasturbationSession";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { createMasturbationSessionController, type SessionOperation } from "./masturbationSessionController";
import { getMasturbationSessionRouteView } from "./masturbationSessionView";

export function useMasturbationSessionFeature(mode: "start" | "active" | "feedback") {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const routeId = mode === "start" ? undefined : params.sessionId;
  // Duplicate/malformed URL values never become a scalar identity.
  const controllerRouteId = typeof routeId === "string" ? routeId : null;
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation } = useBloomLocalState();
  const [nowMilliseconds, setNowMilliseconds] = useState(Date.now);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const activeController = useRef<ReturnType<typeof createMasturbationSessionController> | null>(null);
  const onPersisted = useRef<(operation: SessionOperation, sessionId: string | null) => void>(() => {});
  const controller = useMemo(() => {
    const instance = createMasturbationSessionController({
      flowActions,
      getState: getAcceptedState,
      getRouteSessionId: () => controllerRouteId,
      retryPersistedMutation,
      onPersisted: (operation, sessionId) => {
        if (mounted.current && activeController.current === instance) onPersisted.current(operation, sessionId);
      }
    });
    return instance;
  }, [flowActions, getAcceptedState, retryPersistedMutation, controllerRouteId, mode]);
  activeController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const allowNavigation = usePersistenceNavigationGuard(operation.busy);

  const navigateSession = (sessionId: string) => {
    const current = getAcceptedState().masturbationTracking.currentSession;
    if (current?.id !== sessionId) return;
    allowNavigation();
    navigateBloomProductFlow(router, current.status === "active"
      ? { flow: "masturbationSession", mode: "resume", sessionId }
      : { flow: "masturbationSessionFeedback", sessionId }, "replace");
  };
  const close = () => {
    if (!mounted.current || activeController.current !== controller || controller.getSnapshot().busy) return;
    allowNavigation();
    router.replace(routes.home);
  };
  onPersisted.current = (completedOperation, sessionId) => {
    try {
      if (sessionId === null) return;
      const current = getAcceptedState();
      if (completedOperation === "completeFeedback") {
        if (current.masturbationTracking.sessions.some((entry) => entry.id === sessionId)) close();
      } else if (completedOperation === "start" || completedOperation === "end") {
        navigateSession(sessionId);
      }
    } catch {
      setNavigationError("Your change was saved, but this screen could not close. Use Continue or Back to Today.");
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setNavigationError(null);
  }, [controller]);
  // Display-only clock. No flow, mutation, or persisted duration is updated by
  // a tick; the domain transitions own all session timestamps and durations.
  useEffect(() => {
    const interval = setInterval(() => setNowMilliseconds(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const displayedId = mode === "start"
    ? state.masturbationTracking.currentSession?.id ?? operation.sessionId ?? undefined
    : routeId;
  const view = getMasturbationSessionRouteView(state, displayedId, nowMilliseconds);
  const durableView = getMasturbationSessionRouteView(durableState, displayedId, nowMilliseconds);
  const canContinue = !operation.busy &&
    (view.kind === "active" || view.kind === "awaitingFeedback") &&
    "session" in durableView && durableView.session === view.session;
  const isDurablyCompleted = view.kind === "completed" && durableView.kind === "completed" &&
    view.session === durableView.session;
  const availability = getMasturbationTrackingAvailability(state, new Date(nowMilliseconds).toISOString());
  const locked = operation.busy || (operation.result !== null && !operation.result.ok && operation.result.accepted);
  const canRetry = !operation.busy && operation.result !== null && !operation.result.ok && operation.result.retryable;
  const invoke = (command: () => ReturnType<typeof controller.start>) => {
    // Discard handlers retained by an earlier route render or an unmounted
    // screen; only the current controller may issue a new command or retry.
    if (!mounted.current || activeController.current !== controller) return;
    setNavigationError(null);
    const pending = command();
    // Expected persistence failures are result objects. An unexpected thrown
    // dependency failure has already set the controller's sanitized message.
    if (pending !== null) void pending.catch(() => {});
  };

  return {
    view, availability, busy: operation.busy, locked,
    message: navigationError ?? operation.message,
    canRetry, canContinue, isDurablyCompleted,
    actions: {
      start: () => invoke(controller.start),
      startPause: () => invoke(controller.startPause),
      endPause: () => invoke(controller.endPause),
      end: () => invoke(controller.end),
      completeFeedback: (feedback: MasturbationSessionFeedback) => invoke(() => controller.completeFeedback(feedback)),
      retry: () => invoke(controller.retry),
      continueSession: () => {
        if (mounted.current && activeController.current === controller &&
          !controller.getSnapshot().busy && canContinue && "session" in view &&
          getAcceptedState().masturbationTracking.currentSession === view.session) {
          try { navigateSession(view.session.id); }
          catch { setNavigationError("This screen could not open. Please try Continue again."); }
        }
      },
      close
    }
  };
}
