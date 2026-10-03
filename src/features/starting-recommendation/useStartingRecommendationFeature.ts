import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { createStartingRecommendationController } from "./startingRecommendationController";
import {
  getStartingRecommendationView, isStartingRecommendationSuccessorCurrent, sameStartingRecommendationFacts,
  type AcceptedStartingRecommendation, type StartingRecommendationView
} from "./startingRecommendationView";

export function useStartingRecommendationFeature() {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hasHydrated, hydrationStatus } = useBloomLocalState();
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const durable = useRef(durableState);
  durable.current = durableState;
  const currentController = useRef<ReturnType<typeof createStartingRecommendationController> | null>(null);
  const persisted = useRef<(accepted: AcceptedStartingRecommendation) => void>(() => {});
  const controller = useMemo(() => {
    const instance = createStartingRecommendationController({
      flowActions, getState: getAcceptedState, retryPersistedMutation,
      onPersisted: (accepted) => {
        if (mounted.current && currentController.current === instance) persisted.current(accepted);
      }
    });
    return instance;
  }, [flowActions, getAcceptedState, retryPersistedMutation]);
  currentController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const unconfirmed = !sameStartingRecommendationFacts(state, durableState);
  const blocked = operation.busy || unconfirmed;
  const allowNavigation = usePersistenceNavigationGuard(blocked);
  const navigateSaved = (accepted: AcceptedStartingRecommendation) => {
    if (!hasHydrated || !isStartingRecommendationSuccessorCurrent(accepted, getAcceptedState())) return;
    const recommendation = accepted.productOnboarding.planAcceptance.recommendation;
    if (recommendation === "reset" || recommendation === "reset_and_content_free") {
      if (accepted.resetJourney.status !== "baseline_pending") return;
      allowNavigation();
      if (!navigateBloomProductFlow(router, { flow: "resetBaseline", journeyId: accepted.resetJourney.id }, "replace")) {
        setNavigationError("Başlangıç soruları açılamadı. Devam et ile yeniden dene.");
      }
    } else {
      allowNavigation();
      router.replace(routes.home);
    }
  };
  persisted.current = (accepted) => {
    try { navigateSaved(accepted); }
    catch { setNavigationError("Planın kaydedildi, ancak sonraki ekran açılamadı. Devam et ile yeniden dene."); }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setNavigationError(null); }, [controller]);
  const view: StartingRecommendationView = hasHydrated ? getStartingRecommendationView(state) : { kind: "unavailable" };
  const accepted = operation.acceptedFacts;
  const recovery = accepted !== null && isStartingRecommendationSuccessorCurrent(accepted, state);
  const locked = !hasHydrated || blocked || accepted !== null;
  const canRetry = hasHydrated && !operation.busy && recovery && unconfirmed &&
    sameStartingRecommendationFacts(state, accepted!) && operation.result !== null && !operation.result.ok && operation.result.retryable;
  // Superseded receipts never auto-navigate; a later cumulative durable save
  // permits explicit recovery while the accepted plan/destination still exists.
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
    view, busy: operation.busy, locked, saveState, canRetry, canContinue, recovery, canClose: hasHydrated && !blocked,
    message: navigationError ?? operation.message,
    actions: {
      accept: () => invoke(() => controller.accept(state)),
      retry: () => invoke(controller.retry, true),
      continueAfterSave: () => {
        if (!current() || controller.getSnapshot().busy || !canContinue || accepted === null ||
          !sameStartingRecommendationFacts(getAcceptedState(), state) || !sameStartingRecommendationFacts(state, durable.current)) return;
        try { navigateSaved(accepted); }
        catch { setNavigationError("Sonraki ekran açılamadı. Yeniden dene."); }
      },
      close: () => {
        if (!current() || !hasHydrated || controller.getSnapshot().busy || blocked ||
          !sameStartingRecommendationFacts(getAcceptedState(), state) || !sameStartingRecommendationFacts(state, durable.current)) return;
        try { allowNavigation(); router.replace(routes.home); }
        catch { setNavigationError("Ekran kapatılamadı. Yeniden dene."); }
      }
    }
  };
}
