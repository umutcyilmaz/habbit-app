export const BLOOM_LOCAL_STATE_HYDRATION_TIMEOUT_MS = 10_000;

export class BloomLocalStateHydrationPendingError extends Error {
  constructor() {
    super("Bloom local data hydration is still pending.");
    this.name = "BloomLocalStateHydrationPendingError";
  }
}

export function isBloomLocalStateHydrationPendingError(
  error: unknown
): error is BloomLocalStateHydrationPendingError {
  return (
    error instanceof BloomLocalStateHydrationPendingError ||
    (error instanceof Error &&
      error.name === "BloomLocalStateHydrationPendingError")
  );
}

type BloomLocalStateHydrationTimeoutRecoveryContext = {
  isMounted: boolean;
  isCurrentOperation: boolean;
};

export type BloomLocalStateHydrationTimeoutRecovery = {
  hydrationStatus: "error";
  hydrationError: {
    code: "storage-unavailable";
    message: string;
  };
};

export function getBloomLocalStateHydrationTimeoutRecovery(
  error: unknown,
  context: BloomLocalStateHydrationTimeoutRecoveryContext
): BloomLocalStateHydrationTimeoutRecovery | null {
  if (
    !isBloomLocalStateHydrationPendingError(error) ||
    !context.isMounted ||
    !context.isCurrentOperation
  ) {
    return null;
  }

  return {
    hydrationStatus: "error",
    hydrationError: {
      code: "storage-unavailable",
      message:
        "Bloom is still waiting for local storage. You can retry without starting another load."
    }
  };
}

export function waitForBloomLocalStateHydration(
  operation: Promise<void>,
  timeoutMs = BLOOM_LOCAL_STATE_HYDRATION_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    let didSettle = false;
    const timeout = setTimeout(() => {
      if (didSettle) {
        return;
      }

      didSettle = true;
      reject(new BloomLocalStateHydrationPendingError());
    }, Math.max(0, timeoutMs));

    void operation.then(
      () => {
        if (didSettle) {
          return;
        }

        didSettle = true;
        clearTimeout(timeout);
        resolve();
      },
      (error: unknown) => {
        if (didSettle) {
          return;
        }

        didSettle = true;
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
