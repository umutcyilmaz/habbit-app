import { createMemoryStorageClient } from "../../storage/storageAdapters";
import { createBloomStatePersistenceCoordinator } from "../../storage/bloomStatePersistence";

// Root navigator retains underlying routes. Keep their existing contexts, but
// use ONLY fresh process-local memory throughout this explicitly opted-in build.
// Never switch runtime on navigation, read/copy disk data, or touch canonical keys.
const memory = createBloomStatePersistenceCoordinator(createMemoryStorageClient());
export const kegelPreviewRuntime = {
  now: () => new Date(), load: memory.load, save: memory.enqueueWrite, deleteAll: memory.deleteAll
};
