export const BLOOM_LOCAL_DATA_DELETION_TIMEOUT_MS = 10_000;

export class BloomLocalDataDeletionPendingError extends Error {
  constructor() {
    super("Bloom local data deletion is still being confirmed.");
    this.name = "BloomLocalDataDeletionPendingError";
  }
}

export function isBloomLocalDataDeletionPendingError(
  error: unknown
): error is BloomLocalDataDeletionPendingError {
  return (
    error instanceof BloomLocalDataDeletionPendingError ||
    (error instanceof Error &&
      error.name === "BloomLocalDataDeletionPendingError")
  );
}

export function waitForBloomLocalDataDeletion(
  operation: Promise<void>,
  timeoutMs = BLOOM_LOCAL_DATA_DELETION_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    let didSettle = false;
    const timeout = setTimeout(() => {
      if (didSettle) {
        return;
      }

      didSettle = true;
      reject(new BloomLocalDataDeletionPendingError());
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

export function observeBloomLocalDataDeletionSettlement(
  operation: Promise<void>,
  onSuccess: () => void,
  onFailure: () => void
): void {
  void operation.then(onSuccess, onFailure);
}
