import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AccessibilityInfo, AppState, BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextProps } from "react-native";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UrgeExerciseAtmosphere, UrgeExerciseLCD } from "./UrgeExerciseVisuals";
import { createUrgeExerciseTimer, getUrgeExerciseBreath, urgeExerciseMinutes } from "./urgeExerciseTimer";
import { useUrgeExerciseReducedMotion } from "./useUrgeExerciseReducedMotion";

export type UrgeExerciseAction = Readonly<{ label: string; onPress: () => void }>;
export type UrgeExerciseProps = Readonly<{
  testIDPrefix: string;
  initialDurationMs?: number;
  allowDurationSelection?: boolean;
  notice?: string;
  reducedMotionNotice?: string;
  fixtureNotice?: string;
  closeAccessibilityLabel: string;
  completionAnnouncement: string;
  completionNote?: string;
  completionActionLabel: string;
  exitDescription: string;
  exitConfirmLabel: string;
  onExitConfirmed: () => boolean | void;
  evaluationAction?: UrgeExerciseAction;
  confirmExitWhenIdle?: boolean;
  manageGestures?: boolean;
  interactionDisabled?: boolean;
  statusContent?: ReactNode;
}>;

// Simple local hierarchy: controls and titles grow gradually; prose retains
// native scaling. No word-measuring tree, finite text height or truncation.
export function UrgeExerciseText({ control = false, style, ...props }: TextProps & { control?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const base = StyleSheet.flatten([s.text, style]);
  const adjustment = control ? 1 / Math.sqrt(Math.max(1, fontScale)) : 1;
  return <Text {...props} style={[base, { fontSize:(base.fontSize ?? 15) * adjustment, lineHeight:(base.lineHeight ?? 23) * adjustment }]} />;
}

function Button({ testID, label, onPress, secondary = false, disabled = false }: { testID:string; label:string; onPress:()=>void; secondary?:boolean; disabled?:boolean }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && !disabled && { opacity:.75 }]}>
    <UrgeExerciseText control style={s.buttonLabel}>{label}</UrgeExerciseText>
  </Pressable>;
}

export function UrgeExercise({
  testIDPrefix, initialDurationMs, allowDurationSelection = true,
  notice, reducedMotionNotice, fixtureNotice, closeAccessibilityLabel,
  completionAnnouncement, completionNote, completionActionLabel,
  exitDescription, exitConfirmLabel, onExitConfirmed,
  evaluationAction, confirmExitWhenIdle = false,
  interactionDisabled = false, statusContent, manageGestures = true
}: UrgeExerciseProps) {
  const [timer] = useState(() => createUrgeExerciseTimer(() => performance.now(), initialDurationMs === undefined
    ? { allowDurationSelection }
    : { initialDurationMs, allowDurationSelection }));
  const [leavingScreen, setLeavingScreen] = useState(false);
  const state = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
  const navigation = useNavigation(), focused = useIsFocused();
  const insets = useSafeAreaInsets(), reduced = useUrgeExerciseReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.35 || width < 360;
  const scroll = useRef<ScrollView>(null), leaving = useRef(false), notified = useRef(false), mounted = useRef(false), lastPress = useRef(-Infinity);
  const timed = state.phase === "running" || state.phase === "paused";
  const preventRemoval = !leavingScreen && (timed || confirmExitWhenIdle);
  const breath = getUrgeExerciseBreath(state.elapsedMs);
  const id = (suffix: string) => `${testIDPrefix}.${suffix}`;
  const leave = () => {
    if (!mounted.current || leaving.current || interactionDisabled) return;
    leaving.current = true;
    timer.dispose();
    setLeavingScreen(true);
  };
  const exit = () => {
    const current = timer.getSnapshot();
    if (current.phase === "running" || current.phase === "paused" || confirmExitWhenIdle) timer.askExit();
    else leave();
  };
  const press = (action: () => void) => {
    const now = performance.now();
    if (!mounted.current || leaving.current || interactionDisabled || now - lastPress.current < 350) return;
    lastPress.current = now;
    action();
  };
  const evaluate = evaluationAction ? () => press(() => {
    const current = timer.getSnapshot();
    if (!focused || AppState.currentState !== "active" || !current.foreground || current.confirmingExit) return;
    if (current.phase === "running") timer.pause();
    evaluationAction.onPress();
  }) : null;
  usePreventRemove(preventRemoval, () => timer.askExit());
  useEffect(() => {
    if (!leavingScreen || notified.current) return;
    notified.current = true;
    let completed = false;
    try { completed = onExitConfirmed() !== false; } catch { completed = false; }
    if (!completed && mounted.current) {
      timer.activate();
      timer.setForeground(focused && AppState.currentState === "active");
      leaving.current = false;
      notified.current = false;
      setLeavingScreen(false);
    }
  }, [focused, leavingScreen, onExitConfirmed, timer]);
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
    if (!manageGestures) return;
    navigation.setOptions({ gestureEnabled: !preventRemoval });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [manageGestures, navigation, preventRemoval]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { exit(); return true; });
    return () => subscription.remove();
  });
  useEffect(() => {
    if (state.phase === "running") AccessibilityInfo.announceForAccessibility("Sayaç başladı. Nefes ritmi: dört saniye al, dört saniye tut, altı saniye ver. İstediğin an bitirebilirsin.");
    else if (state.phase === "paused") AccessibilityInfo.announceForAccessibility("Sayaç durdu. Devam etmek için Devam et düğmesini kullan.");
    else if (state.phase === "completed") AccessibilityInfo.announceForAccessibility(completionAnnouncement);
    if (state.phase === "ready" || state.phase === "completed") scroll.current?.scrollTo({ y:0, animated:false });
  }, [completionAnnouncement, state.phase]);
  return <View testID={id(state.phase)} style={s.root}>
    <StatusBar style="light" />
    <UrgeExerciseAtmosphere elapsedMs={state.elapsedMs} running={state.phase === "running" && state.foreground && !state.confirmingExit} />
    <View style={[s.header, { paddingTop:insets.top + 8 }]}>
      <Pressable testID={id("exit")} accessibilityRole="button" accessibilityLabel={closeAccessibilityLabel} onPress={exit} style={s.close}><UrgeExerciseText accessible={false} allowFontScaling={false} style={{ fontSize:24, lineHeight:30 }}>×</UrgeExerciseText></Pressable>
      <UrgeExerciseText control accessibilityRole="header" style={s.headerTitle}>Zor an</UrgeExerciseText>
      <View style={{ width:44 }} />
    </View>
    <ScrollView ref={scroll} testID={id("scroll")} style={{ flex:1 }} contentContainerStyle={[s.content, { minHeight:height - insets.top - 68, paddingBottom:Math.max(insets.bottom, 24) + 16 }]}>
      {notice ? <UrgeExerciseText control testID={id("notice")} style={s.notice}>{notice}</UrgeExerciseText> : null}
      {reduced && reducedMotionNotice ? <UrgeExerciseText control testID={id("reduced-motion")} style={s.notice}>{reducedMotionNotice}</UrgeExerciseText> : null}
      {fixtureNotice ? <UrgeExerciseText testID={id("fixture")} style={s.notice}>{fixtureNotice}</UrgeExerciseText> : null}
      {statusContent && !state.confirmingExit ? <View testID={id("status")} style={s.status}>{statusContent}</View> : null}
      <View style={{ marginTop:timed && !stacked ? Math.min(125, height * .13) : 24 }}>
        <UrgeExerciseLCD testID={id("lcd")} remainingMs={state.durationMs - state.elapsedMs} />
      </View>
      {state.phase === "ready" && <>
        {allowDurationSelection && <View accessibilityRole="radiogroup" accessibilityLabel="Süre seçimi" style={[s.presets, stacked && s.stacked]}>
          {urgeExerciseMinutes.map(minutes => <Pressable key={minutes} testID={id(`duration.${minutes}`)} accessibilityRole="radio" accessibilityLabel={`${minutes} dakika`}
            accessibilityState={{ checked:state.durationMs === minutes * 60_000, disabled:interactionDisabled }} disabled={interactionDisabled}
            onPress={() => timer.select(minutes)}
            style={[s.preset, stacked && { width:"100%" }, state.durationMs === minutes * 60_000 && s.selected, interactionDisabled && s.disabled]}>
            <UrgeExerciseText control style={s.presetLabel}>{minutes} dk</UrgeExerciseText>
          </Pressable>)}
        </View>}
        <View style={s.controls}>
          <Button testID={id("start")} label="Başlat" disabled={interactionDisabled} onPress={() => press(() => { if (AppState.currentState === "active" && focused) timer.start(); })} />
          {evaluate ? <Button testID={id("evaluate")} label={evaluationAction?.label ?? ""} secondary disabled={interactionDisabled || !state.foreground || state.confirmingExit} onPress={evaluate} /> : null}
        </View>
        <UrgeExerciseText control style={s.rhythm}>Nefes rehberi · 4 al · 4 tut · 6 ver</UrgeExerciseText>
        <UrgeExerciseText testID={id("intro.prose")} style={s.prose}>Bu ritmi istersen dene. Sana uygun değilse doğal nefesine dön. İstediğin an durabilir veya çıkabilirsin.</UrgeExerciseText>
        <View style={s.guide}>
          <UrgeExerciseText control accessibilityRole="header" style={s.guideTitle}>Kendi ritminde</UrgeExerciseText>
          <UrgeExerciseText testID={id("intro.guide")} style={s.prose}>Bir süre hedefin yok. Süre dolunca nasıl hissettiğine sen karar verirsin.</UrgeExerciseText>
        </View>
      </>}
      {timed && <>
        <View style={s.cue}>
          <UrgeExerciseText control testID={id("cue")} accessibilityLiveRegion="none" style={s.cueTitle}>{state.phase === "paused" ? "Duraklatıldı" : breath.label}</UrgeExerciseText>
          <UrgeExerciseText style={s.rhythm}>4 saniye al · 4 tut · 6 ver</UrgeExerciseText>
        </View>
        {state.pauseReason === "background" && <UrgeExerciseText testID={id("background")} style={s.prose}>Arka planda süre durdu. Hazır olunca devam et.</UrgeExerciseText>}
        <UrgeExerciseText style={s.prose}>Bu bir nefes örneği. Rahat değilse doğal nefesine dön. Süreyi beklemek zorunda değilsin.</UrgeExerciseText>
        <View testID={id("controls")} style={[s.controls, !stacked && { marginTop:"auto", paddingTop:32 }]}>
          {state.phase === "running" ? <Button testID={id("pause")} label="Duraklat" disabled={interactionDisabled} onPress={() => press(timer.pause)} /> : <Button testID={id("resume")} label="Devam et" disabled={interactionDisabled || !state.foreground} onPress={() => press(() => { if (AppState.currentState === "active" && focused) timer.resume(); })} />}
          {evaluate ? <Button testID={id("evaluate")} label={evaluationAction?.label ?? ""} secondary disabled={interactionDisabled || !state.foreground || state.confirmingExit} onPress={evaluate} /> : <Button testID={id("finish")} label="Egzersizi bitir" secondary disabled={interactionDisabled} onPress={() => press(timer.askExit)} />}
        </View>
      </>}
      {state.phase === "completed" && <>
        <UrgeExerciseText control testID={id("completion")} accessibilityRole="header" style={[s.cueTitle, { marginTop:32 }]}>Süre doldu</UrgeExerciseText>
        <UrgeExerciseText style={s.prose}>Nasıl hissettiğine sen karar verirsin. Sürenin dolması, dürtünün azaldığı anlamına gelmez.</UrgeExerciseText>
        {completionNote ? <UrgeExerciseText testID={id("unsaved")} style={s.prose}>{completionNote}</UrgeExerciseText> : null}
        <View style={s.controls}>
          {evaluate ? <Button testID={id("evaluate")} label={evaluationAction?.label ?? ""} disabled={interactionDisabled || !state.foreground || state.confirmingExit} onPress={evaluate} /> : <Button testID={id("done")} label={completionActionLabel} disabled={interactionDisabled} onPress={leave} />}
          <Button testID={id("reset")} label="Süreyi yeniden seç" secondary disabled={interactionDisabled} onPress={() => press(timer.reset)} />
        </View>
      </>}
    </ScrollView>
    <Modal visible={state.confirmingExit} transparent animationType={reduced ? "none" : "fade"} onRequestClose={timer.cancelExit}
      onShow={() => AccessibilityInfo.announceForAccessibility("Egzersizden çıkılsın mı? Sayaç durdu.")}>
      <View style={[s.scrim, { paddingTop:insets.top + 16, paddingBottom:Math.max(insets.bottom,16) }]}>
        <ScrollView testID={id("exit.dialog")} accessibilityViewIsModal style={{ flexGrow:0, maxHeight:"100%" }} contentContainerStyle={s.dialog}>
          <UrgeExerciseText control accessibilityRole="header" style={s.dialogTitle}>Egzersizden çıkılsın mı?</UrgeExerciseText>
          <UrgeExerciseText style={s.prose}>{exitDescription}</UrgeExerciseText>
          {statusContent ? <View style={s.status}>{statusContent}</View> : null}
          <Button testID={id("exit.confirm")} label={exitConfirmLabel} disabled={interactionDisabled} onPress={leave} />
          <Button testID={id("exit.keep")} label="Burada kal" secondary onPress={timer.cancelExit} />
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
  status:{ gap:10, marginTop:12, padding:14, borderRadius:18, backgroundColor:"#171925e6" },
  presets:{ flexDirection:"row", justifyContent:"center", gap:8, marginTop:24 },
  stacked:{ flexDirection:"column", alignItems:"stretch" },
  preset:{ minHeight:44, paddingHorizontal:14, paddingVertical:10, borderRadius:24, backgroundColor:"#ffffff12", justifyContent:"center", borderWidth:1.5, borderColor:"transparent" },
  selected:{ backgroundColor:"#3a4bff38", borderColor:"#aab3ff" },
  presetLabel:{ textAlign:"center", fontFamily:"Inter_600SemiBold" },
  controls:{ gap:10, marginTop:22 },
  button:{ minHeight:56, paddingHorizontal:20, paddingVertical:16, borderRadius:30, justifyContent:"center", backgroundColor:"#3a4bff", borderTopWidth:1, borderTopColor:"#7480ff" },
  secondary:{ backgroundColor:"#1b1c25", borderTopColor:"#33343d" },
  disabled:{ opacity:.45 },
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
