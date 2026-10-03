import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";

import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import type { BehaviorSlipReason } from "../../domain/models/BehaviorSlip";
import { getUrgeControlProgress } from "../../domain/urgeControl/getUrgeControlProgress";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import type { BloomLocalState } from "../../storage/bloomState";
import { createPanicController, type PanicOperation } from "./panicController";
import { getPanicView, samePanicFacts, type PanicView } from "./panicView";

// Display/preview clock only. The flow facade owns all mutation facts.
const readDisplayTime = () => new Date(Date.now()).toISOString();

export function usePanicFeature(reason: BehaviorSlipReason | null) {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hasHydrated, hydrationStatus } = useBloomLocalState();
  const [nowMilliseconds, setNowMilliseconds] = useState(Date.now);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const currentController = useRef<ReturnType<typeof createPanicController> | null>(null);
  const onPersisted = useRef<(operation: PanicOperation, accepted: BloomLocalState) => void>(() => {});
  const controller = useMemo(() => {
    const instance = createPanicController({
      flowActions, getState: getAcceptedState, getDisplayTime: readDisplayTime, retryPersistedMutation,
      onPersisted: (operation, accepted) => {
        if (mounted.current && currentController.current === instance) onPersisted.current(operation, accepted);
      }
    });
    return instance;
  }, [flowActions, getAcceptedState, retryPersistedMutation]);
  currentController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const durable = samePanicFacts(state, durableState);
  // An obsolete nonretryable receipt must not trap a newer durable state.
  // Conflicting commands stay locked by the receipt; Close follows durability.
  const blocked = operation.busy || !durable;
  const allowNavigation = usePersistenceNavigationGuard(blocked);
  const navigateSaved = (kind: PanicOperation, accepted: BloomLocalState) => {
    if (!samePanicFacts(getAcceptedState(), accepted)) return;
    if (kind === "startUrge") {
      const event = accepted.urgeControl.activeEvent;
      const progress = getUrgeControlProgress(accepted.urgeControl, readDisplayTime());
      if (event === null || progress === null) return;
      allowNavigation();
      if (!navigateBloomProductFlow(router, { flow: "urgeControl", mode: "resume", eventId: event.id, stage: progress.stage }, "replace")) {
        setNavigationError("Devam ekranı açılamadı. Devam et ile yeniden dene.");
      }
    } else {
      allowNavigation();
      router.replace(routes.home);
    }
  };
  onPersisted.current = (kind, accepted) => {
    try { navigateSaved(kind, accepted); }
    catch { setNavigationError("Kaydın kaydedildi, ancak sonraki ekran açılamadı. Devam et ile yeniden dene."); }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setNavigationError(null); }, [controller]);
  useEffect(() => {
    const interval = setInterval(() => setNowMilliseconds(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const view: PanicView = hasHydrated
    ? getPanicView(state, reason, new Date(nowMilliseconds).toISOString()) : { kind: "unavailable" };
  const locked = !hasHydrated || blocked || operation.acceptedState !== null;
  const canRetry = !operation.busy && operation.result !== null && !operation.result.ok && operation.result.retryable;
  const saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed" = !hasHydrated
    ? hydrationStatus === "error" ? "unavailable" : "loading"
    : operation.busy ? "saving" : durable ? "saved" : "unconfirmed";
  const accepted = operation.acceptedState;
  const recoveryTarget = accepted === null ? null : operation.operation === "startUrge" ? "urge" : "today";
  const canContinue = hasHydrated && !blocked && operation.result?.ok === true && accepted !== null && samePanicFacts(state, accepted);
  const current = () => mounted.current && currentController.current === controller;
  const invoke = (command: () => ReturnType<typeof controller.startUrge>, retry = false) => {
    if (!current() || !hasHydrated || (!retry && !durable)) return;
    setNavigationError(null);
    const pending = command();
    if (pending !== null) void pending.catch(() => {});
  };
  return {
    view, busy: operation.busy, locked, canRetry, saveState, recoveryTarget, canContinue,
    message: navigationError ?? operation.message,
    actions: {
      startUrge: () => invoke(() => controller.startUrge(state)),
      recordSlip: () => { if (reason !== null) invoke(() => controller.recordSlip(reason, state)); },
      retry: () => invoke(controller.retry, true),
      continueAfterSave: () => {
        if (!current() || controller.getSnapshot().busy || !canContinue || accepted === null || operation.operation === null) return;
        try { navigateSaved(operation.operation, accepted); }
        catch { setNavigationError("Sonraki ekran açılamadı. Devam et ile yeniden dene."); }
      },
      continueExisting: () => {
        if (!current() || controller.getSnapshot().busy || locked || view.kind !== "resume" || !samePanicFacts(getAcceptedState(), state)) return;
        const progress = getUrgeControlProgress(state.urgeControl, readDisplayTime());
        if (progress === null) return;
        try {
          allowNavigation();
          if (!navigateBloomProductFlow(router, { flow: "urgeControl", mode: "resume", eventId: view.eventId, stage: progress.stage }, "replace")) {
            setNavigationError("Devam ekranı açılamadı. Yeniden dene.");
          }
        } catch { setNavigationError("Devam ekranı açılamadı. Yeniden dene."); }
      },
      close: () => {
        if (!current() || controller.getSnapshot().busy || blocked || !samePanicFacts(getAcceptedState(), state)) return;
        try { allowNavigation(); router.replace(routes.home); }
        catch { setNavigationError("Ekran kapatılamadı. Yeniden dene."); }
      }
    }
  };
}
