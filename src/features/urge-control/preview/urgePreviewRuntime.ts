import { createMemoryStorageClient } from "../../../storage/storageAdapters";
import { createBloomStatePersistenceCoordinator } from "../../../storage/bloomStatePersistence";

// Stable build-wide isolation, including retained routes and process restarts.
// Never hydrate, migrate or copy canonical data / previously used QA namespaces.
const memory = createBloomStatePersistenceCoordinator(createMemoryStorageClient());
export const urgePreviewRuntime = {
  now: () => new Date(), load: memory.load,
  save: async () => ({ status: "invalidated" as const, writeId: 0, generation: 0 }),
  deleteAll: memory.deleteAll
};
