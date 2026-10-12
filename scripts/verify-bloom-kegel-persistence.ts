import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { createDefaultBloomState, saveCompletedKegelSessionState, type BloomLocalState } from "../src/storage/bloomState";
import { createBloomStatePersistenceCoordinator, BLOOM_STATE_STORAGE_KEY, BLOOM_CORRUPT_BACKUP_PREFIX } from "../src/storage/bloomStatePersistence";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createKegelPersistenceController } from "../src/features/kegel/kegelPersistenceController";
import { deriveKegelSummary, kegelLocalDate } from "../src/features/kegel/kegelSummary";
import type { CompletedKegelSession } from "../src/domain/models/KegelState";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";

const now=()=>new Date("2026-10-12T12:00:00.000Z");
class Storage implements StorageClient {
  values=new Map<string,string>(); fail=false; failAfter=false;
  async getItem(key:string){return this.values.get(key) ?? null;}
  async setItem(key:string,value:string){
    if(this.fail) throw new Error("injected before write");
    this.values.set(key,value);if(this.failAfter) throw new Error("injected after write");
  }
  async removeItem(key:string){this.values.delete(key);}
  async getAllKeys(){return [...this.values.keys()];}
}
function session(id:string, completed=new Date("2026-10-12T12:00:00.000Z")):CompletedKegelSession {
  return {id,status:"completed",startedAt:new Date(completed.getTime()-63000).toISOString(),completedAt:completed.toISOString(),
    completionDate:kegelLocalDate(completed),completionUtcOffsetMinutes:completed.getTimezoneOffset(),
    program:{configurationId:"editable-config-1",provisional:true,repetitions:10,contractionSeconds:3,relaxationSeconds:3,countdownSeconds:3,dailyTarget:3},
    completedRepetitions:10,metrics:{activeExerciseSeconds:60,elapsedSeconds:63,pausedSeconds:0,pauseCount:0}};
}
function harness(initial:BloomLocalState, storage=new Storage()){
  const persistence=createBloomStatePersistenceCoordinator(storage,now);
  const runtime=createBloomLocalStateMutationRuntime({initialState:initial,persistState:persistence.enqueueWrite,initialHydrationStatus:"ready"});
  const actions=createBloomProductAcknowledgedActions({applyAcknowledgedMutation:runtime.applyAcknowledgedMutation});
  const controller=createKegelPersistenceController({actions:actions.kegel,getState:runtime.getState,getDurableState:runtime.getDurableState,
    retryPersistedMutation:runtime.retryPersistence,confirmCurrentPersistence:runtime.confirmCurrentPersistence});
  return {persistence,runtime,actions,controller,storage};
}
function withoutKegel(state:BloomLocalState){const {kegel,...others}=state;return others;}
async function verify(){
  const normalized=validateAndNormalizeBloomState(createPopulatedState());assert(normalized.success);
  const baseline=normalized.state, rawV7=JSON.stringify({version:7,savedAt:now().toISOString(),state:withoutKegel(baseline)});
  const storage=new Storage();storage.values.set("bloom.localState.v7",rawV7);
  const coordinator=createBloomStatePersistenceCoordinator(storage,now);
  const loaded=await coordinator.load();assert(loaded.status==="success");
  assert.equal(loaded.source,"legacy");assert.deepEqual(withoutKegel(loaded.state),withoutKegel(baseline));
  assert.deepEqual(loaded.state.kegel,{onboardingCompletedAt:null,sessions:[]});
  assert.equal(storage.values.get("bloom.localState.v7"),rawV7,"v7 recovery bytes retained after durable v8 migration");
  assert.equal(JSON.parse(storage.values.get(BLOOM_STATE_STORAGE_KEY)!).version,8);
  const h=harness(loaded.state,storage);
  assert((await h.controller.completeOnboarding(now().toISOString()))?.ok);
  const first=session("kegel-first"),second=session("kegel-second");
  const a=h.controller.saveSession(first),b=h.controller.saveSession(first);
  assert.equal(a,b,"Repeated synchronous callbacks share the same acknowledged operation");
  assert((await a)?.ok);assert((await h.controller.saveSession(first))?.ok);
  assert.equal(h.runtime.getDurableState().kegel.sessions.length,1);
  assert((await h.controller.saveSession(second))?.ok);
  assert.deepEqual(withoutKegel(h.runtime.getDurableState()),withoutKegel(baseline),"All existing Tracking, Content-Free, Reset and legacy slices are identical");
  assert.equal(storage.values.get("bloom.localState.v7"),rawV7);
  const reopenedStorage=new Storage();reopenedStorage.values=new Map(storage.values);
  const reopened=await createBloomStatePersistenceCoordinator(reopenedStorage,now).load();assert(reopened.status==="success");
  assert.equal(reopened.source,"current");assert.equal(reopened.state.kegel.sessions.length,2);
  assert.equal(reopened.state.kegel.onboardingCompletedAt,now().toISOString());
  const summary=deriveKegelSummary(reopened.state.kegel,now());
  assert.equal(summary.kind,"real");assert.equal(summary.done,2);assert.equal(summary.total,20);assert.equal(summary.streak,1);
  assert.equal(summary.week!.reduce((n,v)=>n+v,0),2);assert.equal(summary.heat![27],2);
  // Cancellation has no transition; an incomplete record is rejected even if a
  // caller mistakenly tries to label it completed.
  const prior=h.runtime.getState();
  assert.equal(saveCompletedKegelSessionState(prior,{...session("cancelled"),completedRepetitions:9}),prior);
  assert.equal(saveCompletedKegelSessionState(prior,{...session("cancelled"),metrics:{...first.metrics,activeExerciseSeconds:59}}),prior);
  assert.equal(saveCompletedKegelSessionState(prior,{...session("cancelled"),status:"unfinished" as "completed"}),prior);
  assert.equal(saveCompletedKegelSessionState(prior,{...first,completedAt:second.completedAt}),prior);
  const asymmetric=session("asymmetric");asymmetric.program={...asymmetric.program,repetitions:2,contractionSeconds:2,relaxationSeconds:4,dailyTarget:7};
  asymmetric.completedRepetitions=2;asymmetric.metrics={activeExerciseSeconds:12,elapsedSeconds:20,pausedSeconds:5,pauseCount:2};
  const changed=saveCompletedKegelSessionState(prior,asymmetric);assert.notEqual(changed,prior);
  assert.deepEqual(changed.kegel.sessions[changed.kegel.sessions.length-1]!.program,asymmetric.program);
  assert.equal(changed.kegel.sessions[0]!.program.contractionSeconds,3,"Old snapshots do not change with later configuration");
  const failure=harness(createDefaultBloomState());failure.storage.fail=true;
  const failed=await failure.controller.saveSession(first);assert(failed && !failed.ok && failed.accepted && failed.retryable);
  assert.equal(failure.runtime.getDurableState().kegel.sessions.length,0,"Accepted state is not a successful durable save");
  assert.equal(failure.runtime.getState().kegel.sessions.length,1);
  assert.equal(failure.controller.saveSession(second),null,"Unconfirmed accepted save blocks another command");
  failure.storage.fail=false;assert((await failure.controller.retry())?.ok);
  assert.deepEqual(failure.runtime.getDurableState().kegel.sessions,[first],"Retry preserves original ID/timestamp/snapshot");
  const uncertain=harness(createDefaultBloomState());uncertain.storage.failAfter=true;
  const uncertainResult=await uncertain.controller.saveSession(first);assert(uncertainResult && !uncertainResult.ok);
  uncertain.storage.failAfter=false;assert((await uncertain.controller.retry())?.ok);
  assert.equal(uncertain.runtime.getDurableState().kegel.sessions.length,1,"Failure after actual write + retry never duplicates");
  const superseded=harness(createDefaultBloomState());superseded.storage.fail=true;
  const originalFailed=await superseded.controller.saveSession(first);assert(originalFailed && !originalFailed.ok && originalFailed.retryable);
  superseded.storage.fail=false;await superseded.persistence.enqueueWrite(superseded.runtime.getState());
  const hydrated=await superseded.persistence.load();assert(hydrated.status==="success");
  superseded.runtime.completeHydration(superseded.runtime.beginHydration(),hydrated.state,{needsPersist:false,persistenceError:null});
  const obsolete=await superseded.controller.retry();assert(obsolete && !obsolete.ok && !obsolete.retryable && obsolete.accepted);
  assert((await superseded.controller.confirmCurrentSave())?.ok,"Obsolete receipt can confirm current durable truth without replay");
  assert.equal(superseded.runtime.getDurableState().kegel.sessions.length,1);
  const intro=harness(createDefaultBloomState());intro.storage.fail=true;
  const introFailure=await intro.controller.completeOnboarding(now().toISOString());assert(introFailure && !introFailure.ok);
  assert.equal(intro.runtime.getDurableState().kegel.onboardingCompletedAt,null);
  assert(intro.controller.getSnapshot().message?.includes("Tanıtım"),"Onboarding failure must not claim a completed workout");
  intro.storage.fail=false;
  assert((await intro.controller.retry())?.ok);
  const failedMigration=new Storage();failedMigration.values.set("bloom.localState.v7",rawV7);failedMigration.fail=true;
  const failedLoad=await createBloomStatePersistenceCoordinator(failedMigration,now).load();assert(failedLoad.status==="success" && failedLoad.needsPersist);
  assert.equal(failedMigration.values.get("bloom.localState.v7"),rawV7);assert(!failedMigration.values.has(BLOOM_STATE_STORAGE_KEY));
  failedMigration.fail=false;const retryLoad=await createBloomStatePersistenceCoordinator(failedMigration,now).load();assert(retryLoad.status==="success" && !retryLoad.needsPersist);
  assert.equal(failedMigration.values.get("bloom.localState.v7"),rawV7);
  for(const version of [2,3,4,5,6,7]){
    const client=new Storage();const key=`bloom.localState.v${version}`;
    client.values.set(key,JSON.stringify({version,savedAt:now().toISOString(),state:{...createDefaultBloomState(),kegel:{sessions:[first],onboardingCompletedAt:now().toISOString()}}}));
    const legacy=await createBloomStatePersistenceCoordinator(client,now).load();assert(legacy.status==="success");
    assert.deepEqual(legacy.state.kegel,{onboardingCompletedAt:null,sessions:[]},"Pre-Kegel versions cannot import fabricated Kegel fields");
  }
  for(const kegel of [undefined, {onboardingCompletedAt:null,sessions:[{...first,completedRepetitions:4}]},
    {onboardingCompletedAt:null,sessions:[first,first]}, {onboardingCompletedAt:"garbage",sessions:[]}]){
    const client=new Storage();const raw=JSON.stringify({version:8,savedAt:now().toISOString(),state:{...createDefaultBloomState(),kegel}});
    client.values.set(BLOOM_STATE_STORAGE_KEY,raw);
    const corrupt=await createBloomStatePersistenceCoordinator(client,now).load();assert.equal(corrupt.status,"corrupt");
    assert.equal(client.values.get(BLOOM_STATE_STORAGE_KEY),raw);assert([...client.values.keys()].some(k=>k.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX)));
  }
  const history={onboardingCompletedAt:null,sessions:[session("sat",new Date(2026,9,10,12)),session("sun",new Date(2026,9,11,12)),first,second]};
  const historySummary=deriveKegelSummary(history,now());assert.equal(historySummary.streak,3);assert.equal(historySummary.done,2);assert.equal(historySummary.total,40);
  assert.equal(historySummary.week![historySummary.dayIndex!],2);
  assert.equal(deriveKegelSummary(history,new Date(2026,9,13,12)).streak,3);
  assert.equal(deriveKegelSummary(history,new Date(2026,9,14,12)).streak,0);
  assert.equal(deriveKegelSummary({onboardingCompletedAt:null,sessions:[]},now()).streak,0);
  const oldZone=process.env.TZ;process.env.TZ="Europe/Berlin";
  const dst={onboardingCompletedAt:null,sessions:[session("dst1",new Date(2026,2,28,12)),session("dst2",new Date(2026,2,29,12))]};
  assert.equal(deriveKegelSummary(dst,new Date(2026,2,30,12)).streak,2);if(oldZone===undefined) delete process.env.TZ; else process.env.TZ=oldZone;
  // An envelope from a future writer blocks fallback rather than rewriting data.
  const future=new Storage();const futureRaw=JSON.stringify({version:99,savedAt:now().toISOString(),state:baseline});
  future.values.set(BLOOM_STATE_STORAGE_KEY,futureRaw);future.values.set("bloom.localState.v7",rawV7);
  assert.equal((await createBloomStatePersistenceCoordinator(future,now).load()).status,"unsupported-version");
  assert.equal(future.values.get(BLOOM_STATE_STORAGE_KEY),futureRaw);assert.equal(future.values.get("bloom.localState.v7"),rawV7);
  const deleted=harness(createDefaultBloomState());assert((await deleted.controller.saveSession(first))?.ok);
  deleted.runtime.beginDeletion();deleted.runtime.completeDeletion(createDefaultBloomState());
  assert.equal(deleted.controller.saveSession(first),null,"A cached completion cannot resurrect a deleted session");
  assert.equal(deleted.runtime.getDurableState().kegel.sessions.length,0);
  // The user-supplied local reference is intentionally outside source control.
  // Validate its inventory here when present; core persistence checks also run in CI.
  if(existsSync(".local-design/kegel/tasarim.html")) {
    const plan=readFileSync("docs/bloom-html-implementation-plan.md","utf8"),html=readFileSync(".local-design/kegel/tasarim.html","utf8").split("const flows = [")[1]!;
    const labels=[...html.matchAll(/"(\d+\. [^"\n]+)"/g)].map(m=>m[1]!);
    assert.equal(labels.length,88);for(const label of labels)assert(plan.includes(`| ${label} |`),label);
    console.log("Full HTML inventory verified: 88 labeled screen states covered.");
  }
  console.log("Kegel persistence passed: v7 retained migration/failed migration; all existing slices preserved; onboarding; full snapshots; reopen/two sessions; duplicate callbacks; rejected incomplete records; durable failure/retry and post-write uncertainty; real daily/weekly/heat/streak + DST; malformed/future payload preservation; optional local-reference inventory coverage.");
}
void verify().catch(error=>{console.error(error);process.exitCode=1;});
