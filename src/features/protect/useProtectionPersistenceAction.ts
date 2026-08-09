import { useCallback, useEffect, useRef, useState } from "react";

import {
  useBloomLocalState,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../../app/providers/BloomLocalStateProvider";

type ProtectionPersistenceCallbacks = {
  onSuccess?: () => void;
  onFailure?: () => void;
};

type PendingProtectionRetry = {
  actionId: string;
  retryToken: BloomPersistenceRetryToken;
  callbacks: ProtectionPersistenceCallbacks;
};

const acceptedFailureMessage =
  "Protection updated in this session, but Bloom couldn’t save the change to local storage. Try again.";
const rejectedFailureMessage =
  "Protection could not be updated or saved yet. Try again.";
const invalidatedFailureMessage =
  "Protection changed in this session, but Bloom couldn’t confirm a local save.";
const unknownPersistenceMessage =
  "Bloom is still confirming this Protection change in local storage. You can leave safely or try again; it is not shown as saved yet.";
const supersededFailureMessage =
  "A newer Protection change replaced this save request. Bloom did not mark the earlier change as saved.";

export function useProtectionPersistenceAction() {
  const { retryPersistedMutation } = useBloomLocalState();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] =
    useState<PendingProtectionRetry | null>(null);
  const [message, setMessage] = useState<string | undefined>();
  const inFlightRef = useRef(false);
  const pendingRetryRef = useRef<PendingProtectionRetry | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleResult = useCallback(
    (
      result: BloomPersistedMutationResult,
      actionId: string,
      callbacks: ProtectionPersistenceCallbacks
    ) => {
      if (!mountedRef.current) {
        return;
      }

      if (result.ok) {
        pendingRetryRef.current = null;
        setPendingRetry(null);
        setMessage(undefined);
        callbacks.onSuccess?.();
        return;
      }

      if (result.accepted && result.retryable) {
        const nextPendingRetry = {
          actionId,
          retryToken: result.retryToken,
          callbacks
        } satisfies PendingProtectionRetry;
        pendingRetryRef.current = nextPendingRetry;
        setPendingRetry(nextPendingRetry);
        setMessage(
          result.reason === "persistenceUnknown"
            ? unknownPersistenceMessage
            : acceptedFailureMessage
        );
        return;
      }

      pendingRetryRef.current = null;
      setPendingRetry(null);
      setMessage(
        result.reason === "persistenceSuperseded"
          ? supersededFailureMessage
          : result.accepted
          ? invalidatedFailureMessage
          : rejectedFailureMessage
      );
      callbacks.onFailure?.();
    },
    []
  );

  const runAction = useCallback(
    async (
      actionId: string,
      mutation: () => Promise<BloomPersistedMutationResult>,
      callbacks: ProtectionPersistenceCallbacks = {}
    ) => {
      if (inFlightRef.current || pendingRetryRef.current !== null) {
        return;
      }

      inFlightRef.current = true;
      setActiveAction(actionId);
      setMessage(undefined);

      try {
        const result = await mutation();
        handleResult(result, actionId, callbacks);
      } catch {
        if (mountedRef.current) {
          setMessage(rejectedFailureMessage);
          callbacks.onFailure?.();
        }
      } finally {
        inFlightRef.current = false;

        if (mountedRef.current) {
          setActiveAction(null);
        }
      }
    },
    [handleResult]
  );

  const retry = useCallback(async () => {
    const pending = pendingRetryRef.current;

    if (pending === null || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setActiveAction(pending.actionId);

    try {
      const result = await retryPersistedMutation(pending.retryToken);
      handleResult(result, pending.actionId, pending.callbacks);
    } catch {
      if (mountedRef.current) {
        setMessage(
          "Bloom still couldn’t save this Protection change to local storage. Try again."
        );
      }
    } finally {
      inFlightRef.current = false;

      if (mountedRef.current) {
        setActiveAction(null);
      }
    }
  }, [handleResult, retryPersistedMutation]);

  return {
    activeAction,
    isLocked: activeAction !== null || pendingRetry !== null,
    isNavigationLocked: activeAction !== null,
    message,
    pendingRetryAction: pendingRetry?.actionId ?? null,
    retry,
    runAction
  };
}
