import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type {
  BloomPersistedMutationResult,
  BloomPersistenceRetryToken
} from "../../app/providers/bloomLocalStateMutationRuntime";
import type { ContentFreeState } from "../../domain/models/ContentFreeState";
import type { BloomLocalState } from "../../storage/bloomState";
import { getLatestManualContentFreeUndoCandidate } from "./contentFreeView";

export type ContentFreeOperation = "activate" | "deactivate" | "recordManualViolation" | "undoManualViolation";
export type ContentFreeOperationSnapshot = {
  busy: boolean;
  operation: ContentFreeOperation | null;
  violationId: string | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};

type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
};

const unavailableMessage = "This action is unavailable for the current record. Review the latest Content-Free state and try again.";

// Coordinates only local operations and receipts. Product policy, timestamps,
// IDs, and streak changes remain in the existing flow/transition boundary.
export function createContentFreeController(options: Options) {
  let snapshot: ContentFreeOperationSnapshot = {
    busy: false, operation: null, violationId: null, result: null, message: null
  };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: ContentFreeOperationSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  function observe(
    promise: Promise<BloomPersistedMutationResult>,
    operation: ContentFreeOperation,
    violationId: string | null
  ): Promise<BloomPersistedMutationResult> {
    const observed = promise.then((result) => {
      inFlight = null;
      publish({ busy: false, operation, violationId, result, message: result.ok ? null : persistenceMessage(result) });
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "Bloom could not finish this request. Close and reopen Content-Free to continue." });
      throw error;
    });
    inFlight = observed;
    return observed;
  }

  function run(
    operation: ContentFreeOperation,
    expectedContent: ContentFreeState,
    command: () => Promise<BloomPersistedMutationResult>,
    violationId: unknown = null
  ): Promise<BloomPersistedMutationResult> | null {
    if (snapshot.busy) return snapshot.operation === operation && snapshot.violationId === violationId ? inFlight : null;
    if (snapshot.result !== null && !snapshot.result.ok && snapshot.result.accepted) return null;

    // React handlers carry the immutable slice they displayed. Re-read accepted
    // truth before dispatch, including changes that have not rendered yet.
    const content = options.getState().contentFree;
    const expectedStatus = operation === "activate" ? "inactive" : "active";
    if (content !== expectedContent || content.status !== expectedStatus ||
      (operation === "undoManualViolation" &&
        (typeof violationId !== "string" || violationId.trim().length === 0 ||
          getLatestManualContentFreeUndoCandidate(content)?.id !== violationId))) {
      publish({ ...snapshot, message: unavailableMessage });
      return null;
    }
    const targetId = typeof violationId === "string" ? violationId : null;
    publish({ busy: true, operation, violationId: targetId, result: null, message: null });
    try {
      return observe(command(), operation, targetId);
    } catch (error) {
      publish({ ...snapshot, busy: false, message: "Bloom could not finish this request. Close and reopen Content-Free to continue." });
      return Promise.reject(error);
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    activate: (expectedContent: ContentFreeState) => run("activate", expectedContent, options.flowActions.contentFree.activate),
    deactivate: (expectedContent: ContentFreeState) => run("deactivate", expectedContent, options.flowActions.contentFree.deactivate),
    recordManualViolation: (expectedContent: ContentFreeState) => run(
      "recordManualViolation", expectedContent, options.flowActions.contentFree.recordManualViolation
    ),
    undoManualViolation: (violationId: unknown, expectedContent: ContentFreeState) => run(
      "undoManualViolation", expectedContent,
      // run validates the exact ID before this flow command can be invoked.
      () => options.flowActions.contentFree.undoManualViolation({ violationId: violationId as string }), violationId
    ),
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, operation, violationId } = snapshot;
      if (result === null || result.ok || !result.retryable || operation === null) return null;
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), operation, violationId);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Saving has not been confirmed yet. Try saving again to check the same change.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "This request was replaced by a newer change. Close and reopen Content-Free to continue.";
  if (result.accepted) return result.retryable
    ? "Your change is held here, but it could not be saved. Try saving again before continuing."
    : "Your change was accepted, but saving could not be confirmed. Close and reopen Content-Free to continue.";
  if (result.reason === "hydrationPending" || result.reason === "stateUnavailable" || result.reason === "deletionInProgress") return "Local data is not ready for this action. Please try again when it is available.";
  // Includes invalidSession. Do not infer Reset ownership or duplicate its
  // restriction/reversibility policy from a rejected transition in the UI.
  return unavailableMessage;
}
