// Execute the real timer, screen handlers and animation effects with controlled
// hooks/clock/AppState. Native pixels are checked separately in Simulator.
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const previewBase = 'src/features/urge-control/preview/';
const exerciseBase = 'src/features/urge-control/exercise/';
function evaluate(file, imports = {}, extra = {}) {
  const module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module,exports:module.exports,require:name=>{assert(name in imports,`Unexpected import: ${name}`);return imports[name];},...extra});
  return module.exports;
}
const model = evaluate(exerciseBase+'urgeExerciseTimer.ts');
let now = 100, timer = model.createUrgeExerciseTimer(()=>now);
assert.equal(timer.getSnapshot().phase,'ready');
timer.start(); assert.equal(timer.getSnapshot().phase,'ready','Unmounted handlers cannot start');
timer.activate();
for(const duration of [5,10,15,20]) { timer.select(duration); assert.equal(timer.getSnapshot().durationMs,duration*60000); }
for(const invalid of [0,2,7,60,NaN,Infinity]) timer.select(invalid);
assert.equal(timer.getSnapshot().durationMs,1200000);
timer.select(5); timer.start(); now+=1500; timer.start(); timer.tick();
assert.equal(timer.getSnapshot().elapsedMs,1500,'Repeated start cannot reset the anchor');
for(let n=0;n<100;n++)timer.tick(); assert.equal(timer.getSnapshot().elapsedMs,1500,'Tick frequency does not add time');
timer.select(20); assert.equal(timer.getSnapshot().durationMs,300000);
now+=250; timer.pause(); const paused=timer.getSnapshot().elapsedMs;
now+=600000; timer.pause(); timer.tick(); assert.equal(timer.getSnapshot().elapsedMs,paused);
timer.resume(); timer.resume(); now+=2000; timer.tick(); assert.equal(timer.getSnapshot().elapsedMs,paused+2000);
timer.setForeground(false); const frozen=timer.getSnapshot().elapsedMs;
now+=3600000; timer.resume();timer.tick();assert.equal(timer.getSnapshot().elapsedMs,frozen);
timer.setForeground(true); timer.tick(); assert.equal(timer.getSnapshot().phase,'paused','Foreground never auto resumes');
timer.resume(); now+=900; timer.askExit(); const exiting=timer.getSnapshot().elapsedMs;
now+=600000; timer.askExit();timer.resume();timer.tick();assert.equal(timer.getSnapshot().elapsedMs,exiting);
timer.cancelExit();assert.equal(timer.getSnapshot().phase,'paused','Cancel exit does not count unobserved time');
timer.resume();now+=9999999;timer.tick();assert.equal(timer.getSnapshot().phase,'completed');assert.equal(timer.getSnapshot().elapsedMs,300000);
timer.resume();timer.start();assert.equal(timer.getSnapshot().phase,'completed');timer.reset();assert.equal(timer.getSnapshot().phase,'ready');
timer.start();now+=120;timer.dispose();const disposed=timer.getSnapshot().elapsedMs;now+=80000;timer.resume();timer.tick();assert.equal(timer.getSnapshot().elapsedMs,disposed);
timer.activate();assert.equal(timer.getSnapshot().phase,'paused');timer.resume();now+=100;timer.tick();assert.equal(timer.getSnapshot().elapsedMs,disposed+100,'Strict Mode replay excludes detached time');
timer.dispose();
let changes=0;timer=model.createUrgeExerciseTimer(()=>now,{initialDurationMs:2000,allowDurationSelection:false});const unsub=timer.subscribe(()=>changes++);timer.activate();timer.start();now+=2000;timer.tick();timer.tick();assert.equal(changes,2,'Completion publishes once');unsub();timer.reset();assert.equal(changes,2);
assert.equal(model.createUrgeExerciseTimer(()=>now).getSnapshot().elapsedMs,0,'New instance/restart has no draft');
let backward=10;timer=model.createUrgeExerciseTimer(()=>backward);timer.activate();timer.start();backward=1010;timer.tick();backward=1;timer.tick();assert.equal(timer.getSnapshot().elapsedMs,1000,'Clock anomalies cannot reverse time');backward=NaN;timer.tick();assert.equal(timer.getSnapshot().elapsedMs,1000);
for(const [time,phase,expansion] of [[0,'inhale',0],[2000,'inhale',.5],[4000,'hold',1],[7999,'hold',1],[8000,'exhale',1],[11000,'exhale',.5],[14000,'inhale',0]]) { const frame=model.getUrgeExerciseBreath(time);assert.equal(frame.phase,phase);assert.equal(frame.expansion,expansion); }
for(const [ms,text] of [[300000,'05:00'],[299999,'05:00'],[299000,'04:59'],[1,'00:01'],[0,'00:00'],[-1,'00:00']])assert.equal(model.formatUrgeExerciseTime(ms),text);
console.log('Timer: presets, explicit start, monotonic anchors, delayed ticks, pause/resume, background, exit, completion, restart, unmount and 4-4-6 boundaries passed.');

const jsx=(type,props)=>({type,props:props||{}});
function elements(node) { return !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(elements):node.type==='Modal'&&!node.props.visible?[]:[node,...elements(node.props.children)]; }
let cursor,values,effects,pending,intervals,listeners,backListeners,guard,blocked,reduced,focused,viewport,tree,navigations,evaluations,fixture,renderOverrides;
const hooks={
  useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},
  useRef(initial){const i=cursor++;return values[i]??(values[i]={current:initial});},
  useCallback(fn){cursor++;return fn;},
  useSyncExternalStore(sub,get){cursor++;return get();},
  useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||!deps||deps.some((d,k)=>!Object.is(d,old.deps?.[k])))pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}
};
const rn={AccessibilityInfo:{announceForAccessibility:()=>{}},AppState:{currentState:'active',addEventListener:(_,f)=>{listeners.add(f);return {remove:()=>listeners.delete(f)};}},BackHandler:{addEventListener:(_,f)=>{backListeners.add(f);return {remove:()=>backListeners.delete(f)};}},Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:x=>x,flatten:a=>Object.assign({},...a)},useWindowDimensions:()=>viewport};
const navigation={setOptions(){}};
const imports={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':rn,'@react-navigation/native':{useIsFocused:()=>focused,usePreventRemove:(b,f)=>{blocked=b;guard=f;}},'expo-router':{useNavigation:()=>navigation},'expo-status-bar':{StatusBar:'StatusBar'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:62,bottom:34})},'./useUrgeExerciseReducedMotion':{useUrgeExerciseReducedMotion:()=>reduced},'./UrgeExerciseVisuals':{UrgeExerciseAtmosphere:'Atmosphere',UrgeExerciseLCD:'LCD'},'./urgeExerciseTimer':model};
const exercise=evaluate(exerciseBase+'UrgeExercise.tsx',imports,{performance:{now:()=>now},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn)});
function exerciseProps(){return {testIDPrefix:'urge.preview',...(fixture?{initialDurationMs:2000,allowDurationSelection:false,fixtureNotice:'QA: 2 saniyelik bitiş denemesi'}:{allowDurationSelection:true}),notice:'QA önizleme · Kaydedilmez',reducedMotionNotice:'QA · Hareket azaltma açık',closeAccessibilityLabel:'Önizlemeden çık',completionAnnouncement:'Süre doldu. Hiçbir sonuç kaydedilmedi.',completionNote:'Hiçbir sonuç kayda geçmedi.',completionActionLabel:'Önizlemeyi kapat',exitDescription:'Sayaç durdu. Çıkarsan bu önizleme kapanır. Kayıt yok.',exitConfirmLabel:'Çık ve kapat',onExitConfirmed:()=>{assert.equal(blocked,false,'Navigation guard must be released before exit callback');navigations++;}};}
function render(extra){if(extra!==undefined)renderOverrides=extra;cursor=0;tree=elements(exercise.UrgeExercise({...exerciseProps(),...renderOverrides}));pending.splice(0).forEach(fn=>fn());assert(intervals.size<=1,'No duplicated ticker');return tree;}
function fresh(complete=false){cursor=0;values=[];effects=[];pending=[];intervals=new Set();listeners=new Set();backListeners=new Set();navigations=0;evaluations=0;reduced=false;focused=true;fixture=complete;renderOverrides={};viewport={width:402,height:874,fontScale:1};rn.AppState.currentState='active';render();render();}
const node=id=>render().find(n=>n.props.testID==='urge.preview.'+id||n.props.id===id);
function press(id,advance=400){now+=advance;const n=node(id);assert(n,`Missing control ${id}`);n.props.onPress();render();render();}
function appState(status){rn.AppState.currentState=status;[...listeners].forEach(fn=>fn(status));render();}
function cleanup(){effects.forEach(e=>e?.cleanup?.());assert.equal(intervals.size,0);assert.equal(listeners.size,0);assert.equal(backListeners.size,0);}
fresh();press('duration.15');assert.equal(node('duration.15').props.accessibilityState.checked,true);press('start');assert(node('running'));assert(blocked);assert.equal(intervals.size,1);
const stalePause=node('pause').props.onPress;now+=400;stalePause();stalePause();render();assert(node('paused'));assert.equal(intervals.size,0);
press('resume');appState('inactive');assert(node('paused'));assert(node('background'));now+=60000;appState('active');assert.equal(intervals.size,0);press('resume');assert.equal(intervals.size,1);
focused=false;render();render();assert(node('paused'));focused=true;render();render();assert(node('paused'),'Focus return requires Resume');
press('resume');guard();render();render();assert(node('exit.dialog'));assert.equal(intervals.size,0);press('exit.keep');assert(node('paused'));press('resume');press('finish');press('exit.confirm');assert.equal(navigations,1);press('exit.confirm',0);assert.equal(navigations,1);cleanup();
fresh();rn.AppState.currentState='inactive';press('start');assert(node('ready'),'A stale foreground render cannot start while inactive');rn.AppState.currentState='active';press('exit');assert.equal(navigations,1);cleanup();
fresh(true);press('start');now+=2000;[...intervals].forEach(fn=>fn());render();render();assert(node('completed'));assert(node('unsaved'));assert.equal(intervals.size,0);press('reset');assert(node('ready'));press('start');now+=2000;[...intervals].forEach(fn=>fn());render();render();press('done');assert.equal(navigations,1);cleanup();
fresh();reduced=true;press('start');press('exit');assert.equal(node('exit.dialog').type,'ScrollView');assert.equal(render().find(n=>n.type==='Modal').props.animationType,'none');cleanup();
fresh();render({evaluationAction:{label:'Durum kontrolüne geç',onPress:()=>evaluations++},confirmExitWhenIdle:true});render();press('evaluate');assert.equal(evaluations,1,'Ready exercise can explicitly continue without starting');assert(node('ready'));cleanup();
fresh();render({evaluationAction:{label:'Durum kontrolüne geç',onPress:()=>evaluations++},confirmExitWhenIdle:true});render();press('start');press('evaluate');assert.equal(evaluations,1,'Running exercise advances only after an explicit evaluation action');assert(node('paused'),'Evaluation freezes the running timer before handing control to the adapter');cleanup();
fresh(true);render({evaluationAction:{label:'Durum kontrolüne geç',onPress:()=>evaluations++},confirmExitWhenIdle:true});render();press('start');now+=2000;[...intervals].forEach(fn=>fn());render();assert(node('completed'));assert.equal(evaluations,0,'Timer completion never invokes evaluation');press('evaluate');assert.equal(evaluations,1);cleanup();
fresh();render({confirmExitWhenIdle:true});render();press('exit');assert(node('exit.dialog'),'Production-shaped idle exit requests confirmation');assert.equal(navigations,0);press('exit.confirm');assert.equal(navigations,1);cleanup();
fresh();let exitAttempts=0;render({confirmExitWhenIdle:true,onExitConfirmed:()=>++exitAttempts>1});render();press('exit');press('exit.confirm');assert.equal(exitAttempts,1);assert(node('exit.dialog'),'Failed navigation must restore the confirmation instead of latching exit');press('exit.confirm');assert.equal(exitAttempts,2,'Restored confirmation must permit an explicit navigation retry');cleanup();
fresh();render({evaluationAction:{label:'Durum kontrolüne geç',onPress:()=>evaluations++},confirmExitWhenIdle:true,interactionDisabled:true,statusContent:jsx('Recovery',{testID:'recovery'})});render();assert.equal(node('evaluate').props.disabled,true);assert(node('status'));press('evaluate');assert.equal(evaluations,0,'Pending persistence disables evaluation');press('exit');assert(node('exit.dialog'));assert.equal(node('exit.confirm').props.disabled,true,'Pending persistence cannot be bypassed through confirmed exit');cleanup();
for(const width of [320,375,402])for(const fontScale of [1,1.35,3.1]) {fresh();viewport={width,height:568,fontScale};render();const scroll=render().find(n=>n.type==='ScrollView');assert(elements(scroll).some(n=>n.props.testID==='urge.preview.start'),'All controls are in the main scroll');assert.equal(node('duration.5').props.style.some(s=>s?.width==='100%'),fontScale>=1.35||width<360);cleanup();}
console.log('UI: actual handlers, rapid presses, navigation guard release, completion, dialog, AppState/focus, one interval, unmount and scrolling layout passed.');

for(const reducedMotion of [false,true])for(const running of [false,true]) {
 let cleanups=[],timings=[],cancels=0;
 const animationImports={react:{useEffect:fn=>cleanups.push(fn())},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',StyleSheet:{create:x=>x,absoluteFill:{}}},'react-native-svg':Object.fromEntries(['default','Circle','Defs','Ellipse','G','LinearGradient','Polygon','RadialGradient','Rect','Stop'].map(n=>[n,n])),
 'react-native-reanimated':{default:{View:'AnimatedView'},cancelAnimation:()=>cancels++,Easing:{linear:'linear'},useAnimatedStyle:fn=>fn(),useReducedMotion:()=>reducedMotion,useSharedValue:v=>({value:v}),withTiming:(v,options)=>{timings.push(options.duration);return v;}},'./urgeExerciseTimer':model,'./useUrgeExerciseReducedMotion':{useUrgeExerciseReducedMotion:()=>reducedMotion}};
 const visuals=evaluate(exerciseBase+'UrgeExerciseVisuals.tsx',animationImports);
 visuals.UrgeExerciseAtmosphere({elapsedMs:11000,running});
 assert.equal(timings.length,running&&!reducedMotion?1:0);if(timings.length)assert.equal(timings[0],3000,'Exhale animation uses the same phase remainder as text');
 cleanups.forEach(fn=>fn());assert.equal(cancels,2,'Cancel old animation on update and unmount');
 const lcd=visuals.UrgeExerciseLCD({remainingMs:125000});assert.equal(lcd.props.accessibilityRole,'timer');assert.equal(lcd.props.accessibilityLabel,'Kalan süre: 2 dakika 5 saniye');assert.equal(lcd.props.accessibilityLiveRegion,'none');
}
console.log('Motion: phase remainder synchronized; Reduced Motion and pause remove tweens; all animations cancel; LCD has one non-live spoken timer label.');

for(const dev of [false,true])for(const e2e of [false,true])for(const bundle of [undefined,'com.umutcyilmaz.bloom','com.umutcyilmaz.bloom.e2e'])for(const flag of [undefined,'1','true']){
 const gate=evaluate(previewBase+'urgePreviewMode.ts',{'expo-constants':{default:{}},'../../../shared/runtime/e2eMode':{isE2EMode:false}},{process:{env:{}}});assert.equal(gate.resolveUrgePreviewEnabled(dev,e2e,bundle,flag),dev&&e2e&&bundle==='com.umutcyilmaz.bloom.e2e'&&flag==='1');
}
for(const file of ['UrgeExercise.tsx','UrgeExerciseVisuals.tsx','urgeExerciseTimer.ts'])assert(!/AsyncStorage|useBloom|flowActions|WebView|Date\.now|new Date/.test(fs.readFileSync(exerciseBase+file,'utf8')));
const previewScreen=fs.readFileSync(previewBase+'UrgePreviewScreen.tsx','utf8');assert(previewScreen.includes('testIDPrefix="urge.preview"'));assert(previewScreen.includes('router.replace("/today")'));
const provider=fs.readFileSync('src/app/providers/AppProviders.tsx','utf8');assert(provider.includes('{urgePreviewEnabled ? <LocalProviders runtime={urgePreviewRuntime}>'));
assert(fs.readFileSync('app/debug/urge-control.tsx','utf8').includes('if (!urgePreviewEnabled) return <Redirect href="/" />;'));
assert(fs.readFileSync('src/storage/bloomStateSchema.ts','utf8').includes('BLOOM_PERSISTENCE_VERSION = 9'));
(async()=>{
 let memoryClients=0;const runtime=evaluate(previewBase+'urgePreviewRuntime.ts',{'../../../storage/storageAdapters':{createMemoryStorageClient:()=>{memoryClients++;return {};}},'../../../storage/bloomStatePersistence':{createBloomStatePersistenceCoordinator:()=>({load:()=>null,deleteAll:()=>{}})}}).urgePreviewRuntime;
 let motionValue=false, motionListener, detach=0, resolveRead, hookCleanup, effectRan=false;
 const motionHook=evaluate(exerciseBase+'useUrgeExerciseReducedMotion.ts',{
  react:{useState:initial=>[motionValue, value=>motionValue=value],useEffect:fn=>{if(!effectRan){effectRan=true;hookCleanup=fn();}}},
  'react-native':{AccessibilityInfo:{addEventListener:(_,fn)=>{motionListener=fn;return {remove:()=>detach++};},isReduceMotionEnabled:()=>new Promise(resolve=>resolveRead=resolve)}},
  'react-native-reanimated':{useReducedMotion:()=>false}
 }).useUrgeExerciseReducedMotion;
 motionHook();motionListener(true);resolveRead(false);await Promise.resolve();assert.equal(motionHook(),true,'Late initial read cannot overwrite a native change');hookCleanup();motionListener(false);assert.equal(motionValue,true);assert.equal(detach,1);
 console.log('Reduced Motion: native changes update mounted UI; stale async read and post-unmount updates are ignored; subscription removed.');
 assert.equal(memoryClients,1);assert.equal((await runtime.save()).status,'invalidated');console.log('Isolation: 36 gate combinations, release redirect, root memory precedence, no feature mutation imports, no device save acknowledgement and unchanged v9 passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
