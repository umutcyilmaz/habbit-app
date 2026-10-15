import { createMemoryStorageClient } from "../../storage/storageAdapters";
import { createBloomStatePersistenceCoordinator } from "../../storage/bloomStatePersistence";

// Visual-preview builds must never hydrate/migrate canonical or prior QA data.
// Root isolation is stable across navigation and genuine process restarts.
const memory=createBloomStatePersistenceCoordinator(createMemoryStorageClient());
export const practicePreviewRuntime={now:()=>new Date(),load:memory.load,
  // A retained route cannot claim a device save from volatile preview memory.
  save:async()=>({status:"invalidated" as const,writeId:0,generation:0}),deleteAll:memory.deleteAll};
