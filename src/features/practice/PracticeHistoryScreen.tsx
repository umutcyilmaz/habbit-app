import { ScrollView, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { practiceLayout } from "./practiceTypography";
import { PracticeText } from "./PracticeText";
import { KegelBack, KegelCard } from "../kegel/components/KegelUI";
import { practiceEndingLabels } from "../../domain/models/PracticeState";
import { groupPracticeHistory } from "./practiceHistory";
import { formatPracticeTime as fmt } from "./practiceSession";
import { PracticeEntryCard } from "./PracticeEntryCard";

export function PracticeHistoryScreen() {
  const bloom=useBloomLocalState(),router=useRouter(),insets=useSafeAreaInsets();
  const {fontScale,width,height}=useWindowDimensions();
  const stacked=practiceLayout(width,height,fontScale).stacked;
  const heading=<PracticeText textRole="display" testID="practice.history.heading" accessibilityRole="header" accessibilityLabel="Pratik geçmişi" variant="title" style={{fontSize:24,lineHeight:30}}>Pratik geçmişi</PracticeText>;
  const groups=bloom.hydrationStatus==="ready"?groupPracticeHistory(bloom.durableState.practice):[];
  return <View testID="practice.history" style={{flex:1,backgroundColor:"#000",paddingTop:insets.top,paddingHorizontal:18}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:12}}><KegelBack testID="practice.history.back" back onPress={()=>{if(bloom.getAcceptedState()===bloom.getDurableState())router.canGoBack()?router.back():router.replace("/today");}}/>{!stacked&&<View style={{flex:1,minWidth:0}}>{heading}</View>}</View>
    <ScrollView key={`${width}:${height}:${fontScale}`} contentContainerStyle={{gap:14,paddingBottom:insets.bottom+24}}>
      {stacked&&heading}
      <PracticeText style={{color:"#8e8e93",fontSize:14,lineHeight:22}}>Yalnız bu cihaza kaydedilen tamamlanmış pratikler. Günler kaydetme anındaki yerel saat dilimine göre gruplanır.</PracticeText>
      {bloom.hydrationStatus!=="ready"?<PracticeText>Kayıtlar doğrulanıyor.</PracticeText>:groups.length===0?<KegelCard testID="practice.history.empty"><PracticeText testID="practice.history.empty.heading" variant="title">Henüz kaydedilmiş pratik yok</PracticeText><PracticeText testID="practice.history.empty.body" style={{marginTop:12,color:"#8e8e93"}}>Tamamladığın pratiği açıkça kaydettiğinde burada görünür. Yarım kalan egzersizler saklanmaz.</PracticeText></KegelCard>:groups.map(group=><View key={group.day} style={{gap:12}}><PracticeText accessibilityRole="header" style={{color:"#aab3ff",marginTop:16}}>{new Date(group.day+"T12:00:00Z").toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}</PracticeText>{group.sessions.map(session=><KegelCard key={session.id} testID="practice.history.record" style={{gap:12}}>
        <PracticeText variant="title">{fmt(session.foregroundExerciseMs)} · {session.pauses.length} duraklama</PracticeText>
        <PracticeText>Aktif {fmt(session.activeMs)} · Duraklama {fmt(session.intentionalPauseMs)}</PracticeText>
        {!!session.pauses.length&&<PracticeText style={{color:"#8e8e93"}}>{session.pauses.map((p,i)=>`${i+1}. duraklama: ${fmt(p.startMs)}–${fmt(p.endMs)}`).join("\n")}</PracticeText>}
        <PracticeText style={{color:"#aab3ff"}}>KULLANICI BEYANI</PracticeText>
        <PracticeText testID="practice.history.answers">Ereksiyon: {session.erectionQuality===null?"Atlandı":`${session.erectionQuality} / 10`}{"\n"}Açık içerik: {session.explicitContent===null?"Atlandı":session.explicitContent?"Evet":"Hayır"}{"\n"}Bitiş: {session.ending?practiceEndingLabels[session.ending]:"Atlandı"}{"\n"}His: {session.feelings.length?session.feelings.join(", "):"Belirtilmedi"}</PracticeText>
        <PracticeText testID="practice.history.reports" style={{color:"#8e8e93"}}>Uyarılma beyanları: {session.arousalReports.length?session.arousalReports.map(r=>`${fmt(r.atMs)} · ${r.level}/10`).join("\n"):"Belirtilmedi"}</PracticeText>
        {session.explicitContent===true&&<PracticeText style={{color:"#d9a46b"}}>Bu beyan Content-Free, Reset veya Tracking kayıtlarını değiştirmez.</PracticeText>}
        <PracticeText style={{fontSize:12,lineHeight:18,color:"#8e8e93"}}>Kaydedildi · {session.timezone.name}</PracticeText>
      </KegelCard>)}</View>)}
      <PracticeEntryCard location="history" showHistory={false}/>
    </ScrollView>
  </View>;
}
