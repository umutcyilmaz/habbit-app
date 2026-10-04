import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";

import { mapBloomHomeActionToFlowIntent } from "../../app/flows/mapBloomHomeActionToFlowIntent";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { getBloomHomeReadModel, type BloomHomeAction } from "../../domain/home/getBloomHomeReadModel";
import { getTrackingSummary } from "./homePresentation";

export function useBloomHomeFeature() {
  const router = useRouter();
  const { durableState, hydrationStatus } = useBloomLocalState();
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

  return { hydrationStatus, model, tracking, openAction, openPanic, openContentFree };
}
