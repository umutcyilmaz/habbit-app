import { useEffect } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { AppText } from "../../../shared/components/v4/AppText";
import { kegelColors as c } from "../kegelTheme";

const glow = require("../assets/glow.png");
const segments = 180;

export function KegelGlow({ full = false }: { full?: boolean }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image accessible={false} source={glow} style={[styles.fog, full && { height: 740, opacity: .5 }]} /></View>;
}

export function PelvicMuscle({ width = 270, contracted = false, demo = false, labels = false, found = false, onFind }: {
  width?: number; contracted?: boolean; demo?: boolean; labels?: boolean; found?: boolean; onFind?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(lift);
    if (demo && !reduceMotion) {
      lift.value = withRepeat(withSequence(withDelay(480, withTiming(1, { duration: 1020, easing: Easing.bezier(.2,.8,.2,1) })),
        withDelay(1500, withTiming(0, { duration: 1020 })), withTiming(0, { duration: 1980 })), -1);
    } else lift.value = withTiming(contracted ? 1 : 0, { duration: reduceMotion ? 0 : 900, easing: Easing.bezier(.22,1,.36,1) });
    return () => cancelAnimation(lift);
  }, [contracted, demo, lift, reduceMotion]);
  const muscleStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - .45 * lift.value }] }));
  const organStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * width / 240 * lift.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: .25 + lift.value * .45, transform: [{ scale: 1 + .18 * lift.value }, { translateY: -9 * width / 240 * lift.value }] }));
  const arrowStyle = useAnimatedStyle(() => ({ opacity: lift.value }));
  return <View style={{ width, height: width * .75 }}>
    <Animated.Image accessible={false} resizeMode="stretch" source={glow} style={[styles.layer, { top: width*.36, left: width*.13, width: width*.74, height: width*.36 }, glowStyle]} />
    <Image accessible={false} source={require("../assets/bones.png")} style={styles.layer} />
    <Animated.Image accessible={false} source={require("../assets/bladder.png")} style={[styles.layer, organStyle]} />
    {labels && <AppText style={[styles.anatomyLabel, { top: width * .30 }]}>Mesane</AppText>}
    <Animated.Image accessible={false} source={require("../assets/muscle.png")} style={[styles.layer, { transformOrigin: [width/2, width*112/240, 0] }, muscleStyle]} />
    <Animated.View style={[styles.up, { top: width*.66 }, arrowStyle]}><KegelSymbol name="up" /></Animated.View>
    {labels && found && <AppText style={[styles.anatomyLabel, { top: width*.70, color: c.light }]}>Pelvik taban kası</AppText>}
    {onFind && <Pressable testID="kegel.intro.find-muscle" accessibilityRole="button" accessibilityLabel="Pelvik taban kasını bul" onPress={onFind}
      style={{ position: "absolute", left: width*.21, top: width*.45, width: width*.58, height: width*.25 }}>
      {!found && <View style={styles.tapRing} />}
    </Pressable>}
  </View>;
}

function mix(a: number, b: number, t: number) { return Math.round(a + (b-a)*t); }
function ringColor(i: number) {
  // HTML's rotated horizontal gradient, sampled around the circumference.
  const t = (Math.cos(i / segments * Math.PI * 2) + 1) / 2;
  const from = t < .55 ? [36,51,201] : [127,140,255];
  const to = t < .55 ? [127,140,255] : [223,227,255];
  const f = t < .55 ? t/.55 : (t-.55)/.45;
  return `rgb(${mix(from[0]!,to[0]!,f)},${mix(from[1]!,to[1]!,f)},${mix(from[2]!,to[2]!,f)})`;
}

function RingSegment({ index, size, value }: { index: number; size: number; value: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, (value.value * segments - index) * 2)) }));
  return <Animated.View style={[{
    position: "absolute", width: size*.07, height: size*.035, borderRadius: 1,
    left: size*.465, top: size*.5 - size*.0175,
    backgroundColor: ringColor(index),
    transform: [{ rotate: `${index*360/segments-90}deg` }, { translateX: size*.46 }]
  }, style]} />;
}

export function KegelRing({ size = 250, progress, contracted, label, seconds, paused = false, showMuscle = true, duration = 60 }: {
  size?: number; progress: number; contracted: boolean; label: string; seconds: string; paused?: boolean; showMuscle?: boolean; duration?:number;
}) {
  const value = useSharedValue(progress);
  const reduceMotion = useReducedMotion();
  useEffect(() => { value.value = withTiming(progress, { duration: paused || reduceMotion ? 0 : duration, easing: Easing.linear }); }, [progress, paused, reduceMotion, value, duration]);
  const cap = useAnimatedStyle(() => ({ opacity:value.value>0 ? 1 : 0,backgroundColor:interpolateColor((Math.cos(value.value*Math.PI*2)+1)/2,[0,.55,1],["#2433c9","#7f8cff","#dfe3ff"],"RGB",{gamma:1}),transform:[{rotate:`${value.value*360-90}deg`},{translateX:size*.46}] }));
  return <View accessible accessibilityLabel={`${label}, ${seconds}`} style={{ width: size, height: size }}>
    <View style={[styles.track, { width:size*.99, height:size*.99, left:size*.005, top:size*.005, borderWidth:size*.07, borderRadius:size }]} />
    {Array.from({length:segments}, (_, index) => <RingSegment key={index} index={index} size={size} value={value} />)}
    {progress>0 && <View style={{position:"absolute",left:size*.465,top:size*.005,width:size*.07,height:size*.07,borderRadius:size*.035,backgroundColor:"#dfe3ff"}} />}
    <Animated.View style={[{position:"absolute",left:size*.465,top:size*.465,width:size*.07,height:size*.07,borderRadius:size*.035,backgroundColor:c.light},cap]} />
    {showMuscle && <View style={[styles.ringInside, { inset:size*.113, borderRadius:size, borderColor:contracted ? "rgba(170,179,255,.45)" : "rgba(255,255,255,.06)" }]}>
      <Image accessible={false} source={glow} style={[styles.layer, { opacity: contracted ? .8 : .2 }]} />
      {showMuscle && <PelvicMuscle width={size*.5667} contracted={contracted} />}
      <AppText variant="display" style={[styles.phase, { fontSize: paused ? 24 : size === 250 ? 28 : 36, lineHeight: paused ? 32 : size === 250 ? 34 : 44 }]}>{label}</AppText>
      <AppText style={styles.seconds}>{seconds}</AppText>
    </View>}
  </View>;
}

export function KegelMetrics({ values }: { values: readonly { icon: string; value: string; label: string }[] }) {
  return <View style={styles.metrics}>
    <Image accessible={false} source={require("../assets/connectors.png")} style={{ width:290, height:28, maxWidth:"92%", alignSelf:"center", marginBottom:0 }} />
    <View style={styles.metricRow}>{values.map(item => <View key={item.label} style={styles.metric}>
      <View style={styles.pill}><KegelSymbol name={item.icon} color={c.text} size={16} /><AppText style={styles.pillValue}>{item.value}</AppText></View>
      <AppText style={styles.metricLabel}>{item.label}</AppText>
    </View>)}</View>
  </View>;
}

export function KegelSymbol({ name, color = c.light, size = 20 }: { name: string; color?: string; size?: number }) {
  if (name === "check") return <View style={{ width:size*.4, height:size*.72, borderRightWidth:size*.1, borderBottomWidth:size*.1, borderColor:color, transform:[{ rotate:"45deg" }], marginTop:-size*.16 }} />;
  if (name === "play") return <View style={{ width:0,height:0,borderTopWidth:size*.35,borderBottomWidth:size*.35,borderLeftWidth:size*.55,borderTopColor:"transparent",borderBottomColor:"transparent",borderLeftColor:color }} />;
  if (name === "close" || name === "back") return <View style={{ width:size,height:size,alignItems:"center",justifyContent:"center" }}>
    <View style={{ position:"absolute",width: name === "back" ? size*.6 : size,height:2.2,backgroundColor:color,transform:[{rotate:"-45deg"}], ...(name === "back" ? {top:size*.27,left:size*.15} : {}) }} />
    <View style={{ position:"absolute",width: name === "back" ? size*.6 : size,height:2.2,backgroundColor:color,transform:[{rotate:"45deg"}], ...(name === "back" ? {top:size*.65,left:size*.15} : {}) }} />
  </View>;
  const source=iconSources[name];
  return source ? <Image accessible={false} source={source} style={{width:size,height:size,tintColor:color}} /> : null;
}

const iconSources:Record<string,number>={
  rep:require("../assets/icon-rep.png"),timer:require("../assets/icon-timer.png"),clock:require("../assets/icon-clock.png"),cal:require("../assets/icon-cal.png"),
  flame:require("../assets/icon-flame.png"),up:require("../assets/icon-up.png"),wave:require("../assets/icon-wave.png"),lung:require("../assets/icon-lung.png"),
  body:require("../assets/icon-body.png"),bed:require("../assets/icon-bed.png"),wind:require("../assets/icon-wind.png"),info:require("../assets/icon-info.png"),warn:require("../assets/icon-warn.png"),drop:require("../assets/icon-drop.png")
};

const styles = StyleSheet.create({
  fog: { position:"absolute", top:-150,left:-160,width:720,height:720,opacity:.27 },
  layer: { position:"absolute", width:"100%",height:"100%" },
  anatomyLabel: { position:"absolute",width:"100%",textAlign:"center",fontSize:14,lineHeight:20,color:c.muted },
  up: { position:"absolute",left:"46%" },
  tapRing: { alignSelf:"center",width:44,height:44,borderRadius:22,borderWidth:1.5,borderColor:c.light,marginTop:10 },
  track: { position:"absolute",borderColor:c.line },
  ringInside: { position:"absolute",borderWidth:1,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(0,0,0,.65)" },
  phase: { fontWeight:"700",letterSpacing:-.7,marginTop:-5,textAlign:"center" },
  seconds: { fontSize:15,lineHeight:21,color:c.muted,fontVariant:["tabular-nums"],textAlign:"center",marginTop:2 },
  metrics: { width:330,maxWidth:"100%",alignSelf:"center",marginTop:12 },
  metricRow: { flexDirection:"row",justifyContent:"space-between" },
  metric: { flex:1,alignItems:"center" },
  pill: { height:44,minWidth:84,borderRadius:999,borderWidth:2,borderTopColor:"#dfe3ff",borderLeftColor:c.highlight,borderRightColor:c.highlight,borderBottomColor:"#2433c9",flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center",paddingHorizontal:12,backgroundColor:"rgba(0,0,0,.35)" },
  pillValue: { fontSize:20,lineHeight:26,fontWeight:"700" },
  metricLabel: { fontSize:14,lineHeight:20,fontWeight:"600",marginTop:8 }
});
