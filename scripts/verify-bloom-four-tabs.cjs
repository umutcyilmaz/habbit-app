const assert=require('node:assert/strict');
const {readFileSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
function evaluate(file,imports={}) {
  const source=readFileSync(resolve(file),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};
  runInNewContext(code,{module,exports:module.exports,require:name=>{assert(name in imports,`Unexpected import ${name}`);return imports[name];}});
  return module.exports;
}
const constants=evaluate('src/constants/navigation.ts');
assert.equal(constants.tabRoutes.map(t=>t.title).join('|'),'Ana sayfa|Library|Kegel|Profil');
assert.equal(constants.tabRoutes.map(t=>t.name).join('|'),'today|library|kegel|profile');
assert.equal(constants.tabRoutes[2].href,'/bloom/kegel');
assert(constants.tabRoutes.every(t=>!t.href.includes('/debug/')));
for(const name of constants.hiddenLegacyTabs) assert(existsSync(`app/(tabs)/${name}.tsx`));
for(const [name,href] of Object.entries({home:'/(tabs)/today',log:'/(tabs)/log',exercises:'/(tabs)/exercises',progress:'/(tabs)/progress',protect:'/(tabs)/protect'})) assert.equal(constants.routes[name],href);
const jsx=(type,props,key)=>({type,props,key});
const runtime={'react/jsx-runtime':{jsx,jsxs:jsx}};
function nodes(tree) {
  if(Array.isArray(tree))return tree.flatMap(nodes);
  if(!tree || typeof tree!=='object' || !tree.props)return [];
  if(typeof tree.type==='function')return nodes(tree.type(tree.props));
  return [tree,...nodes(tree.props.children)];
}
const native={'react-native':{View:'View',Pressable:'Pressable',StyleSheet:{create:v=>v,hairlineWidth:.5}},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34,left:0,right:0})},
  'react-native-reanimated':{default:{View:'AnimatedView'},useSharedValue:value=>({value}),useReducedMotion:()=>true,useAnimatedStyle:fn=>fn(),withSpring:v=>v,withTiming:v=>v},
  '../components/v4/AppText':{AppText:'AppText'},'../../constants/navigation':constants,...runtime};
const bar=evaluate('src/shared/navigation/BloomBottomNavigation.tsx',native);
for(const active of constants.tabRoutes.map(t=>t.name)) for(const blocked of [false,true]) {
  const tree=bar.BloomBottomNavigation({active,blocked,onSelect:()=>{}}),entries=nodes(tree);
  const buttons=entries.filter(n=>n.type==='Pressable');assert.equal(buttons.length,4);
  assert.equal(buttons.filter(b=>b.props.accessibilityState.selected).length,1);
  assert(buttons.every(b=>b.props.accessibilityRole==='tab' && b.props.disabled===blocked));
  assert.equal(tree.props.style[1].paddingBottom,34);
  assert.equal(tree.props.style[0].paddingTop+buttons[0].props.style.height+tree.props.style[1].paddingBottom,96);
}
const tabs={Screen:'Tabs.Screen'};
const layout=evaluate('app/(tabs)/_layout.tsx',{'../../src/shared/navigation/BloomGuardedNavigators':{BloomGuardedTabs:tabs},'expo-status-bar':{StatusBar:'StatusBar'},'../../src/constants/navigation':constants,
  'react-native-reanimated':{useReducedMotion:()=>false},
  '../../src/shared/navigation/BloomTabsBar':{BloomTabsBar:'BloomTabsBar'},'../../src/shared/navigation/BloomTabRecoveryScreen':{BloomTabRecoveryScreen:'BloomTabRecoveryScreen'},...runtime}).default();
const screens=nodes(layout).filter(n=>n.type==='Tabs.Screen');
assert.equal(screens.filter(s=>s.props.options.tabBarItemStyle?.display!=='none').length,4);
assert(screens.filter(s=>constants.hiddenLegacyTabs.includes(s.props.name)).every(s=>s.props.options.tabBarItemStyle?.display==='none' && s.props.options.tabBarButton()===null));
assert(!screens.some(s=>s.props.name.startsWith('debug')));
assert(readFileSync('app/(tabs)/today.tsx','utf8').includes('return <BloomHomeScreen />'));
assert(readFileSync('app/(tabs)/kegel.tsx','utf8').includes('href={routes.kegel}'));
const boundary=evaluate('src/shared/navigation/bloomTabNavigation.ts');
let accepted={},durable=accepted,hydrated=true,renderedAccepted=accepted;
const calls=[],bloom={get state(){return renderedAccepted;},get durableState(){return durable;},get hasHydrated(){return hydrated;},getAcceptedState:()=>accepted,getDurableState:()=>durable};
let prevent=false;
const adapter=evaluate('src/shared/navigation/BloomTabsBar.tsx',{
  'expo-router':{useRouter:()=>({push:href=>calls.push(['push',href])})},
  '../../app/providers/BloomLocalStateProvider':{useBloomLocalState:()=>bloom},'../../constants/navigation':constants,
  './BloomBottomNavigation':{BloomBottomNavigation:'BloomBottomNavigation'},'./bloomTabNavigation':boundary,...runtime});
const state={index:0,routes:constants.tabRoutes.map(t=>({name:t.name,key:t.name+'-key'}))};
const navigation={emit:event=>{calls.push(['event',event.target]);return {defaultPrevented:prevent};},navigate:name=>calls.push(['navigate',name])};
let view=adapter.BloomTabsBar({state,navigation});
assert.equal(view.props.blocked,false);
accepted={pending:true};
view.props.onSelect(constants.tabRoutes[1]);assert.equal(calls.length,0,'A fresh pending snapshot must block even a stale rendered tab callback');
renderedAccepted=accepted;view=adapter.BloomTabsBar({state,navigation});assert.equal(view.props.blocked,true);
view.props.onSelect(constants.tabRoutes[2]);assert.equal(calls.length,0,'Failed/unconfirmed save cannot leave through Kegel');
hydrated=false;accepted=durable;view.props.onSelect(constants.tabRoutes[3]);assert.equal(calls.length,0,'Unknown storage cannot switch tabs');
hydrated=true;renderedAccepted=accepted;view=adapter.BloomTabsBar({state,navigation});
view.props.onSelect(constants.tabRoutes[2]);assert.equal(calls[1][0],'push');assert.equal(calls[1][1],'/bloom/kegel');
assert.equal(calls.filter(c=>c[0]==='navigate').length,0,'Kegel must retain its guarded root stack, not embed active work in a tab');
calls.length=0;prevent=true;view.props.onSelect(constants.tabRoutes[1]);assert.equal(calls.length,1,'Prevented tabPress must not navigate');
prevent=false;calls.length=0;view.props.onSelect(constants.tabRoutes[1]);assert.equal(calls[1][1],'library');
const feature=readFileSync('src/features/kegel/screens/KegelFeatureScreen.tsx','utf8');
assert(feature.includes('showBottomNavigation && stage==="home"'));
assert(feature.includes('currentOperation.busy || bloom.getAcceptedState()!==bloom.getDurableState() || recovery.navigationBlocked'));
assert(feature.includes('usePersistenceNavigationGuard(recovery.navigationBlocked)'));
assert(readFileSync('app/bloom/kegel.tsx','utf8').includes('<KegelFeatureScreen showBottomNavigation />'));
for(const file of ['LibraryEntryScreen','ProfileEntryScreen']) {
  const folder=file.startsWith('Library')?'library':'profile';
  const src=readFileSync(`src/features/${folder}/screens/${file}.tsx`,'utf8');
  assert(!/productActions|saveBloomLocalState|AsyncStorage|Math.random|new Date|Plus|Premium/.test(src));
}
console.log('Four-tab verification passed: exactly four accessible native items; 96pt safe-area bar; canonical V4 Home/Kegel; legacy links retained and hidden; stale pending/failed/unknown-storage boundaries; tabPress prevention; truthful Library/Profile skeletons; existing Kegel stack guards retained.');

const guarded=evaluate('src/shared/navigation/guardBloomNavigation.ts');
const rootState={index:1,routes:[{key:'tabs',name:'(tabs)'},{key:'kegel',name:'bloom/kegel'}]};
const pushed={index:2,routes:[...rootState.routes,{key:'new-tabs',name:'(tabs)'}]};
const removed={index:0,routes:[rootState.routes[0]]};
const locks={kegel:{preventRemove:true}};
assert(guarded.shouldBlockBloomNavigation(rootState,pushed,'NAVIGATE',locks,false),'Active exercises/guarded screens cannot be hidden by a forward deep link');
assert(guarded.shouldBlockBloomNavigation(rootState,pushed,'PUSH',{},true),'Unconfirmed saves block forward PUSH even before a guard-context render');
assert(!guarded.shouldBlockBloomNavigation(rootState,removed,'POP',locks,false),'Existing beforeRemove callbacks must still own normal removal and exit prompts');
assert(guarded.shouldBlockBloomNavigation(rootState,removed,'POP',locks,true));
assert(guarded.shouldBlockBloomRouteFocus(rootState,removed,locks,false),'Child focus cannot bypass the existing guard');
assert(!guarded.shouldBlockBloomNavigation(pushed,rootState,'POP',locks,true),'A displaced unprotected screen can return to its existing recovery owner');
assert(!guarded.shouldBlockBloomRouteFocus(pushed,rootState,locks,true));
const otherOwner={index:0,routes:[rootState.routes[0]]};
assert(guarded.shouldBlockBloomNavigation(rootState,otherOwner,'POP',{...locks,tabs:{preventRemove:true}},true),'An already protected current owner cannot escape through another recovery screen');
const tabState={index:0,routes:[{key:'today',name:'today'},{key:'library',name:'library'}]};
const tabChanged={...tabState,index:1};
assert(guarded.shouldBlockBloomNavigation(tabState,tabChanged,'JUMP_TO',{},true));
assert(!guarded.shouldBlockBloomNavigation(tabState,tabChanged,'JUMP_TO',{},false));
const entry={index:0,routes:[{key:'entry',name:'index'}]};
assert(!guarded.shouldBlockBloomNavigation(entry,{index:0,routes:[{key:'onboarding',name:'onboarding'}]},'REPLACE',{},true),'Entry redirects must preserve hydration/migration recovery');
assert(!guarded.shouldBlockBloomNavigation(rootState,null,'NAVIGATE',locks,true));
assert(!guarded.shouldBlockBloomNavigation(rootState,rootState,'SET_PARAMS',locks,true));
let next=pushed,uncertain=false;
const original={getStateForAction:()=>next,getStateForRouteFocus:()=>next};
const wrapped=guarded.createBloomRouterBoundary(original,()=>locks,()=>uncertain);
assert.equal(wrapped.getStateForAction(rootState,{type:'NAVIGATE'},{}),rootState);
next=removed;assert.equal(wrapped.getStateForAction(rootState,{type:'POP'},{}),removed);
uncertain=true;assert.equal(wrapped.getStateForAction(rootState,{type:'POP'},{}),rootState);
assert.equal(wrapped.getStateForRouteFocus(rootState,'tabs'),rootState);
const backCalls=[];
let history=true;
const back=evaluate('src/shared/navigation/BloomNestedBackButton.tsx',{'expo-router':{useRouter:()=>({canGoBack:()=>history,back:()=>backCalls.push('back'),replace:href=>backCalls.push(href)})},
  'react-native':{Pressable:'Pressable',View:'View'},'../../constants/navigation':constants,...runtime});
back.BloomNestedBackButton().props.onPress();history=false;back.BloomNestedBackButton().props.onPress();
assert.equal(backCalls.join('|'),'back|/(tabs)/profile');
assert(!readFileSync('app/_layout.tsx','utf8').includes('statusBarStyle:'));
console.log('Forward-navigation regression passed: real router-wrapper delegation, retained guarded owner, child focus, pending tab jumps, safe recovery return, entry redirect and native Back fallback.');

async function verifyTabRecovery() {
  let accepted={facts:'accepted'},durable={facts:'previous'},gate,count=0,blocked;
  let cursor=0,dirty=false,work=[],tree;const values=[],effects=[];
  const hooks={useState(initial){const i=cursor++;if(!(i in values))values[i]=initial;
    return [values[i],v=>{if(!Object.is(v,values[i])){values[i]=v;dirty=true;}}];},
    useRef(initial){const i=cursor++;return values[i] ?? (values[i]={current:initial});},
    useEffect(fn,deps){const i=cursor++;if(!effects[i] || deps.some((v,n)=>v!==effects[i].deps[n]))work.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
  const bloom={get state(){return accepted;},get durableState(){return durable;},getAcceptedState:()=>accepted,getDurableState:()=>durable,
    confirmCurrentPersistence:()=>{count++;return new Promise(resolve=>{gate=resolve;});}};
  const {BloomTabRecoveryScreen}=evaluate('src/shared/navigation/BloomTabRecoveryScreen.tsx',{
    react:hooks,'react/jsx-runtime':runtime['react/jsx-runtime'],'react-native':{View:'View'},
    '../../app/providers/BloomLocalStateProvider':{useBloomLocalState:()=>bloom},'../components/v4/AppText':{AppText:'AppText'},
    '../components/v4/AppButton':{AppButton:'AppButton'},'./usePersistenceNavigationGuard':{usePersistenceNavigationGuard:value=>{blocked=value;}}});
  const render=()=>{let turn=0;do{assert(++turn<20);dirty=false;cursor=0;tree=BloomTabRecoveryScreen({children:'existing screen'});
    const next=work;work=[];next.forEach(fn=>fn());}while(dirty);return nodes(tree);};
  const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
  let entries=render();assert(blocked);
  const press=entries.find(n=>n.props.testID==='bloom.tab-save.confirm').props.onPress;
  press();press();entries=render();assert.equal(count,1,'Current-state confirmation double taps must not create extra writes');
  assert(entries.find(n=>n.props.testID==='bloom.tab-save.confirm').props.disabled);
  gate({ok:false});await flush();entries=render();assert(blocked && entries.some(n=>n.props.testID==='bloom.tab-save.recovery'));
  entries.find(n=>n.props.testID==='bloom.tab-save.confirm').props.onPress();render();
  const captured=accepted;durable=captured;accepted={facts:'newer accepted'};gate({ok:true});await flush();entries=render();
  assert(blocked && entries.some(n=>n.props.testID==='bloom.tab-save.recovery'),'A superseded successful receipt must not claim latest state is durable');
  entries.find(n=>n.props.testID==='bloom.tab-save.confirm').props.onPress();render();durable=accepted;gate({ok:true});await flush();entries=render();
  assert(!blocked && !entries.some(n=>n.props.testID==='bloom.tab-save.recovery'));
  assert.equal(count,3);assert.equal(accepted,durable);
  assert(!readFileSync('src/shared/navigation/BloomTabRecoveryScreen.tsx','utf8').includes('productActions'),'Recovery must never replay a domain command');
  console.log('Tab recovery verification passed: existing current-confirmation API only, busy guard, double taps, failed save, superseded receipt and truthful durable-only unlock.');
}
void verifyTabRecovery().catch(error=>{console.error(error);process.exitCode=1;});
