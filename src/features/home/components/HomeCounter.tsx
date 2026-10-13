import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { AppText } from "../../../shared/components/v4/AppText";

export function advanceHomeCounter(seconds: number | null, observedAt: string, now: Date, maximum = Infinity): number | null {
  const observed = Date.parse(observedAt), current = now.getTime();
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(observed) || !Number.isFinite(current)) return null;
  return Math.min(maximum, Math.max(0, Math.floor(seconds + (current - observed) / 1000)));
}

/** Text reflects elapsed time, never an animated count through invented intermediate facts. */
export function HomeCounter({ seconds, observedAt, now, id, maximum, emptyLabel = "Henüz tamamlanan oturum yok" }: {
  seconds: number | null; observedAt: string; now: () => Date; id: string; maximum?: number; emptyLabel?: string;
}) {
  const reduced = useReducedMotion(), large = useWindowDimensions().fontScale > 1.5;
  const [, setClock] = useState(() => now());
  useFocusEffect(useCallback(() => {
    const refresh = () => setClock(now());
    refresh();
    let interval: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      if (interval !== undefined) clearInterval(interval);
      if (AppState.currentState === "active") { refresh(); interval = setInterval(refresh, 1000); }
    };
    update();
    const subscription = AppState.addEventListener("change", update);
    return () => { if (interval !== undefined) clearInterval(interval); subscription.remove(); };
  }, [now]));
  const elapsed = advanceHomeCounter(seconds, observedAt, now(), maximum);
  const days = elapsed === null ? null : Math.floor(elapsed / 86400);
  const rest = elapsed === null ? null : `${Math.floor(elapsed % 86400 / 3600)} sa ${Math.floor(elapsed % 3600 / 60)} dk ${elapsed % 60} sn`;
  return <View style={styles.counter}>
    <View testID={id} style={[styles.numberRow, large && styles.largeRow]} accessible accessibilityRole="text" accessibilityLabel={days === null ? emptyLabel : `${days} tamamlanan gün`}>
      <Animated.View key={days ?? "empty"} {...(reduced ? {} : { entering: FadeIn.duration(300) })}>
        <AppText testID={`${id}.value`} style={[styles.number, large && styles.largeNumber]}>{days ?? "—"}</AppText>
      </Animated.View><AppText style={[styles.unit, large && styles.largeUnit]}>gün</AppText>
    </View>
    <View style={styles.timeChip}><AppText testID={`${id}.time`} style={styles.time}>{rest ?? emptyLabel}</AppText></View>
  </View>;
}
const styles = StyleSheet.create({
  counter: { alignItems: "center", gap: 16 }, numberRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 12 }, largeRow: { flexDirection: "column", alignItems: "center", gap: 0 },
  number: { fontSize: 76, lineHeight: 90, fontFamily: "Inter_700Bold", letterSpacing: -2, fontVariant: ["tabular-nums"] }, unit: { fontSize: 76, lineHeight: 90, fontFamily: "Inter_700Bold", letterSpacing: -2 },
  largeNumber: { fontSize: 48, lineHeight: 60 }, largeUnit: { fontSize: 36, lineHeight: 48 },
  timeChip: { backgroundColor: "rgba(255,255,255,.08)", borderRadius: 24, borderWidth: 1, borderColor: "rgba(170,179,255,.22)", paddingHorizontal: 20, paddingVertical: 10, maxWidth: "100%" }, time: { fontSize: 17, lineHeight: 23, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"], textAlign: "center" },
});
