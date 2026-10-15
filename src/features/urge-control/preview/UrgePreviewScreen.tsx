import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextProps } from "react-native";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUrgePreviewReducedMotion } from "./useUrgePreviewReducedMotion";
import { UrgePreviewAtmosphere, UrgePreviewLCD } from "./UrgePreviewVisuals";
import { createUrgePreviewTimer, getUrgePreviewBreath, urgePreviewMinutes } from "./urgePreviewTimer";

// Simple local hierarchy: controls and titles grow gradually; prose retains
// native scaling. No word-measuring tree, finite text height or truncation.
export function UrgePreviewText({ control = false, style, ...props }: TextProps & { control?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const base = StyleSheet.flatten([s.text, style]);
  const adjustment = control ? 1 / Math.sqrt(Math.max(1, fontScale)) : 1;
  return <Text {...props} style={[base, { fontSize:(base.fontSize ?? 15) * adjustment, lineHeight:(base.lineHeight ?? 23) * adjustment }]} />;
}
function Button({ id, label, onPress, secondary = false }: { id:string; label:string; onPress:()=>void; secondary?:boolean }) {
  return <Pressable testID={`urge.preview.${id}`} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, pressed && { opacity:.75 }]}>
    <UrgePreviewText control style={s.buttonLabel}>{label}</UrgePreviewText>
  </Pressable>;
}

export function UrgePreviewScreen({ completionFixture = false }: { completionFixture?: boolean }) {
  const [timer] = useState(() => createUrgePreviewTimer(() => performance.now(), completionFixture));
  const [leavingScreen, setLeavingScreen] = useState(false);
  const state = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
  const router = useRouter(), navigation = useNavigation(), focused = useIsFocused();
  const insets = useSafeAreaInsets(), reduced = useUrgePreviewReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.35 || width < 360;
  const scroll = useRef<ScrollView>(null), leaving = useRef(false), mounted = useRef(false), lastPress = useRef(-Infinity);
  const timed = state.phase === "running" || state.phase === "paused";
  const breath = getUrgePreviewBreath(state.elapsedMs);
  const leave = () => {
    if (!mounted.current || leaving.current) return;
    leaving.current = true;
    timer.dispose();
    setLeavingScreen(true);
  };
  const exit = () => {
    const current = timer.getSnapshot();
    if (current.phase === "running" || current.phase === "paused") timer.askExit();
    else leave();
  };
  const press = (action: () => void) => {
    const now = performance.now();
    if (!mounted.current || leaving.current || now - lastPress.current < 350) return;
    lastPress.current = now;
    action();
  };
  usePreventRemove(timed && !leavingScreen, () => timer.askExit());
  useEffect(() => { if (leavingScreen) router.replace("/today"); }, [leavingScreen, router]);
  useEffect(() => {
    mounted.current = true; timer.activate();
    return () => { mounted.current = false; timer.dispose(); };
  }, [timer]);
  useEffect(() => {
    const update = (status: string) => timer.setForeground(focused && status === "active");
    update(AppState.currentState);
    const subscription = AppState.addEventListener("change", update);
    return () => subscription.remove();
  }, [timer, focused]);
  useEffect(() => {
    if (state.phase !== "running" || !state.foreground || state.confirmingExit) return;
    const interval = setInterval(timer.tick, 100);
    return () => clearInterval(interval);
  }, [timer, state.phase, state.foreground, state.confirmingExit]);
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !timed });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation, timed]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { exit(); return true; });
    return () => subscription.remove();
  });
  useEffect(() => {
    if (state.phase === "running") AccessibilityInfo.announceForAccessibility("Sayaç başladı. Nefes ritmi: dört saniye al, dört saniye tut, altı saniye ver. İstediğin an bitirebilirsin.");
    else if (state.phase === "paused") AccessibilityInfo.announceForAccessibility("Sayaç durdu. Devam etmek için Devam et düğmesini kullan.");
    else if (state.phase === "completed") AccessibilityInfo.announceForAccessibility("Süre doldu. Hiçbir sonuç kaydedilmedi.");
    if (state.phase === "ready" || state.phase === "completed") scroll.current?.scrollTo({ y:0, animated:false });
  }, [state.phase]);
  return <View testID={`urge.preview.${state.phase}`} style={s.root}>
    <StatusBar style="light" />
    <UrgePreviewAtmosphere elapsedMs={state.elapsedMs} running={state.phase === "running" && state.foreground && !state.confirmingExit} />
    <View style={[s.header, { paddingTop:insets.top + 8 }]}>
      <Pressable testID="urge.preview.exit" accessibilityRole="button" accessibilityLabel="Önizlemeden çık" onPress={exit} style={s.close}><UrgePreviewText accessible={false} allowFontScaling={false} style={{ fontSize:24, lineHeight:30 }}>×</UrgePreviewText></Pressable>
      <UrgePreviewText control accessibilityRole="header" style={s.headerTitle}>Zor an</UrgePreviewText>
      <View style={{ width:44 }} />
    </View>
    <ScrollView ref={scroll} testID="urge.preview.scroll" style={{ flex:1 }} contentContainerStyle={[s.content, { minHeight:height - insets.top - 68, paddingBottom:Math.max(insets.bottom, 24) + 16 }]}>
      <UrgePreviewText control testID="urge.preview.notice" style={s.notice}>QA önizleme · Kaydedilmez</UrgePreviewText>
      {reduced && <UrgePreviewText control testID="urge.preview.reduced-motion" style={s.notice}>QA · Hareket azaltma açık</UrgePreviewText>}
      {completionFixture && <UrgePreviewText testID="urge.preview.fixture" style={s.notice}>QA: 2 saniyelik bitiş denemesi</UrgePreviewText>}
      <View style={{ marginTop:timed && !stacked ? Math.min(125, height * .13) : 24 }}>
        <UrgePreviewLCD remainingMs={state.durationMs - state.elapsedMs} />
      </View>
      {state.phase === "ready" && <>
        {!completionFixture && <View accessibilityRole="radiogroup" accessibilityLabel="Süre seçimi" style={[s.presets, stacked && s.stacked]}>
          {urgePreviewMinutes.map(minutes => <Pressable key={minutes} testID={`urge.preview.duration.${minutes}`} accessibilityRole="radio" accessibilityLabel={`${minutes} dakika`}
            accessibilityState={{ checked:state.durationMs === minutes * 60_000 }} onPress={() => timer.select(minutes)}
            style={[s.preset, stacked && { width:"100%" }, state.durationMs === minutes * 60_000 && s.selected]}>
            <UrgePreviewText control style={s.presetLabel}>{minutes} dk</UrgePreviewText>
          </Pressable>)}
        </View>}
        <View style={s.controls}><Button id="start" label="Başlat" onPress={() => press(() => { if (AppState.currentState === "active" && focused) timer.start(); })} /></View>
        <UrgePreviewText control style={s.rhythm}>Nefes rehberi · 4 al · 4 tut · 6 ver</UrgePreviewText>
        <UrgePreviewText testID="urge.preview.intro.prose" style={s.prose}>Bu ritmi istersen dene. Sana uygun değilse doğal nefesine dön. İstediğin an durabilir veya çıkabilirsin.</UrgePreviewText>
        <View style={s.guide}>
          <UrgePreviewText control accessibilityRole="header" style={s.guideTitle}>Kendi ritminde</UrgePreviewText>
          <UrgePreviewText testID="urge.preview.intro.guide" style={s.prose}>Bir süre hedefin yok. Süre dolunca nasıl hissettiğine sen karar verirsin.</UrgePreviewText>
        </View>
      </>}
      {timed && <>
        <View style={s.cue}>
          <UrgePreviewText control testID="urge.preview.cue" accessibilityLiveRegion="none" style={s.cueTitle}>{state.phase === "paused" ? "Duraklatıldı" : breath.label}</UrgePreviewText>
          <UrgePreviewText style={s.rhythm}>4 saniye al · 4 tut · 6 ver</UrgePreviewText>
        </View>
        {state.pauseReason === "background" && <UrgePreviewText testID="urge.preview.background" style={s.prose}>Arka planda süre durdu. Hazır olunca devam et.</UrgePreviewText>}
        <UrgePreviewText style={s.prose}>Bu bir nefes örneği. Rahat değilse doğal nefesine dön. Süreyi beklemek zorunda değilsin.</UrgePreviewText>
        <View testID="urge.preview.controls" style={[s.controls, !stacked && { marginTop:"auto", paddingTop:32 }]}>
          {state.phase === "running" ? <Button id="pause" label="Duraklat" onPress={() => press(timer.pause)} /> : <Button id="resume" label="Devam et" onPress={() => press(() => { if (AppState.currentState === "active" && focused) timer.resume(); })} />}
          <Button id="finish" label="Egzersizi bitir" secondary onPress={() => press(timer.askExit)} />
        </View>
      </>}
      {state.phase === "completed" && <>
        <UrgePreviewText control testID="urge.preview.completion" accessibilityRole="header" style={[s.cueTitle, { marginTop:32 }]}>Süre doldu</UrgePreviewText>
        <UrgePreviewText style={s.prose}>Nasıl hissettiğine sen karar verirsin. Sürenin dolması, dürtünün azaldığı anlamına gelmez.</UrgePreviewText>
        <UrgePreviewText testID="urge.preview.unsaved" style={s.prose}>Hiçbir sonuç kayda geçmedi.</UrgePreviewText>
        <View style={s.controls}><Button id="done" label="Önizlemeyi kapat" onPress={leave} /><Button id="reset" label="Süreyi yeniden seç" secondary onPress={() => press(timer.reset)} /></View>
      </>}
    </ScrollView>
    <Modal visible={state.confirmingExit} transparent animationType={reduced ? "none" : "fade"} onRequestClose={timer.cancelExit}
      onShow={() => AccessibilityInfo.announceForAccessibility("Egzersizden çıkılsın mı? Sayaç durdu.")}>
      <View style={[s.scrim, { paddingTop:insets.top + 16, paddingBottom:Math.max(insets.bottom,16) }]}>
        <ScrollView testID="urge.preview.exit.dialog" accessibilityViewIsModal style={{ flexGrow:0, maxHeight:"100%" }} contentContainerStyle={s.dialog}>
          <UrgePreviewText control accessibilityRole="header" style={s.dialogTitle}>Egzersizden çıkılsın mı?</UrgePreviewText>
          <UrgePreviewText style={s.prose}>Sayaç durdu. Çıkarsan bu önizleme kapanır. Kayıt yok.</UrgePreviewText>
          <Button id="exit.confirm" label="Çık ve kapat" onPress={leave} />
          <Button id="exit.keep" label="Burada kal" secondary onPress={timer.cancelExit} />
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  root:{ flex:1, backgroundColor:"#000" },
  text:{ fontFamily:"Inter_400Regular", fontSize:15, lineHeight:23, color:"#fff", flexShrink:1 },
  header:{ flexDirection:"row", alignItems:"center", gap:10, paddingHorizontal:20, paddingBottom:8 },
  headerTitle:{ flex:1, textAlign:"center", fontFamily:"Inter_600SemiBold" },
  close:{ width:44, height:44, borderRadius:22, backgroundColor:"#ffffff10", justifyContent:"center", alignItems:"center" },
  content:{ paddingHorizontal:22, flexGrow:1 },
  notice:{ color:"#aab3ff", textAlign:"center", marginTop:10, fontSize:13, lineHeight:20 },
  presets:{ flexDirection:"row", justifyContent:"center", gap:8, marginTop:24 },
  stacked:{ flexDirection:"column", alignItems:"stretch" },
  preset:{ minHeight:44, paddingHorizontal:14, paddingVertical:10, borderRadius:24, backgroundColor:"#ffffff12", justifyContent:"center", borderWidth:1.5, borderColor:"transparent" },
  selected:{ backgroundColor:"#3a4bff38", borderColor:"#aab3ff" },
  presetLabel:{ textAlign:"center", fontFamily:"Inter_600SemiBold" },
  controls:{ gap:10, marginTop:22 },
  button:{ minHeight:56, paddingHorizontal:20, paddingVertical:16, borderRadius:30, justifyContent:"center", backgroundColor:"#3a4bff", borderTopWidth:1, borderTopColor:"#7480ff" },
  secondary:{ backgroundColor:"#1b1c25", borderTopColor:"#33343d" },
  buttonLabel:{ textAlign:"center", fontFamily:"Inter_600SemiBold", width:"100%" },
  rhythm:{ color:"#b9bdd6", textAlign:"center", marginTop:16 },
  prose:{ color:"#b9bdd0", marginTop:16, marginBottom:8 },
  guide:{ padding:20, marginTop:20, borderRadius:26, backgroundColor:"#141722d9", borderTopWidth:1, borderTopColor:"#ffffff16" },
  guideTitle:{ fontFamily:"Inter_600SemiBold", color:"#d4d9ff" },
  cue:{ marginTop:32, marginBottom:8 },
  cueTitle:{ textAlign:"center", fontFamily:"Inter_700Bold", fontSize:30, lineHeight:38, color:"#fff" },
  scrim:{ flex:1, backgroundColor:"#000b", paddingHorizontal:20, justifyContent:"center" },
  dialog:{ padding:24, borderRadius:28, backgroundColor:"#171925", gap:16, flexGrow:0 },
  dialogTitle:{ fontFamily:"Inter_600SemiBold", fontSize:24, lineHeight:32, textAlign:"center" }
});
