import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { createResetRecommendationController, type AcceptedResetRecommendation } from "./resetRecommendationController";
import { getResetRecommendationView, sameResetRecommendationFacts, type ResetRecommendationView } from "./resetRecommendationView";

// Read-only evidence clock. The flow facade owns the acceptance Date and ID.
const readDisplayTime = () => new Date(Date.now()).toISOString();

export function useResetRecommendationFeature() {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hasHydrated, hydrationStatus } = useBloomLocalState();
  const [now, setNow] = useState(Date.now);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const durable = useRef(durableState);
  durable.current = durableState;
  const currentController = useRef<ReturnType<typeof createResetRecommendationController> | null>(null);
  const persisted = useRef<(accepted: AcceptedResetRecommendation) => void>(() => {});
  const controller = useMemo(() => {
    const instance = createResetRecommendationController({
      flowActions, getState: getAcceptedState, getDisplayTime: readDisplayTime, retryPersistedMutation,
      onPersisted: (accepted) => {
        if (mounted.current && currentController.current === instance) persisted.current(accepted);
      }
    });
    return instance;
  }, [flowActions, getAcceptedState, retryPersistedMutation]);
  currentController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const unconfirmed = !sameResetRecommendationFacts(state, durableState);
  const blocked = operation.busy || unconfirmed;
  const allowNavigation = usePersistenceNavigationGuard(blocked);
  const navigateSaved = (accepted: AcceptedResetRecommendation) => {
    if (!hasHydrated || getAcceptedState().resetJourney !== accepted) return;
    allowNavigation();
    if (!navigateBloomProductFlow(router, { flow: "resetBaseline", journeyId: accepted.id }, "replace")) {
      setNavigationError("Başlangıç soruları açılamadı. Devam et ile yeniden dene.");
    }
  };
  persisted.current = (accepted) => {
    try { navigateSaved(accepted); }
    catch { setNavigationError("Kaydın kaydedildi, ancak başlangıç soruları açılamadı. Devam et ile yeniden dene."); }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setNavigationError(null); }, [controller]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const view: ResetRecommendationView = hasHydrated
    ? getResetRecommendationView(state, new Date(now).toISOString()) : { kind: "unavailable" };
  const accepted = operation.acceptedReset;
  const recovery = accepted !== null && accepted === state.resetJourney;
  const locked = !hasHydrated || blocked || accepted !== null;
  const canRetry = hasHydrated && !operation.busy && recovery && accepted !== durableState.resetJourney &&
    operation.result !== null && !operation.result.ok && operation.result.retryable;
  // A newer cumulative save may durably include this exact Reset while
  // superseding its receipt. Only explicit Continue leaves in that case.
  const canContinue = hasHydrated && recovery && !blocked && operation.result !== null &&
    (operation.result.ok || operation.result.accepted);
  const saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed" = !hasHydrated
    ? hydrationStatus === "error" ? "unavailable" : "loading"
    : operation.busy ? "saving" : operation.result !== null && !operation.result.ok && !operation.result.accepted
      ? "unavailable" : unconfirmed ? "unconfirmed" : "saved";
  const current = () => mounted.current && currentController.current === controller;
  const invoke = (command: () => ReturnType<typeof controller.accept>, retry = false) => {
    if (!current() || !hasHydrated || (!retry && locked)) return;
    setNavigationError(null);
    const pending = command();
    if (pending !== null) void pending.catch(() => {});
  };
  return {
    view, busy: operation.busy, locked, saveState, canRetry, canContinue, recovery,
    message: navigationError ?? operation.message,
    actions: {
      accept: () => invoke(() => controller.accept(state)),
      retry: () => invoke(controller.retry, true),
      continueAfterSave: () => {
        if (!current() || controller.getSnapshot().busy || !canContinue || accepted === null ||
          !sameResetRecommendationFacts(getAcceptedState(), state) || !sameResetRecommendationFacts(state, durable.current)) return;
        try { navigateSaved(accepted); }
        catch { setNavigationError("Başlangıç soruları açılamadı. Yeniden dene."); }
      },
      close: () => {
        if (!current() || controller.getSnapshot().busy || blocked || !sameResetRecommendationFacts(getAcceptedState(), state)) return;
        try { allowNavigation(); router.replace(routes.home); }
        catch { setNavigationError("Ekran kapatılamadı. Yeniden dene."); }
      }
    }
  };
}
