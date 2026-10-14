import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { useNavigation, useRouter } from "expo-router";
import { AccessibilityInfo, AppState, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppText } from "../../shared/components/v4/AppText";
import { KegelBack, KegelCard, KegelHint } from "../kegel/components/KegelUI";
import { createPracticeSession, formatPracticeTime as fmt, practiceEndings, practiceFeelings } from "./practiceSession";
import { PracticeButton } from "./PracticeButton";
import { PracticeCheck, PracticeCurve, PracticeOrb, PracticeRule } from "./PracticeVisuals";
import { kegelColors as c } from "../kegel/kegelTheme";

export function PracticePreviewScreen() {
  const [session]=useState(()=>createPracticeSession(()=>performance.now()));
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  const insets=useSafeAreaInsets(), reduced=useReducedMotion(), router=useRouter(), navigation=useNavigation();
  const [startConfirm,setStartConfirm]=useState(false), [levelOpen,setLevelOpen]=useState(false), [foreground,setForeground]=useState(AppState.currentState==="active");
  const scroll=useRef<ScrollView>(null), leave=useRef(false), cooldown=useRef(-Infinity);
  const {fontScale}=useWindowDimensions();
  const largeText=fontScale>1.4;
  const timed=state.phase==="running"||state.phase==="paused";
  const protectedDraft=state.phase!=="intro"&&state.phase!=="discarded";
  const exit=()=>{if(protectedDraft)session.askExit();else router.replace("/today");};
  // The existing Bloom navigator also guards unacknowledged persistent writes.
  usePreventRemove(protectedDraft,()=>session.askExit());
  useEffect(()=>{navigation.setOptions({gestureEnabled:!protectedDraft});return ()=>navigation.setOptions({gestureEnabled:true});},[navigation,protectedDraft]);
  useEffect(()=>{const sub=BackHandler.addEventListener("hardwareBackPress",()=>{exit();return true;});return ()=>sub.remove();});
  useEffect(()=>{session.activate();return ()=>session.dispose();},[session]);
  useEffect(()=>{
    const sub=AppState.addEventListener("change",status=>{setForeground(status==="active");if(status!=="active")session.background();});
    if(AppState.currentState!=="active")session.background();
    return ()=>sub.remove();
  },[session]);
  useEffect(()=>{
    if(!timed||state.background||state.confirmingExit||!foreground)return;
    const timer=setInterval(session.tick,250);
    return ()=>clearInterval(timer);
  },[session,timed,state.background,state.confirmingExit,foreground]);
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});AccessibilityInfo.announceForAccessibility(state.phase==="reflection"?`Soru ${state.question+1} / 3`:state.phase==="summary"?"Pratik tamamlandı. Kaydedilmedi.":state.phase==="paused"?"Duraklama başladı":state.phase==="running"?"Pratik başladı":"Pratik önizlemesi");},[state.phase,state.question]);
  useEffect(()=>{if(state.phase==="discarded"&&!leave.current){leave.current=true;router.replace("/today");}},[state.phase,router]);
  const press=(action:()=>void)=>{const now=performance.now();if(now-cooldown.current<350)return;cooldown.current=now;action();};
  const animate=foreground&&!state.background&&!state.confirmingExit;
  const selectedLevel=state.levels[state.levels.length-1]?.level;
  const choose=(id:string,label:string,selected:boolean,onPress:()=>void,amber=false,lit=false)=><Pressable key={id} testID={`practice.${id}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={[s.choice,/^(level|quality)\./.test(id)&&{width:fontScale>2.4?"45%":largeText?"30%":"17%",flexGrow:1},lit&&{backgroundColor:"#171b40"},selected&&{borderColor:amber?c.warning:c.blue,backgroundColor:amber?"#322719":"#191e4a"}]}><AppText style={[s.choiceText,amber&&selected&&{color:c.warning}]}>{label}</AppText></Pressable>;
  const row=(label:string,value:string)=><View key={label} style={[s.row,largeText&&{flexDirection:"column"}]}><AppText style={s.meta}>{label}</AppText><AppText variant="title" style={{flex:1,textAlign:largeText?"left":"right",fontSize:15,lineHeight:22}}>{value}</AppText></View>;
  const questionValue=state.question===0?state.quality:state.question===1?state.content:state.ending;
  return <View testID={`practice.${state.phase}`} style={[s.screen,{paddingTop:insets.top,paddingBottom:Math.max(20,insets.bottom)}]}>
    <View style={s.top}>
      <KegelBack testID="practice.exit" back={state.phase==="reflection"&&state.question>0} onPress={()=>state.phase==="reflection"&&state.question>0?press(()=>session.back(state.question)):exit()}/>
      <AppText variant="title" style={{fontSize:17,flex:1,textAlign:"center"}}>{state.phase==="paused"?`${state.pauses.length+1}. duraklama`:"Pratik"}</AppText>
      {!largeText&&<AppText style={[s.meta,{fontSize:12,maxWidth:"33%",textAlign:"right"}]}>QA · Kaydedilmez</AppText>}
    </View>
    <ScrollView ref={scroll} style={{flex:1}} contentContainerStyle={{paddingBottom:24}} showsVerticalScrollIndicator={false}>
      {largeText&&<AppText accessibilityLabel="Pratik önizlemesi. Kaydedilmez." style={[s.meta,{marginTop:10,color:c.light}]}>Kaydedilmez</AppText>}
      <Animated.View key={`${state.phase}-${state.question}`} {...(reduced?{}:{entering:FadeInDown.duration(300)})}>
        {state.phase==="intro"&&<>
          <AppText style={[s.meta,{marginTop:22,color:c.light}]}>AROUSAL CONTROL</AppText>
          <AppText testID="practice.intro.heading" accessibilityRole="header" accessibilityLabel="Yükselişi daha erken fark et" variant="display" style={s.title}>{largeText?"Artışı daha erken fark\u00a0et":"Yükselişi daha erken fark\u00a0et"}</AppText>
          <AppText style={s.sub}>Bu pratik uyarılma seviyeni tanımana, otomatikleşmeden önce durmana ve istersen daha bilinçli devam etmene yardımcı olur.</AppText>
          <View style={{gap:10,marginTop:24}}>{[
            ["clock","Süre hedefi yok","Ulaşman gereken bir süre yok."],
            ["rep","Duraklama pratiğin kendisi","Kısa bir an durmak başarısızlık değil, becerinin ta kendisi."],
            ["wave","Sertlik değişebilir","Duraklamada sertlik azalırsa bu normal. Nazikçe devam edebilir ya da pratiği bitirebilirsin."],
            ["up","Süre sadece bir trend","Süreyi iyi ya da kötü diye değerlendirmeyiz. Bu önizleme kaydedilmez."]
          ].map(([,title,detail],i)=><Animated.View key={title} {...(reduced?{}:{entering:FadeInDown.delay(150+i*80).duration(450)})}><KegelCard style={{padding:14,borderRadius:22}}><PracticeRule index={i} title={title!} detail={detail!}/></KegelCard></Animated.View>)}</View>
        </>}
        {state.phase==="running"&&<>
          <View style={s.timer}><AppText testID="practice.elapsed" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} variant="display" style={[s.time,largeText&&{fontSize:32,lineHeight:42}]}>{fmt(state.elapsedMs)}</AppText><AppText style={s.meta}>toplam süre · {state.pauses.length} duraklama</AppText></View>
          <PracticeCurve state={state} animate={animate}/>
          <KegelCard style={{marginTop:22}}>
            <AppText variant="title" style={{fontSize:18}}>Uyarılma rehberi</AppText>
            {largeText&&<AppText style={{color:c.light,marginTop:18}}>7–10 · Burada dur</AppText>}
            <View style={s.scale}><View style={s.bracket}>{!largeText&&<AppText style={{color:c.light,fontSize:12,backgroundColor:c.card,paddingHorizontal:6,marginTop:-11}}>Burada dur</AppText>}</View><View style={s.line}/><View style={s.ticks}>{Array.from({length:10},(_,i)=><View key={i} style={{alignItems:"center",flex:1,gap:8}}><View style={[s.dot,{backgroundColor:i>=6?c.blue:"#4a4a51"}]}/><AppText accessible={false} allowFontScaling={false} style={{fontSize:13,color:i>=6?"#fff":c.muted}}>{i+1}</AppText></View>)}</View></View>
            <View style={[s.groups,largeText&&{flexWrap:"wrap"}]}>{[["1–3","Sakin"],["4–6","Yükseliyor"],["7–8","Yoğun"],["9–10","Eşik"]].map(([range,label],i)=><View key={range} style={largeText?{width:"100%",alignItems:"flex-start",paddingVertical:8}:{flex:1,alignItems:"center"}}><AppText style={{fontSize:12,color:c.muted}}>{range}</AppText><AppText style={{fontSize:13,color:i>1?c.light:"#fff"}}>{label}</AppText></View>)}</View>
          </KegelCard>
          <Pressable testID="practice.level.open" accessibilityRole="button" accessibilityState={{expanded:levelOpen}} onPress={()=>setLevelOpen(!levelOpen)} style={{minHeight:48,justifyContent:"center"}}><AppText style={{color:c.light,fontSize:14}}>Seviyemi belirt · {selectedLevel?`${selectedLevel} / 10 (beyanım)`:"isteğe bağlı"}</AppText></Pressable>
          {levelOpen&&<View style={s.grid}>{Array.from({length:10},(_,i)=>choose(`level.${i+1}`,String(i+1),selectedLevel===i+1,()=>session.reportLevel(i+1)))}</View>}
          <KegelCard style={{padding:18,borderRadius:24}}><AppText variant="title" style={{fontSize:16}}>Bu pratikte hedef</AppText><AppText style={[s.sub,{fontSize:15}]}>Boşalmayı geciktirmek değil, eşiği tanımak. Daha fazlası önerilmiyor.</AppText></KegelCard>
        </>}
        {state.phase==="paused"&&<>
          <PracticeOrb pauseMs={state.pauseMs} animate={animate}/>
          <AppText style={[s.sub,{textAlign:"center",marginTop:20}]}>Elini çek. Nefesin yavaşlasın.</AppText>
          <View style={[s.timer,{marginTop:22}]}><AppText testID="practice.pause.elapsed" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} variant="display" style={[s.time,{fontSize:largeText?32:44,lineHeight:largeText?42:56}]}>{fmt(state.pauseMs)}</AppText><AppText style={s.meta}>duraklama · toplam {fmt(state.elapsedMs)}</AppText></View>
          <KegelCard style={{marginTop:22,borderRadius:24}}><AppText variant="title" style={{fontSize:16,lineHeight:23}}>Seviye dörde inince devam edebilirsin.</AppText><AppText style={[s.sub,{fontSize:15}]}>Sertlik azalırsa bu normal. Devam etmek zorunda değilsin.</AppText></KegelCard>
        </>}
        {state.phase==="reflection"&&<View testID={`practice.question.${state.question+1}`}>
          <View style={s.progress}>{[0,1,2].map(i=><View key={i} style={[s.segment,i<=state.question&&{backgroundColor:c.blue}]}/>)}</View>
          <AppText style={[s.meta,{marginTop:28}]}>Soru {state.question+1} / 3</AppText>
          <AppText accessibilityRole="header" variant="display" style={s.title}>{["Ereksiyon kalitesi nasıldı?","Açık içerik kullandın mı?","Pratik nasıl bitti?"][state.question]}</AppText>
          <AppText style={s.sub}>{["Pratik sırasındaki genel izlenimin.","Pratik sırasında ya da hemen öncesinde.","Hepsi kabul edilebilir. Örüntüyü fark etmek için."][state.question]}</AppText>
          {state.question===0&&<><View style={[s.grid,{marginTop:26}]}>{Array.from({length:10},(_,i)=>choose(`quality.${i+1}`,String(i+1),state.quality===i+1,()=>session.answerQuality(i+1),false,state.quality!==null&&i+1<state.quality))}</View><View testID="practice.quality.endpoints" style={{flexDirection:largeText?"column":"row",justifyContent:"space-between",alignItems:largeText?"flex-start":"stretch",marginTop:10,gap:8}}><AppText testID="practice.quality.low" style={[s.meta,{flexShrink:1,maxWidth:"100%"}]}>1 · Zayıf</AppText><AppText testID="practice.quality.high" style={[s.meta,{flexShrink:1,maxWidth:"100%"}]}>10 · Tam</AppText></View><KegelHint>Bu bir test değil. Kendini denemeye çalışma. Pratik sırasında ne fark ettiysen onu işaretle.</KegelHint></>}
          {state.question===1&&<><View style={[s.grid,{marginTop:26}]}>{choose("content.no","Hayır",state.content===false,()=>session.answerContent(false))}{choose("content.yes","Evet",state.content===true,()=>session.answerContent(true),true)}</View><KegelHint warning={state.content===true}>Bu cevap yalnızca bu önizlemede kalır. İçeriksiz süre sayacını ve mastürbasyon takibini değiştirmez.</KegelHint>{state.content===true&&<KegelCard style={{marginTop:16,backgroundColor:"#261f17"}}><AppText style={{color:c.warning,fontSize:16}}>Sayaç sıfırlanmayacak</AppText><AppText style={s.sub}>Kazara gördüysen “Hayır” seç; sayılmaz. Kaydetme ve sayaç kuralları sonraki aşamada değerlendirilecek.</AppText></KegelCard>}</>}
          {state.question===2&&<><View style={{gap:10,marginTop:24}}>{Object.entries(practiceEndings).map(([value,label])=>choose(`ending.${value}`,label,state.ending===value,()=>session.answerEnding(value as keyof typeof practiceEndings)))}</View><AppText style={[s.meta,{marginTop:24,marginBottom:10}]}>Nasıl hissettin? · isteğe bağlı</AppText><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{practiceFeelings.map((f,i)=>choose(`feeling.${i}`,f,state.feelings.includes(f),()=>press(()=>session.toggleFeeling(f))))}</View></>}
        </View>}
        {state.phase==="summary"&&<>
          <View style={{alignItems:"center",marginTop:26}}><PracticeCheck animate={foreground}/></View>
          <AppText accessibilityRole="header" variant="display" style={[s.title,{textAlign:"center",marginTop:24}]}>Pratik tamamlandı</AppText><AppText style={[s.sub,{textAlign:"center"}]}>{fmt(state.elapsedMs)} · {state.pauses.length} duraklama</AppText>
          <AppText testID="practice.unsaved" style={[s.meta,{textAlign:"center",marginTop:10,color:c.light}]}>Önizleme · Kaydedilmedi</AppText>
          {!!state.pauses.length&&<KegelCard style={{marginTop:24}}><AppText variant="title" style={{fontSize:16}}>İlk duraklama {fmt(state.pauses[0]!.atMs)}’da</AppText><AppText style={s.sub}>Bu süre bir başarı puanı değil. Yalnızca bu pratiğin özeti.</AppText></KegelCard>}
          <KegelCard style={{marginTop:12}}><AppText style={s.meta}>SÜRE</AppText>{row("Toplam süre",fmt(state.elapsedMs))}{row("Aktif süre",fmt(state.elapsedMs-state.pauses.reduce((sum,p)=>sum+p.durationMs,0)))}{state.pauses.length?state.pauses.map((p,i)=>row(`${i+1}. duraklama · ${fmt(p.atMs)}’da`,fmt(p.durationMs))):row("Duraklama","Yok")}</KegelCard>
          <KegelCard style={{marginTop:12}}><AppText style={s.meta}>ÖZET · KULLANICI BEYANI</AppText>{row("Ereksiyon",state.quality?`${state.quality} / 10`:"Atlandı")}{row("Açık içerik",state.content===null?"Atlandı":state.content?"Evet":"Hayır")}{row("Bitiş",state.ending?practiceEndings[state.ending]:"Atlandı")}{!!state.feelings.length&&row("His",state.feelings.join(", "))}{row("Seviye girişleri",state.levels.length?state.levels.map(p=>`${fmt(p.atMs)} · ${p.level}/10`).join("\n"):"Belirtilmedi")}</KegelCard>
        </>}
      </Animated.View>
    </ScrollView>
    {state.background&&timed&&<View testID="practice.background" style={{paddingVertical:10}}><AppText style={{color:c.warning,fontSize:14,lineHeight:20}}>Arka planda süre durdu. Hazır olduğunda devam et.</AppText></View>}
    <View style={{gap:10,paddingTop:12}}>
      {state.phase==="intro"&&<PracticeButton testID="practice.start" compactLabel="Başla" label="Pratiğe başla" onPress={()=>setStartConfirm(true)}/>}
      {timed&&<><PracticeButton testID={state.background?"practice.foreground":state.phase==="paused"?"practice.resume":"practice.pause"} compactLabel={state.phase==="running"&&!state.background?"Durakla":"Devam et"} label={state.background?"Zamanlayıcıya devam et":state.phase==="paused"?"Pratiğe devam et":"Duraklama başlat"} onPress={()=>press(()=>state.background?session.continueForeground():state.phase==="paused"?session.resume():session.pause())}/><PracticeButton testID="practice.finish" compactLabel="Bitir" secondary label="Pratiği bitir" disabled={state.background} onPress={()=>press(session.finish)}/></>}
      {state.phase==="reflection"&&<><PracticeButton testID="practice.next" compactLabel={state.question===2?"Özet":"Devam"} disabled={questionValue===null} label={state.question===2?"Özeti göster":"Devam"} style={state.question===1&&state.content===true?{backgroundColor:"#866137"}:undefined} onPress={()=>press(()=>session.next(state.question))}/><Pressable testID="practice.skip" accessibilityRole="button" onPress={()=>press(()=>session.next(state.question,true))} style={s.link}><AppText style={s.meta}>Bu soruyu atla</AppText></Pressable></>}
      {state.phase==="summary"&&<><PracticeButton testID="practice.done" label="Tamam" onPress={session.discard}/><Pressable testID="practice.edit" accessibilityRole="button" style={s.link} onPress={()=>press(session.edit)}><AppText style={s.meta}>Yanıtları düzenle</AppText></Pressable></>}
    </View>
    <Modal visible={startConfirm||state.confirmingExit} transparent animationType={reduced?"none":"fade"} onRequestClose={()=>{setStartConfirm(false);session.keep();}}>
      <View style={s.scrim}><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:"flex-end"}}><KegelCard accessibilityViewIsModal style={{padding:24}}><AppText accessibilityRole="header" variant="display" style={[s.title,{fontSize:25,lineHeight:31}]}>{startConfirm?"Pratiğe hazır mısın?":"Pratikten çıkmak istiyor musun?"}</AppText><AppText style={s.sub}>{startConfirm?"Süre hedefi yok. İstediğin an durabilir ya da bitirebilirsin. Bu QA önizlemesi hiçbir oturum kaydetmez.":"Çıkarsan bu geçici pratik silinir. Yanıtlarını ve özeti görmek için pratiği bitirebilirsin."}</AppText><View style={{gap:10,marginTop:22}}>{startConfirm?<><PracticeButton testID="practice.start.confirm" label="Başlat" disabled={!foreground} onPress={()=>{session.start();setStartConfirm(false);}}/><PracticeButton testID="practice.start.cancel" secondary label="Şimdi değil" onPress={()=>setStartConfirm(false)}/></>:<><PracticeButton testID="practice.exit.keep" label="Pratiğe dön" onPress={session.keep}/>{timed&&<PracticeButton testID="practice.exit.finish" label="Bitir ve soruları aç" secondary disabled={state.background} onPress={session.finish}/>}<PracticeButton testID="practice.exit.confirm" label="Önizlemeden çık" secondary onPress={session.discard}/></>}</View></KegelCard></ScrollView></View>
    </Modal>
  </View>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#000",paddingHorizontal:18},top:{minHeight:56,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
  title:{fontSize:30,lineHeight:34,letterSpacing:-.6,marginTop:8},sub:{fontSize:16,lineHeight:24,color:c.muted,marginTop:10},meta:{fontSize:14,lineHeight:20,color:c.muted},
  timer:{alignItems:"center",marginTop:28},time:{fontSize:76,lineHeight:90,letterSpacing:-2,fontVariant:["tabular-nums"],maxWidth:"100%"},
  scale:{marginTop:44},bracket:{position:"absolute",left:"60%",right:0,top:-25,height:20,borderWidth:1.5,borderBottomWidth:0,borderColor:c.blue,borderTopLeftRadius:10,borderTopRightRadius:10,alignItems:"center"},line:{position:"absolute",left:"5%",right:"5%",height:4,top:5,backgroundColor:"#4a4a51"},ticks:{flexDirection:"row"},dot:{width:14,height:14,borderRadius:7},groups:{flexDirection:"row",marginTop:18,paddingTop:14,borderTopWidth:1,borderColor:c.line,gap:4},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{minWidth:48,minHeight:58,paddingHorizontal:12,paddingVertical:14,borderRadius:15,borderWidth:1.5,borderColor:c.line,backgroundColor:c.raised,alignItems:"center",justifyContent:"center",flexGrow:1},choiceText:{fontSize:16,lineHeight:24},
  progress:{flexDirection:"row",gap:6,marginTop:14},segment:{flex:1,height:4,borderRadius:2,backgroundColor:"#28282c"},row:{flexDirection:"row",alignItems:"flex-start",gap:12,paddingVertical:13,borderBottomWidth:1,borderColor:c.line},link:{minHeight:44,alignItems:"center",justifyContent:"center"},scrim:{flex:1,backgroundColor:"rgba(0,0,0,.8)",padding:20,paddingTop:60,paddingBottom:40}
});
