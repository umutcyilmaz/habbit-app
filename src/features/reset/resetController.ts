import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { PostResetAssessment } from "../../domain/models/PostResetAssessment";
import type { ResetBaseline } from "../../domain/models/ResetBaseline";
import type { ResetJourney, ResetViolation } from "../../domain/models/ResetJourney";
import type { ISODateString } from "../../domain/models/shared";
import type { BloomLocalState } from "../../storage/bloomState";
import { getLatestResetUndoCandidate, getResetRouteView, type ResetRouteInput } from "./resetView";

export type ResetBaselineAnswers = ResetBaseline["selfReport"];
export type ResetAssessmentAnswers = Pick<PostResetAssessment,
  "urgeIntensityChange" | "abilityToPauseChange" | "spontaneousErectionChange" |
  "overallSexualResponseChange" | "readinessToRestartTracking">;
export type ResetOperation = "startFromBaseline" | "recordViolation" | "undoViolation" | "completeElapsed" | "completeAssessment";
export type ResetOperationSnapshot = {
  busy: boolean;
  operation: ResetOperation | null;
  violationId: string | null;
  acceptedReset: ResetJourney | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};
type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  getRoute: () => ResetRouteInput;
  getDisplayTime: () => ISODateString;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  onPersisted?: (operation: ResetOperation, acceptedReset: ResetJourney) => void;
};
const unavailable = "This action is unavailable for the current Reset record. Review the current journey and attempt before trying again.";

export function createResetController(options: Options) {
  let snapshot: ResetOperationSnapshot = {
    busy: false, operation: null, violationId: null, acceptedReset: null, result: null, message: null
  };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: ResetOperationSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  function observe(
    promise: Promise<BloomPersistedMutationResult>, operation: ResetOperation,
    violationId: string | null, acceptedReset: ResetJourney | null
  ): Promise<BloomPersistedMutationResult> {
    const observed = promise.then((result) => {
      inFlight = null;
      publish({ busy: false, operation, violationId, acceptedReset, result, message: result.ok ? null : persistenceMessage(result) });
      if (result.ok && acceptedReset !== null) options.onPersisted?.(operation, acceptedReset);
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "Bloom could not finish this request. Close and reopen the Reset screen to continue." });
      throw error;
    });
    inFlight = observed;
    return observed;
  }

  function run(
    operation: ResetOperation, expectedReset: ResetJourney,
    command: (reset: ResetJourney) => Promise<BloomPersistedMutationResult>, violationId: unknown = null
  ): Promise<BloomPersistedMutationResult> | null {
    if (snapshot.busy) return snapshot.operation === operation && snapshot.violationId === violationId ? inFlight : null;
    if (snapshot.result !== null && !snapshot.result.ok && snapshot.result.accepted) return null;
    const reset = options.getState().resetJourney;
    const route = options.getRoute();
    const view = getResetRouteView(reset, route, options.getDisplayTime());
    const valid = reset === expectedReset && (
      operation === "startFromBaseline" ? route.mode === "baseline" && view.kind === "baseline" :
      operation === "completeAssessment" ? route.mode === "assessment" && view.kind === "assessment" :
      operation === "completeElapsed" ? route.mode === "completion" && view.kind === "active" && view.progress.isPeriodComplete :
      route.mode === "progress" && view.kind === "active" &&
        (operation !== "undoViolation" || (typeof violationId === "string" && violationId.trim().length > 0 &&
          getLatestResetUndoCandidate(reset)?.id === violationId))
    );
    if (!valid) {
      publish({ ...snapshot, message: unavailable });
      return null;
    }
    const targetId = typeof violationId === "string" ? violationId : null;
    publish({ busy: true, operation, violationId: targetId, acceptedReset: null, result: null, message: null });
    try {
      const pending = command(reset);
      // Existing commands accept synchronously. Retain their exact successor
      // for receipt/retry navigation; the old URL is never its new identity.
      const nextReset = options.getState().resetJourney;
      const acceptedReset = nextReset === reset ? null : nextReset;
      publish({ ...snapshot, acceptedReset });
      return observe(pending, operation, targetId, acceptedReset);
    } catch (error) {
      publish({ ...snapshot, busy: false, message: "Bloom could not finish this request. Close and reopen the Reset screen to continue." });
      return Promise.reject(error);
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    startFromBaseline: (selfReport: ResetBaselineAnswers, expectedReset: ResetJourney) => run(
      "startFromBaseline", expectedReset, () => options.flowActions.reset.startFromBaseline({ selfReport })
    ),
    recordViolation: (reason: ResetViolation["reason"], expectedReset: ResetJourney) => run(
      "recordViolation", expectedReset, () => options.flowActions.reset.recordViolation({ reason, source: { kind: "manual" } })
    ),
    undoViolation: (violationId: unknown, expectedReset: ResetJourney) => run(
      "undoViolation", expectedReset,
      () => options.flowActions.reset.undoViolation({ violationId: violationId as string }), violationId
    ),
    completeElapsed: (expectedReset: ResetJourney) => run(
      "completeElapsed", expectedReset, options.flowActions.reset.completeElapsed
    ),
    completeAssessment: (answers: ResetAssessmentAnswers, expectedReset: ResetJourney) => run(
      "completeAssessment", expectedReset, (reset) => {
        // run has validated the assessment route and this exact immutable
        // snapshot. Stable references come from canonical state, not URL hints.
        if (reset.status !== "assessment_pending") throw new Error("Invalid assessment state.");
        return options.flowActions.reset.completeAssessment({
          ...answers, resetJourneyId: reset.id, resetAttemptId: reset.currentAttempt.id, baselineId: reset.baseline.id
        });
      }
    ),
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, operation, violationId, acceptedReset } = snapshot;
      if (result === null || result.ok || !result.retryable || operation === null) return null;
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), operation, violationId, acceptedReset);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Saving has not been confirmed yet. Try saving again to check the same change.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "This request was replaced by a newer change. Close and reopen the current Reset route to continue.";
  if (result.accepted) return result.retryable
    ? "Your change is held here, but it could not be saved. Try saving again before continuing."
    : "Your change was accepted, but saving could not be confirmed. Close and reopen the current Reset route to continue.";
  if (result.reason === "hydrationPending" || result.reason === "stateUnavailable" || result.reason === "deletionInProgress") return "Local data is not ready for this action. Please try again when it is available.";
  return unavailable;
}
