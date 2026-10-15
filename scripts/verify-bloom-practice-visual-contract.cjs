// Normal/moderate/maximum JSX/text/style parity with the approved pre-fix UI.
// This catches changes to rendered layout; it is not a native pixel inspection.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const contractPath='docs/qa/practice-persistence/approved-practice-render-contract.json';
function evaluate(file,imports){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{assert(n in imports,n);return imports[n];}});return module.exports;}
const jsx=(type,props)=>({type,props:props||{}}),typography=evaluate('src/features/practice/practiceTypography.ts',{});
const base={phase:'intro',elapsedMs:65000,pauseMs:3000,question:0,pauses:[{atMs:10000,durationMs:3000}],levels:[{atMs:5000,level:7}],quality:8,content:true,ending:'stopped',feelings:['Sakin'],background:false,confirmingExit:false};
const definitions=[['intro',{}],['ready',{}, {introduced:true}],['start-dialog',{}, {},true],['running',{phase:'running'}],['background',{phase:'running',background:true}],['paused',{phase:'paused'}],['exit-dialog',{phase:'running',confirmingExit:true}],...[0,1,2].map(question=>['question-'+(question+1),{phase:'reflection',question}]),['summary',{phase:'summary'}],['saved',{phase:'summary'},{saved:true}],['retry',{phase:'summary'},{captured:true,recovery:jsx('View',{testID:'practice.save.status',children:jsx('Text',{children:'Kaydın bu cihaza yazıldığı doğrulanmadı. Aynı kaydı yeniden dene.'})})}]];
function contracts(file){const entries=[];
 for(const width of [375,402])for(const fontScale of [1,1.353,3.571])for(const [name,patch,productionPatch={},confirm=false] of definitions){
  const state={...base,...patch};let index=0;
  const session={getSnapshot:()=>state,subscribe(){},activate(){},dispose(){}};
  const imports={react:{useState(initial){const i=index++;return [i===2?confirm:typeof initial==='function'?initial():initial,()=>{}];},useRef:initial=>({current:initial}),useSyncExternalStore:(sub,get)=>get(),useEffect(){}},'react/jsx-runtime':{jsx,jsxs:jsx},'@react-navigation/native':{usePreventRemove(){}},'expo-router':{useRouter:()=>({}),useNavigation:()=>({})},'react-native':{AppState:{currentState:'active'},AccessibilityInfo:{},BackHandler:{},Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',View:'View',StyleSheet:{create:x=>x},useWindowDimensions:()=>({width,height:width===375?812:874,fontScale})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:62,bottom:34})},'react-native-reanimated':{default:{View:'AnimatedView'},useReducedMotion:()=>false,FadeInDown:{duration:()=>({}),delay:()=>({duration:()=>({})})}},'./PracticeText':{PracticeText:'Text'},'./practiceSession':{createPracticeSession:()=>session,formatPracticeTime:ms=>String(ms),practiceEndings:{stopped:'Boşalmadan bitirdim'},practiceFeelings:['Kontrollü','Sakin']},'./practiceTypography':typography,'./PracticeButton':{PracticeButton:'Button'},'../kegel/components/KegelUI':{KegelBack:'Back',KegelCard:'Card'},'./PracticeVisuals':{PracticeCheck:'Check',PracticeCurve:'Curve',PracticeOrb:'Orb',PracticeRule:'Rule',PracticeHint:'Hint'},'../kegel/kegelTheme':{kegelColors:{}}};
  const {PracticePreviewScreen}=evaluate(file,imports);const tree=PracticePreviewScreen({production:{introduced:false,busy:false,navigationBlocked:false,captured:false,saved:false,recovery:null,...productionPatch}});
  const normalized=JSON.stringify(tree,(key,value)=>key==='ref'||typeof value==='function'?undefined:value);
  entries.push({case:`${width}/${fontScale}/${name}`,sha256:crypto.createHash('sha256').update(normalized).digest('hex')});
 }return entries;
}
if(process.argv[2]==='--capture-approved'){
 assert(process.argv[3],'Provide the frozen, pre-reliability approved source');
 fs.writeFileSync(contractPath,JSON.stringify({scope:'Rendered text/styles/structure, not native pixels; approved pre-reliability PracticePreviewScreen',cases:contracts(process.argv[3])},null,2)+'\n');
}
const expected=JSON.parse(fs.readFileSync(contractPath,'utf8')).cases;assert.deepEqual(contracts('src/features/practice/PracticePreviewScreen.tsx'),expected);
console.log(`Practice visual contract passed: ${expected.length} rendered states at 375/402pt × normal/moderate/maximum; text/styles/layout identical to approved pre-fix UI. Not a new native pixel test.`);
