const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const source = fs.readFileSync('src/features/relaxing-sounds/soundPlaybackController.ts', 'utf8');
const exports_ = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {exports:exports_});
function harness() {
 let status={currentTime:0,duration:40,playing:false,isLoaded:true,isBuffering:false,playbackState:'readyToPlay'};
 let tick=()=>{}, clock=0, created=0, released=0, plays=0, paused=0, activated=0, deactivated=0, volume=1;
 let activation=()=>Promise.resolve(), seek=()=>Promise.resolve();
 const c=exports_.createSoundPlaybackController({
  create(){created++;return {status:()=>({...status}),play(){plays++;status.playing=true;},pause(){paused++;status.playing=false;},seekTo:async seconds=>{await seek();status.currentTime=seconds;},volume:v=>volume=v,dispose(){released++;}};},
  activate(){activated++;return activation();},deactivate(){deactivated++;return Promise.resolve();},every(fn){tick=fn;return ()=>{tick=()=>{};};},now:()=>clock
 });
 return {c,update(s){status={...status,...s};tick();},time(n){clock=n;tick();},setActivation(fn){activation=fn;},setSeek(fn){seek=fn;},get counts(){return {created,released,plays,paused,activated,deactivated,volume};},get status(){return status;}};
}
(async()=>{
 const h=harness();h.c.open();assert.equal(h.c.getSnapshot().phase,'ready');
 await h.c.toggle();assert.equal(h.c.getSnapshot().playing,true);
 h.update({currentTime:10});assert.equal(h.c.getSnapshot().elapsed,10);
 await h.c.toggle();h.time(100000);assert.equal(h.c.getSnapshot().elapsed,10,'Pause cannot consume timer');
 await h.c.toggle();h.update({currentTime:39.9});h.update({currentTime:.2});assert(Math.abs(h.c.getSnapshot().elapsed-40.2)<.01,'Native wrap accumulates listening time');
 h.update({playing:false,isBuffering:true});h.time(200000);assert.equal(h.c.getSnapshot().phase,'buffering');assert.equal(h.c.getSnapshot().elapsed,40.2);
 h.update({playing:true,isBuffering:false,currentTime:1});h.c.setDuration(1200);assert.equal(h.c.getSnapshot().remaining,1159);
 h.c.setDuration(0);assert.equal(h.c.getSnapshot().remaining,null);
 await h.c.seekBy(15);assert.equal(h.c.getSnapshot().elapsed,56);assert.equal(h.status.currentTime,16);
 await h.c.seekBy(-100);assert.equal(h.c.getSnapshot().elapsed,0);
 h.c.suspend();assert.equal(h.status.playing,false);h.c.foreground();assert.equal(h.status.playing,false,'Foreground must never implicitly resume');
 await h.c.toggle();h.update({currentTime:2});h.update({playing:false});assert.equal(h.c.getSnapshot().playing,false);
 await h.c.toggle();assert.equal(h.status.playing,true,'One explicit press resumes an interruption');
 h.c.setQaDuration(5);h.update({currentTime:5.2});assert(h.counts.volume<1,'End fade follows engine progress');h.update({currentTime:7.3});assert.equal(h.c.getSnapshot().phase,'ended');assert.equal(h.status.playing,false);assert.equal(h.c.getSnapshot().elapsed,5);
 const pauses=h.counts.paused;h.time(300000);assert.equal(h.counts.paused,pauses,'No repeated expiry/session deactivation work');
 await h.c.toggle();assert.equal(h.c.getSnapshot().elapsed,0);assert.equal(h.status.currentTime,0);
 h.c.setDuration(1800);h.update({currentTime:39});for(let i=0;i<16;i++){h.update({currentTime:0});h.update({currentTime:39});}
 h.c.setDuration(600);assert.equal(h.c.getSnapshot().phase,'ended','A shorter duration expires immediately if already consumed');
 h.c.setDuration(0);await h.c.toggle();assert.equal(h.c.getSnapshot().playing,true);
 h.c.close();h.c.close();assert.equal(h.counts.released,1,'Release exactly once');
 h.c.open();assert.equal(h.c.getSnapshot().elapsed,0);assert.equal(h.c.getSnapshot().duration,600);
 h.c.stop();assert.equal(h.c.getSnapshot().elapsed,0);assert.equal(h.status.playing,false);h.c.close();assert.equal(h.counts.created,h.counts.released);
 const race=harness();race.c.open();let finish;race.setActivation(()=>new Promise(resolve=>finish=resolve));const p=race.c.toggle();void race.c.toggle();race.c.suspend();finish();await p;assert.equal(race.counts.plays,0,'Async activation cannot play after suspension');
 race.c.foreground();race.setActivation(()=>Promise.reject(new Error('audio focus')));await race.c.toggle();assert.equal(race.c.getSnapshot().phase,'error');race.c.close();
 const loading=harness();loading.c.open();loading.update({isLoaded:false});loading.time(12001);assert.equal(loading.c.getSnapshot().phase,'error');loading.c.open();assert.equal(loading.c.getSnapshot().elapsed,0);loading.update({playbackState:'failed'});assert.equal(loading.c.getSnapshot().phase,'error');loading.c.close();
 const exit=harness();exit.c.open();let seekFinish;exit.setSeek(()=>new Promise(resolve=>seekFinish=resolve));await exit.c.toggle();const pending=exit.c.seekBy(15);exit.c.close();seekFinish();await pending;assert.equal(exit.counts.plays,1,'Pending seek cannot restart after screen exit');
 const portExports={};const activations=[];
 const fakeAudio={createAudioPlayer:()=>{},setAudioModeAsync:()=>Promise.resolve(),setIsAudioActiveAsync:async enabled=>{activations.push(enabled);}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/relaxing-sounds/expoSoundPort.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:portExports,require:()=>fakeAudio,performance:{now:()=>0},setInterval,clearInterval});
 const ownerA=portExports.expoSoundPort(1),ownerB=portExports.expoSoundPort(2);
 await ownerA.activate();await ownerB.activate();await ownerA.deactivate();assert.equal(activations.length,2,'Old route cannot deactivate a newer audio owner');await ownerB.deactivate();assert.deepEqual(activations,[true,true,false]);
 const canceled=portExports.expoSoundPort(3);const canceledActivation=canceled.activate();await canceled.deactivate();await canceledActivation;assert.equal(activations.length,3,'Cancelled activation never acquires focus');
 const sceneExports={};let reduced=false,animationStarts=0;const cleanups=[];
 const jsx=(type,props)=>({type,props});
 const fakeReanimated={default:'Animated',cancelAnimation:()=>{},Easing:{linear:0,inOut:x=>x,sin:0},useAnimatedStyle:()=>({}),useReducedMotion:()=>reduced,useSharedValue:()=>({value:0}),withRepeat:()=>{animationStarts++;return 1;},withTiming:()=>1};fakeReanimated.default={View:'AnimatedView'};
 const sceneRequire=name=>name==='react'?{useEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup);}}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{StyleSheet:{absoluteFill:{}},View:'View'}:name==='react-native-reanimated'?fakeReanimated:name==='react-native-svg'?{SvgXml:'SvgXml'}:JSON.parse(fs.readFileSync('src/features/relaxing-sounds/soundSceneLayers.json','utf8'));
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/relaxing-sounds/SoundScene.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:sceneExports,require:sceneRequire});
 for(const id of ['ocean','rain','fire','forest']){
  reduced=true;let scene=sceneExports.SoundScene({id,playing:true});for(const layer of scene.props.children[1])layer.type(layer.props);assert.equal(animationStarts,0,'Reduced Motion must not start decorative loops');
  reduced=false;scene=sceneExports.SoundScene({id,playing:false});for(const layer of scene.props.children[1])layer.type(layer.props);assert.equal(animationStarts,0,'Paused scene must not start loops');
 }
 const moving=sceneExports.SoundScene({id:'forest',playing:true});for(const layer of moving.props.children[1])layer.type(layer.props);assert(animationStarts>0);cleanups.forEach(fn=>fn());
 const manifest=JSON.parse(fs.readFileSync('docs/qa/relaxing-sounds/audio-assets.json','utf8'));
 for(const id of ['ocean','rain','fire','forest']){
  const b=fs.readFileSync(`src/features/relaxing-sounds/assets/${id}.wav`);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert(b.length>1000000);
  assert.equal(require('node:crypto').createHash('sha256').update(b).digest('hex'),manifest[id].bundledSha256);
 }
 const feature=fs.readFileSync('src/features/relaxing-sounds/SoundPlayerScreen.tsx','utf8');assert(!feature.includes('productActions.'));assert(!source.includes('storage'));assert(feature.includes('kegelPersistenceQaEnabled && process.env.EXPO_PUBLIC_RELAXING_SOUNDS_QA'));
 assert(fs.readFileSync('app/bloom/library/sound.tsx','utf8').includes('SoundPlayerScreen'));
 require('./patch-expo-audio-ios.cjs');
 console.log('Audio verification passed: actual-engine clock, loop wraps, pause/buffer, finite/unlimited, seek/clamp, fade/expiry, interruption, background, teardown races, rapid presses, retries, errors, bundled WAV hashes and isolated QA gate.');
})().catch(e=>{console.error(e);process.exitCode=1;});
