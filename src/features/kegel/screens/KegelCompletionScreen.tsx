import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { kegelPreviewConfig as config } from "../kegelConfig";
import { kegelColors as c } from "../kegelTheme";
import { KegelButton, KegelCard, kegelStyles as s } from "../components/KegelUI";
import { KegelGlow, KegelMetrics, KegelRing, KegelSymbol } from "../components/KegelVisuals";

export function KegelCompletionScreen({ onDone, fromRun }: {onDone:()=>void;fromRun:boolean}) {
  const [feeling,setFeeling]=useState<string|null>(null);
  const [progress,setProgress]=useState(0);
  const reduceMotion=useReducedMotion();
  const scale=useSharedValue(reduceMotion ? 1 : 0);
  useEffect(()=>{
    setProgress(1);scale.value=reduceMotion ? 1 : withDelay(500,withSpring(1,{damping:12,stiffness:180}));
  },[reduceMotion,scale]);
  const checkStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  return <AppScreen testID="kegel.completed" scroll includeBottomNavClearance={false} showsVerticalScrollIndicator={false} style={{backgroundColor:c.canvas}} contentContainerStyle={styles.content}>
    <KegelGlow full />
    <View style={styles.badge}><KegelRing size={118} progress={progress} duration={1100} contracted={false} label="" seconds="" showMuscle={false} />
      <Animated.View style={[styles.check,checkStyle]}><KegelSymbol name="check" size={60} color={c.text} /></Animated.View>
      {!reduceMotion && Array.from({length:10},(_,i)=><CompletionSpark key={i} index={i} />)}</View>
    <AppText variant="display" style={[s.title,{marginTop:20}]}>Set tamamlandı</AppText>
    <AppText style={[s.subtitle,{marginTop:6}]}>{fromRun ? "Önizleme seti · Kaydedilmedi" : "Tamamlama ekranı · Örnek tasarım verisi"}</AppText>
    <KegelMetrics values={[
      {icon:"rep",value:String(config.repetitions),label:"Tekrar"},
      {icon:"timer",value:`${config.contractionSeconds} sn`,label:"Tutuş"},
      {icon:"clock",value:`${Math.ceil(config.repetitions*(config.contractionSeconds+config.relaxationSeconds)/60)} dk`,label:"Süre"}
    ]} />
    <KegelCard style={{marginTop:26}}><KegelRowNote /></KegelCard>
    <KegelCard style={{marginTop:12}}><AppText variant="title" style={{fontSize:17}}>Nasıl hissettirdi?</AppText>
      <View style={styles.feelings}>{["Kolay","İyi","Zor"].map(label=><KegelButton key={label} testID={`kegel.feeling.${label}`} label={label} secondary accessibilityState={{selected:feeling===label}}
        onPress={()=>setFeeling(label)} style={[styles.feeling,feeling===label && {backgroundColor:"rgba(58,75,255,.25)",borderWidth:1.5,borderColor:c.highlight}]} />)}</View>
      <AppText accessibilityLiveRegion="polite" style={styles.note}>{feeling==="Zor" ? "Kaslarını dinlendir. Geri bildirimin bu önizlemede kalır." : feeling ? "Geri bildirimin alındı. Önizleme programını değiştirmez." : "Nasıl hissettiğini seç. Bu önizlemede kaydedilmez."}</AppText>
    </KegelCard>
    <KegelButton testID="kegel.completed.done" label="Bitti" onPress={onDone} style={{marginTop:22,width:"100%"}} />
  </AppScreen>;
}

function CompletionSpark({index}:{index:number}) {
  const value=useSharedValue(0);
  useEffect(()=>{value.value=withDelay(1100,withTiming(1,{duration:1100}));},[value]);
  const style=useAnimatedStyle(()=>({opacity:value.value===0 ? 0 : 1-value.value,transform:[{translateX:Math.cos(index*Math.PI/5)*(30+80*value.value)},{translateY:Math.sin(index*Math.PI/5)*(30+80*value.value)}]}));
  return <Animated.View accessible={false} style={[{position:"absolute",left:57,top:57,width:4,height:4,borderRadius:2,backgroundColor:c.light},style]} />;
}

function KegelRowNote() {
  return <View style={{flexDirection:"row",alignItems:"center",gap:16}}><View style={styles.noteIcon}><KegelSymbol name="check" size={28} /></View><View style={{flex:1}}>
    <AppText variant="title" style={{fontSize:17}}>Kaydedilmeyen deneme</AppText><AppText style={styles.note}>Bu set geçmiş, günlük seri veya başarı oluşturmaz.</AppText>
  </View></View>;
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingTop:24,paddingBottom:40,alignItems:"center"},badge:{width:118,height:118},check:{position:"absolute",inset:0,alignItems:"center",justifyContent:"center"},
  feelings:{flexDirection:"row",gap:8,marginTop:14},feeling:{flex:1,minHeight:46,paddingHorizontal:8},note:{fontSize:14,lineHeight:20,color:c.muted,marginTop:12},noteIcon:{width:50,height:56,alignItems:"center",justifyContent:"center"}
});
