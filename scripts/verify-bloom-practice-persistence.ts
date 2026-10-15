import { readPracticeAvailability } from "../src/app/providers/readPracticeAvailability";
import { strict as assert } from "node:assert";
import { createDefaultBloomState, acknowledgePracticeIntroductionState, saveCompletedPracticeSessionState, type BloomLocalState } from "../src/storage/bloomState";
import { normalizeCompletedPracticeSession } from "../src/storage/bloomPracticeSchema";
import { createBloomStatePersistenceCoordinator, BLOOM_STATE_STORAGE_KEY } from "../src/storage/bloomStatePersistence";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createPracticePersistenceController } from "../src/features/practice/practicePersistenceController";
import { getPracticeAvailability } from "../src/domain/productPolicy/getPracticeAvailability";
import { getPracticeLocalDay, groupPracticeHistory } from "../src/features/practice/practiceHistory";
import { createPracticeQaFixture, practiceQaRecord } from "../src/features/practice/qa/practiceQaFixtures";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import type { StorageClient } from "../src/storage/storageAdapters";

class Storage implements StorageClient {
  values=new Map<string,string>(); fail=false; failAfter=false; gate:Promise<void>|null=null; writes=0;
  async getItem(k:string){return this.values.get(k)??null;}
  async setItem(k:string,v:string){this.writes++;if(this.gate)await this.gate;if(this.fail)throw new Error("before write");this.values.set(k,v);if(this.failAfter)throw new Error("after write");}
  async removeItem(k:string){this.values.delete(k);}
  async getAllKeys(){return [...this.values.keys()];}
}
const now=()=>new Date("2026-10-14T12:00:00.000Z");
const introduced=()=>acknowledgePracticeIntroductionState(createDefaultBloomState(),{version:1,acknowledgedAt:now().toISOString()});
function harness(initial=introduced(),storage=new Storage(),timeout=2000) {
  const coordinator=createBloomStatePersistenceCoordinator(storage,now);
  const runtime=createBloomLocalStateMutationRuntime({initialState:initial,initialHydrationStatus:"ready",persistState:coordinator.enqueueWrite,acknowledgementTimeoutMs:timeout});
  const actions=createBloomProductAcknowledgedActions({applyAcknowledgedMutation:runtime.applyAcknowledgedMutation,isPracticeStateConfirmed:s=>runtime.getHydrationStatus()==="ready"&&!runtime.isWritesBlocked()&&s===runtime.getDurableState()});
  const controller=createPracticePersistenceController({actions:actions.practice,getState:runtime.getState,getDurableState:runtime.getDurableState,isReady:()=>runtime.getHydrationStatus()==="ready"&&!runtime.isWritesBlocked(),retryPersistedMutation:runtime.retryPersistence,confirmCurrentPersistence:runtime.confirmCurrentPersistence});
  return {runtime,actions,controller,storage,coordinator};
}
const omitPractice=(s:BloomLocalState)=>{const {practice,...other}=s;return other;};
async function verify() {
  const valid=practiceQaRecord();assert.deepEqual(normalizeCompletedPracticeSession(valid),valid);
  const invalid:unknown[]=[{...valid,version:2},{...valid,source:"masturbation_tracking"},{...valid,activeMs:NaN},{...valid,intentionalPauseMs:-1},{...valid,foregroundExerciseMs:Infinity},{...valid,activeMs:1},{...valid,pauses:[{startMs:20000,endMs:19000}]},{...valid,pauses:[{startMs:10000,endMs:20000},{startMs:19000,endMs:24000}]},{...valid,arousalReports:[{atMs:70000,reportedAt:valid.completedAt,level:4}]},{...valid,arousalReports:[{atMs:100,reportedAt:valid.startedAt,level:11}]},{...valid,erectionQuality:0},{...valid,explicitContent:"yes"},{...valid,ending:"unknown"},{...valid,feelings:["Sakin","Sakin"]},{...valid,timezone:{name:"fake",utcOffsetMinutes:0}},{...valid,completedAt:"yesterday"}];
  for(const record of invalid)assert.throws(()=>normalizeCompletedPracticeSession(record));
  for(const baseline of [createDefaultBloomState(),createPopulatedState()]) {
    const store=new Storage(),raw=JSON.stringify({version:8,savedAt:now().toISOString(),state:omitPractice(baseline)});store.values.set("bloom.localState.v8",raw);
    const migration=await createBloomStatePersistenceCoordinator(store,now).load();assert(migration.status==="success");assert.deepEqual(omitPractice(migration.state),omitPractice(baseline));assert.deepEqual(migration.state.practice,{introduction:null,sessions:[]});assert.equal(store.values.get("bloom.localState.v8"),raw);assert.equal(JSON.parse(store.values.get(BLOOM_STATE_STORAGE_KEY)!).version,9);
    assert.deepEqual((await createBloomStatePersistenceCoordinator(store,now).load()),{...migration,source:"current"});
    store.values.set(BLOOM_STATE_STORAGE_KEY,"broken-v9");assert.equal((await createBloomStatePersistenceCoordinator(store,now).load()).status,"corrupt");assert.equal(store.values.get("bloom.localState.v8"),raw);
  }
  const failed=new Storage();const seed=createPracticeQaFixture("populated-v8");failed.values.set(seed.key,seed.payload);failed.fail=true;
  const result=await createBloomStatePersistenceCoordinator(failed,now).load();assert(result.status==="success"&&result.needsPersist);assert.equal(failed.values.get(seed.key),seed.payload);assert(!failed.values.has(BLOOM_STATE_STORAGE_KEY));
  for(const fixture of ["fresh-v8","populated-v8","reset-active","reset-elapsed","reset-baseline","reset-completed-pending","corrupt-v9","unsupported-v9"]) {
    const store=new Storage(),seed=createPracticeQaFixture(fixture);store.values.set(seed.key,seed.payload);const loaded=await createBloomStatePersistenceCoordinator(store,now).load();
    if(fixture.includes("corrupt"))assert.equal(loaded.status,"corrupt");else if(fixture.includes("unsupported"))assert.equal(loaded.status,"unsupported-version");else {assert(loaded.status==="success",`${fixture} must validate`);assert.equal(getPracticeAvailability(loaded.state,true).canStart,!fixture.startsWith("reset-"));}
  }
  const misplaced=new Storage();misplaced.values.set(BLOOM_STATE_STORAGE_KEY,JSON.stringify({version:8,savedAt:now().toISOString(),state:omitPractice(createDefaultBloomState())}));assert.equal((await createBloomStatePersistenceCoordinator(misplaced,now).load()).status,"corrupt","v9 key cannot silently relocate an older envelope");
  const preservedOlder=validateAndNormalizeBloomState({...createDefaultBloomState(),practice:{introduction:null,sessions:[valid]}},"v8");assert(preservedOlder.success&&preservedOlder.state.practice.sessions.length===1,"An existing valid Practice field is not silently erased during migration");
  const incompatible=validateAndNormalizeBloomState({...createDefaultBloomState(),practice:{introduction:{version:2,acknowledgedAt:now().toISOString()},sessions:[]}});assert(incompatible.success);assert.notEqual(incompatible.state.practice.introduction?.version,1);assert.equal(acknowledgePracticeIntroductionState(incompatible.state,{version:2,acknowledgedAt:now().toISOString()}),incompatible.state);assert.equal(acknowledgePracticeIntroductionState(incompatible.state,{version:1,acknowledgedAt:now().toISOString()}).practice.introduction?.version,1,"Incompatible version is acknowledged only after confirming the current intro");
  const missing=createDefaultBloomState();assert(getPracticeAvailability(missing,true).canStart);assert(!getPracticeAvailability(null,true).canStart);assert(!getPracticeAvailability(missing,false).canStart);assert(!getPracticeAvailability(missing,true,{...missing}).canStart);
  assert.equal(saveCompletedPracticeSessionState(missing,valid),missing,"Introduction is required");
  const live=harness();assert(readPracticeAvailability(live.runtime).canStart);const hydration=live.runtime.beginHydration();assert(!readPracticeAvailability(live.runtime).canStart,"Actual start reads hydration before React rerenders");live.runtime.completeHydration(hydration,live.runtime.getState(),{needsPersist:false,persistenceError:null});assert(readPracticeAvailability(live.runtime).canStart);live.runtime.beginDeletion();assert(!readPracticeAvailability(live.runtime).canStart,"Actual start reads deletion barrier before React rerenders");live.runtime.completeDeletion(createDefaultBloomState());assert(!readPracticeAvailability(live.runtime).canStart);live.runtime.finishResetNavigation();assert(readPracticeAvailability(live.runtime).canStart);
  const state=introduced(),saved=saveCompletedPracticeSessionState(state,{...valid,explicitContent:true});assert.notEqual(saved,state);assert.deepEqual(omitPractice(saved),omitPractice(state),"No Tracking/Content-Free/Reset/legacy changes");assert.equal(saveCompletedPracticeSessionState(saved,{...valid,erectionQuality:1}),saved,"ID immutable");
  assert(!validateAndNormalizeBloomState({...saved,practice:{...saved.practice,sessions:[valid,{...valid,id:"bad",activeMs:NaN}]}}).success,"Malformed history fails the whole state, never silently drops a record");
  assert(!validateAndNormalizeBloomState({...saved,practice:{...saved.practice,sessions:[valid,valid]}}).success);
  assert.equal(getPracticeLocalDay("2026-10-13T23:00:00.000Z",-180),"2026-10-14");assert.equal(groupPracticeHistory(saved.practice).length,1);
  const h=harness();const first=h.controller.save(valid),double=h.controller.save({...valid,erectionQuality:1});assert.equal(first,double);assert((await first)?.ok);assert(h.controller.isSaved());assert.equal(h.storage.writes,1);assert((await h.controller.save(valid))?.ok);assert.equal(h.storage.writes,1);assert(Object.isFrozen(h.controller.getRecord()));
  const reopened=await h.coordinator.load();assert(reopened.status==="success"&&reopened.state.practice.sessions.length===1);assert.deepEqual(reopened.state.practice.sessions[0],valid);
  for(const after of [false,true]) {
    const fail=harness();fail.storage.fail=!after;fail.storage.failAfter=after;
    const response=await fail.controller.save(valid);assert(response&&!response.ok&&response.retryable&&response.accepted);assert(!fail.controller.isSaved());assert.equal(fail.runtime.getDurableState().practice.sessions.length,0);assert.equal(fail.controller.save({...valid,id:"second"}),null);assert.equal(fail.controller.save({...valid,erectionQuality:1}),null);
    fail.storage.fail=false;fail.storage.failAfter=false;const retry=fail.controller.retry(),rapidRetry=fail.controller.retry();assert.equal(retry,rapidRetry);assert((await retry)?.ok);assert(fail.controller.isSaved());assert.deepEqual(fail.runtime.getDurableState().practice.sessions,[valid]);assert.equal(fail.controller.getRecord()?.id,valid.id);
  }
  const intro=harness(createDefaultBloomState());intro.storage.fail=true;assert(!((await intro.controller.acknowledgeIntroduction({version:1,acknowledgedAt:now().toISOString()}))?.ok));assert.equal(intro.runtime.getDurableState().practice.introduction,null);intro.storage.fail=false;assert((await intro.controller.retry())?.ok);assert.equal(intro.runtime.getDurableState().practice.introduction?.version,1);
  const staleIntro=harness(createDefaultBloomState());assert((await staleIntro.controller.acknowledgeIntroduction({version:1,acknowledgedAt:now().toISOString()}))?.ok);staleIntro.runtime.beginDeletion();await staleIntro.coordinator.deleteAll();staleIntro.runtime.completeDeletion(createDefaultBloomState());staleIntro.runtime.finishResetNavigation();assert.equal(staleIntro.controller.acknowledgeIntroduction({version:1,acknowledgedAt:now().toISOString()}),null,"A cached old intro acknowledgement cannot replay after deletion");assert.equal(staleIntro.runtime.getDurableState().practice.introduction,null);
  let release!:()=>void;const delayed=harness(introduced(),new Storage(),10);delayed.storage.gate=new Promise(resolve=>release=resolve);
  const unknown=await delayed.controller.save(valid);assert(unknown&&!unknown.ok&&unknown.reason==="persistenceUnknown");assert(!delayed.controller.isSaved());release();delayed.storage.gate=null;assert((await delayed.controller.retry())?.ok);assert.equal(delayed.storage.writes,1,"Late covering acknowledgement does not duplicate the write");
  let finish!:()=>void;const concurrent=harness();concurrent.storage.gate=new Promise(resolve=>finish=resolve);
  const old=concurrent.controller.save(valid);await Promise.resolve();await Promise.resolve();
  assert(!getPracticeAvailability(concurrent.runtime.getDurableState(),true,concurrent.runtime.getState()).canStart);
  const newer=concurrent.actions.library.setArticleState("bookmark","wave",true);finish();concurrent.storage.gate=null;
  const stale=await old;assert(stale&&!stale.ok&&stale.reason==="persistenceSuperseded");assert((await newer).ok);assert.equal(concurrent.controller.retry(),null);assert((await concurrent.controller.confirm())?.ok);assert(concurrent.controller.isSaved());assert.deepEqual(concurrent.runtime.getDurableState().practice.sessions,[valid]);assert(concurrent.runtime.getDurableState().library.bookmarkedArticleIds.includes("wave"));
  const deletion=harness();let releaseDeletion!:()=>void;deletion.storage.gate=new Promise(resolve=>releaseDeletion=resolve);const pending=deletion.controller.save(valid);await Promise.resolve();await Promise.resolve();deletion.runtime.beginDeletion();const wipe=deletion.coordinator.deleteAll();releaseDeletion();await wipe;deletion.runtime.completeDeletion(createDefaultBloomState());deletion.runtime.finishResetNavigation();await pending;assert(!deletion.controller.isSaved());assert.equal(deletion.controller.save(valid),null);assert.equal(deletion.storage.values.size,0);
  const clear=harness();assert((await clear.controller.save(valid))?.ok);clear.storage.values.set("bloom.localState.v8",seed.payload);clear.storage.values.set("bloom.localState.v7","recovery");clear.storage.values.set("unrelated","preserve");clear.runtime.beginDeletion();await clear.coordinator.deleteAll();clear.runtime.completeDeletion(createDefaultBloomState());clear.runtime.finishResetNavigation();assert.deepEqual([...clear.storage.values],[['unrelated','preserve']]);const blank=await clear.coordinator.load();assert(blank.status==="success"&&blank.state.practice.sessions.length===0);assert(!clear.controller.isSaved(),"Whole-app deletion invalidates cached saved receipts and history");
  console.log("Practice persistence: strict domain invariants; empty/populated v8 lossless migration + raw recovery; corrupt/future fail closed; intro acknowledgement; duplicate/delayed/unknown/failed writes + exact retry; immutable identity; concurrent supersession/current confirmation; deletion barriers/relaunch; durable history/timezone; all cross-feature slices preserved — passed.");
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
