import { createDefaultBloomState, type BloomLocalState } from "./bloomState";
import {
  BLOOM_PERSISTENCE_VERSION,
  parsePersistedPayload,
  readPersistedEnvelope,
  validateAndNormalizeBloomState,
  type PersistedBloomEnvelopeV2
} from "./bloomStateSchema";
import type { StorageClient } from "./storageClient";

export const BLOOM_STATE_STORAGE_KEY = "bloom.localState.v2";
export const BLOOM_LEGACY_STATE_STORAGE_KEYS = ["bloom.localState.v1"] as const;
export const BLOOM_CORRUPT_BACKUP_PREFIX = "bloom.localState.corrupt.";

export type BloomStateLoadResult =
  | {
      status: "success";
      state: BloomLocalState;
      source: "current" | "legacy" | "empty";
      needsPersist: boolean;
      persistenceError: string | null;
    }
  | {
      status: "corrupt";
      error: string;
      sourceKey: string;
      backupKey: string | null;
    }
  | {
      status: "unsupported-version";
      version: number;
      sourceKey: string;
      backupKey: string | null;
    };

type Clock = () => Date;

export async function loadBloomLocalState(
  client: StorageClient,
  now: Clock = () => new Date()
): Promise<BloomStateLoadResult> {
  const currentPayload = await client.getItem(BLOOM_STATE_STORAGE_KEY);

  if (currentPayload !== null) {
    return loadStoredPayload(BLOOM_STATE_STORAGE_KEY, currentPayload, client, now);
  }

  for (const legacyKey of BLOOM_LEGACY_STATE_STORAGE_KEYS) {
    const legacyPayload = await client.getItem(legacyKey);

    if (legacyPayload !== null) {
      return loadStoredPayload(legacyKey, legacyPayload, client, now);
    }
  }

  return {
    status: "success",
    state: createDefaultBloomState(),
    source: "empty",
    needsPersist: false,
    persistenceError: null
  };
}

export async function persistBloomLocalState(
  state: BloomLocalState,
  client: StorageClient,
  now: Clock = () => new Date()
): Promise<void> {
  const envelope: PersistedBloomEnvelopeV2 = {
    version: BLOOM_PERSISTENCE_VERSION,
    savedAt: now().toISOString(),
    state
  };

  await client.setItem(BLOOM_STATE_STORAGE_KEY, JSON.stringify(envelope));
}

export function createBloomStateWriteQueue(
  client: StorageClient,
  now: Clock = () => new Date()
) {
  return createBloomStatePersistenceCoordinator(client, now).enqueueWrite;
}

export function createBloomStatePersistenceCoordinator(
  client: StorageClient,
  now: Clock = () => new Date()
) {
  let queueTail: Promise<void> = Promise.resolve();
  let writeGeneration = 0;
  let deletionPromise: Promise<void> | null = null;

  const enqueueWrite = (state: BloomLocalState): Promise<void> => {
    if (deletionPromise !== null) {
      return Promise.reject(new Error("Bloom persistence is being reset."));
    }

    const queuedGeneration = writeGeneration;
    const queuedWrite = queueTail
      .catch(() => undefined)
      .then(async () => {
        if (queuedGeneration !== writeGeneration) {
          return;
        }

        await persistBloomLocalState(state, client, now);
      });

    queueTail = queuedWrite.catch(() => undefined);
    return queuedWrite;
  };

  const deleteAll = (): Promise<void> => {
    if (deletionPromise !== null) {
      return deletionPromise;
    }

    writeGeneration += 1;
    const queuedDeletion = queueTail
      .catch(() => undefined)
      .then(() => clearAllBloomStorage(client));
    const trackedDeletion = queuedDeletion.finally(() => {
      if (deletionPromise === trackedDeletion) {
        deletionPromise = null;
      }
    });

    deletionPromise = trackedDeletion;
    queueTail = trackedDeletion.catch(() => undefined);
    return trackedDeletion;
  };

  return {
    enqueueWrite,
    deleteAll
  };
}

export async function clearAllBloomStorage(client: StorageClient): Promise<void> {
  const allKeys = await client.getAllKeys();
  const existingKeys = new Set(allKeys);
  const corruptBackupKeys = allKeys
    .filter((key) => key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX))
    .sort();
  const legacyKeys = BLOOM_LEGACY_STATE_STORAGE_KEYS.filter((key) =>
    existingKeys.has(key)
  );
  const keysToRemove = Array.from(
    new Set([
      ...corruptBackupKeys,
      ...legacyKeys,
      ...(existingKeys.has(BLOOM_STATE_STORAGE_KEY)
        ? [BLOOM_STATE_STORAGE_KEY]
        : [])
    ])
  );

  for (const key of keysToRemove) {
    await client.removeItem(key);
  }
}

async function loadStoredPayload(
  sourceKey: string,
  rawPayload: string,
  client: StorageClient,
  now: Clock
): Promise<BloomStateLoadResult> {
  const parsedPayload = parsePersistedPayload(rawPayload);

  if (!parsedPayload.success) {
    return createCorruptResult(
      sourceKey,
      rawPayload,
      parsedPayload.error,
      client,
      now
    );
  }

  const envelopeResult = readPersistedEnvelope(parsedPayload.value);

  if (envelopeResult.status === "invalid") {
    return createCorruptResult(
      sourceKey,
      rawPayload,
      envelopeResult.error,
      client,
      now
    );
  }

  if (envelopeResult.status === "unsupported-version") {
    const backupKey = await preserveCorruptPayload(
      sourceKey,
      rawPayload,
      `Unsupported Bloom state version ${envelopeResult.version}.`,
      client,
      now
    );

    return {
      status: "unsupported-version",
      version: envelopeResult.version,
      sourceKey,
      backupKey
    };
  }

  const storedState =
    envelopeResult.status === "current"
      ? envelopeResult.envelope.state
      : envelopeResult.state;
  const validationResult = validateAndNormalizeBloomState(storedState);

  if (!validationResult.success) {
    return createCorruptResult(
      sourceKey,
      rawPayload,
      validationResult.error,
      client,
      now
    );
  }

  const isLegacyPayload =
    envelopeResult.status === "legacy" || sourceKey !== BLOOM_STATE_STORAGE_KEY;

  if (isLegacyPayload) {
    try {
      await persistBloomLocalState(validationResult.state, client, now);

      if (sourceKey !== BLOOM_STATE_STORAGE_KEY) {
        try {
          await client.removeItem(sourceKey);
        } catch {
          // The current envelope is durable; a leftover legacy key is safe to retry later.
        }
      }

      return {
        status: "success",
        state: validationResult.state,
        source: "legacy",
        needsPersist: false,
        persistenceError: null
      };
    } catch {
      return {
        status: "success",
        state: validationResult.state,
        source: "legacy",
        needsPersist: true,
        persistenceError: "Migrated Bloom data could not be saved yet."
      };
    }
  }

  return {
    status: "success",
    state: validationResult.state,
    source: "current",
    needsPersist: validationResult.wasNormalized,
    persistenceError: null
  };
}

async function createCorruptResult(
  sourceKey: string,
  rawPayload: string,
  error: string,
  client: StorageClient,
  now: Clock
): Promise<BloomStateLoadResult> {
  const backupKey = await preserveCorruptPayload(
    sourceKey,
    rawPayload,
    error,
    client,
    now
  );

  return {
    status: "corrupt",
    error: "Stored Bloom data could not be loaded safely.",
    sourceKey,
    backupKey
  };
}

async function preserveCorruptPayload(
  sourceKey: string,
  rawPayload: string,
  reason: string,
  client: StorageClient,
  now: Clock
): Promise<string | null> {
  const backupKey = `${BLOOM_CORRUPT_BACKUP_PREFIX}${fingerprint(`${sourceKey}:${rawPayload}`)}`;

  try {
    const existingBackup = await client.getItem(backupKey);

    if (existingBackup === null) {
      await client.setItem(
        backupKey,
        JSON.stringify({
          sourceKey,
          detectedAt: now().toISOString(),
          reason,
          rawPayload
        })
      );
    }

    return backupKey;
  } catch {
    return null;
  }
}

function fingerprint(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
