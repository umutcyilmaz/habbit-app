import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { createKegelPreviewData, getKegelSetName } from "../kegelSession";
import { kegelPreviewConfig } from "../kegelConfig";
import { kegelColors as c } from "../kegelTheme";
import { KegelHomeScreen } from "./KegelHomeScreen";
import { KegelIntroScreen } from "./KegelIntroScreen";
import { KegelExerciseScreen } from "./KegelExerciseScreen";
import { KegelCompletionScreen } from "./KegelCompletionScreen";

const scenarios=[
  ["intro","İlk açılış"],["home","Ana ekran · boş durum"],["design","Ana ekran · örnek geçmiş"],
  ["step-1","Eğitim 1 · kası bul"],["step-2","Eğitim 2 · hisleri seç"],["step-3","Eğitim 3 · basılı tut"],["step-4","Eğitim 4 · teknik"],
  ["exercise","Egzersiz · gerçek süre"],["paused","Duraklatılmış · örnek"],["completed","Tamamlandı · örnek"]
] as const;
type Stage="home"|"intro"|"exercise"|"completed";
function stageFor(scenario:string):Stage {
  return scenario.startsWith("step-") ? "intro" : scenario==="exercise" || scenario==="paused" ? "exercise" : scenario==="completed" ? "completed" : "home";
}

// Entire feature is ephemeral. No provider, domain command, storage adapter,
// persistence schema or legacy exercise state is imported by this tree.
export function KegelPreviewScreen({scenario}:{scenario:string}) {
  const [selection,setSelection]=useState(scenario);
  const [generation,setGeneration]=useState(0);
  const [stage,setStage]=useState<Stage>(stageFor(scenario));
  const [introduced,setIntroduced]=useState(scenario!=="intro");
  const [menu,setMenu]=useState(false);
  const [fromRun,setFromRun]=useState(false);
  const data=createKegelPreviewData(selection==="design" ? "design" : "empty");
  const change=(id:string)=>{setSelection(id);setStage(stageFor(id));setIntroduced(id!=="intro");setFromRun(false);setGeneration(n=>n+1);setMenu(false);};
  const initialStep=selection.startsWith("step-") ? Math.min(3,Math.max(0,Number(selection.slice(5))-1)) : 0;
  return <View style={{flex:1,backgroundColor:c.canvas}}><StatusBar style="light" />
    {stage==="home" && <KegelHomeScreen key={generation} introduced={introduced} data={data} onIntro={()=>{setSelection("step-1");setStage("intro");}} onStart={()=>{setSelection("exercise");setStage("exercise");}} onMenu={()=>setMenu(true)} />}
    {stage==="intro" && <KegelIntroScreen key={generation} initialStep={initialStep} onClose={()=>setStage("home")} onFinish={()=>{setIntroduced(true);setStage("home");}} />}
    {stage==="exercise" && <KegelExerciseScreen key={generation} setName={getKegelSetName(data.done)} initialPaused={selection==="paused"}
      initialActiveMs={selection==="paused" ? kegelPreviewConfig.countdownSeconds*1000+1200 : 0}
      onComplete={()=>{setFromRun(true);setIntroduced(true);setStage("completed");}} onExit={()=>{setIntroduced(true);setStage("home");}} />}
    {stage==="completed" && <KegelCompletionScreen onDone={()=>{setIntroduced(true);setStage("home");}} fromRun={fromRun} />}
    <Modal visible={menu} transparent animationType="fade" onRequestClose={()=>setMenu(false)}><View style={{flex:1,backgroundColor:"rgba(0,0,0,.8)",padding:20,justifyContent:"center"}}>
      <View style={{backgroundColor:c.card,borderRadius:30,padding:20,maxHeight:"85%"}}><AppText variant="heading1">Kegel · izole önizleme</AppText>
        <AppText tone="secondary" style={{marginVertical:12}}>Tüm denemeler bellekte kalır. Örnek geçmiş açıkça etiketlenir. Program değerleri geçicidir.</AppText>
        <ScrollView contentContainerStyle={{gap:8}}>{scenarios.map(([id,label])=><AppButton key={id} testID={`kegel.preview.${id}`} label={label} variant="secondary" onPress={()=>change(id)} />)}</ScrollView>
        <AppButton label="Kapat" variant="ghost" onPress={()=>setMenu(false)} />
      </View></View></Modal>
  </View>;
}
