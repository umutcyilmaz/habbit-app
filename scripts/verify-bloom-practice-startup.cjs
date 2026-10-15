// Real parent + preview + temporary runtime + persistence controller. Deferred
// acknowledgement and explicit AppState events select the interleaving; no sleep.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const jsx=(type,props)=>({type,props:props||{}});
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):t.type==='Modal'&&!t.props.visible?[]:[t,...nodes(t.props.children)];
function evaluate(file,imports,extra={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{assert(n in imports,`Unexpected import ${n}`);return imports[n];},...extra});return module.exports;}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function hooks(){let cursor=0;const values=[],effects=[],pending=[];return {values,begin(){cursor=0;},flush(){pending.splice(0).forEach(f=>f());},dispose(){effects.forEach(e=>e?.cleanup?.());},api:{
 useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},
 useRef(initial){const i=cursor++;return values[i]??(values[i]={current:initial});},
 useMemo(fn,deps){const i=cursor++;if(!values[i]||deps.some((d,k)=>!Object.is(d,values[i].deps[k])))values[i]={deps,value:fn()};return values[i].value;},
 useSyncExternalStore(sub,get){cursor++;return get();},
 useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||!deps||deps.some((d,k)=>!Object.is(d,old.deps?.[k])))pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}
}};}
const sessions=evaluate('src/features/practice/practiceSession.ts',{});
const policy=evaluate('src/domain/productPolicy/getPracticeAvailability.ts',{'../contentFree/getResetContentFreeCredit':{canOfferResetContentFreeContinuation:()=>false}});
const controllers=evaluate('src/features/practice/practicePersistenceController.ts',{
 '../../domain/models/PracticeState':{PRACTICE_INTRO_VERSION:1},'../../storage/bloomPracticeSchema':{normalizeCompletedPracticeSession:r=>({...r}),practicePayloadEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},'../../domain/productPolicy/getPracticeAvailability':policy
});
function harness(){
 const parent=hooks(),preview=hooks(),ack=deferred(),entered=deferred(),listeners=new Set(),timers=new Set(),startPromises=[];
 let clock=0,durable={resetJourney:{status:'inactive'},practice:{introduction:null,sessions:[]}},accepted=durable,ready=true,writes=0,saveWrites=0,actualStarts=0,runtimeStartAt=null,session,beforeCommit,afterStart,onAcknowledged;
 const app={currentState:'active',addEventListener(_,f){listeners.add(f);return {remove:()=>listeners.delete(f)};}};
 const bloom={get state(){return accepted;},get durableState(){return durable;},getAcceptedState:()=>accepted,getDurableState:()=>durable,getPracticeAvailability:()=>policy.getPracticeAvailability(durable,ready,accepted),now:()=>new Date(Date.UTC(2026,9,15,12)+clock),retryPersistedMutation:async()=>{throw Error('Unexpected retry');},confirmCurrentPersistence:async()=>{throw Error('Unexpected confirm');},productActions:{practice:{
  async acknowledgeIntroduction(input){writes++;entered.resolve();await ack.promise;durable={...durable,practice:{...durable.practice,introduction:input}};accepted=durable;onAcknowledged?.();return {ok:true,accepted:true};},
  async saveCompletedSession(record){saveWrites++;durable={...durable,practice:{...durable.practice,sessions:[...durable.practice.sessions,record]}};accepted=durable;return {ok:true,accepted:true};}
 }}};
 const common={'react/jsx-runtime':{jsx,jsxs:jsx},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:62,bottom:34})},'./PracticeText':{PracticeText:'Text'},'./PracticeButton':{PracticeButton:'Button'}};
 const router={replace(){}},navigation={setOptions(){}};
 const {PracticeFeatureScreen}=evaluate('src/features/practice/PracticeFeatureScreen.tsx',{...common,react:parent.api,'expo-router':{useRouter:()=>router},'react-native':{AppState:app,ScrollView:'ScrollView',View:'View'},'../../app/providers/BloomLocalStateProvider':{useBloomLocalState:()=>bloom},'../../domain/models/PracticeState':{PRACTICE_INTRO_VERSION:1},'../../shared/navigation/bloomPersistenceRecovery':{getBloomPersistenceRecovery:op=>({navigationBlocked:op.busy||op.locked&&!op.result?.ok})},'./PracticePreviewScreen':{PracticePreviewScreen:'Preview'},'./practicePersistenceController':controllers});
 const {PracticePreviewScreen}=evaluate('src/features/practice/PracticePreviewScreen.tsx',{...common,react:preview.api,'@react-navigation/native':{usePreventRemove(){}},'expo-router':{useNavigation:()=>navigation,useRouter:()=>router},'react-native':{AppState:app,AccessibilityInfo:{announceForAccessibility(){}},BackHandler:{addEventListener:()=>({remove(){}})},Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:x=>x},View:'View',useWindowDimensions:()=>({width:402,height:874,fontScale:1})},'react-native-reanimated':{default:{View:'AnimatedView'},useReducedMotion:()=>false,FadeInDown:{duration:()=>({}),delay:()=>({duration:()=>({})})}},'./practiceSession':{...sessions,createPracticeSession:now=>{
  session=sessions.createPracticeSession(now);const start=session.start;session.start=()=>{const before=session.getSnapshot().phase;start();if(before==='intro'&&session.getSnapshot().phase==='running'){actualStarts++;runtimeStartAt=bloom.now().toISOString();afterStart?.();}};return session;
 }},'./practiceTypography':evaluate('src/features/practice/practiceTypography.ts',{}),'../kegel/components/KegelUI':{KegelBack:'Back',KegelCard:'Card'},'./PracticeVisuals':{PracticeCheck:'Check',PracticeCurve:'Curve',PracticeOrb:'Orb',PracticeRule:'Rule',PracticeHint:'Hint'},'../kegel/kegelTheme':{kegelColors:{}}},{performance:{now:()=>clock},setInterval:f=>{timers.add(f);return f;},clearInterval:f=>timers.delete(f)});
 let controls,tree;
 function render(){parent.begin();const p=nodes(PracticeFeatureScreen()).find(n=>n.type==='Preview');parent.flush();if(!p)return;controls=p.props.production;preview.begin();tree=nodes(PracticePreviewScreen({production:{...controls,onStart:begin=>{const promise=controls.onStart(()=>{beforeCommit?.();return begin();});startPromises.push(promise);return promise;}}}));preview.flush();return tree;}
 function button(id){render();const n=tree.find(n=>n.props.testID==='practice.'+id);assert(n,`Missing ${id}`);return n;}
 function press(id){const n=button(id);assert(!n.props.disabled,`Disabled ${id}`);n.props.onPress();render();}
 function background(){app.currentState='inactive';listeners.forEach(f=>f('inactive'));}
 function foreground(){app.currentState='active';listeners.forEach(f=>f('active'));}
 function confirm(){press('start');press('start.confirm');return startPromises.at(-1);}
 function snapshot(){return session.getSnapshot();}
 function run(){return parent.values.find(v=>v?.current?.startedAt)?.current??null;}
 function dispose(){parent.dispose();preview.dispose();}
 render();return {ack,entered,render,button,press,confirm,background,foreground,snapshot,run,dispose,
  get session(){return session;},get starts(){return actualStarts;},get writes(){return writes;},get saveWrites(){return saveWrites;},get records(){return durable.practice.sessions;},get timers(){return timers.size;},get runtimeStartAt(){return runtimeStartAt;},get startsPending(){return startPromises;},get controls(){return controls;},
  advance(ms){clock+=ms;},tick(){timers.forEach(f=>f());session.tick();},beforeCommit(fn){beforeCommit=fn;},afterStart(fn){afterStart=fn;},onAcknowledged(fn){onAcknowledged=fn;},block(){ready=false;},
  async release(){ack.resolve();return startPromises[0];}
 };
}
async function verify(){
 // A stale active-screen handler fired after the app has already left foreground.
 const before=harness();before.press('start');const stale=before.button('start.confirm').props.onPress;before.background();stale();await before.startsPending[0];before.render();assert.equal(before.writes,0);assert.equal(before.starts,0);assert.equal(before.timers,0);assert.equal(before.run(),null);
 before.foreground();before.advance(3000);const retryBefore=before.confirm();await before.entered.promise;before.ack.resolve();assert(await retryBefore);assert.equal(before.writes,1);assert.equal(before.starts,1);assert.equal(before.run().startedAt,before.runtimeStartAt);before.dispose();
 // Background while the actual introduction write is pending. Durable success
 // must not reserve a run. Returning alone never starts a timer.
 const during=harness();const pending=during.confirm();await during.entered.promise;during.advance(50);during.background();during.advance(60000);during.ack.resolve();assert.equal(await pending,false);during.render();assert.equal(during.writes,1);assert.equal(during.starts,0);assert.equal(during.run(),null);assert.equal(during.timers,0);
 during.foreground();during.render();assert.equal(during.starts,0);during.advance(5000);assert(await during.confirm());during.render();assert.equal(during.writes,1,'An acknowledged introduction is not written twice');assert.equal(during.starts,1);assert.equal(during.run().startedAt,during.runtimeStartAt);assert.notEqual(during.run().startedAt,'2026-10-15T12:00:00.000Z');
 assert.equal(await during.controls.onStart(()=>{throw Error('Duplicate runtime start');}),false,'A stale parent closure is locked synchronously by the real run ref');
 during.session.finish();during.session.next(0,true);during.session.next(1,true);during.session.next(2,true);during.render();const saved=during.snapshot();during.controls.onSave(saved);during.controls.onSave(saved);await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(during.saveWrites,1);assert.equal(during.records.length,1);assert.equal(during.records[0].startedAt,during.runtimeStartAt);during.dispose();
 // The durable ACK result has been produced, but its consumer has not yet
 // resumed. Backgrounding at this exact result boundary must remain retryable.
 const delivered=harness();delivered.onAcknowledged(()=>delivered.background());const deliveredPending=delivered.confirm();await delivered.entered.promise;delivered.ack.resolve();assert.equal(await deliveredPending,false);delivered.render();assert.equal(delivered.starts,0);assert.equal(delivered.run(),null);assert.equal(delivered.timers,0);delivered.onAcknowledged(undefined);delivered.foreground();assert(await delivered.confirm());assert.equal(delivered.writes,1);assert.equal(delivered.starts,1);delivered.dispose();
 // The callback boundary itself rejects a no-longer-active preview, before any
 // parent run/time is recorded. This deliberately closes the former gap.
 const boundary=harness();boundary.beforeCommit(()=>boundary.background());const boundaryPending=boundary.confirm();await boundary.entered.promise;boundary.ack.resolve();assert.equal(await boundaryPending,false);assert.equal(boundary.starts,0);assert.equal(boundary.run(),null);boundary.beforeCommit(undefined);boundary.foreground();assert(await boundary.confirm());assert.equal(boundary.starts,1);assert.equal(boundary.writes,1);boundary.dispose();
 // Immediately after acknowledgement/runtime start, before the parent promise
 // continuation or React render: AppState settles and freezes the actual timer.
 const after=harness();after.afterStart(()=>after.background());const afterPending=after.confirm();await after.entered.promise;after.ack.resolve();assert(await afterPending);after.render();assert.equal(after.starts,1);assert(after.snapshot().background);assert.equal(after.timers,0);const elapsed=after.snapshot().elapsedMs;after.advance(60000);after.tick();assert.equal(after.snapshot().elapsedMs,elapsed);after.foreground();after.render();assert.equal(after.timers,0);after.advance(400);after.press('foreground');assert.equal(after.timers,1);after.advance(1000);after.tick();assert.equal(after.snapshot().elapsedMs,elapsed+1000);assert.equal(after.writes,1);assert.equal(after.starts,1);after.dispose();assert.equal(after.timers,0);
 // Promise success followed by inactivity before a consumer can use it cannot
 // leave an intro marked started: the runtime already exists and is suspended.
 const result=harness();const resultPending=result.confirm();await result.entered.promise;result.ack.resolve();assert(await resultPending);result.background();result.render();assert.equal(result.snapshot().phase,'running');assert(result.snapshot().background);assert(result.run());assert.equal(result.timers,0);result.dispose();
 const rapid=harness();rapid.press('start');const same=rapid.button('start.confirm').props.onPress;same();same();await rapid.entered.promise;rapid.ack.resolve();await Promise.all(rapid.startsPending);rapid.render();assert.equal(rapid.writes,1);assert.equal(rapid.starts,1);rapid.dispose();
 const unmounted=harness();const late=unmounted.confirm();await unmounted.entered.promise;unmounted.dispose();unmounted.ack.resolve();assert.equal(await late,false);assert.equal(unmounted.starts,0);assert.equal(unmounted.run(),null);assert.equal(unmounted.timers,0);
 const blocked=harness();const guarded=blocked.confirm();await blocked.entered.promise;blocked.block();blocked.ack.resolve();assert.equal(await guarded,false);assert.equal(blocked.starts,0);assert.equal(blocked.run(),null);blocked.dispose();
 console.log('Practice startup lifecycle passed: real parent/preview/session/controller; inactive before ACK, during write, commit boundary and immediately after ACK/start; explicit foreground restart/resume; exact startedAt; one intro write/runtime/record/ID; rapid/stale/unmount/current-read guards. No sleeps or arbitrary timeouts.');
}
let completed=false;
process.on('beforeExit',()=>{if(!completed){console.error('Practice startup harness did not finish its controlled acknowledgement steps.');process.exitCode=1;}});
verify().then(()=>{completed=true;},error=>{completed=true;console.error(error);process.exitCode=1;});
