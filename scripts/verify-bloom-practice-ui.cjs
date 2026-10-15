// Execute real native screen handlers with controlled hooks, clock and AppState.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function evaluate(file,imports,extra={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{assert(n in imports,`Unexpected import ${n}`);return imports[n];},...extra});return module.exports;}
const jsx=(type,props)=>({type,props:props||{}}),elements=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(elements):t.type==='Modal'&&!t.props.visible?[]:[t,...elements(t.props.children)];
let clock=0,cursor=0,values=[],effects=[],pending=[],listeners=[],timers=new Set(),navigationCalls=0,production,blocked=false,guard,reduced=false;
const hooks={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],v=>values[i]=v];},useRef(initial){const i=cursor++;return values[i]??(values[i]={current:initial});},useSyncExternalStore(sub,get){cursor++;return get();},useEffect(fn,deps){const i=cursor++,old=effects[i];if(!old||!deps||deps.some((d,k)=>!Object.is(d,old.deps?.[k]))){pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}}};
let viewport={width:402,height:874,fontScale:1};
const typography=evaluate('src/features/practice/practiceTypography.ts',{});
const sessionExports=evaluate('src/features/practice/practiceSession.ts',{});
const imports={react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'@react-navigation/native':{usePreventRemove:(b,f)=>{blocked=b;guard=f;}},'expo-router':{useNavigation:()=>nav,useRouter:()=>router},'react-native':{AccessibilityInfo:{announceForAccessibility(){}},AppState:{currentState:'active',addEventListener:(_,f)=>{listeners.push(f);return {remove:()=>listeners=listeners.filter(x=>x!==f)};}},BackHandler:{addEventListener:()=>({remove(){}})},Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:x=>x},View:'View',useWindowDimensions:()=>viewport},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:62,bottom:34})},'react-native-reanimated':{default:{View:'AnimatedView'},useReducedMotion:()=>reduced,FadeInDown:{duration:()=>({}),delay:()=>({duration:()=>({})})}},'./PracticeText':{PracticeText:'Text'},'./practiceTypography':typography,'../kegel/components/KegelUI':{KegelBack:'Back',KegelButton:'Button',KegelCard:'Card',KegelHint:'Hint',KegelRow:'Row'},'./PracticeButton':{PracticeButton:'Button'},'./practiceSession':sessionExports,'./PracticeVisuals':{PracticeCheck:'Check',PracticeCurve:'Curve',PracticeOrb:'Orb',PracticeRule:'Rule',PracticeHint:'Hint'},'../kegel/kegelTheme':{kegelColors:{}}};
const nav={setOptions(){}},router={replace(){navigationCalls++;}};
const {PracticePreviewScreen}=evaluate('src/features/practice/PracticePreviewScreen.tsx',imports,{performance:{now:()=>clock},setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)});
const render=()=>{cursor=0;const tree=elements(PracticePreviewScreen({production}));pending.splice(0).forEach(f=>f());return tree;},byId=id=>render().find(t=>t.props.testID===`practice.${id}`),press=id=>{clock+=400;const el=byId(id);assert(el,`Missing ${id}`);assert(!el.props.disabled,`Disabled ${id}`);el.props.onPress();render();};
function noRawText(node,insideText=false){if(typeof node==='string'||typeof node==='number'){assert(insideText,'Raw strings must not reach a native View/fragment');return;}if(Array.isArray(node)){node.forEach(n=>noRawText(n,insideText));return;}if(node&&typeof node==='object')noRawText(node.props?.children,node.type==='Text'||node.type==='Hint');}
cursor=0;noRawText(PracticePreviewScreen({}));pending.splice(0).forEach(f=>f());
assert(byId('intro'));press('start');assert(byId('start.confirm'));press('start.cancel');assert(byId('intro'));press('start');press('start.confirm');assert(byId('running'));assert(blocked);assert.equal(timers.size,1);
press('level.open');press('level.7');press('pause');assert(byId('paused'));clock+=4000;[...timers].forEach(f=>f());press('resume');assert(byId('running'));
clock+=400;const stalePause=byId('pause').props.onPress;stalePause();stalePause();assert(byId('paused'),'rapid presses cannot reverse phase');
listeners.forEach(f=>f('background'));render();assert.equal(timers.size,0);assert(byId('background'));clock+=60000;listeners.forEach(f=>f('active'));render();assert(byId('background'),'foreground requires explicit continue');assert.equal(timers.size,0);press('foreground');assert.equal(timers.size,1);
guard();render();assert(byId('exit.keep'));assert.equal(timers.size,0);assert.equal(navigationCalls,0,'navigation removal asks confirmation');press('exit.keep');press('finish');assert.equal(timers.size,0);assert(byId('question.1'));
press('quality.8');const oldNext=byId('next').props.onPress;oldNext();clock+=400;oldNext();assert(byId('question.2'),'stale double next cannot skip Q2');press('content.yes');assert(render().some(t=>t.props.children==='Sayaç sıfırlanmayacak'));press('next');press('ending.stopped');press('feeling.0');press('next');assert(byId('summary'));assert(byId('unsaved'));press('edit');press('skip');press('skip');press('skip');assert(byId('summary'));press('done');assert.equal(navigationCalls,1);
assert.equal(timers.size,0);effects.forEach(e=>e?.cleanup?.());assert.equal(listeners.length,0);
values=[];effects=[];reduced=true;const reducedTree=render();assert(!reducedTree.filter(t=>t.type==='AnimatedView').some(t=>'entering' in t.props));press('start');assert.equal(render().find(t=>t.type==='Modal').props.animationType,'none');effects.forEach(e=>e?.cleanup?.());
for(const dev of [false,true])for(const e2e of [false,true])for(const bundle of [undefined,'com.umutcyilmaz.bloom','com.umutcyilmaz.bloom.e2e'])for(const flag of [undefined,'1','true']){const gate=evaluate('src/features/practice/practicePreviewMode.ts',{'expo-constants':{default:{expoConfig:{ios:{bundleIdentifier:bundle}}}},'../../shared/runtime/e2eMode':{isE2EMode:e2e}},{__DEV__:dev,process:{env:{EXPO_PUBLIC_PRACTICE_PREVIEW:flag}}});assert.equal(gate.practicePreviewEnabled,dev&&e2e&&bundle==='com.umutcyilmaz.bloom.e2e'&&flag==='1');}
for(const file of ['practiceSession.ts','PracticePreviewScreen.tsx','PracticeVisuals.tsx','PracticeButton.tsx']){const source=fs.readFileSync('src/features/practice/'+file,'utf8');assert(!/AsyncStorage|useBloomLocalState|completeMasturbation|startMasturbation|WebView/.test(source),'Shared temporary Practice experience cannot write storage or mount WebView');}
assert(fs.readFileSync('app/debug/practice.tsx','utf8').includes('if (!practicePreviewEnabled) return <Redirect href="/" />;'));
console.log('Practice UI: actual screen controls, rapid presses, navigation confirmation, AppState, timer cleanup, reflection/edit/skip and 36 preview guard combinations passed.');

for(const reduced of [false,true]) {
 let repeats=0,cancelled=0,cleanup=[];const timing=[];
 const visualImports={react:{useEffect:fn=>cleanup.push(fn())},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{StyleSheet:{create:x=>x,absoluteFill:{}},View:'View',useWindowDimensions:()=>viewport},'react-native-svg':{default:'Svg',Circle:'Circle',Defs:'Defs',LinearGradient:'Gradient',Path:'Path',Stop:'Stop',Line:'Line'},'react-native-reanimated':{default:{createAnimatedComponent:t=>'Animated'+t,View:'AnimatedView'},cancelAnimation:()=>cancelled++,Easing:{linear:'linear'},useAnimatedProps:fn=>fn(),useAnimatedStyle:fn=>fn(),useReducedMotion:()=>reduced,useSharedValue:v=>({value:v}),withRepeat:v=>{repeats++;return v;},withTiming:(v,options)=>{timing.push(options?.duration);return v;}},'./PracticeText':{PracticeText:'Text'},'./practiceTypography':typography};
 const visuals=evaluate('src/features/practice/PracticeVisuals.tsx',visualImports);
 visuals.PracticeCurve({state:{pauses:[],elapsedMs:2000},animate:true});
 assert.equal(repeats,reduced?0:1,'Reduced Motion disables decorative curve loop');
 visuals.PracticeOrb({pauseMs:2500,animate:true});visuals.PracticeCheck({animate:true});
 if(reduced)assert(timing.every(duration=>duration===0),'Reduced Motion has no tweening');
 cleanup.forEach(fn=>fn?.());assert(cancelled>=3,'every visual cancels animation on unmount');
}
console.log('Practice motion: Reduced Motion disables entries, modal fades, curve loop and tweens; animation cancellation passed.');
for(const fontScale of [1,3.2]) {
 const {PracticeButton}=evaluate('src/features/practice/PracticeButton.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Pressable',StyleSheet:{create:x=>x}},'./PracticeText':{PracticeText:'Text'},'./practiceTypography':typography});
 const button=PracticeButton({label:'Pratiğe başla',disabled:true});
 assert.equal(button.props.accessibilityLabel,'Pratiğe başla');assert.equal(button.props.accessibilityState.disabled,true);
 const label=button.props.children;assert.equal(label.props.children,'Pratiğe başla');assert.equal(label.props.textRole,'control');assert.equal(label.props.style.width,'100%');assert.equal(label.props.allowFontScaling,undefined,'Real control text keeps full native font scaling');
}
console.log('Practice button: full visible/accessibility label, gradual control typography, wrapping and native scaling retained.');

// Structural regressions are assertions about layout policy/handlers, not pixels.
for(const width of [375,402])for(const fontScale of [1,1.35,3.1,3.2]) {
 viewport={width,height:width===375?812:874,fontScale};production=undefined;
 values=[];effects=[];pending=[];const tree=render();
 const scroll=tree.find(t=>t.type==='ScrollView');
 const inside=elements(scroll.props.children).some(t=>t.props.testID==='practice.controls');
 assert.equal(inside,typography.practiceLayout(width,viewport.height,fontScale).flowingControls,'Large controls must participate in the main scroll, not consume a fixed footer');
 const heading=byId('intro.heading');assert.equal(heading.props.children,'Yükselişi daha erken fark\u00a0et');
 assert.equal(heading.props.numberOfLines,undefined,'Critical headings cannot be truncated');
 press('start');const modal=render().find(t=>t.type==='Modal');
 assert(elements(modal).some(t=>t.type==='ScrollView'),'Dialog content and actions scroll together');
 assert.equal(typography.practiceLayout(width,viewport.height,fontScale).columns,fontScale>2.4?2:fontScale>=1.35?3:5);
 effects.forEach(e=>e?.cleanup?.());
}
assert(typography.practiceLayout(320,568,1).flowingControls,'Short supported viewports cannot reserve a multi-button fixed footer');
for(const scale of [1,1.35,3.2,4.5]) {
 const base={fontSize:16,lineHeight:24};
 assert.equal(typography.practiceTypeStyle(base,'content',scale).fontSize,16,'Essential prose retains full native scaling before a measured word overflow');
 const display=typography.practiceTypeStyle({fontSize:30,lineHeight:34},'display',scale);
 assert(Math.abs(display.fontSize*scale-30*Math.sqrt(scale))<1e-9,'Display grows continuously without a blanket cap');
}
assert.equal(typography.practiceWordFit(339,200),1);assert.equal(typography.practiceWordFit(24,24),1,'An intrinsic-width short label must not be shrunk by a safety margin');
assert.equal(typography.practiceWordFit(0,550),1);
assert(Math.abs(typography.practiceWordFit(339,550)-337/550)<1e-9);
let textCursor=0,textValues=[];
const textHooks={useState(initial){const i=textCursor++;if(!(i in textValues))textValues[i]=initial;return [textValues[i],v=>{textValues[i]=typeof v==='function'?v(textValues[i]):v;}];}};
const {PracticeText}=evaluate('src/features/practice/PracticeText.tsx',{
 react:textHooks,'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-native':{View:'View',StyleSheet:{create:x=>x,flatten:arr=>Object.assign({},...arr)},useWindowDimensions:()=>({fontScale:3.2})},
 '../../shared/components/v4/AppText':{AppText:'Text'},'../../shared/design-system/v4/theme':{theme:{typography:{body:{fontFamily:'Inter_400Regular',fontSize:14,lineHeight:21}}}},'./practiceTypography':typography
});
const textRender=()=>{textCursor=0;return elements(PracticeText({children:'otomatikleşmeden önce fark\u00a0et',accessibilityLabel:'Tam yönerge',style:{fontSize:16,lineHeight:24}}));};
let textTree=textRender(),visible=textTree.find(t=>t.type==='Text'),hidden=textTree.find(t=>t.type==='Text'&&t.props.accessible===false);
assert.equal(textTree[0].props.style[0].alignSelf,'stretch','Available line width comes from a stretching container, not the changing glyph width');assert.equal(visible.props.onLayout,undefined,'The glyph layout must not feed back into font size');assert.equal(visible.props.style[1].fontSize,16);assert.equal(visible.props.allowFontScaling,undefined);assert.equal(visible.props.numberOfLines,undefined);
assert(hidden.props.children.includes('fark\u00a0et'),'Nonbreaking phrases must be measured as a whole');
assert(textTree.some(t=>t.props.importantForAccessibility==='no-hide-descendants'),'Measuring text must never be announced');
textTree[0].props.onLayout({nativeEvent:{layout:{width:339}}});hidden.props.onTextLayout({nativeEvent:{lines:[{width:550},{width:80}]}});
visible=textRender().find(t=>t.type==='Text');assert(Math.abs(visible.props.style[1].fontSize-16*337/550)<1e-9);
const paragraphProbe=textRender().find(t=>t.type==='Text'&&t.props.accessible===false&&t.props.style.some?.(s=>s.height===16384));
assert(paragraphProbe,'Fitted prose needs a native paragraph-height probe with vertical room');
paragraphProbe.props.onTextLayout({nativeEvent:{lines:[{y:0,height:65.744},{y:657.44,height:65.744}]}});
assert.equal(textRender().find(t=>t.type==='Text').props.style[2].minHeight,726,'Reserve measured complete line extent plus rounding allowance, never a fixed paragraph height');
assert.equal(visible.props.accessibilityLabel,'Tam yönerge');assert.equal(visible.props.children,'otomatikleşmeden önce fark\u00a0et');
textRender()[0].props.onLayout({nativeEvent:{layout:{width:600}}});assert.equal(textRender().find(t=>t.type==='Text').props.style[1].fontSize,16,'A wider layout restores the requested native size');
assert.equal(textRender().find(t=>t.type==='Text').props.style[2].minHeight,undefined,'A changed width must invalidate stale paragraph height');
viewport={width:402,height:874,fontScale:1};
console.log('Practice typography: native word measurement, full prose/labels, no truncation, continuous role scaling, 375/402 widths, default/moderate/maximum scroll controls and scrollable dialogs passed. Pixel correctness requires inspected Simulator captures.');

(async()=>{
 values=[];effects=[];pending=[];clock=0;reduced=false;let savedPayload,startCalls=0,leaveCalls=0,reportCalls=0;
 production={introduced:false,busy:false,navigationBlocked:false,captured:false,saved:false,recovery:null,
 isNavigationBlockedNow:()=>production.navigationBlocked,isSavedNow:()=>production.saved,isCapturedNow:()=>production.captured,onStart:async startSession=>{startCalls++;return startSession();},onSave:payload=>{savedPayload=payload;production={...production,captured:true,busy:true,navigationBlocked:true};},onReport(){reportCalls++;},onLeave:()=>leaveCalls++};
 render();press('start');press('start.confirm');await Promise.resolve();render();assert(byId('running'));assert.equal(startCalls,1);
 press('pause');clock+=2000;[...timers].forEach(f=>f());press('resume');press('level.open');const staleLevel=byId('level.4').props.onPress;press('level.4');assert.equal(reportCalls,1);press('finish');staleLevel();assert.equal(reportCalls,1,'Rejected stale level input cannot enter the production payload');press('skip');press('skip');press('skip');assert(byId('summary'));assert(byId('save'));assert(!byId('done'));production.saveDisabled=true;assert(byId('save').props.disabled,'Reset restriction disables summary Save');production.saveDisabled=false;const staleExit=byId('exit').props.onPress,staleEdit=byId('edit').props.onPress;press('save');staleEdit();assert(byId('summary'),'Stale Edit cannot mutate the immutable pending payload');staleExit();assert(!byId('exit.confirm'),'Stale Exit cannot abandon an accepted pending save');assert.equal(savedPayload.quality,null);assert.equal(savedPayload.content,null);assert.equal(savedPayload.ending,null);assert.equal(savedPayload.pauses.length,1);assert(byId('save').props.disabled);assert(!byId('edit'),'Immutable first-save payload cannot be edited');guard();assert.equal(leaveCalls,0);
 production.busy=false;production.navigationBlocked=false;production.saved=true;render();assert(byId('saved'));assert(!blocked,'Only durable success releases draft guard');press('done');assert.equal(leaveCalls,1);effects.forEach(e=>e?.cleanup?.());assert.equal(timers.size,0);
 values=[];effects=[];pending=[];production={...production,introduced:true,saved:false,captured:false,onStart:async()=>false};render();assert(byId('instructions'));assert(!byId('intro.heading'),'Acknowledged intro is replaced with an explicit ready screen');press('instructions');assert(byId('intro.heading'));press('start');press('start.confirm');await Promise.resolve();render();assert(byId('intro'),'Rejected actual start never starts a clock');assert.equal(timers.size,0);effects.forEach(e=>e?.cleanup?.());
 values=[];effects=[];pending=[];let releaseStart;production={...production,introduced:false,onStart:startSession=>new Promise(resolve=>releaseStart=resolve).then(()=>startSession())};render();press('start');press('start.confirm');const abandonedSession=values.find(value=>value?.getSnapshot);effects.forEach(e=>e?.cleanup?.());releaseStart(true);await Promise.resolve();assert.equal(abandonedSession.getSnapshot().phase,'intro','Late acknowledgement after unmount cannot recreate an exercise');assert.equal(timers.size,0);
 console.log('Production Practice shared UI: explicit guarded start, acknowledged-intro revisit, completed-only explicit save, skipped null answers, immutable save controls, persistence navigation guard and durable-only saved/leave state passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
