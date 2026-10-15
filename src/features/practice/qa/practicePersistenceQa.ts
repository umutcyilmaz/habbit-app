import Constants from "expo-constants";
import { isE2EMode } from "../../../shared/runtime/e2eMode";
import { storageClient } from "../../../storage/storageClient";
import type { StorageClient } from "../../../storage/storageAdapters";
import { createBloomStatePersistenceCoordinator } from "../../../storage/bloomStatePersistence";
import { createPracticeQaFixture, practiceQaFixtures } from "./practiceQaFixtures";
export function resolvePracticePersistenceQaEnabled(dev:boolean,e2e:boolean,bundle:string|undefined,flag:string|undefined,run:string|undefined) {
  return dev&&e2e&&bundle==="com.umutcyilmaz.bloom.e2e"&&flag==="1"&&typeof run==="string"&&/^[a-zA-Z0-9_-]{8,80}$/.test(run);
}
const run=process.env.EXPO_PUBLIC_PRACTICE_QA_RUN;
export const practicePersistenceQaEnabled=resolvePracticePersistenceQaEnabled(typeof __DEV__!=="undefined"&&__DEV__,isE2EMode,Constants.expoConfig?.ios?.bundleIdentifier,process.env.EXPO_PUBLIC_PRACTICE_PERSISTENCE_QA,run);
const requested=process.env.EXPO_PUBLIC_PRACTICE_QA_FIXTURE??"fresh-v8";
const fixture=practiceQaFixtures.includes(requested as never)?requested:"fresh-v8";
export const practiceQaPrefix=`bloom.e2e.practice.${practicePersistenceQaEnabled?run:"disabled_preview"}.${fixture}.`;
export const practiceQaInvalidConfiguration=typeof __DEV__!=="undefined"&&__DEV__&&isE2EMode&&Constants.expoConfig?.ios?.bundleIdentifier==="com.umutcyilmaz.bloom.e2e"&&process.env.EXPO_PUBLIC_PRACTICE_PERSISTENCE_QA==="1"&&!practicePersistenceQaEnabled;
export function createPracticeQaStorage(client:StorageClient,prefix:string):StorageClient {
  if(!/^bloom\.e2e\.practice\.[a-zA-Z0-9_-]{8,80}\.[a-z0-9-]+\.$/.test(prefix))throw new Error("Invalid isolated Practice namespace");
  return {getItem:key=>client.getItem(prefix+key),setItem:(key,value)=>client.setItem(prefix+key,value),removeItem:key=>client.removeItem(prefix+key),getAllKeys:async()=>(await client.getAllKeys()).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length))};
}
let failNext=false,delayNext=false;
export function failNextPracticeQaSave(){if(practicePersistenceQaEnabled)failNext=true;}
export function delayNextPracticeQaSave(){if(practicePersistenceQaEnabled)delayNext=true;}
// Initialization happens only in a never-used isolated namespace. A durable
// sentinel survives Settings deletion: deleted data must not be seeded again.
const base=createPracticeQaStorage(storageClient,practiceQaPrefix);
const client:StorageClient={...base,setItem:async(key,value)=>{
  if(delayNext){delayNext=false;await new Promise(resolve=>setTimeout(resolve,2500));}
  if(failNext){failNext=false;throw new Error("Isolated Practice QA write failure");}await base.setItem(key,value);
}};
const persistence=createBloomStatePersistenceCoordinator(client);
export const practicePersistenceQaRuntime={now:()=>new Date(),save:persistence.enqueueWrite,deleteAll:persistence.deleteAll,load:async()=>{
  if(!practicePersistenceQaEnabled)throw new Error("Practice QA is disabled");
  if(await base.getItem("fixture-initialized")===null) {
    if((await base.getAllKeys()).length!==0)throw new Error("Refusing to seed existing isolated Practice data");
    const seed=createPracticeQaFixture(fixture);await base.setItem(seed.key,seed.payload);await base.setItem("fixture-initialized","1");
  }
  return persistence.load();
}};
