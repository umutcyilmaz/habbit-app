import { View } from "react-native";
import { useRouter } from "expo-router";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { PracticeText } from "./PracticeText";
import { PracticeButton } from "./PracticeButton";
import { PracticeRule } from "./PracticeVisuals";

export function PracticeEntryCard({location,showHistory=true,disabled=false}:{location:"home"|"library"|"article"|"history";showHistory?:boolean;disabled?:boolean}) {
  const bloom=useBloomLocalState(),router=useRouter();
  const ready=bloom.hydrationStatus==="ready",availability=bloom.getPracticeAvailability();
  const confirmed=()=>bloom.hasHydrated&&bloom.getAcceptedState()===bloom.getDurableState();
  return <View testID={`practice.entry.${location}`} style={{padding:20,gap:14,borderRadius:28,backgroundColor:availability.canStart?"#10153a":"#141415",borderWidth:1,borderColor:availability.canStart?"#303761":"#29292d"}}>
    <PracticeRule index={1} title={availability.canStart?"Pratik":"Pratik duraklatıldı"} detail={availability.canStart?"Eşiği tanı, istersen durakla. Süre hedefi yok.":availability.reason==="unavailable"?"Kalıcı durum doğrulanana kadar yeni pratik başlatılamaz.":"Reset tamamlanana ve gerekli kararlar kaydedilene kadar yeni pratik başlatılamaz."}/>
    {availability.canStart&&<PracticeButton testID={`practice.entry.${location}.start`} label="Pratiğe başla" disabled={disabled} onPress={()=>{if(!disabled&&bloom.getPracticeAvailability().canStart)router.push("/bloom/practice");}}/>}
    {showHistory&&<PracticeButton testID={`practice.entry.${location}.history`} secondary label="Pratik geçmişi" disabled={disabled||!ready||bloom.state!==bloom.durableState} onPress={()=>{if(!disabled&&confirmed())router.push("/bloom/practice/history");}}/>}
    <PracticeText testID={`practice.entry.${location}.detail`} style={{fontSize:12,lineHeight:18,color:"#8e8e93"}}>Pratik rehberli bir egzersizdir. Mastürbasyon takibinden bağımsızdır.</PracticeText>
  </View>;
}
