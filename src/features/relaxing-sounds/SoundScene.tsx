import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import layers from './soundSceneLayers.json';
import type { SoundId } from './sounds';

function Layer({ xml, kind, index, running }: { xml: string; kind: string; index: number; running: boolean }) {
  const motion = useSharedValue(0);
  useEffect(() => {
    if (!running) { cancelAnimation(motion); return; }
    motion.value = 0;
    const duration = kind === 'rainfall' ? 1600 : kind === 'flame' ? 1100 + index * 200 : kind === 'embers' ? 4800 : kind === 'mist' ? 18000 : kind === 'wv' ? 6000 + index * 1700 : 5000 + index * 450;
    motion.value = withRepeat(withTiming(1, { duration, easing: ['rainfall','embers','wv'].includes(kind) ? Easing.linear : Easing.inOut(Easing.sin) }), -1, !['rainfall','embers','wv'].includes(kind));
    return () => cancelAnimation(motion);
  }, [running, kind, index, motion]);
  const style = useAnimatedStyle(() => {
    const p = motion.value;
    if (kind === 'wv') return { transform: [{ translateX: p * 292 }] };
    if (kind === 'refl') return { opacity: 1 - p * .55, transform: [{ scaleX: 1 - p * .18 }] };
    if (kind === 'flame') return { transform: [{ scaleY: 1 + p * .06 }, { scaleX: 1 - p * .025 }] };
    if (kind === 'embers') return { opacity: Math.sin(p * Math.PI), transform: [{ translateY: -p * 260 }, { translateX: p * 18 }] };
    if (kind === 'mist') return { transform: [{ translateX: p * 100 }] };
    if (kind === 'row') return { transform: [{ translateX: -p * 8 }] };
    if (kind === 'ffly') return { opacity: .2 + p * .8, transform: [{ translateX: p * 10 }, { translateY: -p * 8 }] };
    return { transform: [{ translateY: p * (kind === 'rainfall' ? 130 : 160) }] };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, style]}><SvgXml xml={xml} width="100%" height="100%" /></Animated.View>;
}
export function SoundScene({ id, playing = false }: { id: SoundId; playing?: boolean }) {
  const reduced = useReducedMotion(), scene = layers[id];
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <SvgXml xml={scene.base} width="100%" height="100%" />
    {scene.layers.map((layer, index) => <Layer key={index} {...layer} index={index} running={playing && !reduced} />)}
    <View style={StyleSheet.absoluteFill}><SvgXml xml={scene.front} width="100%" height="100%" /></View>
  </View>;
}
