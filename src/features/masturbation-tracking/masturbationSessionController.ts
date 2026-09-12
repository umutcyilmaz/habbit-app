import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type {
  BloomPersistedMutationResult,
  BloomPersistenceRetryToken
} from "../../app/providers/bloomLocalStateMutationRuntime";
import type { MasturbationSessionFeedback } from "../../domain/models/MasturbationSession";
import type { BloomLocalState } from "../../storage/bloomState";

export type SessionOperation = "start" | "startPause" | "endPause" | "end" | "completeFeedback";
export type MasturbationSessionOperationSnapshot = {
  busy: boolean;
  operation: SessionOperation | null;
  sessionId: string | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};

type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  getRouteSessionId: () => unknown;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  onPersisted?: (operation: SessionOperation, sessionId: string | null) => void;
};

// Local operation coordination only. The current runtime snapshot is read
// immediately before dispatch, so stale route handlers cannot target new work.
export function createMasturbationSessionController(options: Options) {
  let snapshot: MasturbationSessionOperationSnapshot = {
    busy: false, operation: null, sessionId: null, result: null, message: null
  };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  let acceptedStart: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: MasturbationSessionOperationSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const locked = () => snapshot.busy || (snapshot.result !== null && !snapshot.result.ok && snapshot.result.accepted);

  function observe(
    promise: Promise<BloomPersistedMutationResult>,
    operation: SessionOperation,
    sessionId: string | null
  ): Promise<BloomPersistedMutationResult> {
    const observed = promise.then((result) => {
      inFlight = null;
      if (operation === "start" && result.accepted) acceptedStart = observed;
      publish({ busy: false, operation, sessionId, result, message: result.ok ? null : persistenceMessage(result) });
      if (result.ok) options.onPersisted?.(operation, sessionId);
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "Bloom could not finish this request. Please return to Today and reopen the session." });
      throw error;
    });
    inFlight = observed;
    return observed;
  }

  function run(
    operation: SessionOperation,
    command: () => Promise<BloomPersistedMutationResult>
  ): Promise<BloomPersistedMutationResult> | null {
    if (snapshot.busy) return snapshot.operation === operation ? inFlight : null;
    if (operation === "start" && acceptedStart !== null) return acceptedStart;
    if (locked()) return null;
    let sessionId: string | null = null;
    if (operation !== "start") {
      const routeId = options.getRouteSessionId();
      const current = options.getState().masturbationTracking.currentSession;
      const expected = operation === "completeFeedback" ? "awaiting_feedback" : "active";
      if (typeof routeId !== "string" || routeId.trim().length === 0 || current?.id !== routeId || current.status !== expected) {
        publish({ ...snapshot, message: "This session is no longer available for this action. Return to Today and reopen your current session." });
        return null;
      }
      sessionId = routeId;
    }
    publish({ busy: true, operation, sessionId, result: null, message: null });
    try {
      const promise = command();
      // Start accepts synchronously; capture its identity before awaiting the
      // exact persistence receipt, without generating another ID in the feature.
      if (operation === "start") sessionId = options.getState().masturbationTracking.currentSession?.id ?? null;
      publish({ ...snapshot, sessionId });
      return observe(promise, operation, sessionId);
    } catch (error) {
      publish({ ...snapshot, busy: false, message: "Bloom could not finish this request. Please return to Today and reopen the session." });
      return Promise.reject(error);
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start: () => run("start", options.flowActions.tracking.session.start),
    startPause: () => run("startPause", options.flowActions.tracking.session.startPause),
    endPause: () => run("endPause", options.flowActions.tracking.session.endPause),
    end: () => run("end", options.flowActions.tracking.session.end),
    completeFeedback: (feedback: MasturbationSessionFeedback) => run(
      "completeFeedback", () => options.flowActions.tracking.session.completeFeedback(feedback)
    ),
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, operation, sessionId } = snapshot;
      if (result === null || result.ok || !result.retryable || operation === null) return null;
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), operation, sessionId);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Local storage has not confirmed this change yet. Retry checks the same save; it does not repeat the session action.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "This request was replaced by a newer change. Reopen your current session to continue.";
  if (result.accepted) return result.retryable
    ? "Your change is held in this session, but it could not be saved. Retry saving before continuing."
    : "Your change was accepted, but its save could not be confirmed. Reopen your current session to continue.";
  if (result.reason === "hydrationPending" || result.reason === "stateUnavailable" || result.reason === "deletionInProgress") return "Local data is not ready for this action. Please try again when it is available.";
  return "This session action is unavailable now. Your existing session and settings have been preserved.";
}
