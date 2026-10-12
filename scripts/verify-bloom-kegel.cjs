const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const root = resolve(__dirname, "..");
function evaluate(file, imports = {}, globals = {}) {
  const source = readFileSync(resolve(root, file), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  runInNewContext(compiled.outputText, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, ...globals }, { filename: file });
  return module.exports;
}
const config = evaluate("src/features/kegel/kegelConfig.ts");
const session = evaluate("src/features/kegel/kegelSession.ts", { "./kegelConfig": config });
const frame = session.getKegelFrame;
assert.equal(frame(-100).phase, "countdown");
assert.equal(frame(2999).secondsLeft, 1);
assert.equal(frame(3000).phase, "contract");
assert.equal(frame(5999).phase, "contract");
assert.equal(frame(6000).phase, "relax");
assert.equal(frame(6000).progress, 1);
assert.equal(frame(9000).repetition, 2);
assert.equal(frame(62999).phase, "relax", "Final relaxation must finish before completion");
assert.equal(frame(63000).phase, "completed");
assert.equal(frame(999999).repetition, 10);
const asymmetric = { repetitions: 2, countdownSeconds: 1, contractionSeconds: 2, relaxationSeconds: 4 };
assert.equal(frame(3000, asymmetric).phase, "relax");
assert.equal(frame(7000, asymmetric).repetition, 2);
assert.equal(frame(13000, asymmetric).phase, "completed");
const empty = session.createKegelPreviewData("empty");
for (const key of ["streak", "total", "week", "heat"]) assert.equal(empty[key], null);
assert.equal(session.createKegelPreviewData("design").kind, "design");
assert.notEqual(session.createKegelPreviewData("design"), session.createKegelPreviewData("design"));

for (const dev of [false, true]) for (const e2e of [false, true]) for (const bundle of [undefined, "com.umutcyilmaz.bloom", "com.umutcyilmaz.bloom.e2e"]) for (const flag of [undefined, "1", "true"]) {
  const mode = evaluate("src/features/kegel/kegelPreviewMode.ts", {
    "expo-constants": { default: { expoConfig: { ios: { bundleIdentifier: bundle } } } },
    "../../shared/runtime/e2eMode": { isE2EMode: e2e }
  }, { __DEV__: dev, process: { env: { EXPO_PUBLIC_KEGEL_PREVIEW: flag } } });
  assert.equal(mode.kegelPreviewEnabled, dev && e2e && bundle === "com.umutcyilmaz.bloom.e2e" && flag === "1");
}

// Execute the real hook with a deterministic monotonic clock and effect cleanup.
let now = 0, cursor = 0, pending = [], states = [], refs = [], effects = [], intervals = new Map(), nextId = 0, completed = 0, appStateListener;
const react = {
  useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return refs[i] ?? (refs[i] = { current: initial }); },
  useEffect(fn, deps) { const i = cursor++; const old = effects[i]; if (!old || deps.some((d, n) => d !== old.deps[n])) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); }
};
const { useKegelExercise } = evaluate("src/features/kegel/useKegelExercise.ts", {
  "./kegelConfig": config,
  react, "./kegelSession": session, "react-native": { AppState: { addEventListener(_, fn) { appStateListener = fn; return { remove() { appStateListener = undefined; } }; } } }
}, { performance: { now: () => now }, setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id) });
let completedMetrics;
const render = () => { cursor = 0; const value = useKegelExercise(metrics => {completed++;completedMetrics=metrics;}); const work = pending; pending = []; work.forEach(fn => fn()); return value; };
const tick = delta => { now += delta; [...intervals.values()].forEach(fn => fn()); return render(); };
let exercise = render();
exercise = tick(4200); assert.equal(exercise.frame.secondsLeft, 2);
exercise.pause(); exercise = render();
const pausedFrame = JSON.stringify(exercise.frame);
exercise = tick(20000); assert.equal(JSON.stringify(exercise.frame), pausedFrame);
exercise.resume(); exercise = render(); exercise = tick(1800);
assert.equal(exercise.frame.phase, "relax");assert.equal(exercise.frame.secondsLeft, 3);
appStateListener("background");exercise = render();assert.equal(exercise.paused, true);
tick(90000);assert.equal(completed, 0);
exercise.resume();render();tick(57000);assert.equal(completed, 1);
tick(10000);assert.equal(completed, 1, "Completion must fire once");
assert.equal(completedMetrics.activeExerciseSeconds,60);assert.equal(completedMetrics.pausedSeconds,110);assert.equal(completedMetrics.elapsedSeconds,173);assert.equal(completedMetrics.pauseCount,2);
effects.forEach(effect => effect?.cleanup?.());assert.equal(intervals.size, 0);assert.equal(appStateListener, undefined);

const runtime = readFileSync(resolve(root, "src/features/kegel/kegelPreviewRuntime.ts"), "utf8");
assert(runtime.includes("createMemoryStorageClient()"));assert(!runtime.includes("storageClient"));
console.log("Kegel verification passed: timing boundaries, final relaxation, asymmetric editable config, truthful empty state, 36 preview guards, real-hook pause/resume/background/once-only completion and cleanup, memory-only runtime.");

const fakeStorage={getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{},getAllKeys:async()=>[]};
for(const dev of [false,true]) for(const e2e of [false,true]) for(const bundle of [undefined,"com.umutcyilmaz.bloom","com.umutcyilmaz.bloom.e2e"]) for(const flag of [undefined,"1","true"]) for(const run of [undefined,"short","../escape","qa_20261012_unique"]) {
  const qa=evaluate("src/features/kegel/kegelPersistenceQa.ts",{
    "expo-constants":{default:{expoConfig:{ios:{bundleIdentifier:bundle}}}},"../../shared/runtime/e2eMode":{isE2EMode:e2e},
    "./kegelPreviewMode":{resolveKegelPreviewEnabled:(d,e,b,f)=>d&&e&&b==="com.umutcyilmaz.bloom.e2e"&&f==="1"},
    "../../storage/storageClient":{storageClient:fakeStorage},"../../storage/bloomStatePersistence":{createBloomStatePersistenceCoordinator:()=>({})}
  },{__DEV__:dev,process:{env:{EXPO_PUBLIC_KEGEL_PERSISTENCE_QA:flag,EXPO_PUBLIC_KEGEL_QA_RUN:run}}});
  assert.equal(qa.kegelPersistenceQaEnabled,dev&&e2e&&bundle==="com.umutcyilmaz.bloom.e2e"&&flag==="1"&&run==="qa_20261012_unique");
}
console.log("Kegel durable-QA guard verification passed (144 combinations, explicit unique namespace required).");

const realRoute=readFileSync(resolve(root,"app/bloom/kegel.tsx"),"utf8");
assert(realRoute.includes('if (kegelPreviewEnabled && !kegelPersistenceQaEnabled) return <Redirect href={routes.home} />;'));
assert(!realRoute.includes('href="/debug/kegel"'));
assert(readFileSync(resolve(root,"app/debug/kegel-persistence.tsx"),"utf8").includes('kegelPersistenceQaEnabled ? <KegelFeatureScreen qa /> : <Redirect href="/" />'));
console.log("Kegel route isolation passed: memory design builds cannot claim durable saves; guarded durable QA entry.");

const {validKegelQaRun}=require("./require-kegel-qa-run.cjs");
for(const run of [undefined,"","short","../escape","qa_20261012_unique","a".repeat(80),"a".repeat(81)]) {
  assert.equal(validKegelQaRun(run),typeof run==="string"&&run.length>=8&&run.length<=80&&/^[a-zA-Z0-9_-]+$/.test(run));
}
assert(require("node:child_process").spawnSync(process.execPath,[resolve(root,"scripts/require-kegel-qa-run.cjs")],{env:{...process.env,EXPO_PUBLIC_KEGEL_QA_RUN:""}}).status===1);
console.log("Kegel QA startup fails closed before Expo when the isolated run name is missing/invalid.");

// Execute the real completion component: exercise completion is distinct from
// durable-save confirmation, and the existing dismiss conditions stay intact.
const jsx=(type,props,key)=>({type,props,key});
function nodes(tree) {
  if(Array.isArray(tree)) return tree.flatMap(nodes);
  if(!tree || typeof tree!=="object" || !tree.props) return [];
  if(typeof tree.type==="function") return nodes(tree.type(tree.props));
  return [tree,...nodes(tree.props.children)];
}
function textOf(tree) {
  if(typeof tree==="string" || typeof tree==="number") return String(tree);
  if(Array.isArray(tree)) return tree.map(textOf).join("");
  return tree?.props ? textOf(tree.props.children) : "";
}
const {KegelCompletionScreen}=evaluate("src/features/kegel/screens/KegelCompletionScreen.tsx",{
  react:{useState:value=>[value,()=>{}],useEffect:()=>{}},
  "react/jsx-runtime":{jsx,jsxs:jsx},
  "react-native":{View:"View",StyleSheet:{create:value=>value}},
  "react-native-reanimated":{default:{View:"AnimatedView"},useReducedMotion:()=>true,
    useSharedValue:value=>({value}),useAnimatedStyle:fn=>fn(),withDelay:(_,value)=>value,withSpring:value=>value,withTiming:value=>value},
  "../../../shared/components/v4/AppScreen":{AppScreen:"AppScreen"},
  "../../../shared/components/v4/AppText":{AppText:"AppText"},
  "../kegelConfig":config,"../kegelTheme":{kegelColors:{}},
  "../components/KegelUI":{KegelButton:"KegelButton",KegelCard:"KegelCard",kegelStyles:{}},
  "../components/KegelVisuals":{KegelGlow:"KegelGlow",KegelMetrics:"KegelMetrics",KegelRing:"KegelRing",KegelSymbol:"KegelSymbol"}
});
for(const status of ["saving","failed","saved",undefined]) {
  const tree=KegelCompletionScreen({fromRun:true,session:{program:config.kegelConfig},saveStatus:status,onDone:()=>{}});
  const entries=nodes(tree),note=entries.find(n=>n.props.testID==="kegel.completed.save-note");
  const noteText=textOf(note),done=entries.find(n=>n.props.testID==="kegel.completed.done");
  assert(!noteText.includes("Kaydedilmeyen deneme"),"A real session must never be labeled an unsaved preview");
  assert(noteText.includes(status==="saved" ? "Kaydedilen set" : status==="saving" ? "Kaydediliyor…" : "Kaydetme doğrulanmadı"));
  assert.equal(done.props.disabled,status!=="saved","Existing save-confirmation dismissal guard must remain intact");
  if(status!=="saved") assert(!noteText.includes("etkinliğine dahil edildi"));
}
for(const fromRun of [false,true]) {
  const tree=KegelCompletionScreen({fromRun,onDone:()=>{}}),entries=nodes(tree);
  assert(textOf(entries.find(n=>n.props.testID==="kegel.completed.save-note")).includes("Kaydedilmeyen deneme"));
  assert.equal(entries.find(n=>n.props.testID==="kegel.completed.done").props.disabled,false);
}
const dismissed=nodes(KegelCompletionScreen({fromRun:true,session:{program:config.kegelConfig},saveStatus:"failed",allowDismiss:true,onDone:()=>{}}));
assert.equal(dismissed.find(n=>n.props.testID==="kegel.completed.done").props.label,"Kaydetmeden dön");
assert.equal(dismissed.find(n=>n.props.testID==="kegel.completed.done").props.disabled,false);

// Controlled hook harness around the real feature and persistence controller.
// Storage/receipts are deferred here; durable failure/retry is separately covered
// by verify:kegel:persistence using the actual coordinator and mutation runtime.
const controllerModule=evaluate("src/features/kegel/kegelPersistenceController.ts");
const summaryModule=evaluate("src/features/kegel/kegelSummary.ts");
const recoveryModule=evaluate("src/shared/navigation/bloomPersistenceRecovery.ts");
function introHarness() {
  let accepted={kegel:{onboardingCompletedAt:null,sessions:[]}},durable=accepted,resolveSave;
  let submits=0,retries=0,randomCalls=0,index=0,dirty=false,work=[],tree;
  const values=[],effectValues=[];
  const changed=(previous,deps)=>!previous || deps.some((value,i)=>value!==previous[i]);
  const hooks={
    useState(initial){const i=index++;if(!(i in values)) values[i]=typeof initial==="function" ? initial() : initial;
      return [values[i],value=>{const next=typeof value==="function" ? value(values[i]) : value;if(!Object.is(next,values[i])){values[i]=next;dirty=true;}}];},
    useRef(initial){const i=index++;return values[i] ?? (values[i]={current:initial});},
    useMemo(fn,deps){const i=index++;if(changed(values[i]?.deps,deps)) values[i]={deps,value:fn()};return values[i].value;},
    useEffect(fn,deps){const i=index++;if(changed(effectValues[i]?.deps,deps)) work.push(()=>{effectValues[i]?.cleanup?.();effectValues[i]={deps,fn,cleanup:fn()};});},
    useSyncExternalStore:(_,getSnapshot)=>getSnapshot()
  };
  const actions={kegel:{completeOnboarding:completedAt=>{
    submits++;accepted={...durable,kegel:{...durable.kegel,onboardingCompletedAt:completedAt}};
    return new Promise(resolve=>{resolveSave=resolve;});
  }}};
  const bloom={productActions:actions,get state(){return accepted;},get durableState(){return durable;},hasHydrated:true,
    now:()=>new Date("2026-10-12T12:00:00.000Z"),getAcceptedState:()=>accepted,getDurableState:()=>durable,
    retryPersistedMutation:()=>{retries++;return new Promise(resolve=>{resolveSave=resolve;});},
    confirmCurrentPersistence:async()=>{durable=accepted;return {ok:true};}};
  const screenImports={react:hooks,"react/jsx-runtime":{jsx,jsxs:jsx},"expo-router":{useRouter:()=>({})},
    "expo-status-bar":{StatusBar:"StatusBar"},"react-native":{View:"View"},
    "../../../app/providers/BloomLocalStateProvider":{useBloomLocalState:()=>bloom},
    "../../../shared/components/v4/AppText":{AppText:"AppText"},
    "../../../shared/navigation/usePersistenceNavigationGuard":{usePersistenceNavigationGuard:()=>()=>{}},
    "../../../shared/navigation/bloomPersistenceRecovery":recoveryModule,
    "../../../shared/navigation/BloomBottomNavigation":{BloomBottomNavigation:"BloomBottomNavigation"},
    "../kegelConfig":config,"../kegelPersistenceController":controllerModule,
    "../kegelPersistenceQa":{kegelPersistenceQaEnabled:false},"../kegelSummary":summaryModule,"../kegelSession":session,
    "../kegelTheme":{kegelColors:{}},"../components/KegelUI":{KegelButton:"KegelButton"}};
  for(const name of ["KegelHomeScreen","KegelIntroScreen","KegelExerciseScreen","KegelCompletionScreen"]) screenImports[`./${name}`]={[name]:name};
  const {KegelFeatureScreen}=evaluate("src/features/kegel/screens/KegelFeatureScreen.tsx",screenImports,
    {setInterval:()=>1,clearInterval:()=>{},Math:Object.assign(Object.create(Math),{random:()=>{randomCalls++;return randomCalls/100;}})});
  const render=()=>{let turns=0;do{assert(++turns<20,"Feature should settle without repeated automatic starts");dirty=false;index=0;
    tree=KegelFeatureScreen({});const next=work;work=[];next.forEach(fn=>fn());}while(dirty);return tree;};
  return {render,find:type=>nodes(tree).find(n=>n.type===type),id:id=>nodes(tree).find(n=>n.props.testID===id),
    complete:ok=>{assert(resolveSave);if(ok) durable=accepted;const resolve=resolveSave;resolveSave=null;
      resolve(ok ? {ok:true,accepted:true} : {ok:false,accepted:true,retryable:true,retryToken:{}});},
    replayEffects:()=>{effectValues.forEach(effect=>{effect?.cleanup?.();if(effect) effect.cleanup=effect.fn();});},
    counts:()=>({submits,retries,randomCalls,sessions:durable.kegel.sessions.length})};
}
async function verifyIntroTransition() {
  const flush=async()=>{for(let i=0;i<8;i++) await Promise.resolve();};
  for(const failFirst of [false,true]) {
    const h=introHarness();h.render();h.find("KegelHomeScreen").props.onIntro();h.render();
    const finish=h.find("KegelIntroScreen").props.onFinish;
    finish();finish();await flush();h.render();
    assert.equal(h.counts().submits,1,"Double taps must share the existing onboarding save");
    assert.equal(h.find("KegelIntroScreen").props.finishBusy,true);
    assert(!h.find("KegelExerciseScreen"),"Accepted or pending onboarding must not start an exercise");
    if(failFirst) {
      h.complete(false);await flush();h.render();
      h.find("KegelIntroScreen").props.onClose();h.render();
      assert(h.find("KegelIntroScreen") && !h.find("KegelExerciseScreen"),"Existing failed-save navigation guard must remain intact");
      h.id("kegel.save.retry").props.onPress();await flush();h.render();
      assert(!h.find("KegelExerciseScreen"),"Pending retry must not start an exercise");
    }
    h.complete(true);await flush();h.render();
    const exercise=h.find("KegelExerciseScreen");assert(exercise,"Durable onboarding confirmation must open the first real exercise");
    assert.equal(h.counts().randomCalls,2,"Exactly one exercise identity is created after confirmation");
    h.replayEffects();h.render();assert.equal(h.find("KegelExerciseScreen").key,exercise.key,"Effect replay must not recreate the exercise");
    exercise.props.onExit();h.render();assert.equal(h.counts().sessions,0,"Cancelling the first exercise must not save a completion");
    h.find("KegelHomeScreen").props.onIntro();h.render();
    assert(h.find("KegelIntroScreen") && !h.find("KegelExerciseScreen"),"An old receipt must not auto-start a revisited introduction");
    h.find("KegelIntroScreen").props.onFinish();h.render();assert(h.find("KegelExerciseScreen"));
    assert.equal(h.counts().submits,1,"Already durable onboarding must not be saved again");
    assert.equal(h.counts().retries,failFirst ? 1 : 0);
  }
  console.log("Kegel final UX verification passed: four truthful completion states, unchanged dismiss/retry guards, durable-only first exercise, failed onboarding + retry, double taps, effect replay, cancellation and revisited technique.");
}
void verifyIntroTransition().catch(error=>{console.error(error);process.exitCode=1;});
