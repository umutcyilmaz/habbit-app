import { useEffect } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

/** Decorative sky only: its brightness never claims a streak or health outcome. */
export function HomeAtmosphere() {
  const focused = useIsFocused(), reduced = useReducedMotion(), drift = useSharedValue(0);
  useEffect(() => {
    const update = () => {
      cancelAnimation(drift);
      drift.value = focused && !reduced && AppState.currentState === "active"
        ? withRepeat(withTiming(1, { duration: 12000 }), -1, true) : 0;
    };
    update();
    const subscription = AppState.addEventListener("change", update);
    return () => { subscription.remove(); cancelAnimation(drift); };
  }, [focused, reduced, drift]);
  const fogStyle = useAnimatedStyle(() => ({ opacity: .75 + drift.value * .2, transform: [{ translateX: drift.value * 14 }] }));
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.sky}>
    <Svg width="100%" height="100%" viewBox="0 0 402 650" preserveAspectRatio="none">
      <Defs><LinearGradient id="homeNight" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#010208" /><Stop offset={0.48} stopColor="#070d2a" /><Stop offset="1" stopColor="#000" /></LinearGradient></Defs>
      <Rect width={402} height={650} fill="url(#homeNight)" />
      {[[26,89],[98,43],[161,78],[245,30],[337,82],[374,153],[47,199],[277,147],[126,178]].map(([x,y], index) => <Circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 1 : .6} fill="#c9d0ff" opacity={.3} />)}
    </Svg>
    <Animated.View style={[StyleSheet.absoluteFill, fogStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 402 650" preserveAspectRatio="none">
        <Defs><RadialGradient id="homeFog"><Stop offset="0" stopColor="#5668ff" stopOpacity={.6} /><Stop offset={0.5} stopColor="#2535ae" stopOpacity={.32} /><Stop offset="1" stopColor="#030717" stopOpacity={0} /></RadialGradient></Defs>
        <Ellipse cx={208} cy={318} rx={285} ry={228} fill="url(#homeFog)" />
        <Ellipse cx={285} cy={220} rx={185} ry={130} fill="url(#homeFog)" opacity={.4} />
      </Svg>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ sky: { position: "absolute", left: -16, right: -16, top: -100, height: 650, overflow: "hidden" } });
