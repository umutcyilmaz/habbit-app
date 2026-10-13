// Controlled hook/clock harness: actual native component code, no renderer/device storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>({type,props:props||{}});
let focused=true,reduced=false,appState='active',listener,cleanup,ticks=new Map(),nextId=0,cancelled=0,repeats=0;
const native={View:'View',useWindowDimensions:()=>({fontScale:1}),StyleSheet:{create:s=>s,absoluteFill:{}},
  AppState:{get currentState(){return appState;},addEventListener:(event,fn)=>{listener=fn;return{remove(){listener=null;}};}}};
const animations={default:{View:'AnimatedView'},FadeIn:{duration:()=>({})},useReducedMotion:()=>reduced,
  useSharedValue:()=>({value:0}),cancelAnimation:()=>cancelled++,useAnimatedStyle:fn=>fn(),withTiming:(v)=>v,withRepeat:v=>{repeats++;return v;}};
let values=[],cursor=0;
const hooks={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],v=>{values[i]=v;}];},useCallback:f=>f,useEffect:f=>{cleanup=f();}};
const imports={'react':hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'expo-router':{useFocusEffect:f=>{if(!cleanup)cleanup=f();}},
  '@react-navigation/native':{useIsFocused:()=>focused},'react-native':native,'react-native-reanimated':animations,
  'react-native-svg':Object.fromEntries(['default','Circle','Defs','Ellipse','LinearGradient','RadialGradient','Rect','Stop'].map(n=>[n,n])),
  '../../../shared/components/v4/AppText':{AppText:'AppText'}};
function evaluate(file){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:n=>{assert(n in imports,n);return imports[n];},
  setInterval:(fn)=>{const id=++nextId;ticks.set(id,fn);return id;},clearInterval:id=>ticks.delete(id)});return module.exports;}
const {HomeCounter,advanceHomeCounter}=evaluate('src/features/home/components/HomeCounter.tsx');
const at='2026-10-01T10:00:00.000Z';
assert.equal(advanceHomeCounter(null,at,new Date(at)),null);
assert.equal(advanceHomeCounter(86400,at,new Date(at)),86400);
assert.equal(advanceHomeCounter(5,at,new Date('2026-10-01T09:00:00.000Z')),0);
assert.equal(advanceHomeCounter(15*86400-1,at,new Date('2026-10-01T10:00:05.000Z'),15*86400),15*86400);
assert.equal(advanceHomeCounter(1,'invalid',new Date(at)),null);
assert.equal(advanceHomeCounter(NaN,at,new Date(at)),null);
let time=new Date(at);const props={seconds:0,observedAt:at,now:()=>time,id:'counter'};
const render=()=>{cursor=0;return HomeCounter(props);};
render();assert.equal(ticks.size,1,'Focused foreground counter has one clock interval');
time=new Date('2026-10-01T10:00:01.000Z');[...ticks.values()].forEach(fn=>fn());
function nodes(t){if(!t||typeof t!=='object')return[];if(Array.isArray(t))return t.flatMap(nodes);return[t,...nodes(t.props?.children)];}
assert.equal(nodes(render()).find(n=>n.props.testID==='counter.time').props.children,'0 sa 0 dk 1 sn');
appState='background';listener();assert.equal(ticks.size,0,'Background stops seconds updates');
appState='active';listener();assert.equal(ticks.size,1);
cleanup();cleanup=null;assert.equal(ticks.size,0,'Blur/unmount cleans counter timer');assert.equal(listener,null);
const {HomeAtmosphere}=evaluate('src/features/home/components/HomeAtmosphere.tsx');
HomeAtmosphere();assert.equal(repeats,1,'Fog movement uses native Reanimated loop');
appState='background';listener();assert.equal(repeats,1,'Background does not restart animation');
assert(cancelled>0);cleanup();cleanup=null;
appState='active';focused=false;HomeAtmosphere();assert.equal(repeats,1,'Unfocused tab has no moving fog');cleanup();cleanup=null;
focused=true;reduced=true;HomeAtmosphere();assert.equal(repeats,1,'Reduced Motion keeps atmosphere static');cleanup();cleanup=null;
values=[];render();assert.equal(ticks.size,1,'Reduced Motion still shows real clock time without animated value transitions');
const numberNode=nodes(render()).find(n=>n.type==='AnimatedView');assert.equal(numberNode.props.entering,undefined);
cleanup();
console.log('Home animation/clock harness passed: real elapsed values, capped Reset, invalid/future clocks, focus/foreground cleanup, native fog and Reduced Motion. Not a mounted renderer.');
