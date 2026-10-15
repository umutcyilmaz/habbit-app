import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createDefaultBloomState, type BloomLocalState, setLibraryArticleState } from "../src/storage/bloomState";
import { normalizeLibraryState } from "../src/storage/bloomLibrarySchema";
import { createBloomStatePersistenceCoordinator, BLOOM_STATE_STORAGE_KEY, BLOOM_CORRUPT_BACKUP_PREFIX } from "../src/storage/bloomStatePersistence";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createLibraryPersistenceController } from "../src/features/library/libraryPersistenceController";
import { libraryArticles, libraryCategories, nextLibraryArticle, articlesForCategory } from "../src/features/library/libraryContent";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { getBloomPersistenceRecovery } from "../src/shared/navigation/bloomPersistenceRecovery";
import type { StorageClient } from "../src/storage/storageAdapters";
const now=()=>new Date("2026-10-12T15:00:00Z");
class Storage implements StorageClient {
  values=new Map<string,string>();fail=false;failAfter=false;gate:Promise<void>|null=null;
  async getItem(key:string){return this.values.get(key) ?? null;}
  async setItem(key:string,value:string){if(this.gate)await this.gate;if(this.fail)throw new Error("write failed");this.values.set(key,value);if(this.failAfter)throw new Error("receipt failed");}
  async removeItem(key:string){this.values.delete(key);}
  async getAllKeys(){return [...this.values.keys()];}
}
function harness(initial=createDefaultBloomState(),storage=new Storage()) {
  const persistence=createBloomStatePersistenceCoordinator(storage,now);
  const runtime=createBloomLocalStateMutationRuntime({initialState:initial,persistState:persistence.enqueueWrite,initialHydrationStatus:"ready"});
  const actions=createBloomProductAcknowledgedActions({applyAcknowledgedMutation:runtime.applyAcknowledgedMutation});
  const controller=createLibraryPersistenceController({actions:actions.library,getState:runtime.getState,getDurableState:runtime.getDurableState,retryPersistedMutation:runtime.retryPersistence,confirmCurrentPersistence:runtime.confirmCurrentPersistence});
  return {persistence,runtime,actions,controller,storage};
}
async function verify() {
  assert.equal(libraryArticles.length,12);assert.equal(Object.keys(libraryCategories).length,6);
  assert.equal(new Set(libraryArticles.map(a=>a.id)).size,12);
  for(const cat of Object.keys(libraryCategories) as (keyof typeof libraryCategories)[])assert(articlesForCategory(cat).length>0);
  assert.equal(nextLibraryArticle("talk")?.id,"pe");assert.equal(nextLibraryArticle("missing"),undefined);
  if(existsSync(".local-design/kegel/tasarim.html")) {
    const html=readFileSync(".local-design/kegel/tasarim.html","utf8");
    const reference=runInNewContext(html.slice(html.indexOf("const CATS ="),html.indexOf("const SERIES ="))+"\nJSON.stringify({categories:CATS,articles:ARTICLES})") as string;
    const expected=JSON.parse(reference);
    const paragraph=expected.articles.find((article:{id:string})=>article.id==="pe").body[0];
    assert.equal(paragraph[0],"p");
    assert(paragraph[1].includes("Pratik sekmesinde çalıştığın eşik farkındalığı burada işe yarar."));
    paragraph[1]=paragraph[1].replace("Pratik sekmesinde çalıştığın eşik farkındalığı burada işe yarar.","Eşik farkındalığı burada işe yarar.");
    assert.deepEqual(expected,{categories:libraryCategories,articles:libraryArticles},"Only the obsolete Practice-tab navigation wording differs from HTML");
  }
  const baseline=createPopulatedState();baseline.kegel.onboardingCompletedAt=now().toISOString();
  const oldV8={...baseline} as Partial<BloomLocalState>;delete oldV8.library;
  const store=new Storage();const raw=JSON.stringify({version:9,savedAt:now().toISOString(),state:oldV8});store.values.set(BLOOM_STATE_STORAGE_KEY,raw);
  const persistence=createBloomStatePersistenceCoordinator(store,now),load=await persistence.load();
  assert(load.status==="success" && load.needsPersist);assert.deepEqual(load.state,baseline);assert.equal(store.values.get(BLOOM_STATE_STORAGE_KEY),raw,"Loading old v8 does not rewrite without acknowledgement");
  store.fail=true;await assert.rejects(persistence.enqueueWrite(load.state));assert.equal(store.values.get(BLOOM_STATE_STORAGE_KEY),raw);
  store.fail=false;await persistence.enqueueWrite(load.state);assert((await persistence.load()).status==="success");
  const v7Store=new Storage(),v7Raw=JSON.stringify({version:7,savedAt:now().toISOString(),state:{...baseline,library:{bookmarkedArticleIds:["wave"],completedArticleIds:["wave"]}}});
  v7Store.values.set("bloom.localState.v7",v7Raw);v7Store.fail=true;
  const v7Persistence=createBloomStatePersistenceCoordinator(v7Store,now),failedMigration=await v7Persistence.load();assert(failedMigration.status==="success" && failedMigration.needsPersist);
  assert.deepEqual(failedMigration.state.library,createDefaultBloomState().library,"v7 cannot fabricate Library facts");assert.equal(v7Store.values.get("bloom.localState.v7"),v7Raw);
  v7Store.fail=false;const migrated=await v7Persistence.load();assert(migrated.status==="success" && !migrated.needsPersist);
  assert.deepEqual(migrated.state,{...baseline,kegel:createDefaultBloomState().kegel});assert.equal(v7Store.values.get("bloom.localState.v7"),v7Raw);
  const delayed=harness(baseline);let release!:()=>void;
  delayed.storage.gate=new Promise<void>(resolve=>{release=resolve;});
  const pending=delayed.controller.set({kind:"completion",id:"wave",enabled:true});assert(pending);
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert(delayed.controller.getSnapshot().busy);assert.equal(delayed.controller.getSnapshot().result,null);
  assert.deepEqual(delayed.runtime.getState().library.completedArticleIds,["wave"]);
  assert.deepEqual(delayed.runtime.getDurableState().library.completedArticleIds,[],"No durable success while the actual write is awaiting confirmation");
  release();assert((await pending).ok);assert.deepEqual(delayed.runtime.getDurableState().library.completedArticleIds,["wave"]);
  const h=harness(baseline);
  const first=h.controller.set({kind:"bookmark",id:"wave",enabled:true});assert(first);assert(h.controller.getSnapshot().busy);assert.equal(h.controller.set({kind:"bookmark",id:"wave",enabled:true}),null,"Busy closes synchronous double callback window");
  assert((await first).ok);assert.deepEqual(h.runtime.getDurableState().library.bookmarkedArticleIds,["wave"]);
  const afterBookmark=h.runtime.getDurableState();assert.equal(setLibraryArticleState(afterBookmark,"bookmark","wave",true),afterBookmark,"Explicit setters are idempotent");
  assert((await h.controller.set({kind:"completion",id:"wave",enabled:true}))?.ok);
  const reopened=await h.persistence.load();assert(reopened.status==="success");assert.deepEqual(reopened.state,{...baseline,library:{bookmarkedArticleIds:["wave"],completedArticleIds:["wave"]}},"Restart preserves all unrelated facts and exactly two ID choices");
  assert((await h.controller.set({kind:"completion",id:"wave",enabled:false}))?.ok);
  assert((await h.controller.set({kind:"bookmark",id:"wave",enabled:false}))?.ok);assert.deepEqual(h.runtime.getDurableState(),baseline);
  for(const after of [false,true]) {
    const f=harness(baseline);f.storage.fail=!after;f.storage.failAfter=after;
    const result=await f.controller.set({kind:"completion",id:"wave",enabled:true});assert(result && !result.ok && result.retryable);
    assert.deepEqual(f.runtime.getDurableState(),baseline,"Failed receipt cannot show durable completion");assert.deepEqual(f.runtime.getState().library.completedArticleIds,["wave"]);
    assert(getBloomPersistenceRecovery(f.controller.getSnapshot(),f.runtime.getState(),f.runtime.getDurableState()).navigationBlocked);
    assert.equal(f.controller.set({kind:"bookmark",id:"pe",enabled:true}),null);
    f.storage.fail=false;f.storage.failAfter=false;assert((await f.controller.retry())?.ok);
    assert.deepEqual(f.runtime.getDurableState().library.completedArticleIds,["wave"],"Retry before/after actual write never toggles or duplicates");
  }
  const ids=normalizeLibraryState({bookmarkedArticleIds:["removed","wave","wave"],completedArticleIds:["removed"]});
  assert.deepEqual(ids.bookmarkedArticleIds,["removed","wave"]);
  const unknown=harness({...baseline,library:ids});assert((await unknown.controller.set({kind:"bookmark",id:"removed",enabled:false}))?.ok);
  assert.throws(()=>setLibraryArticleState(baseline,"completion","removed",true));
  const unknownLoad=await unknown.persistence.load();assert(unknownLoad.status==="success");assert.deepEqual(unknownLoad.state.library.completedArticleIds,["removed"],"Unknown IDs survive until explicitly removed, never synthesize content");
  for(const library of [null,{completedArticleIds:[]}, {bookmarkedArticleIds:[4],completedArticleIds:[]},{bookmarkedArticleIds:[" "],completedArticleIds:[]}]) {
    const s=new Storage(),broken=JSON.stringify({version:9,savedAt:now().toISOString(),state:{...baseline,library}});s.values.set(BLOOM_STATE_STORAGE_KEY,broken);
    assert.equal((await createBloomStatePersistenceCoordinator(s,now).load()).status,"corrupt");assert.equal(s.values.get(BLOOM_STATE_STORAGE_KEY),broken);assert([...s.values.keys()].some(key=>key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX)));
  }
  const invalidated=harness(baseline);invalidated.storage.fail=true;
  assert((await invalidated.controller.set({kind:"bookmark",id:"wave",enabled:true}))?.ok===false);
  invalidated.runtime.beginDeletion();invalidated.runtime.completeDeletion(createDefaultBloomState());invalidated.runtime.finishResetNavigation();invalidated.storage.fail=false;
  const obsolete=await invalidated.controller.retry();assert(obsolete && !obsolete.ok && !obsolete.retryable);
  assert((await invalidated.controller.confirm())?.ok);assert.deepEqual(invalidated.runtime.getDurableState(),createDefaultBloomState(),"An obsolete receipt cannot resurrect deleted choices");
  const source=readFileSync("src/features/library/screens/LibraryArticleScreen.tsx","utf8");
  assert(!/WebView|AsyncStorage|routes\.arousalControl/.test(source));
  assert(!JSON.stringify(libraryArticles).includes("Pratik sekmesi"));
  console.log("Library passed: HTML inventory with one explicit navigation-wording correction; 6 categories/12 articles/next/unknown routes; additive v8 acknowledged normalization + failed rewrite; retained v7 migration/failed migration; bookmark/read/reversal/restart with all slices preserved; synchronous duplicates; failures before/after write + original retry; unknown IDs; corrupt payload retention; obsolete tokens/deletion; explicit completion only.");
}
void verify().catch(error=>{console.error(error);process.exitCode=1;});
