import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ScrollView, useWindowDimensions } from "react-native";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { AppText } from "../../../shared/components/v4/AppText";
import { PracticeButton } from "../PracticeButton";
import { delayNextPracticeQaSave, failNextPracticeQaSave, practiceQaPrefix } from "./practicePersistenceQa";
export function PracticeQaScreen(){const {width,height,fontScale}=useWindowDimensions();useEffect(()=>{console.info("PRACTICE_QA_VIEWPORT",JSON.stringify({width,height,fontScale}));},[width,height,fontScale]);const bloom=useBloomLocalState(),router=useRouter();return <ScrollView contentContainerStyle={{padding:24,paddingTop:70,gap:16,backgroundColor:"#000"}}>
  <AppText variant="title">İzole Practice QA</AppText><AppText testID="practice.qa.viewport">{`QA viewport ${width} × ${height} · fontScale ${fontScale}`}</AppText><AppText>{practiceQaPrefix}</AppText><AppText testID="practice.qa.count">Kalıcı pratik: {bloom.durableState.practice.sessions.length}</AppText>
  <PracticeButton testID="practice.qa.start" label="Production Practice" onPress={()=>router.push("/bloom/practice")}/><PracticeButton testID="practice.qa.history" label="Geçmiş" onPress={()=>router.push("/bloom/practice/history")}/>
  <PracticeButton testID="practice.qa.fail" label="Sonraki yazmayı başarısız yap" onPress={failNextPracticeQaSave}/><PracticeButton testID="practice.qa.delay" label="Sonraki yazmayı geciktir" onPress={delayNextPracticeQaSave}/>
  <PracticeButton testID="practice.qa.home" label="Ana sayfa" onPress={()=>router.replace("/today")}/><PracticeButton testID="practice.qa.settings" label="Veri kontrolleri" onPress={()=>router.push("/settings/data-controls")}/>
</ScrollView>;}
