import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";

import { getBloomContentFreeEntryIntent } from "../../app/flows/getBloomContentFreeEntryIntent";
import { getResetContentFreeContinuationOffer } from "../../domain/contentFree/getResetContentFreeCredit";
import { mapBloomHomeActionToFlowIntent } from "../../app/flows/mapBloomHomeActionToFlowIntent";
import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { getBloomHomeReadModel, type BloomHomeAction } from "../../domain/home/getBloomHomeReadModel";
import { getTrackingSummary } from "./homePresentation";
import { createHomeTrackingActivationController } from "./homeTrackingActivationController";

const readSystemTime = () => new Date();

export function useBloomHomeFeature() {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, now, getAcceptedState, retryPersistedMutation, hydrationStatus } = useBloomLocalState();
  const activationController = useMemo(() => createHomeTrackingActivationController({
    flowActions, getState: getAcceptedState, retryPersistedMutation
  }), [flowActions, getAcceptedState, retryPersistedMutation]);
  const activation = useSyncExternalStore(activationController.subscribe, activationController.getSnapshot, activationController.getSnapshot);
  const [observationTime, setObservationTime] = useState(() => (now ?? readSystemTime)().toISOString());

  useEffect(() => {
    const refresh = () => setObservationTime((now ?? readSystemTime)().toISOString());
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [now, durableState.resetJourney, durableState.contentFree]);

  const model = useMemo(() => hydrationStatus === "ready"
    ? getBloomHomeReadModel(durableState, observationTime)
    : null, [durableState, hydrationStatus, observationTime]);
  const tracking = useMemo(() => getTrackingSummary(durableState.masturbationTracking, observationTime),
    [durableState.masturbationTracking, observationTime]);
  const openAction = useCallback((action: BloomHomeAction) => {
    navigateBloomProductFlow(router, mapBloomHomeActionToFlowIntent(action));
  }, [router]);
  const openPanic = useCallback(() => { navigateBloomProductFlow(router, { flow: "panic" }); }, [router]);
  const contentFreeContinuation = hydrationStatus === "ready" ? getResetContentFreeContinuationOffer(durableState, durableState) : null;
  const openContentFree = useCallback(() => {
    if (hydrationStatus !== "ready") return;
    navigateBloomProductFlow(router, getBloomContentFreeEntryIntent(durableState, (now ?? readSystemTime)().toISOString()));
  }, [router, durableState, hydrationStatus, now]);

  const activationUnconfirmed = state.masturbationTracking.enabled && !durableState.masturbationTracking.enabled;
  const enableTracking = useCallback(() => {
    if (hydrationStatus !== "ready" || !model?.trackingAvailability.canEnableTracking || activationUnconfirmed) return;
    const pending = activationController.enable(durableState.masturbationTracking);
    if (pending !== null) void pending.catch(() => {});
  }, [activationController, activationUnconfirmed, durableState.masturbationTracking, hydrationStatus, model]);
  const retryTrackingActivation = useCallback(() => {
    const pending = activationController.retry();
    if (pending !== null) void pending.catch(() => {});
  }, [activationController]);

  return { hydrationStatus, model, tracking, openAction, openPanic, openContentFree, contentFreeContinuation,
    trackingActivation: {
      busy: activation.busy,
      locked: activation.busy || activationUnconfirmed || activation.result?.ok === true ||
        (activation.result !== null && activation.result.accepted),
      canRetry: !activation.busy && activation.result !== null && !activation.result.ok && activation.result.retryable && activationUnconfirmed,
      message: activation.message ?? (activationUnconfirmed && !activation.busy ? "Kaydetme henüz doğrulanmadı." : null),
      enable: enableTracking,
      retry: retryTrackingActivation
    }
  };
}
