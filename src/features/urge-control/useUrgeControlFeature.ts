import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StackActions } from "@react-navigation/native";
import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import type { CurrentUrgeControlTrigger, LegacyUrgeControlTrigger, UrgeControlOutcome, UrgeControlTechnique } from "../../domain/models/UrgeControlEvent";
import type { UrgeControlState } from "../../domain/models/UrgeControlState";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { createUrgeControlController, type UrgeControlOperation } from "./urgeControlController";
import { getUrgeControlRouteView, type UrgeControlRouteView } from "./urgeControlView";

const readDisplayTime = () => new Date(Date.now()).toISOString();

export function useUrgeControlFeature() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ eventId?: string | string[]; stage?: string | string[] }>();
  // Keep malformed/duplicate identity distinguishable; stage is only a hint.
  const eventId = params.eventId;
  const routeKey = JSON.stringify(eventId);
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hasHydrated, hydrationStatus } = useBloomLocalState();
  const [now, setNow] = useState(Date.now);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [exerciseExitFailed, setExerciseExitFailed] = useState(false);
  const mounted = useRef(false);
  const durable = useRef(durableState);
  durable.current = durableState;
  const currentController = useRef<ReturnType<typeof createUrgeControlController> | null>(null);
  const persisted = useRef<(operation: UrgeControlOperation, urge: UrgeControlState) => void>(() => {});
  const controller = useMemo(() => {
    const instance = createUrgeControlController({
      flowActions, getState: getAcceptedState, getDurableState: () => durable.current, getRouteEventId: () => eventId,
      getDisplayTime: readDisplayTime, retryPersistedMutation,
      onPersisted: (operation, urge) => {
        if (mounted.current && currentController.current === instance) persisted.current(operation, urge);
      }
    });
    return instance;
  }, [flowActions, getAcceptedState, retryPersistedMutation, routeKey]);
  currentController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const urge = state.urgeControl;
  const unconfirmed = urge !== durableState.urgeControl;
  const receiptPending = operation.acceptedUrge === urge && operation.result?.ok !== true && unconfirmed;
  const locked = !hasHydrated || operation.busy || unconfirmed || receiptPending;
  const displayTime = new Date(now).toISOString();
  const acceptedView: UrgeControlRouteView = hasHydrated ? getUrgeControlRouteView(urge, eventId, displayTime) : { kind: "unavailable" };
  const durableView: UrgeControlRouteView = hasHydrated ? getUrgeControlRouteView(durableState.urgeControl, eventId, displayTime) : { kind: "unavailable" };
  // An optimistic interrupt transition must retain its exercise/recovery UI.
  const holdInterruptForAcknowledgement = unconfirmed && acceptedView.kind === "current" && acceptedView.progress.stage === "outcome" &&
    durableView.kind === "current" && durableView.progress.stage === "interrupt" && acceptedView.event.id === durableView.event.id;
  const view = holdInterruptForAcknowledgement ? durableView : acceptedView;
  const exerciseVisible = view.kind === "current" && view.progress.stage === "interrupt";
  // Recovery stays protected after an accepted write fails, including terminal
  // snapshots where there is no active event left for the route to render.
  // One gesture owner for the production route. The exercise owns its Back
  // confirmation, including while persistence blocks the confirmed exit.
  const allowNavigation = usePersistenceNavigationGuard(operation.busy || unconfirmed || receiptPending,
    { gesturesDisabled: exerciseVisible, handleHardwareBack: !exerciseVisible });
  const navigateSaved = (accepted: UrgeControlState) => {
    if (!hasHydrated || getAcceptedState().urgeControl !== accepted || accepted.activeEvent !== null) return;
    allowNavigation();
    router.replace(routes.home);
  };
  persisted.current = (action, accepted) => {
    if (action !== "complete" && action !== "discardActive") return;
    try { navigateSaved(accepted); }
    catch { setNavigationError("Kayıt kaydedildi. Home ekranını açmak için Devam et düğmesini kullanın."); }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setNavigationError(null); setExerciseExitFailed(false); }, [controller]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const acceptedUrge = operation.acceptedUrge === urge ? operation.acceptedUrge : null;
  const terminalReceipt = acceptedUrge !== null && acceptedUrge.activeEvent === null &&
    (operation.operation === "complete" || operation.operation === "discardActive");
  const canRetry = hasHydrated && !operation.busy && operation.result !== null && !operation.result.ok && operation.result.retryable &&
    (operation.acceptedUrge === null || operation.acceptedUrge === urge && unconfirmed);
  // A later cumulative save may durably contain this exact Urge slice while
  // superseding the original receipt. Only an explicit Continue leaves in that
  // case; a failed receipt never triggers optimistic navigation.
  const canContinue = hasHydrated && terminalReceipt && !operation.busy && !unconfirmed && operation.result !== null &&
    (operation.result.ok || operation.result.accepted);
  const saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed" = !hasHydrated
    ? hydrationStatus === "error" ? "unavailable" : "loading"
    : operation.busy ? "saving" : unconfirmed || receiptPending ? "unconfirmed" : "saved";
  const invoke = (command: () => ReturnType<typeof controller.complete>, retry = false) => {
    if (!mounted.current || currentController.current !== controller || !hasHydrated || (!retry && locked)) return false;
    setNavigationError(null);
    setExerciseExitFailed(false);
    const pending = command();
    if (pending === null) return false;
    void pending.catch(() => {});
    return true;
  };
  return {
    view, busy: operation.busy, locked, saveState, canRetry, canContinue, terminalReceipt, exerciseExitFailed,
    message: navigationError ?? operation.message,
    actions: {
      completeInterrupt: () => invoke(() => controller.completeInterrupt(urge)),
      selectTechnique: (technique: UrgeControlTechnique) => invoke(() => controller.selectTechnique(technique, urge)),
      startPhoneAway: () => invoke(() => controller.startPhoneAway(urge)),
      endPhoneAway: () => invoke(() => controller.endPhoneAway(urge)),
      recordOutcome: (outcome: UrgeControlOutcome) => invoke(() => controller.recordOutcome(outcome, urge)),
      recordTrigger: (trigger: LegacyUrgeControlTrigger) => invoke(() => controller.recordTrigger(trigger, urge)),
      recordTriggers: (triggers: CurrentUrgeControlTrigger[]) => invoke(() => controller.recordTriggers(triggers, urge)),
      complete: () => invoke(() => controller.complete(urge)),
      discardActive: () => invoke(() => controller.discardActive(urge)),
      retry: () => invoke(controller.retry, true),
      exitExercise: () => {
        const latestUrge = getAcceptedState().urgeControl;
        const latestView = getUrgeControlRouteView(latestUrge, eventId, readDisplayTime());
        if (!mounted.current || currentController.current !== controller || !hasHydrated || locked || controller.getSnapshot().busy ||
          latestUrge !== urge || latestUrge !== durable.current.urgeControl || latestView.kind !== "current" || latestView.progress.stage !== "interrupt") return false;
        setNavigationError(null);
        setExerciseExitFailed(false);
        try {
          // Expo Router queues replace and cannot report a cancelled action.
          // Dispatch the existing Home destination synchronously so an unchanged
          // stack (router boundary/beforeRemove rejection) restores the modal.
          const before = navigation.getState();
          if (before === undefined) return false;
          const source = before.routes[before.index]?.key;
          if (source === undefined || !navigation.isFocused()) return false;
          navigation.dispatch({ ...StackActions.replace("(tabs)", { screen: "today" }), source, target: before.key });
          const after = navigation.getState();
          if (after !== undefined && !after.routes.some(route => route.key === source)) return true;
        }
        catch {
          // The same recovery is used for thrown and silently rejected actions.
        }
        setExerciseExitFailed(true);
        setNavigationError("Home açılamadı. Çıkış penceresinden yeniden deneyin.");
        return false;
      },
      continueAfterSave: () => {
        if (!mounted.current || currentController.current !== controller || controller.getSnapshot().busy || !canContinue || acceptedUrge === null) return;
        try { navigateSaved(acceptedUrge); } catch { setNavigationError("Home açılamadı. Yeniden deneyin."); }
      },
      closeUnavailable: () => {
        if (!mounted.current || currentController.current !== controller || locked || controller.getSnapshot().busy ||
          getAcceptedState().urgeControl !== urge || view.kind === "current" || view.kind === "legacy") return;
        try { allowNavigation(); router.replace(routes.home); } catch { setNavigationError("Home açılamadı. Yeniden deneyin."); }
      }
    }
  };
}
