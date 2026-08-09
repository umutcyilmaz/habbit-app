import {
  isStorageUnavailableError
} from "../../storage/storageAdapters";
import type {
  BloomLocalState,
  BloomMutationFailureReason,
  BloomMutationResult
} from "../../storage/bloomState";
import type {
  BloomStateWriteReceipt
} from "../../storage/bloomStatePersistence";

export type BloomMutationRuntimeHydrationStatus =
  | "loading"
  | "ready"
  | "error";

export type BloomAcknowledgedMutationFailureReason =
  | BloomMutationFailureReason
  | "hydrationPending"
  | "deletionInProgress"
  | "storageUnavailable"
  | "persistenceFailed"
  | "persistenceInvalidated"
  | "persistenceSuperseded"
  | "persistenceUnknown";

declare const bloomPersistenceRetryTokenBrand: unique symbol;

export type BloomPersistenceRetryToken = number & {
  readonly [bloomPersistenceRetryTokenBrand]: true;
};

export type BloomPersistedMutationResult =
  | {
      ok: true;
      accepted: true;
      persisted: true;
      sequence: number;
    }
  | {
      ok: false;
      accepted: boolean;
      persisted: false;
      sequence: number;
      reason: BloomAcknowledgedMutationFailureReason;
      retryable: false;
    }
  | {
      ok: false;
      accepted: true;
      persisted: false;
      sequence: number;
      reason:
        | "hydrationPending"
        | "deletionInProgress"
        | "stateUnavailable"
        | "storageUnavailable"
        | "persistenceFailed"
        | "persistenceUnknown";
      retryable: true;
      retryToken: BloomPersistenceRetryToken;
    };

export const BLOOM_PERSISTENCE_RETRY_MESSAGE =
  "Bloom updated this session, but couldn’t save the change to local storage. Try again.";

export const BLOOM_PERSISTENCE_PENDING_MESSAGE =
  "Bloom is still confirming this local save. You can leave safely or try again.";

export const BLOOM_PERSISTENCE_ACKNOWLEDGEMENT_TIMEOUT_MS = 10_000;

type BloomStateMutation = (state: BloomLocalState) => BloomLocalState;

type BloomLocalStateMutationRuntimeOptions = {
  initialState: BloomLocalState;
  initialHydrationStatus?: BloomMutationRuntimeHydrationStatus;
  persistState: (state: BloomLocalState) => Promise<BloomStateWriteReceipt>;
  onStateChange?: (state: BloomLocalState) => void;
  onDurableStateChange?: (state: BloomLocalState) => void;
  onPersistenceErrorChange?: (message: string | null) => void;
  acknowledgementTimeoutMs?: number;
};

type CompleteHydrationOptions = {
  needsPersist: boolean;
  persistenceError: string | null;
};

export type BloomHydrationOperation = Readonly<{
  stateRevision: number;
  persistenceGeneration: number;
}>;

type PersistenceOutcome =
  | { status: "persisted" }
  | { status: "invalidated" }
  | {
      status: "failed";
      reason: "storageUnavailable" | "persistenceFailed";
    };

type AcknowledgementWaitOutcome =
  | PersistenceOutcome
  | { status: "unknown" };

type RetryEntry = {
  generation: number;
  requiredRevision: number;
  retryPromise?: Promise<BloomPersistedMutationResult>;
};

type PendingPersistenceAttempt = {
  generation: number;
  revision: number;
  source: "commit" | "retry";
  promise: Promise<PersistenceOutcome>;
};

export function createBloomLocalStateMutationRuntime(
  options: BloomLocalStateMutationRuntimeOptions
) {
  let state = options.initialState;
  let durableState = options.initialState;
  let hydrationStatus = options.initialHydrationStatus ?? "loading";
  let hasHydratedCanonicalState = hydrationStatus === "ready";
  let pendingMutations: BloomStateMutation[] = [];
  let writesBlocked = false;
  let awaitingResetNavigation = false;
  let stateRevision = hydrationStatus === "ready" ? 1 : 0;
  let nextAcknowledgementSequence = 0;
  let nextPersistenceAttempt = 0;
  let persistenceGeneration = 0;
  let latestSettledPersistenceAttempt = 0;
  let latestPersistedRevision =
    hydrationStatus === "ready" ? stateRevision : 0;
  let durableStateRevision = latestPersistedRevision;
  let supersededAcknowledgementThrough = 0;
  let deletionInvalidatedAcknowledgementThrough = 0;
  let persistedRetryAcknowledgementSequence: number | null = null;
  let deletionRecoveryRequired = false;
  const retryEntries = new Map<number, RetryEntry>();
  const pendingPersistenceAttempts = new Set<PendingPersistenceAttempt>();
  const acknowledgementTimeoutMs =
    options.acknowledgementTimeoutMs ??
    BLOOM_PERSISTENCE_ACKNOWLEDGEMENT_TIMEOUT_MS;

  const notifyStateChange = () => {
    options.onStateChange?.(state);
  };

  const notifyDurableStateChange = () => {
    options.onDurableStateChange?.(durableState);
  };

  const notifyPersistenceError = (message: string | null) => {
    options.onPersistenceErrorChange?.(message);
  };

  const setPersistenceOutcome = (
    attempt: number,
    generation: number,
    revision: number,
    message: string | null
  ) => {
    if (
      generation !== persistenceGeneration ||
      revision !== stateRevision ||
      attempt < latestSettledPersistenceAttempt
    ) {
      return;
    }

    latestSettledPersistenceAttempt = attempt;
    notifyPersistenceError(message);
  };

  const setDurableState = (
    snapshot: BloomLocalState,
    revision: number
  ) => {
    if (revision < durableStateRevision) {
      return;
    }

    durableState = snapshot;
    durableStateRevision = revision;
    notifyDurableStateChange();
  };

  const runPersistenceAttempt = async (
    snapshot: BloomLocalState,
    revision: number,
    generation: number
  ): Promise<PersistenceOutcome> => {
    const attempt = nextPersistenceAttempt + 1;
    nextPersistenceAttempt = attempt;

    try {
      const receipt = await options.persistState(snapshot);

      if (
        generation !== persistenceGeneration ||
        receipt.status === "invalidated"
      ) {
        return { status: "invalidated" };
      }

      latestPersistedRevision = Math.max(
        latestPersistedRevision,
        revision
      );
      setDurableState(snapshot, revision);
      setPersistenceOutcome(attempt, generation, revision, null);
      return { status: "persisted" };
    } catch (error) {
      if (generation !== persistenceGeneration) {
        return { status: "invalidated" };
      }

      const reason = isStorageUnavailableError(error)
        ? "storageUnavailable"
        : "persistenceFailed";
      setPersistenceOutcome(
        attempt,
        generation,
        revision,
        BLOOM_PERSISTENCE_RETRY_MESSAGE
      );

      return { status: "failed", reason };
    }
  };

  const persistSnapshot = (
    snapshot: BloomLocalState,
    revision: number,
    generation: number,
    source: PendingPersistenceAttempt["source"] = "commit"
  ): Promise<PersistenceOutcome> => {
    const promise = runPersistenceAttempt(snapshot, revision, generation);
    const pendingAttempt = {
      generation,
      revision,
      source,
      promise
    } satisfies PendingPersistenceAttempt;
    pendingPersistenceAttempts.add(pendingAttempt);
    void promise.then(
      () => pendingPersistenceAttempts.delete(pendingAttempt),
      () => pendingPersistenceAttempts.delete(pendingAttempt)
    );

    return promise;
  };

  const waitForAcknowledgement = (
    promise: Promise<PersistenceOutcome>,
    attemptGeneration: number,
    requiredRevision: number
  ): Promise<AcknowledgementWaitOutcome> =>
    new Promise((resolve) => {
      let didSettle = false;
      const timeout = setTimeout(() => {
        if (didSettle) {
          return;
        }

        didSettle = true;
        if (
          attemptGeneration === persistenceGeneration &&
          stateRevision === requiredRevision &&
          latestPersistedRevision < requiredRevision
        ) {
          notifyPersistenceError(BLOOM_PERSISTENCE_PENDING_MESSAGE);
        }
        resolve({ status: "unknown" });
      }, Math.max(0, acknowledgementTimeoutMs));

      void promise.then((outcome) => {
        if (didSettle) {
          return;
        }

        didSettle = true;
        clearTimeout(timeout);
        resolve(outcome);
      });
    });

  const scheduleUnacknowledgedPersistence = (
    snapshot: BloomLocalState,
    revision: number
  ) => {
    const generation = persistenceGeneration;
    void persistSnapshot(snapshot, revision, generation);
  };

  const markOutstandingRetriesSuperseded = () => {
    for (const sequence of retryEntries.keys()) {
      supersededAcknowledgementThrough = Math.max(
        supersededAcknowledgementThrough,
        sequence
      );
    }
    retryEntries.clear();

    if (persistedRetryAcknowledgementSequence !== null) {
      supersededAcknowledgementThrough = Math.max(
        supersededAcknowledgementThrough,
        persistedRetryAcknowledgementSequence
      );
      persistedRetryAcknowledgementSequence = null;
    }
  };

  const commitState = (
    nextState: BloomLocalState,
    supersedeOutstandingRetries = true
  ) => {
    if (supersedeOutstandingRetries) {
      markOutstandingRetriesSuperseded();
    }

    state = nextState;
    stateRevision += 1;
    notifyStateChange();

    return stateRevision;
  };

  const getAcknowledgedMutationBlockReason = ():
    | "hydrationPending"
    | "stateUnavailable"
    | "deletionInProgress"
    | null => {
    if (writesBlocked) {
      return "deletionInProgress";
    }

    if (hydrationStatus === "loading") {
      return "hydrationPending";
    }

    return hydrationStatus === "ready" ? null : "stateUnavailable";
  };

  const createRejectedAcknowledgement = (
    sequence: number,
    reason: BloomAcknowledgedMutationFailureReason,
    accepted = false
  ): BloomPersistedMutationResult => ({
    ok: false,
    accepted,
    persisted: false,
    sequence,
    reason,
    retryable: false
  });

  const createRetryableAcknowledgement = (
    sequence: number,
    reason:
      | "hydrationPending"
      | "deletionInProgress"
      | "stateUnavailable"
      | "storageUnavailable"
      | "persistenceFailed"
      | "persistenceUnknown"
  ): BloomPersistedMutationResult => ({
    ok: false,
    accepted: true,
    persisted: false,
    sequence,
    reason,
    retryable: true,
    retryToken: sequence as BloomPersistenceRetryToken
  });

  const createPersistedAcknowledgement = (
    sequence: number
  ): BloomPersistedMutationResult => ({
    ok: true,
    accepted: true,
    persisted: true,
    sequence
  });

  const registerLatePersistenceCleanup = (
    persistenceAttempt: Promise<PersistenceOutcome>,
    sequence: number,
    revision: number,
    generation: number
  ) => {
    void persistenceAttempt.then((outcome) => {
      if (outcome.status !== "persisted") {
        return;
      }

      const cleanup = () => {
        const entry = retryEntries.get(sequence);

        if (
          entry !== undefined &&
          entry.retryPromise === undefined &&
          entry.generation === generation &&
          entry.requiredRevision === revision &&
          persistenceGeneration === generation &&
          stateRevision === revision
        ) {
          retryEntries.delete(sequence);
          persistedRetryAcknowledgementSequence = sequence;
        }
      };

      void Promise.resolve().then(() => {
        const retryPromise = retryEntries.get(sequence)?.retryPromise;

        if (retryPromise === undefined) {
          cleanup();
          return;
        }

        void retryPromise.then(cleanup);
      });
    });
  };

  const mapPersistenceOutcome = (
    outcome: AcknowledgementWaitOutcome,
    sequence: number,
    revision: number,
    generation: number
  ): BloomPersistedMutationResult => {
    if (
      revision !== stateRevision ||
      supersededAcknowledgementThrough >= sequence
    ) {
      retryEntries.delete(sequence);
      supersededAcknowledgementThrough = Math.max(
        supersededAcknowledgementThrough,
        sequence
      );
      return createRejectedAcknowledgement(
        sequence,
        "persistenceSuperseded",
        true
      );
    }

    if (
      outcome.status === "invalidated" ||
      generation !== persistenceGeneration ||
      deletionInvalidatedAcknowledgementThrough >= sequence
    ) {
      if (
        writesBlocked &&
        deletionInvalidatedAcknowledgementThrough < sequence
      ) {
        retryEntries.set(sequence, {
          generation: persistenceGeneration,
          requiredRevision: stateRevision
        });
        return createRetryableAcknowledgement(
          sequence,
          "deletionInProgress"
        );
      }

      retryEntries.delete(sequence);
      return createRejectedAcknowledgement(
        sequence,
        "persistenceInvalidated",
        true
      );
    }

    if (outcome.status === "persisted") {
      retryEntries.delete(sequence);
      return createPersistedAcknowledgement(sequence);
    }

    retryEntries.set(sequence, {
      generation,
      requiredRevision: revision
    });

    return createRetryableAcknowledgement(
      sequence,
      outcome.status === "unknown"
        ? "persistenceUnknown"
        : outcome.reason
    );
  };

  const applyMutation = (
    mutation: BloomStateMutation
  ): BloomMutationResult => {
    if (writesBlocked) {
      return { ok: false, reason: "stateUnavailable" };
    }

    if (hydrationStatus === "loading") {
      pendingMutations.push(mutation);
      return { ok: true };
    }

    if (hydrationStatus !== "ready") {
      return { ok: false, reason: "stateUnavailable" };
    }

    const nextState = mutation(state);

    if (nextState === state) {
      return { ok: false, reason: "invalidSession" };
    }

    const revision = commitState(nextState);
    scheduleUnacknowledgedPersistence(nextState, revision);
    return { ok: true };
  };

  const applyAcknowledgedMutation = (
    mutation: BloomStateMutation
  ): Promise<BloomPersistedMutationResult> => {
    const sequence = nextAcknowledgementSequence + 1;
    nextAcknowledgementSequence = sequence;
    const blockReason = getAcknowledgedMutationBlockReason();

    if (blockReason !== null) {
      return Promise.resolve(
        createRejectedAcknowledgement(sequence, blockReason)
      );
    }

    const nextState = mutation(state);

    if (nextState === state) {
      return Promise.resolve(
        createRejectedAcknowledgement(sequence, "invalidSession")
      );
    }

    const revision = commitState(nextState);
    const generation = persistenceGeneration;

    const persistenceAttempt = persistSnapshot(
      nextState,
      revision,
      generation
    );
    registerLatePersistenceCleanup(
      persistenceAttempt,
      sequence,
      revision,
      generation
    );

    return waitForAcknowledgement(
      persistenceAttempt,
      generation,
      revision
    ).then(
      (outcome) =>
        mapPersistenceOutcome(
          outcome,
          sequence,
          revision,
          generation
        )
    );
  };

  const rejectAcknowledgedMutation = (
    reason: BloomMutationFailureReason
  ): Promise<BloomPersistedMutationResult> => {
    const sequence = nextAcknowledgementSequence + 1;
    nextAcknowledgementSequence = sequence;
    const blockReason = getAcknowledgedMutationBlockReason();

    return Promise.resolve(
      createRejectedAcknowledgement(
        sequence,
        blockReason ?? reason
      )
    );
  };

  const getRetryInterruptionResult = (
    sequence: number,
    entry: RetryEntry
  ): BloomPersistedMutationResult | null => {
    if (retryEntries.get(sequence) !== entry) {
      return createRejectedAcknowledgement(
        sequence,
        supersededAcknowledgementThrough >= sequence
          ? "persistenceSuperseded"
          : "persistenceInvalidated",
        true
      );
    }

    if (writesBlocked) {
      return createRetryableAcknowledgement(
        sequence,
        "deletionInProgress"
      );
    }

    if (entry.generation !== persistenceGeneration) {
      retryEntries.delete(sequence);
      return createRejectedAcknowledgement(
        sequence,
        "persistenceInvalidated",
        true
      );
    }

    if (entry.requiredRevision !== stateRevision) {
      retryEntries.delete(sequence);
      supersededAcknowledgementThrough = Math.max(
        supersededAcknowledgementThrough,
        sequence
      );
      return createRejectedAcknowledgement(
        sequence,
        "persistenceSuperseded",
        true
      );
    }

    if (hydrationStatus !== "ready") {
      return createRetryableAcknowledgement(
        sequence,
        hydrationStatus === "loading"
          ? "hydrationPending"
          : "stateUnavailable"
      );
    }

    return null;
  };

  const retryPersistence = (
    token: BloomPersistenceRetryToken
  ): Promise<BloomPersistedMutationResult> => {
    const sequence = Number(token);
    const entry = retryEntries.get(sequence);

    if (entry === undefined) {
      if (deletionInvalidatedAcknowledgementThrough >= sequence) {
        return Promise.resolve(
          createRejectedAcknowledgement(
            sequence,
            "persistenceInvalidated",
            true
          )
        );
      }

      if (writesBlocked) {
        return Promise.resolve(
          createRejectedAcknowledgement(
            sequence,
            "deletionInProgress",
            true
          )
        );
      }

      if (
        supersededAcknowledgementThrough < sequence &&
        persistedRetryAcknowledgementSequence === sequence
      ) {
        return Promise.resolve(createPersistedAcknowledgement(sequence));
      }

      const reason =
        supersededAcknowledgementThrough >= sequence
          ? "persistenceSuperseded"
          : "persistenceInvalidated";
      return Promise.resolve(
        createRejectedAcknowledgement(sequence, reason, true)
      );
    }

    const initialInterruption = getRetryInterruptionResult(
      sequence,
      entry
    );

    if (initialInterruption !== null) {
      return Promise.resolve(initialInterruption);
    }

    if (entry.requiredRevision === latestPersistedRevision) {
      retryEntries.delete(sequence);
      persistedRetryAcknowledgementSequence = sequence;
      return Promise.resolve(createPersistedAcknowledgement(sequence));
    }

    if (entry.retryPromise !== undefined) {
      return entry.retryPromise;
    }

    const retryWork = async (): Promise<BloomPersistedMutationResult> => {
      const observedAttempts = new Set<PendingPersistenceAttempt>();

      while (true) {
        const interruption = getRetryInterruptionResult(
          sequence,
          entry
        );

        if (interruption !== null) {
          return interruption;
        }

        if (entry.requiredRevision === latestPersistedRevision) {
          retryEntries.delete(sequence);
          persistedRetryAcknowledgementSequence = sequence;
          return createPersistedAcknowledgement(sequence);
        }

        const coveringAttempt = Array.from(pendingPersistenceAttempts).find(
          (attempt) =>
            !observedAttempts.has(attempt) &&
            attempt.generation === entry.generation &&
            attempt.revision === entry.requiredRevision
        );

        if (coveringAttempt !== undefined) {
          observedAttempts.add(coveringAttempt);
          const coveringOutcome = await waitForAcknowledgement(
            coveringAttempt.promise,
            entry.generation,
            entry.requiredRevision
          );
          const postWaitInterruption = getRetryInterruptionResult(
            sequence,
            entry
          );

          if (postWaitInterruption !== null) {
            return postWaitInterruption;
          }

          if (coveringOutcome.status === "unknown") {
            return createRetryableAcknowledgement(
              sequence,
              "persistenceUnknown"
            );
          }

          if (coveringOutcome.status === "invalidated") {
            const retainedAcrossDeletion =
              coveringAttempt.generation !== persistenceGeneration &&
              retryEntries.get(sequence) === entry &&
              deletionInvalidatedAcknowledgementThrough < sequence;

            if (retainedAcrossDeletion) {
              if (writesBlocked) {
                return createRetryableAcknowledgement(
                  sequence,
                  "deletionInProgress"
                );
              }

              continue;
            }

            retryEntries.delete(sequence);
            return createRejectedAcknowledgement(
              sequence,
              "persistenceInvalidated",
              true
            );
          }

          if (
            coveringOutcome.status === "failed" &&
            coveringAttempt.source === "retry"
          ) {
            return createRetryableAcknowledgement(
              sequence,
              coveringOutcome.reason
            );
          }

          continue;
        }

        const snapshot = state;
        const revision = stateRevision;
        const generation = persistenceGeneration;
        const persistenceAttempt = persistSnapshot(
          snapshot,
          revision,
          generation,
          "retry"
        );
        registerLatePersistenceCleanup(
          persistenceAttempt,
          sequence,
          revision,
          generation
        );
        const outcome = await waitForAcknowledgement(
          persistenceAttempt,
          generation,
          revision
        );
        const postWaitInterruption = getRetryInterruptionResult(
          sequence,
          entry
        );

        if (postWaitInterruption !== null) {
          return postWaitInterruption;
        }

        if (outcome.status === "unknown") {
          return createRetryableAcknowledgement(
            sequence,
            "persistenceUnknown"
          );
        }

        if (outcome.status === "invalidated") {
          const retainedAcrossDeletion =
            generation !== persistenceGeneration &&
            retryEntries.get(sequence) === entry &&
            deletionInvalidatedAcknowledgementThrough < sequence;

          if (retainedAcrossDeletion) {
            if (writesBlocked) {
              return createRetryableAcknowledgement(
                sequence,
                "deletionInProgress"
              );
            }

            continue;
          }

          retryEntries.delete(sequence);
          return createRejectedAcknowledgement(
            sequence,
            "persistenceInvalidated",
            true
          );
        }

        if (outcome.status === "failed") {
          return createRetryableAcknowledgement(sequence, outcome.reason);
        }
      }
    };

    let retryPromise: Promise<BloomPersistedMutationResult>;
    retryPromise = retryWork().finally(() => {
      if (entry.retryPromise === retryPromise) {
        delete entry.retryPromise;
      }
    });

    entry.retryPromise = retryPromise;
    return retryPromise;
  };

  const isCurrentHydrationOperation = (
    operation: BloomHydrationOperation
  ) =>
    operation.stateRevision === stateRevision &&
    operation.persistenceGeneration === persistenceGeneration;

  const beginHydration = (): BloomHydrationOperation => {
    hydrationStatus = "loading";
    return {
      stateRevision,
      persistenceGeneration
    };
  };

  const completeHydration = (
    operation: BloomHydrationOperation,
    loadedState: BloomLocalState,
    hydrationOptions: CompleteHydrationOptions
  ): boolean => {
    if (!isCurrentHydrationOperation(operation)) {
      return false;
    }

    const queuedMutations = pendingMutations;
    pendingMutations = [];
    const nextState = queuedMutations.reduce(
      (currentState, mutation) => mutation(currentState),
      loadedState
    );

    hydrationStatus = "ready";
    hasHydratedCanonicalState = true;
    const revision = commitState(nextState, false);
    setDurableState(
      loadedState,
      nextState === loadedState ? revision : Math.max(0, revision - 1)
    );
    notifyPersistenceError(hydrationOptions.persistenceError);

    if (
      hydrationOptions.needsPersist ||
      nextState !== loadedState
    ) {
      scheduleUnacknowledgedPersistence(nextState, revision);
    } else {
      latestPersistedRevision = revision;
      setDurableState(nextState, revision);
    }

    return true;
  };

  const failHydration = (
    operation: BloomHydrationOperation
  ): boolean => {
    if (!isCurrentHydrationOperation(operation)) {
      return false;
    }

    pendingMutations = [];
    hydrationStatus = "error";
    notifyPersistenceError(null);
    return true;
  };

  const beginDeletion = () => {
    const wasHydrationLoading = hydrationStatus === "loading";
    writesBlocked = true;
    awaitingResetNavigation = false;
    pendingMutations = [];
    deletionRecoveryRequired = hasHydratedCanonicalState;
    persistenceGeneration += 1;
    latestPersistedRevision = -1;

    if (wasHydrationLoading) {
      hydrationStatus = "error";
      notifyPersistenceError(null);
    }

    if (persistedRetryAcknowledgementSequence !== null) {
      retryEntries.set(persistedRetryAcknowledgementSequence, {
        generation: persistenceGeneration,
        requiredRevision: stateRevision
      });
      persistedRetryAcknowledgementSequence = null;
    }
  };

  const completeDeletion = (freshState: BloomLocalState) => {
    hydrationStatus = "ready";
    hasHydratedCanonicalState = true;
    deletionInvalidatedAcknowledgementThrough = Math.max(
      deletionInvalidatedAcknowledgementThrough,
      nextAcknowledgementSequence
    );
    retryEntries.clear();
    persistedRetryAcknowledgementSequence = null;
    deletionRecoveryRequired = false;
    const revision = commitState(freshState, false);
    latestPersistedRevision = revision;
    setDurableState(freshState, revision);
    notifyPersistenceError(null);
    awaitingResetNavigation = true;
  };

  const failDeletion = () => {
    awaitingResetNavigation = false;
    writesBlocked = false;
    notifyPersistenceError("Bloom local data could not be deleted.");

    for (const entry of retryEntries.values()) {
      entry.generation = persistenceGeneration;
      entry.requiredRevision = stateRevision;
      delete entry.retryPromise;
    }

    if (deletionRecoveryRequired) {
      deletionRecoveryRequired = false;
      scheduleUnacknowledgedPersistence(state, stateRevision);
    }
  };

  const finishResetNavigation = () => {
    if (!awaitingResetNavigation) {
      return;
    }

    awaitingResetNavigation = false;
    writesBlocked = false;
  };

  return {
    applyMutation,
    applyAcknowledgedMutation,
    rejectAcknowledgedMutation,
    retryPersistence,
    beginHydration,
    completeHydration,
    failHydration,
    beginDeletion,
    completeDeletion,
    failDeletion,
    finishResetNavigation,
    getState: () => state,
    getDurableState: () => durableState,
    getStateRevision: () => stateRevision,
    getDurableStateRevision: () => durableStateRevision,
    getHydrationStatus: () => hydrationStatus,
    getPendingMutationCount: () => pendingMutations.length,
    getRetryEntryCount: () => retryEntries.size,
    isWritesBlocked: () => writesBlocked,
    isAwaitingResetNavigation: () => awaitingResetNavigation
  };
}
