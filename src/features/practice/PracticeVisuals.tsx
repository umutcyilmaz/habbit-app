import { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line } from "react-native-svg";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { PracticeText } from "./PracticeText";
import { practiceLayout } from "./practiceTypography";
import type { PropsWithChildren } from "react";
import type { PracticeSnapshot } from "./practiceSession";
const Dot=Animated.createAnimatedComponent(Circle);
const DrawPath=Animated.createAnimatedComponent(Path);

// Decorative curve only; the dot never supplies an arousal score.
export function PracticeCurve({state,animate}:{state:PracticeSnapshot;animate:boolean}) {
  const reduced=useReducedMotion(), progress=useSharedValue(0);
  useEffect(()=>{
    cancelAnimation(progress);
    if(animate&&!reduced)progress.value=withRepeat(withTiming(1,{duration:9000,easing:Easing.linear}),-1,false);
    return ()=>cancelAnimation(progress);
  },[animate,reduced,progress]);
  const dot=useAnimatedProps(()=>{
    const x=14+292*progress.value;
    return {cx:x,cy:48-22*Math.sin((x-14)/292*Math.PI*2),opacity:reduced?0:1};
  });
  return <View style={{marginTop:16}}>
    <Svg accessible={false} width="100%" height={70} viewBox="0 0 320 70">
      <Defs><LinearGradient id="practiceWave" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#3a4bff"/><Stop offset="1" stopColor="#dfe3ff"/></LinearGradient></Defs>
      <Path d={Array.from({length:61},(_,i)=>{const x=14+292*i/60;return `${i?"L":"M"}${x} ${48-22*Math.sin(i/60*Math.PI*2)}`;}).join(" ")} fill="none" stroke="url(#practiceWave)" strokeWidth={3} />
      {state.pauses.map((p,i)=>{const x=14+292*p.atMs/Math.max(1,state.elapsedMs);return <Line key={i} x1={x} x2={x} y1={8} y2={64} stroke="#aab3ff" strokeDasharray="3 5"/>;})}
      <Dot animatedProps={dot} r={4} fill="#dfe3ff"/>
    </Svg>
    <PracticeText style={styles.caption}>Örnek eğri · fizyolojik ölçüm değil</PracticeText>
    {!!state.pauses.length&&<PracticeText style={styles.caption}>Kesikli işaretler: bu pratikteki duraklamaların zamanı</PracticeText>}
  </View>;
}
export function PracticeOrb({pauseMs,animate}:{pauseMs:number;animate:boolean}) {
  const {width,height,fontScale}=useWindowDimensions(),stacked=practiceLayout(width,height,fontScale).stacked;
  const reduced=useReducedMotion(), scale=useSharedValue(.55);
  const seconds=pauseMs/1000%14;
  const target=seconds<4?.55+.45*seconds/4:seconds<8?1:1-.45*(seconds-8)/6;
  useEffect(()=>{scale.value=withTiming(reduced?.8:target,{duration:animate&&!reduced?260:0,easing:Easing.linear});return ()=>cancelAnimation(scale);},[animate,reduced,scale,target]);
  const style=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  const label=!animate?"Hazır olduğunda":seconds<4?"Nefes al":seconds<8?"Tut":"Yavaşça ver";
  const instruction=<PracticeText accessibilityLiveRegion="polite" textRole="display" variant="display" style={{fontSize:26,lineHeight:34,textAlign:"center",maxWidth:"100%"}}>{label}</PracticeText>;
  return <View style={{alignItems:"center"}}><View style={[styles.orb,stacked&&{width:180,height:180,borderRadius:90}]} >
    <Animated.View accessible={false} style={[StyleSheet.absoluteFill,styles.blue,style]}/>
    {!stacked&&instruction}
  </View>{stacked&&<View style={{width:"100%",marginTop:16}}>{instruction}</View>}</View>;
}
export function PracticeCheck({animate=true}:{animate?:boolean}) {
  const reduced=useReducedMotion(), progress=useSharedValue(reduced?1:0);
  useEffect(()=>{cancelAnimation(progress);if(animate)progress.value=withTiming(1,{duration:reduced?0:1000});return ()=>cancelAnimation(progress);},[animate,reduced,progress]);
  const ring=useAnimatedProps(()=>({strokeDashoffset:289*(1-progress.value)}));
  const check=useAnimatedProps(()=>({strokeDashoffset:54*(1-progress.value)}));
  return <Svg accessible={false} width={100} height={100} viewBox="0 0 100 100"><Defs><LinearGradient id="practiceDone"><Stop offset="0" stopColor="#2433c9"/><Stop offset="1" stopColor="#dfe3ff"/></LinearGradient></Defs><Circle cx={50} cy={50} r={46} fill="none" stroke="#26262b" strokeWidth={3}/><Dot animatedProps={ring} cx={50} cy={50} r={46} fill="none" stroke="url(#practiceDone)" strokeWidth={3} strokeDasharray="289 289"/><DrawPath animatedProps={check} d="m32 51 12 12 25-27" fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="54 54" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

const styles=StyleSheet.create({caption:{fontSize:12,lineHeight:18,color:"#8e8e93",textAlign:"center"},orb:{width:250,height:250,borderRadius:125,borderWidth:1,borderColor:"#28282b",alignItems:"center",justifyContent:"center",alignSelf:"center",marginTop:24},blue:{backgroundColor:"#3a4bff",borderRadius:125}});

export function PracticeRule({index,title,detail}:{index:number;title:string;detail:string}) {
  const {width,height,fontScale}=useWindowDimensions(),stacked=practiceLayout(width,height,fontScale).stacked;
  const paths=["M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v6l5 3 1-1.6-4-2.4V7z","M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM9 7.5v9h2.4v-9zm3.6 0v9H15v-9z","M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3 5-1","M3 17l6-6 4 4 8-8M15 7h6v6"];
  return <View style={{flexDirection:stacked?"column":"row",alignItems:stacked?"flex-start":"center",gap:14}}><View style={{width:44,height:44,borderRadius:14,backgroundColor:"#1b2047",alignItems:"center",justifyContent:"center"}}><Svg accessible={false} width={20} height={20} viewBox="0 0 24 24"><Path d={paths[index] ?? ""} fill={index<2?"#aab3ff":"none"} stroke={index>=2?"#aab3ff":"none"} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"/></Svg></View><View style={stacked?{width:"100%"}:{flex:1,minWidth:0}}><PracticeText testID={`practice.rule.${index}.title`} variant="title" style={{fontSize:16,lineHeight:22}}>{title}</PracticeText><PracticeText testID={`practice.rule.${index}.detail`} style={{fontSize:14,lineHeight:20,color:"#8e8e93",marginTop:2}}>{detail}</PracticeText></View></View>;
}

// Feature-local hint: the icon never steals prose width at accessibility sizes.
export function PracticeHint({children,warning=false}:PropsWithChildren<{warning?:boolean}>) {
  const {width,height,fontScale}=useWindowDimensions(),stacked=practiceLayout(width,height,fontScale).stacked;
  return <View testID="practice.hint" style={{flexDirection:stacked?"column":"row",gap:10,padding:14,marginTop:14,borderRadius:20,backgroundColor:"rgba(255,255,255,.05)"}}>
    <Svg accessible={false} width={18} height={18} viewBox="0 0 18 18"><Circle cx={9} cy={9} r={7} stroke={warning?"#d9a46b":"#aab3ff"} fill="none"/><Path d="M9 8v5M9 5v1" stroke={warning?"#d9a46b":"#aab3ff"} strokeWidth={1.5}/></Svg>
    <PracticeText style={[{color:"#8e8e93",fontSize:14,lineHeight:20},stacked?{width:"100%"}:{flex:1}]}>{children}</PracticeText>
  </View>;
}
