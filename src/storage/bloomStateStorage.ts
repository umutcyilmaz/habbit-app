import type { BloomLocalState } from "./bloomState";
import {
  createBloomStatePersistenceCoordinator,
  loadBloomLocalState as loadBloomLocalStateWithClient
} from "./bloomStatePersistence";
import { storageClient } from "./storageClient";

export type { BloomStateLoadResult } from "./bloomStatePersistence";

const persistenceCoordinator = createBloomStatePersistenceCoordinator(storageClient);

export function loadBloomLocalState() {
  return loadBloomLocalStateWithClient(storageClient);
}

export function saveBloomLocalState(state: BloomLocalState): Promise<void> {
  return persistenceCoordinator.enqueueWrite(state);
}

export function deleteAllPersistedBloomData(): Promise<void> {
  return persistenceCoordinator.deleteAll();
}
