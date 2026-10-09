import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";

import { mapBloomHomeActionToFlowIntent } from "../../app/flows/mapBloomHomeActionToFlowIntent";
import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { getBloomHomeReadModel, type BloomHomeAction } from "../../domain/home/getBloomHomeReadModel";
import { getTrackingSummary } from "./homePresentation";
import { createHomeTrackingActivationController } from "./homeTrackingActivationController";

export function useBloomHomeFeature() {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hydrationStatus } = useBloomLocalState();
  const activationController = useMemo(() => createHomeTrackingActivationController({
    flowActions, getState: getAcceptedState, retryPersistedMutation
  }), [flowActions, getAcceptedState, retryPersistedMutation]);
  const activation = useSyncExternalStore(activationController.subscribe, activationController.getSnapshot, activationController.getSnapshot);
  const [observationTime, setObservationTime] = useState(() => new Date().toISOString());

  useEffect(() => {
    const refresh = () => setObservationTime(new Date().toISOString());
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  const model = useMemo(() => hydrationStatus === "ready"
    ? getBloomHomeReadModel(durableState, observationTime)
    : null, [durableState, hydrationStatus, observationTime]);
  const tracking = useMemo(() => getTrackingSummary(durableState.masturbationTracking, observationTime),
    [durableState.masturbationTracking, observationTime]);
  const openAction = useCallback((action: BloomHomeAction) => {
    navigateBloomProductFlow(router, mapBloomHomeActionToFlowIntent(action));
  }, [router]);
  const openPanic = useCallback(() => { navigateBloomProductFlow(router, { flow: "panic" }); }, [router]);
  const openContentFree = useCallback(() => { navigateBloomProductFlow(router, { flow: "contentFree" }); }, [router]);

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

  return { hydrationStatus, model, tracking, openAction, openPanic, openContentFree,
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
