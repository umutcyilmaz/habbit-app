import Constants from "expo-constants";
import { isE2EMode } from "../../shared/runtime/e2eMode";
import { storageClient } from "../../storage/storageClient";
import type { StorageClient } from "../../storage/storageAdapters";
import { createBloomStatePersistenceCoordinator } from "../../storage/bloomStatePersistence";
import { resolveKegelPreviewEnabled } from "./kegelPreviewMode";

export function resolveKegelPersistenceQaEnabled(dev:boolean,e2e:boolean,bundle:string|undefined,flag:string|undefined,run:string|undefined) {
  return resolveKegelPreviewEnabled(dev,e2e,bundle,flag) && typeof run==="string" && /^[a-zA-Z0-9_-]{8,80}$/.test(run);
}
const run=process.env.EXPO_PUBLIC_KEGEL_QA_RUN;
export const kegelPersistenceQaEnabled=resolveKegelPersistenceQaEnabled(typeof __DEV__!=="undefined" && __DEV__,isE2EMode,
  Constants.expoConfig?.ios?.bundleIdentifier,process.env.EXPO_PUBLIC_KEGEL_PERSISTENCE_QA,run);
export const kegelQaPrefix=`bloom.e2e.kegel.${run}.`;
export function createKegelQaStorage(client:StorageClient,prefix:string):StorageClient {
  return {getItem:key=>client.getItem(prefix+key),setItem:(key,value)=>client.setItem(prefix+key,value),
    removeItem:key=>client.removeItem(prefix+key),getAllKeys:async()=>(await client.getAllKeys()).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length))};
}
// Settings deletion QA is confined to a new, guarded E2E namespace.
let failNextRemoval=kegelPersistenceQaEnabled && process.env.EXPO_PUBLIC_SETTINGS_DELETE_QA === "fail-once";
let failNext=false;
export function failNextKegelQaSave() {if(kegelPersistenceQaEnabled) failNext=true;}
const qaStorage=createKegelQaStorage(storageClient,kegelQaPrefix);
const storage:StorageClient={...qaStorage,removeItem:key=>{
  if(failNextRemoval){failNextRemoval=false;return Promise.reject(new Error("Isolated Settings QA removal failure"));}
  return qaStorage.removeItem(key);
},setItem:(key,value)=>{
  if(failNext){failNext=false;return Promise.reject(new Error("Isolated QA write failure"));}
  return qaStorage.setItem(key,value);
}};
const persistence=createBloomStatePersistenceCoordinator(storage);
export const kegelPersistenceQaRuntime={now:()=>new Date(),load:persistence.load,save:persistence.enqueueWrite,deleteAll:persistence.deleteAll};
