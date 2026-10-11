import { useEffect, useState } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { BackHandler, Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { AppText } from "../../../shared/components/v4/AppText";
import { kegelPreviewConfig as config } from "../kegelConfig";
import { kegelColors as c } from "../kegelTheme";
import { useKegelExercise } from "../useKegelExercise";
import { KegelBack, KegelButton, KegelCard, kegelStyles as s } from "../components/KegelUI";
import { KegelGlow, KegelRing } from "../components/KegelVisuals";

export function KegelExerciseScreen({ setName, initialPaused = false, initialActiveMs = 0, onComplete, onExit }: {
  setName:string;initialPaused?:boolean;initialActiveMs?:number;onComplete:()=>void;onExit:()=>void;
}) {
  const insets=useSafeAreaInsets();
  const reduceMotion=useReducedMotion();
  const {frame,paused,pause,resume}=useKegelExercise(onComplete,initialPaused,initialActiveMs);
  const [exit,setExit]=useState(false);
  const navigation=useNavigation();
  const askExit=()=>{pause();setExit(true);};
  usePreventRemove(true,askExit);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{askExit();return true;});
    return ()=>subscription.remove();
  });
  useEffect(()=>{navigation.setOptions({gestureEnabled:false});return ()=>navigation.setOptions({gestureEnabled:true});},[navigation]);
  const contracting=frame.phase==="contract" && !paused;
  const halo=useSharedValue(0);
  useEffect(()=>{halo.value=withTiming(contracting ? 1 : 0,{duration:reduceMotion ? 0 : 1200});},[contracting,reduceMotion,halo]);
  const haloStyle=useAnimatedStyle(()=>({opacity:.25+.65*halo.value,transform:[{scale:.75+.35*halo.value}]}));
  return <View testID="kegel.exercise" style={[styles.screen,{paddingTop:insets.top,paddingBottom:Math.max(38,insets.bottom)}]}>
    <KegelGlow full />
    <View style={styles.top}><View style={styles.close}><KegelBack testID="kegel.exercise.exit" onPress={askExit} /></View><View style={{alignItems:"center"}}>
      <AppText variant="title" style={{fontSize:17}}>{setName}</AppText><AppText testID="kegel.exercise.rep" style={styles.meta}>Tekrar {frame.repetition} / {config.repetitions} · {config.contractionSeconds} sn</AppText>
    </View></View>
    <ScrollView style={{flex:1,width:"100%"}} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stage}>
      <Animated.Image accessible={false} source={require("../assets/glow.png")} style={[styles.halo,haloStyle]} />
      <View testID={paused ? "kegel.exercise.paused" : `kegel.exercise.${frame.phase}`}>
        <KegelRing size={300} progress={frame.progress} contracted={contracting} paused={paused}
          label={paused ? "Duraklatıldı" : frame.phase==="countdown" ? "Hazır" : frame.phase==="contract" ? "Sık" : "Gevşe"}
          seconds={paused ? `${frame.secondsLeft} sn kaldı` : frame.phase==="countdown" ? "Rahat bir pozisyon al" : `${frame.secondsLeft}`} />
      </View>
      <View style={styles.reps}>{Array.from({length:config.repetitions},(_,i)=><View key={i} style={[styles.rep,i<frame.repetition-1 && {backgroundColor:c.light},i===frame.repetition-1 && {backgroundColor:"rgba(170,179,255,.4)"}]} />)}</View>
      <AppText testID="kegel.exercise.tip" style={styles.tip}>{paused ? "Kasını tamamen gevşet. Hazır olduğunda devam et." : frame.phase==="countdown" ? "Birazdan başlayacağız" : frame.phase==="relax" ? "Tamamen bırak" : config.tips[(frame.repetition-1)%config.tips.length]}</AppText>
    </ScrollView>
    <KegelButton testID="kegel.exercise.pause" label={paused ? "Devam et" : "Duraklat"} secondary onPress={paused ? resume : pause} style={{width:"100%"}} />
    {frame.phase==="countdown" && !paused && <View pointerEvents="none" style={styles.countdown}><Animated.View key={frame.secondsLeft} {...(reduceMotion ? {} : {entering:FadeIn.duration(200)})}><AppText testID="kegel.exercise.countdown" variant="display" style={{fontSize:120,lineHeight:150}}>{frame.secondsLeft}</AppText></Animated.View></View>}
    <Modal visible={exit} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={()=>setExit(false)}>
      <View style={styles.scrim}><KegelCard style={{padding:24}}><AppText variant="display" style={[s.title,{textAlign:"left",fontSize:25}]}>Egzersizden çıkılsın mı?</AppText>
        <AppText style={[s.cardSub,{marginTop:10}]}>Bu deneme yarım kalacak. Hazır olduğunda yeniden başlayabilirsin.</AppText>
        <View style={{gap:10,marginTop:24}}><KegelButton testID="kegel.exercise.keep" label="Egzersize dön" onPress={()=>setExit(false)} />
          <KegelButton testID="kegel.exercise.confirm-exit" label="Egzersizden çık" secondary onPress={onExit} /></View>
      </KegelCard></View>
    </Modal>
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:c.canvas,paddingHorizontal:20,alignItems:"center"},top:{height:53,width:"100%",alignItems:"center",justifyContent:"center"},close:{position:"absolute",right:-4,top:0},
  meta:{fontSize:14,lineHeight:20,color:c.muted,marginTop:2},stage:{alignItems:"center",paddingTop:58,paddingBottom:24},
  halo:{position:"absolute",width:480,height:480,top:0},reps:{flexDirection:"row",gap:7,marginTop:40,maxWidth:"100%"},rep:{width:22,height:6,borderRadius:3,backgroundColor:c.subtle},
  tip:{marginTop:18,fontSize:15,lineHeight:22,color:"rgba(255,255,255,.72)",textAlign:"center",maxWidth:340},
  countdown:{position:"absolute",top:115,bottom:100,left:0,right:0,backgroundColor:"rgba(0,0,0,.6)",alignItems:"center",justifyContent:"center"},
  scrim:{flex:1,backgroundColor:"rgba(0,0,0,.75)",justifyContent:"flex-end",padding:20,paddingBottom:48}
});
