import type { ReactNode } from "react";
import type { PracticeSnapshot } from "./practiceSession";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { useNavigation, useRouter } from "expo-router";
import { AccessibilityInfo, AppState, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { PracticeText } from "./PracticeText";
import { KegelBack, KegelCard } from "../kegel/components/KegelUI";
import { createPracticeSession, formatPracticeTime as fmt, practiceEndings, practiceFeelings } from "./practiceSession";
import { practiceLayout } from "./practiceTypography";
import { PracticeButton } from "./PracticeButton";
import { PracticeCheck, PracticeCurve, PracticeOrb, PracticeRule, PracticeHint } from "./PracticeVisuals";
import { kegelColors as c } from "../kegel/kegelTheme";

export type PracticeProductionControls = {
  introduced:boolean; isNavigationBlockedNow?:()=>boolean; isSavedNow?:()=>boolean; isCapturedNow?:()=>boolean; saveDisabled?:boolean; busy:boolean; navigationBlocked:boolean; captured:boolean; saved:boolean;
  onStart:(startSession:()=>boolean)=>Promise<boolean>; onSave:(state:PracticeSnapshot)=>void;
  onReport:(atMs:number,level:number)=>void; onLeave:()=>void; recovery:ReactNode;
};
// Shared approved native experience. Production actions are injected by the
// guarded feature; the isolated preview has no persistence capabilities.
export function PracticePreviewScreen({production}:{production?:PracticeProductionControls} = {}) {
  const [instructions,setInstructions]=useState(false);
  const [session]=useState(()=>createPracticeSession(()=>performance.now()));
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  const insets=useSafeAreaInsets(), reduced=useReducedMotion(), router=useRouter(), navigation=useNavigation();
  const [startConfirm,setStartConfirm]=useState(false), [levelOpen,setLevelOpen]=useState(false), [foreground,setForeground]=useState(AppState.currentState==="active");
  const scroll=useRef<ScrollView>(null), leave=useRef(false), cooldown=useRef(-Infinity), mounted=useRef(false);
  const {fontScale,width,height}=useWindowDimensions();
  const layout=practiceLayout(width,height,fontScale),largeText=layout.stacked;
  const flowingControls=layout.flowingControls||!!production?.recovery;
  const timed=state.phase==="running"||state.phase==="paused";
  const protectedDraft=state.phase!=="intro"&&state.phase!=="discarded"&&!production?.saved;
  const protectedNavigation=protectedDraft||!!production?.navigationBlocked;
  const leaveScreen=()=>production?production.onLeave():router.replace("/today");
  const blockedNow=()=>production?.isNavigationBlockedNow?.()??!!production?.navigationBlocked;
  const exit=()=>{if(blockedNow())return;if(production?.isSavedNow?.())leaveScreen();else if(protectedDraft)session.askExit();else leaveScreen();};
  // The existing Bloom navigator also guards unacknowledged persistent writes.
  usePreventRemove(protectedNavigation,()=>{if(!blockedNow()&&!production?.isSavedNow?.())session.askExit();});
  useEffect(()=>{navigation.setOptions({gestureEnabled:!protectedNavigation});return ()=>navigation.setOptions({gestureEnabled:true});},[navigation,protectedNavigation]);
  useEffect(()=>{const sub=BackHandler.addEventListener("hardwareBackPress",()=>{exit();return true;});return ()=>sub.remove();});
  useEffect(()=>{mounted.current=true;session.activate();return ()=>{mounted.current=false;session.dispose();};},[session]);
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
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});AccessibilityInfo.announceForAccessibility(state.phase==="reflection"?`Soru ${state.question+1} / 3`:state.phase==="summary"?"Pratik tamamlandı. Kaydedilmedi.":state.phase==="paused"?"Duraklama başladı":state.phase==="running"?"Pratik başladı":production?"Pratik":"Pratik önizlemesi");},[state.phase,state.question,instructions]);
  useEffect(()=>{if(state.phase==="discarded"&&!leave.current){leave.current=true;leaveScreen();}},[state.phase,router]);
  useEffect(()=>{if(production?.saved)AccessibilityInfo.announceForAccessibility("Pratik bu cihaza kaydedildi.");},[production?.saved]);
  const press=(action:()=>void)=>{if(production?.isCapturedNow?.()??production?.captured)return;const now=performance.now();if(now-cooldown.current<350)return;cooldown.current=now;action();};
  const animate=foreground&&!state.background&&!state.confirmingExit;
  const selectedLevel=state.levels[state.levels.length-1]?.level;
  const confirmStart=()=>{
    setStartConfirm(false);
    const startSession=()=>{
      if(!mounted.current||AppState.currentState!=="active"||session.getSnapshot().phase!=="intro")return false;
      session.start();
      return session.getSnapshot().phase==="running";
    };
    if(production)void production.onStart(startSession).catch(()=>{});
    else startSession();
  };
  const choose=(id:string,label:string,selected:boolean,onPress:()=>void,amber=false,lit=false)=><Pressable key={id} testID={`practice.${id}`} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={[s.choice,/^(level|quality)\./.test(id)&&{width:`${100/layout.columns-3}%`,flexGrow:1},lit&&{backgroundColor:"#171b40"},selected&&{borderColor:amber?c.warning:c.blue,backgroundColor:amber?"#322719":"#191e4a"}]}><PracticeText textRole="control" style={[s.choiceText,amber&&selected&&{color:c.warning}]}>{label}</PracticeText></Pressable>;
  const row=(label:string,value:string)=><View key={label} testID={`practice.summary.row.${label}`} style={[s.row,largeText&&{flexDirection:"column"}]}><PracticeText style={s.meta}>{label}</PracticeText><PracticeText variant="title" style={{flex:largeText?undefined:1,width:largeText?"100%":undefined,textAlign:largeText?"left":"right",fontSize:15,lineHeight:22}}>{value}</PracticeText></View>;
  const questionValue=state.question===0?state.quality:state.question===1?state.content:state.ending;
  const controls=<>
    {state.background&&timed&&<View testID="practice.background" style={{paddingVertical:10}}><PracticeText style={{color:c.warning,fontSize:14,lineHeight:20}}>Arka planda süre durdu. Hazır olduğunda devam et.</PracticeText></View>}
    <View testID="practice.controls" style={{gap:10,paddingTop:12}}>
      {state.phase==="intro"&&<PracticeButton testID="practice.start" label="Pratiğe başla" disabled={!!production?.busy||!!production?.navigationBlocked} onPress={()=>setStartConfirm(true)}/>}
      {timed&&<><PracticeButton testID={state.background?"practice.foreground":state.phase==="paused"?"practice.resume":"practice.pause"} label={state.background?"Zamanlayıcıya devam et":state.phase==="paused"?"Pratiğe devam et":"Duraklama başlat"} onPress={()=>press(()=>state.background?session.continueForeground():state.phase==="paused"?session.resume():session.pause())}/><PracticeButton testID="practice.finish" secondary label="Pratiği bitir" disabled={state.background} onPress={()=>press(session.finish)}/></>}
      {state.phase==="reflection"&&<><PracticeButton testID="practice.next" disabled={questionValue===null} label={state.question===2?"Özeti göster":"Devam"} style={state.question===1&&state.content===true?{backgroundColor:"#866137"}:undefined} onPress={()=>press(()=>session.next(state.question))}/><Pressable testID="practice.skip" accessibilityRole="button" onPress={()=>press(()=>session.next(state.question,true))} style={s.link}><PracticeText textRole="control" style={[s.meta,{textAlign:"center"}]}>Bu soruyu atla</PracticeText></Pressable></>}
      {state.phase==="summary"&&!production&&<><PracticeButton testID="practice.done" label="Tamam" onPress={session.discard}/><Pressable testID="practice.edit" accessibilityRole="button" style={s.link} onPress={()=>press(session.edit)}><PracticeText textRole="control" style={[s.meta,{textAlign:"center"}]}>Yanıtları düzenle</PracticeText></Pressable></>}
      {state.phase==="summary"&&production&&<>
        {production.saved?<PracticeButton testID="practice.done" label="Pratik geçmişine git" onPress={production.onLeave}/>:<PracticeButton testID="practice.save" label="Pratiği kaydet" disabled={production.busy||production.navigationBlocked||!!production.saveDisabled} onPress={()=>{if(!blockedNow())production.onSave(session.getSnapshot());}}/>}
        {!production.saved&&!production.captured&&<Pressable testID="practice.edit" accessibilityRole="button" disabled={production.busy} style={s.link} onPress={()=>press(session.edit)}><PracticeText textRole="control" style={[s.meta,{textAlign:"center"}]}>Yanıtları düzenle</PracticeText></Pressable>}
      </>}
      {production?.recovery}
    </View>
</>;
  return <View testID={`practice.${state.phase}`} style={[s.screen,{paddingTop:insets.top,paddingBottom:Math.max(20,insets.bottom)}]}>
    <View style={s.top}>
      <KegelBack testID="practice.exit" back={state.phase==="reflection"&&state.question>0} onPress={()=>state.phase==="reflection"&&state.question>0?press(()=>session.back(state.question)):exit()}/>
      <View style={{flex:1,minWidth:0}}><PracticeText textRole="control" variant="title" style={{fontSize:17,textAlign:"center"}}>{state.phase==="paused"?`${state.pauses.length+1}. duraklama`:"Pratik"}</PracticeText></View>
      {!production&&!largeText&&<View style={{maxWidth:"33%"}}><PracticeText style={[s.meta,{fontSize:12,textAlign:"right"}]}>QA · Kaydedilmez</PracticeText></View>}
    </View>
    <ScrollView testID="practice.scroll" ref={scroll} key={`${width}:${height}:${fontScale}`} style={{flex:1}} contentContainerStyle={{paddingBottom:24}} showsVerticalScrollIndicator={false}>
      {!production&&largeText&&<PracticeText accessibilityLabel="Pratik önizlemesi. Kaydedilmez." style={[s.meta,{marginTop:10,color:c.light}]}>Kaydedilmez</PracticeText>}
      <Animated.View key={`${state.phase}-${state.question}`} {...(reduced?{}:{entering:FadeInDown.duration(300)})}>
        {state.phase==="intro"&&(!production?.introduced||instructions)&&<>
          <PracticeText textRole="display" style={[s.meta,{marginTop:22,color:c.light}]}>AROUSAL CONTROL</PracticeText>
          <PracticeText testID="practice.intro.heading" accessibilityRole="header" accessibilityLabel="Yükselişi daha erken fark et" textRole="display" variant="display" style={s.title}>{"Yükselişi daha erken fark\u00a0et"}</PracticeText>
          <PracticeText testID="practice.intro.prose" style={s.sub}>Bu pratik uyarılma seviyeni tanımana, otomatikleşmeden önce durmana ve istersen daha bilinçli devam etmene yardımcı olur.</PracticeText>
          <View style={{gap:10,marginTop:24}}>{[
            ["clock","Süre hedefi yok","Ulaşman gereken bir süre yok."],
            ["rep","Duraklama pratiğin kendisi","Kısa bir an durmak başarısızlık değil, becerinin ta kendisi."],
            ["wave","Sertlik değişebilir","Duraklamada sertlik azalırsa bu normal. Nazikçe devam edebilir ya da pratiği bitirebilirsin."],
            ["up","Süre sadece bir trend",production?"Süreyi iyi ya da kötü diye değerlendirmeyiz. Tamamladığında kaydetmeyi seçebilirsin.":"Süreyi iyi ya da kötü diye değerlendirmeyiz. Bu önizleme kaydedilmez."]
          ].map(([,title,detail],i)=><Animated.View key={title} {...(reduced?{}:{entering:FadeInDown.delay(150+i*80).duration(450)})}><KegelCard testID={`practice.intro.rule.${i}`} style={{padding:14,borderRadius:22}}><PracticeRule index={i} title={title!} detail={detail!}/></KegelCard></Animated.View>)}</View>
        </>}
        {state.phase==="intro"&&production?.introduced&&!instructions&&<>
          <PracticeText accessibilityRole="header" textRole="display" variant="display" style={s.title}>Kendi ritminde pratik</PracticeText>
          <PracticeText style={s.sub}>Uyarılmanı fark et. İstersen durakla, hazır olduğunda devam et. Süre hedefi yok.</PracticeText>
          <View style={{marginTop:24}}><PracticeRule index={1} title="Duraklamak pratiğin kendisi" detail="Tamamladığında yanıtlarını gözden geçirip kaydetmeyi seçebilirsin."/></View>
          <Pressable testID="practice.instructions" accessibilityRole="button" style={s.link} onPress={()=>setInstructions(true)}><PracticeText textRole="control" style={{color:c.light,textAlign:"center"}}>Yönergeleri tekrar oku</PracticeText></Pressable>
        </>}
        {state.phase==="running"&&<>
          <View style={s.timer}><PracticeText testID="practice.elapsed" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} textRole="timer" variant="display" style={[s.time]}>{fmt(state.elapsedMs)}</PracticeText><PracticeText style={[s.meta,{textAlign:"center"}]}>toplam süre · {state.pauses.length} duraklama</PracticeText></View>
          <PracticeCurve state={state} animate={animate}/>
          <KegelCard testID="practice.guide" style={{marginTop:22}}>
            <PracticeText variant="title" style={{fontSize:18}}>Uyarılma rehberi</PracticeText>
            {largeText&&<PracticeText style={{color:c.light,marginTop:18}}>7–10 · Burada dur</PracticeText>}
            <View style={s.scale}><View style={s.bracket}>{!largeText&&<PracticeText style={{color:c.light,fontSize:12,backgroundColor:c.card,paddingHorizontal:6,marginTop:-11,alignSelf:"center",textAlign:"center"}}>Burada dur</PracticeText>}</View><View style={s.line}/><View style={s.ticks}>{Array.from({length:10},(_,i)=><View key={i} style={{alignItems:"center",flex:1,gap:8}}><View style={[s.dot,{backgroundColor:i>=6?c.blue:"#4a4a51"}]}/><PracticeText accessible={false} allowFontScaling={false} style={{fontSize:13,color:i>=6?"#fff":c.muted,textAlign:"center"}}>{i+1}</PracticeText></View>)}</View></View>
            <View style={[s.groups,largeText&&{flexWrap:"wrap"}]}>{[["1–3","Sakin"],["4–6","Yükseliyor"],["7–8","Yoğun"],["9–10","Eşik"]].map(([range,label],i)=><View key={range} style={largeText?{width:"100%",alignItems:"flex-start",paddingVertical:8}:{flex:1,alignItems:"center"}}><PracticeText style={{fontSize:12,color:c.muted,textAlign:largeText?"left":"center"}}>{range}</PracticeText><PracticeText style={{fontSize:13,color:i>1?c.light:"#fff",textAlign:largeText?"left":"center"}}>{label}</PracticeText></View>)}</View>
          </KegelCard>
          <Pressable testID="practice.level.open" accessibilityRole="button" accessibilityState={{expanded:levelOpen}} onPress={()=>setLevelOpen(!levelOpen)} style={{minHeight:48,justifyContent:"center"}}><PracticeText textRole="control" style={{color:c.light,fontSize:14}}>Seviyemi belirt · {selectedLevel?`${selectedLevel} / 10 (beyanım)`:"isteğe bağlı"}</PracticeText></Pressable>
          {levelOpen&&<View testID="practice.level.grid" style={s.grid}>{Array.from({length:10},(_,i)=>choose(`level.${i+1}`,String(i+1),selectedLevel===i+1,()=>{const count=session.getSnapshot().levels.length;session.reportLevel(i+1);const next=session.getSnapshot();if(next.levels.length>count)production?.onReport(next.levels[next.levels.length-1]!.atMs,i+1);}))}</View>}
          <KegelCard testID="practice.target" style={{padding:18,borderRadius:24}}><PracticeText variant="title" style={{fontSize:16}}>Bu pratikte hedef</PracticeText><PracticeText style={[s.sub,{fontSize:15}]}>Boşalmayı geciktirmek değil, eşiği tanımak. Daha fazlası önerilmiyor.</PracticeText></KegelCard>
        </>}
        {state.phase==="paused"&&<>
          <PracticeOrb pauseMs={state.pauseMs} animate={animate}/>
          <PracticeText testID="practice.pause.instruction" style={[s.sub,{textAlign:"center",marginTop:20}]}>Elini çek. Nefesin yavaşlasın.</PracticeText>
          <View style={[s.timer,{marginTop:22}]}><PracticeText testID="practice.pause.elapsed" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} textRole="timer" variant="display" style={[s.time,{fontSize:44,lineHeight:56}]}>{fmt(state.pauseMs)}</PracticeText><PracticeText style={[s.meta,{textAlign:"center"}]}>duraklama · toplam {fmt(state.elapsedMs)}</PracticeText></View>
          <KegelCard testID="practice.pause.guidance" style={{marginTop:22,borderRadius:24}}><PracticeText variant="title" style={{fontSize:16,lineHeight:23}}>Seviye dörde inince devam edebilirsin.</PracticeText><PracticeText style={[s.sub,{fontSize:15}]}>Sertlik azalırsa bu normal. Devam etmek zorunda değilsin.</PracticeText></KegelCard>
        </>}
        {state.phase==="reflection"&&<View testID={`practice.question.${state.question+1}`}>
          <View style={s.progress}>{[0,1,2].map(i=><View key={i} style={[s.segment,i<=state.question&&{backgroundColor:c.blue}]}/>)}</View>
          <PracticeText style={[s.meta,{marginTop:28}]}>Soru {state.question+1} / 3</PracticeText>
          <PracticeText accessibilityRole="header" textRole="display" variant="display" style={s.title}>{["Ereksiyon kalitesi nasıldı?","Açık içerik kullandın mı?","Pratik nasıl bitti?"][state.question]}</PracticeText>
          <PracticeText style={s.sub}>{["Pratik sırasındaki genel izlenimin.","Pratik sırasında ya da hemen öncesinde.","Hepsi kabul edilebilir. Örüntüyü fark etmek için."][state.question]}</PracticeText>
          {state.question===0&&<><View testID="practice.quality.grid" style={[s.grid,{marginTop:26}]}>{Array.from({length:10},(_,i)=>choose(`quality.${i+1}`,String(i+1),state.quality===i+1,()=>session.answerQuality(i+1),false,state.quality!==null&&i+1<state.quality))}</View><View testID="practice.quality.endpoints" style={{flexDirection:largeText?"column":"row",justifyContent:"space-between",alignItems:largeText?"flex-start":"stretch",marginTop:10,gap:8}}><PracticeText testID="practice.quality.low" style={[s.meta,{flexShrink:1,maxWidth:"100%"}]}>1 · Zayıf</PracticeText><PracticeText testID="practice.quality.high" style={[s.meta,{flexShrink:1,maxWidth:"100%"}]}>10 · Tam</PracticeText></View><PracticeHint>Bu bir test değil. Kendini denemeye çalışma. Pratik sırasında ne fark ettiysen onu işaretle.</PracticeHint></>}
          {state.question===1&&<><View style={[s.grid,{marginTop:26}]}>{choose("content.no","Hayır",state.content===false,()=>session.answerContent(false))}{choose("content.yes","Evet",state.content===true,()=>session.answerContent(true),true)}</View><PracticeHint warning={state.content===true}>{production?"Bu yalnızca senin beyanın. Content-Free kayıtları ayrı yönetilir; bu cevap sayaç, Reset veya mastürbasyon takibini değiştirmez.":"Bu cevap yalnızca bu önizlemede kalır. İçeriksiz süre sayacını ve mastürbasyon takibini değiştirmez."}</PracticeHint>{state.content===true&&<KegelCard testID="practice.content.warning" style={{marginTop:16,backgroundColor:"#261f17"}}><PracticeText style={{color:c.warning,fontSize:16}}>Sayaç sıfırlanmayacak</PracticeText><PracticeText style={s.sub}>{production?"Bu yanıt Practice kaydına eklenir. İçeriksiz sayaç kayıtlarını ayrı yönetebilirsin.":"Kazara gördüysen “Hayır” seç; sayılmaz. Kaydetme ve sayaç kuralları sonraki aşamada değerlendirilecek."}</PracticeText></KegelCard>}</>}
          {state.question===2&&<><View style={{gap:10,marginTop:24}}>{Object.entries(practiceEndings).map(([value,label])=>choose(`ending.${value}`,label,state.ending===value,()=>session.answerEnding(value as keyof typeof practiceEndings)))}</View><PracticeText style={[s.meta,{marginTop:24,marginBottom:10}]}>Nasıl hissettin? · isteğe bağlı</PracticeText><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{practiceFeelings.map((f,i)=>choose(`feeling.${i}`,f,state.feelings.includes(f),()=>press(()=>session.toggleFeeling(f))))}</View></>}
        </View>}
        {state.phase==="summary"&&<>
          <View style={{alignItems:"center",marginTop:26}}><PracticeCheck animate={foreground}/></View>
          <PracticeText accessibilityRole="header" textRole="display" variant="display" style={[s.title,{textAlign:"center",marginTop:24}]}>Pratik tamamlandı</PracticeText><PracticeText style={[s.sub,{textAlign:"center"}]}>{fmt(state.elapsedMs)} · {state.pauses.length} duraklama</PracticeText>
          <PracticeText testID={production?.saved?"practice.saved":"practice.unsaved"} style={[s.meta,{textAlign:"center",marginTop:10,color:c.light}]}>{production?.saved?"Bu cihaza kaydedildi":production?"Henüz kaydedilmedi":"Önizleme · Kaydedilmedi"}</PracticeText>
          {!!state.pauses.length&&<KegelCard style={{marginTop:24}}><PracticeText variant="title" style={{fontSize:16}}>İlk duraklama {fmt(state.pauses[0]!.atMs)}’da</PracticeText><PracticeText style={s.sub}>Bu süre bir başarı puanı değil. Yalnızca bu pratiğin özeti.</PracticeText></KegelCard>}
          <KegelCard testID="practice.summary.times" style={{marginTop:12}}><PracticeText style={s.meta}>SÜRE</PracticeText>{row("Toplam süre",fmt(state.elapsedMs))}{row("Aktif süre",fmt(state.elapsedMs-state.pauses.reduce((sum,p)=>sum+p.durationMs,0)))}{state.pauses.length?state.pauses.map((p,i)=>row(`${i+1}. duraklama · ${fmt(p.atMs)}’da`,fmt(p.durationMs))):row("Duraklama","Yok")}</KegelCard>
          <KegelCard testID="practice.summary.answers" style={{marginTop:12}}><PracticeText style={s.meta}>ÖZET · KULLANICI BEYANI</PracticeText>{row("Ereksiyon",state.quality?`${state.quality} / 10`:"Atlandı")}{row("Açık içerik",state.content===null?"Atlandı":state.content?"Evet":"Hayır")}{row("Bitiş",state.ending?practiceEndings[state.ending]:"Atlandı")}{!!state.feelings.length&&row("His",state.feelings.join(", "))}{row("Seviye girişleri",state.levels.length?state.levels.map(p=>`${fmt(p.atMs)} · ${p.level}/10`).join("\n"):"Belirtilmedi")}</KegelCard>
        </>}
      </Animated.View>
      {flowingControls&&controls}
    </ScrollView>
    {!flowingControls&&controls}
    <Modal visible={startConfirm||state.confirmingExit} transparent animationType={reduced?"none":"fade"} onRequestClose={()=>{setStartConfirm(false);session.keep();}}>
      <View style={[s.scrim,{paddingTop:insets.top+12,paddingBottom:insets.bottom+12}]}><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:"flex-end"}}><KegelCard accessibilityViewIsModal style={{padding:24}}><PracticeText testID="practice.dialog.heading" accessibilityRole="header" textRole="display" variant="display" style={[s.title,{fontSize:25,lineHeight:31}]}>{startConfirm?"Pratiğe hazır mısın?":"Pratikten çıkmak istiyor musun?"}</PracticeText><PracticeText testID="practice.dialog.body" style={s.sub}>{startConfirm?(production?"Süre hedefi yok. İstediğin an durabilir ya da bitirebilirsin. Tanıtımı onaylayıp pratiği başlatırsın; oturum ancak ayrıca kaydedersen saklanır.":"Süre hedefi yok. İstediğin an durabilir ya da bitirebilirsin. Bu QA önizlemesi hiçbir oturum kaydetmez."):"Çıkarsan bu geçici pratik silinir. Yanıtlarını ve özeti görmek için pratiği bitirebilirsin."}</PracticeText><View style={{gap:10,marginTop:22}}>{startConfirm?<><PracticeButton testID="practice.start.confirm" label="Başlat" disabled={!foreground} onPress={confirmStart}/><PracticeButton testID="practice.start.cancel" secondary label="Şimdi değil" onPress={()=>setStartConfirm(false)}/></>:<><PracticeButton testID="practice.exit.keep" label="Pratiğe dön" onPress={session.keep}/>{timed&&<PracticeButton testID="practice.exit.finish" label="Bitir ve soruları aç" secondary disabled={state.background} onPress={session.finish}/>}<PracticeButton testID="practice.exit.confirm" label={production?"Pratikten çık":"Önizlemeden çık"} secondary disabled={blockedNow()} onPress={()=>{if(!blockedNow())session.discard();}}/></>}</View></KegelCard></ScrollView></View>
    </Modal>
  </View>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#000",paddingHorizontal:18},top:{minHeight:56,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
  title:{fontSize:30,lineHeight:34,letterSpacing:-.6,marginTop:8},sub:{fontSize:16,lineHeight:24,color:c.muted,marginTop:10},meta:{fontSize:14,lineHeight:20,color:c.muted},
  timer:{alignItems:"center",marginTop:28},time:{textAlign:"center",fontSize:76,lineHeight:90,letterSpacing:-2,fontVariant:["tabular-nums"],maxWidth:"100%"},
  scale:{marginTop:44},bracket:{position:"absolute",left:"60%",right:0,top:-25,height:20,borderWidth:1.5,borderBottomWidth:0,borderColor:c.blue,borderTopLeftRadius:10,borderTopRightRadius:10,alignItems:"center"},line:{position:"absolute",left:"5%",right:"5%",height:4,top:5,backgroundColor:"#4a4a51"},ticks:{flexDirection:"row"},dot:{width:14,height:14,borderRadius:7},groups:{flexDirection:"row",marginTop:18,paddingTop:14,borderTopWidth:1,borderColor:c.line,gap:4},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{minWidth:48,minHeight:58,paddingHorizontal:12,paddingVertical:14,borderRadius:15,borderWidth:1.5,borderColor:c.line,backgroundColor:c.raised,alignItems:"center",justifyContent:"center",flexGrow:1},choiceText:{fontSize:16,lineHeight:24,textAlign:"center"},
  progress:{flexDirection:"row",gap:6,marginTop:14},segment:{flex:1,height:4,borderRadius:2,backgroundColor:"#28282c"},row:{flexDirection:"row",alignItems:"flex-start",gap:12,paddingVertical:13,borderBottomWidth:1,borderColor:c.line},link:{minHeight:44,alignItems:"center",justifyContent:"center"},scrim:{flex:1,backgroundColor:"rgba(0,0,0,.8)",padding:18}
});
