import type { BloomLocalState } from "./bloomState";
import {
  createBloomStateWriteQueue,
  loadBloomLocalState as loadBloomLocalStateWithClient
} from "./bloomStatePersistence";
import { storageClient } from "./storageClient";

export type { BloomStateLoadResult } from "./bloomStatePersistence";

const enqueueBloomStateWrite = createBloomStateWriteQueue(storageClient);

export function loadBloomLocalState() {
  return loadBloomLocalStateWithClient(storageClient);
}

export function saveBloomLocalState(state: BloomLocalState): Promise<void> {
  return enqueueBloomStateWrite(state);
}
