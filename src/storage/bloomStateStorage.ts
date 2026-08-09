import type { BloomLocalState } from "./bloomState";
import {
  createBloomStatePersistenceCoordinator,
  type BloomStateWriteReceipt
} from "./bloomStatePersistence";
import { storageClient } from "./storageClient";

export type { BloomStateLoadResult } from "./bloomStatePersistence";

const persistenceCoordinator = createBloomStatePersistenceCoordinator(storageClient);

export function loadBloomLocalState() {
  return persistenceCoordinator.load();
}

export function saveBloomLocalState(
  state: BloomLocalState
): Promise<BloomStateWriteReceipt> {
  return persistenceCoordinator.enqueueWrite(state);
}

export function deleteAllPersistedBloomData(): Promise<void> {
  return persistenceCoordinator.deleteAll();
}
