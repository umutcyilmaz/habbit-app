import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../shared/components/v4/AppText";
import { kegelColors as c } from "../kegelTheme";
import { kegelPreviewConfig } from "../kegelConfig";
import { KegelBack, KegelButton, KegelCard, KegelHint, KegelRow, kegelStyles as s } from "../components/KegelUI";
import { KegelGlow, KegelRing, KegelSymbol, PelvicMuscle } from "../components/KegelVisuals";

const trainer = kegelPreviewConfig.trainer;
const titles = ["Pelvik taban nerede?", "Kası nasıl bulursun?", "Sık, tut, bırak", "Doğru teknik"];
export function KegelIntroScreen({ initialStep = 0, onClose, onFinish, finishBusy=false }: {initialStep?:number;onClose:()=>void;onFinish:()=>void;finishBusy?:boolean}) {
  const insets = useSafeAreaInsets();
  const [step,setStep] = useState(initialStep);
  const [found,setFound] = useState(false);
  const [lift,setLift] = useState(false);
  const [options,setOptions] = useState<string[]>([]);
  const [held,setHeld] = useState(false);
  const [holdMs,setHoldMs] = useState(0);
  const [reps,setReps] = useState(0);
  const [message,setMessage] = useState("");
  const started = useRef<number|null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const isComplete = reps >= trainer.repetitions;
  useEffect(() => {
    setFound(false);setLift(false);setOptions([]);setHeld(false);setHoldMs(0);setReps(0);setMessage("");started.current=null;
    if (liftTimer.current) clearTimeout(liftTimer.current);
  }, [step]);
  useEffect(() => () => { if(liftTimer.current) clearTimeout(liftTimer.current); },[]);
  useEffect(() => {
    if (!held) return;
    const timer = setInterval(() => { if(started.current!==null) setHoldMs(performance.now()-started.current); },50);
    return () => clearInterval(timer);
  },[held]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change",state => {
      if(state !== "active") { started.current=null;setHeld(false);setHoldMs(0);setMessage("Ara verildi. Hazır olduğunda tekrar dene."); }
    });
    return () => subscription.remove();
  },[]);
  useEffect(() => {
    if(!isComplete || step !== 2) return;
    const timer = setTimeout(() => setStep(3),trainer.advanceDelayMs);
    return () => clearTimeout(timer);
  },[isComplete,step]);
  const release = () => {
    if(started.current===null) return;
    const elapsed = (performance.now()-started.current)/1000;
    started.current=null;setHeld(false);setHoldMs(0);
    if(elapsed < trainer.minimumHoldSeconds) { setMessage(`Biraz daha uzun: ${trainer.holdSeconds} saniye tut`);return; }
    const next = reps+1;setReps(next);
    setMessage(next >= trainer.repetitions ? "Harika. Kası buldun ve doğru sıktın." : elapsed > trainer.longHoldSeconds ? `Çok uzun tuttun; ${trainer.holdSeconds} saniye yeterli` : `Güzel. ${next}/${trainer.repetitions} · Gevşet, sonra tekrar`);
  };
  const nextDisabled = step===0 ? !found : step===1 ? options.length===0 : false;
  return <View testID={`kegel.intro.step-${step+1}`} style={[styles.screen,{paddingTop:insets.top,paddingBottom:Math.max(insets.bottom,24)}]}>
    <KegelGlow />
    <View style={styles.top}><KegelBack back={step>0} onPress={() => step>0 ? setStep(step-1) : onClose()} /><View style={styles.progress}>{titles.map((_,i) => <View key={i} style={[styles.progressBar,i<=step && {backgroundColor:c.light}]} />)}</View></View>
    <ScrollView key={step} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:14}} style={{flex:1}}>
      <AppText variant="label" style={styles.step}>{step+1} / 4</AppText>
      <AppText variant="display" style={s.title}>{titles[step]}</AppText>
      <AppText style={s.subtitle}>{[
        "Leğen kemiğinin tabanında, hamak gibi uzanan bir kas grubu. Mesaneyi taşır, idrarı ve gazı tutar.",
        "Aşağıdakilerden birini hayal et ya da dene. Hangisinde kası hissettin?",
        `Butona basılı tutarken kası sık ve ${trainer.holdSeconds} saniye tut. Bırakınca kası da tamamen gevşet.`,
        "Kas küçük, hareket içeriden. Dışarıdan bakan biri fark etmemeli."
      ][step]}</AppText>
      {step===0 && <><View style={styles.visual}><PelvicMuscle width={300} labels found={found} contracted={lift} onFind={() => {
        if(found) return;setFound(true);setLift(true);liftTimer.current=setTimeout(()=>setLift(false),1600);
      }} /></View><AppText variant="label" style={[styles.say,{color:found ? c.light : c.muted}]}>{found ? "İşte bu. Sıkınca yukarı ve içeri kalkar." : "Hamağa dokun"}</AppText></>}
      {step===1 && <><View style={{gap:10,marginTop:20}}>{[
        {key:"gas",icon:"wind",title:"Gazı tutar gibi",detail:"Kalabalıkta gaz çıkarmamak için sıktığın kas."},
        {key:"pee",icon:"drop",title:"İdrarı yarıda keser gibi",detail:"Akışı durduran kas. Sadece bulmak için."},
        {key:"lift",icon:"up",title:"İçeri ve yukarı çekiş",detail:"Penis kökünün hafifçe içeri çekildiğini hissedersin."}
      ].map(option => <Pressable key={option.key} testID={`kegel.intro.option.${option.key}`} accessibilityRole="checkbox" accessibilityState={{checked:options.includes(option.key)}} onPress={() => setOptions(list => list.includes(option.key) ? list.filter(n=>n!==option.key) : [...list,option.key])}
        style={[styles.option,options.includes(option.key) && styles.selected]}>
        <View style={styles.optionIcon}><KegelSymbol name={option.icon} /></View><View style={{flex:1}}><AppText variant="title" style={{fontSize:16.5,lineHeight:22}}>{option.title}</AppText><AppText style={{color:c.muted,fontSize:14,lineHeight:20,marginTop:2}}>{option.detail}</AppText></View>
        <View style={[styles.checkbox,options.includes(option.key) && {backgroundColor:c.blue,borderColor:c.blue}]}>{options.includes(option.key) && <KegelSymbol name="check" size={14} color={c.text} />}</View>
      </Pressable>)}</View><KegelHint warning>İdrarı yarıda kesmeyi <AppText variant="label">yalnızca kası bulmak için</AppText> dene. Bunu egzersiz olarak tekrarlama.</KegelHint></>}
      {step===2 && <><View style={[styles.visual,{width:250}]}><KegelRing progress={Math.min(1,holdMs/(trainer.holdSeconds*1000))} contracted={held} label={isComplete ? "Tamam" : held ? "Sık" : reps>0 || message ? "Gevşe" : "Hazır"}
        seconds={held ? holdMs>=trainer.holdSeconds*1000 ? "Bırak" : `${Math.ceil(trainer.holdSeconds-holdMs/1000)} sn` : `${trainer.holdSeconds} sn tut`} /></View>
        <View style={styles.dots}>{Array.from({length:trainer.repetitions},(_,i)=><View key={i} style={[styles.dot,i<reps && {backgroundColor:c.light,transform:[{scale:1.25}]}]} />)}</View>
        <AppText variant="label" accessibilityLiveRegion="polite" style={[styles.say,{color:held || reps>0 ? c.light : message ? c.warning : c.muted}]}>{held ? holdMs>=trainer.holdSeconds*1000 ? "Şimdi bırak ve tamamen gevşet" : "Kası yukarı ve içeri çek, nefes al-ver" : message || `${trainer.repetitions} tekrar yap`}</AppText>
      </>}
      {step===3 && <View style={{gap:10,marginTop:20}}>{[
        ["lung","Nefes almaya devam et","Sıkarken nefesini tutma."],
        ["body","Karın, kalça, bacak gevşek","Sadece pelvik taban çalışsın."],
        ["wave","Gevşetmek de egzersiz","Sıktığın kadar süre tamamen bırak."],
        ["bed","Önce yatarak başla","Kas güçlendikçe oturarak ve ayakta yap."]
      ].map(([icon,title,detail],i) => <KegelCard key={title} style={{borderRadius:22,paddingVertical:5,paddingHorizontal:16}}><KegelRow icon={icon!} title={title!} detail={detail!} warning={i===1} /></KegelCard>)}</View>}
    </ScrollView>
    <View style={s.footer}>{step===2 ? <>
      <Pressable testID="kegel.intro.hold" accessibilityRole="button" accessibilityLabel={isComplete ? "Tamamlandı" : `${trainer.holdSeconds} saniye basılı tut ve sık`} disabled={isComplete}
        onPressIn={() => { if(isComplete || started.current!==null) return;started.current=performance.now();setHeld(true);setHoldMs(0);setMessage(""); }} onPressOut={release}
        style={[styles.hold,held && styles.selected,isComplete && {backgroundColor:c.blue}]}>
        {isComplete ? <KegelSymbol name="check" color={c.text} size={18} /> : <View style={[styles.dot,{backgroundColor:c.light}]} />}<AppText variant="title" style={{fontSize:17}}>{isComplete ? "Tamamlandı" : "Basılı tut ve sık"}</AppText>
      </Pressable>
      <KegelButton testID="kegel.intro.skip" label="Atla" secondary onPress={() => setStep(3)} style={{backgroundColor:"transparent",minHeight:44}} />
    </> : <KegelButton testID="kegel.intro.next" label={step===3 ? finishBusy ? "Kaydediliyor…" : "İlk egzersize geç" : "Devam"} icon={step===3 ? "play" : undefined} disabled={nextDisabled || finishBusy}
      onPress={() => {if(nextDisabled)return;step===3 ? onFinish() : setStep(step+1);}} />}</View>
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas,paddingHorizontal:20},top:{height:58,flexDirection:"row",alignItems:"center",gap:14},
  progress:{flex:1,flexDirection:"row",gap:6,marginRight:56},progressBar:{flex:1,height:4,borderRadius:2,backgroundColor:c.subtle},
  step:{fontSize:14,color:c.light,textAlign:"center",marginBottom:4},visual:{width:300,alignSelf:"center",marginTop:20},
  say:{textAlign:"center",fontSize:15,lineHeight:22,marginTop:10,minHeight:22},
  option:{flexDirection:"row",gap:14,alignItems:"center",paddingVertical:15,paddingHorizontal:16,borderRadius:24,backgroundColor:c.card,borderWidth:1.5,borderColor:"transparent"},
  selected:{backgroundColor:"rgba(58,75,255,.12)",borderColor:c.highlight},optionIcon:{width:44,height:44,borderRadius:14,backgroundColor:c.icon,alignItems:"center",justifyContent:"center"},
  checkbox:{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:"rgba(255,255,255,.2)",alignItems:"center",justifyContent:"center"},
  dots:{flexDirection:"row",justifyContent:"center",gap:10,marginTop:14},dot:{width:10,height:10,borderRadius:5,backgroundColor:"rgba(255,255,255,.14)"},
  hold:{height:60,borderRadius:999,borderWidth:1.5,borderColor:c.subtle,backgroundColor:"rgba(255,255,255,.08)",flexDirection:"row",gap:10,alignItems:"center",justifyContent:"center"}
});
