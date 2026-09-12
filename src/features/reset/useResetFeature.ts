import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { navigateBloomProductFlow } from "../../app/navigation/navigateBloomProductFlow";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import type { ResetJourney, ResetViolation } from "../../domain/models/ResetJourney";
import { getResetProgress } from "../../domain/reset/getResetProgress";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { createResetController, type ResetAssessmentAnswers, type ResetBaselineAnswers, type ResetOperation } from "./resetController";
import { getResetRouteView, type ResetRouteMode, type ResetRouteView } from "./resetView";

// Read-only selector clock. Mutation IDs/timestamps are created exclusively by
// the existing flow factory, including on the completion screen.
const readDisplayTime = () => new Date(Date.now()).toISOString();

export function useResetFeature(mode: ResetRouteMode) {
  const router = useRouter();
  const params = useLocalSearchParams<{ journeyId?: string | string[]; attemptId?: string | string[] }>();
  const journeyId = typeof params.journeyId === "string" ? params.journeyId : null;
  const attemptId = typeof params.attemptId === "string" ? params.attemptId : null;
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hasHydrated, hydrationStatus } = useBloomLocalState();
  const [nowMilliseconds, setNowMilliseconds] = useState(Date.now);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const currentController = useRef<ReturnType<typeof createResetController> | null>(null);
  const onPersisted = useRef<(operation: ResetOperation, acceptedReset: ResetJourney) => void>(() => {});
  const controller = useMemo(() => {
    const instance = createResetController({
      flowActions, getState: getAcceptedState,
      getRoute: () => ({ mode, journeyId, attemptId }),
      getDisplayTime: readDisplayTime, retryPersistedMutation,
      onPersisted: (operation, acceptedReset) => {
        if (mounted.current && currentController.current === instance) onPersisted.current(operation, acceptedReset);
      }
    });
    return instance;
  }, [flowActions, getAcceptedState, retryPersistedMutation, mode, journeyId, attemptId]);
  currentController.current = controller;
  const operation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const allowNavigation = usePersistenceNavigationGuard(operation.busy);

  const navigateAcceptedReset = (acceptedReset: ResetJourney) => {
    if (getAcceptedState().resetJourney !== acceptedReset) return;
    if (acceptedReset.status === "active") {
      const progress = getResetProgress(acceptedReset, readDisplayTime());
      if (progress === null) return;
      allowNavigation();
      navigateBloomProductFlow(router, {
        flow: "resetProgress", journeyId: acceptedReset.id, attemptId: acceptedReset.currentAttempt.id, progress
      }, "replace");
    } else if (acceptedReset.status === "assessment_pending") {
      allowNavigation();
      navigateBloomProductFlow(router, {
        flow: "resetAssessment", journeyId: acceptedReset.id, attemptId: acceptedReset.currentAttempt.id
      }, "replace");
    } else if (acceptedReset.status === "completed") {
      allowNavigation();
      router.replace(routes.home);
    }
  };
  onPersisted.current = (_operation, acceptedReset) => {
    try { navigateAcceptedReset(acceptedReset); }
    catch { setNavigationError("Your change was saved, but the next screen could not open. Use Continue to try again."); }
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { setNavigationError(null); }, [controller]);
  useEffect(() => {
    const interval = setInterval(() => setNowMilliseconds(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const reset = state.resetJourney;
  const view: ResetRouteView = hasHydrated
    ? getResetRouteView(reset, { mode, journeyId: params.journeyId, attemptId: params.attemptId }, new Date(nowMilliseconds).toISOString())
    : { kind: "unavailable" };
  const locked = !hasHydrated || operation.busy ||
    (operation.result !== null && !operation.result.ok && operation.result.accepted);
  const canRetry = !operation.busy && operation.result !== null && !operation.result.ok && operation.result.retryable;
  const saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed" = !hasHydrated
    ? hydrationStatus === "error" ? "unavailable" : "loading"
    : operation.busy ? "saving" : reset === durableState.resetJourney ? "saved" : "unconfirmed";

  // A legitimate restart/undo changes the attempt before the old URL changes.
  // Keep that operation's receipt/retry UI visible without trusting the old URL
  // as authority for the successor. Only this exact saved successor can proceed.
  const acceptedReset = hasHydrated && operation.acceptedReset === reset ? operation.acceptedReset : null;
  const recoveryTarget: "progress" | "assessment" | "today" | null = acceptedReset?.status === "active" ? "progress" :
    acceptedReset?.status === "assessment_pending" ? "assessment" : acceptedReset?.status === "completed" ? "today" : null;
  const canContinue = !operation.busy && operation.result?.ok === true &&
    recoveryTarget !== null && acceptedReset === durableState.resetJourney;
  const canOpenCompletion = !locked && mode === "progress" && view.kind === "active" &&
    view.progress.isPeriodComplete && reset === durableState.resetJourney;

  const invoke = (command: () => ReturnType<typeof controller.completeElapsed>) => {
    if (!mounted.current || currentController.current !== controller) return;
    setNavigationError(null);
    const pending = command();
    if (pending !== null) void pending.catch(() => {});
  };
  return {
    view, busy: operation.busy, locked, message: navigationError ?? operation.message,
    canRetry, saveState, recoveryTarget, canContinue, canOpenCompletion,
    actions: {
      startFromBaseline: (answers: ResetBaselineAnswers) => invoke(() => controller.startFromBaseline(answers, reset)),
      recordViolation: (reason: ResetViolation["reason"]) => invoke(() => controller.recordViolation(reason, reset)),
      undoViolation: (violationId: string) => invoke(() => controller.undoViolation(violationId, reset)),
      completeElapsed: () => invoke(() => controller.completeElapsed(reset)),
      completeAssessment: (answers: ResetAssessmentAnswers) => invoke(() => controller.completeAssessment(answers, reset)),
      retry: () => invoke(controller.retry),
      continueAfterSave: () => {
        if (!mounted.current || currentController.current !== controller || controller.getSnapshot().busy ||
          !canContinue || acceptedReset === null || getAcceptedState().resetJourney !== acceptedReset) return;
        try { navigateAcceptedReset(acceptedReset); }
        catch { setNavigationError("The next screen could not open. Please try Continue again."); }
      },
      continueToCompletion: () => {
        if (!mounted.current || currentController.current !== controller || controller.getSnapshot().busy ||
          !canOpenCompletion || getAcceptedState().resetJourney !== reset) return;
        const currentView = getResetRouteView(reset, { mode, journeyId, attemptId }, readDisplayTime());
        if (currentView.kind !== "active" || !currentView.progress.isPeriodComplete) return;
        try {
          allowNavigation();
          navigateBloomProductFlow(router, {
            flow: "resetCompletion", journeyId: currentView.reset.id,
            attemptId: currentView.reset.currentAttempt.id, progress: currentView.progress
          }, "replace");
        } catch { setNavigationError("The completion screen could not open. Please try Continue again."); }
      },
      close: () => {
        if (!mounted.current || currentController.current !== controller || controller.getSnapshot().busy ||
          getAcceptedState().resetJourney !== reset) return;
        try { allowNavigation(); router.replace(routes.home); }
        catch { setNavigationError("This screen could not close. Please try Close again."); }
      }
    }
  };
}
