import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { formatUrgeExerciseTime, getUrgeExerciseBreath } from "./urgeExerciseTimer";
import { useUrgeExerciseReducedMotion } from "./useUrgeExerciseReducedMotion";

export function UrgeExerciseAtmosphere({ elapsedMs, running }: { elapsedMs: number; running: boolean }) {
  const reduced = useUrgeExerciseReducedMotion();
  const breath = getUrgeExerciseBreath(elapsedMs);
  const expansion = useSharedValue(breath.expansion);
  useEffect(() => {
    cancelAnimation(expansion);
    expansion.value = reduced ? .5 : breath.expansion;
    if (running && !reduced) expansion.value = withTiming(breath.target, { duration: breath.remainingMs, easing: Easing.linear });
    return () => cancelAnimation(expansion);
    // A tween starts only at a phase boundary or pause/resume. Snapshot ticks
    // do not restart it; the active-time phase supplies its remaining duration.
  }, [breath.phase, running, reduced, expansion]);
  const style = useAnimatedStyle(() => ({
    opacity: .65 + expansion.value * .35,
    transform: [{ scale: .8 + expansion.value * .24 }]
  }));
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 402 874" preserveAspectRatio="none">
      <Defs><LinearGradient id="urgeNight" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#020308" /><Stop offset={0.48} stopColor="#070b22" /><Stop offset="1" stopColor="#000" /></LinearGradient></Defs>
      <Rect width={402} height={874} fill="url(#urgeNight)" />
      {[[32,93],[138,122],[265,82],[360,184],[71,234],[302,266]].map(([x,y], i) => <Circle key={i} cx={x} cy={y} r={.7} fill="#c5ccff" opacity={.3} />)}
    </Svg>
    <Animated.View style={[{ position:"absolute", left:-120, right:-120, top:-200, bottom:-200 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 402 874" preserveAspectRatio="none">
        <Defs><RadialGradient id="urgeFog"><Stop offset="0" stopColor="#7483ff" stopOpacity={.62} /><Stop offset={0.36} stopColor="#3a4bff" stopOpacity={.35} /><Stop offset="1" stopColor="#14204d" stopOpacity={0} /></RadialGradient></Defs>
        <Ellipse cx={205} cy={354} rx={292} ry={270} fill="url(#urgeFog)" />
        <Ellipse cx={294} cy={270} rx={170} ry={135} fill="url(#urgeFog)" opacity={.6} />
        <Ellipse cx={65} cy={430} rx={180} ry={125} fill="url(#urgeFog)" opacity={.45} />
      </Svg>
    </Animated.View>
  </View>;
}

// The approved HTML's seven-segment geometry, rendered as native SVG paths.
const segments = {
  a: "8,5 13,0 41,0 46,5 41,10 13,10",
  b: "49,8 54,13 54,41 49,46 44,41 44,13",
  c: "49,50 54,55 54,83 49,88 44,83 44,55",
  d: "8,91 13,86 41,86 46,91 41,96 13,96",
  e: "5,50 10,55 10,83 5,88 0,83 0,55",
  f: "5,8 10,13 10,41 5,46 0,41 0,13",
  g: "8,48 13,43 41,43 46,48 41,53 13,53"
};
const digits: Record<string, string> = { "0":"abcdef", "1":"bc", "2":"abged", "3":"abgcd", "4":"fgbc", "5":"afgcd", "6":"afgedc", "7":"abc", "8":"abcdefg", "9":"abcdfg" };
export function UrgeExerciseLCD({ remainingMs, testID }: { remainingMs: number; testID?: string }) {
  const time = formatUrgeExerciseTime(remainingMs);
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return <View testID={testID} accessible accessibilityRole="timer"
    accessibilityLabel={`Kalan süre: ${Math.floor(seconds / 60)} dakika ${seconds % 60} saniye`}
    accessibilityValue={{ text: time }} accessibilityLiveRegion="none" style={s.lcd}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.screen}>
      <Svg width="100%" height="100%" viewBox="0 0 330 148">
        <Defs><LinearGradient id="urgeLCD" x1="0" y1="0" x2="0.7" y2="1"><Stop offset="0" stopColor="#d9def3" /><Stop offset={0.48} stopColor="#aeb6d6" /><Stop offset="1" stopColor="#8790b4" /></LinearGradient><LinearGradient id="urgeGlass" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#fff" stopOpacity={.25} /><Stop offset={0.55} stopColor="#fff" stopOpacity={0} /></LinearGradient></Defs>
        <Rect width={330} height={148} rx={26} fill="url(#urgeLCD)" />
        <G transform="translate(31 26)">
          {Array.from(time).map((char, index) => char === ":" ? <G key={index} transform="translate(125 0)"><Rect x={2} y={26} width={9} height={9} fill="#0c0f1e" /><Rect x={2} y={60} width={9} height={9} fill="#0c0f1e" /></G> :
            <G key={index} transform={`translate(${[0,63,0,148,211][index]} 0)`}>
              {Object.entries(segments).map(([segment, points]) => <Polygon key={segment} points={points} fill="#0c0f1e" opacity={digits[char]?.includes(segment) ? 1 : .045} />)}
            </G>)}
        </G>
        <Rect width={330} height={148} rx={26} fill="url(#urgeGlass)" />
      </Svg>
    </View>
  </View>;
}
const s = StyleSheet.create({
  lcd: { width:"100%", maxWidth:358, alignSelf:"center", borderRadius:38, padding:12, backgroundColor:"#202126", borderWidth:1, borderTopColor:"#55565e", borderColor:"#101115", shadowColor:"#000", shadowOffset:{width:0,height:20}, shadowRadius:24, shadowOpacity:.7 },
  screen: { width:"100%", aspectRatio:330/148, borderRadius:26, overflow:"hidden", backgroundColor:"#aeb6d6", borderTopWidth:3, borderTopColor:"#646b89" }
});
