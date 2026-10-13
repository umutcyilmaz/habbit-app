import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { AppText } from '../../shared/components/v4/AppText';
import { useBloomLocalState } from '../../app/providers/BloomLocalStateProvider';
import { routes } from '../../constants/navigation';
import { kegelPersistenceQaEnabled } from '../kegel/kegelPersistenceQa';
import { SoundScene } from './SoundScene';
import { findSound, formatSoundTime, soundDurations, type sounds } from './sounds';
import { createSoundPlaybackController } from './soundPlaybackController';
import { expoSoundPort } from './expoSoundPort';
const qa = kegelPersistenceQaEnabled && process.env.EXPO_PUBLIC_RELAXING_SOUNDS_QA === '1';
const fade = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 100" preserveAspectRatio="none"><defs><linearGradient id="f" x2="0" y2="1"><stop stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="10" height="100" fill="url(#f)"/></svg>';
const seekIcon = (forward: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g ${forward ? 'transform="translate(24 0) scale(-1 1)"' : ''}><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" fill="#fff"/></g></svg>`;
const play = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 3l15 9-15 9z" fill="#000"/></svg>';
const pause = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 3h4v18H6zM14 3h4v18h-4z" fill="#000"/></svg>';
export function SoundPlayerScreen() {
  const { id } = useLocalSearchParams<{id?:string}>(), focused = useIsFocused();
  const sound = findSound(id), router = useRouter(), insets = useSafeAreaInsets();
  if (!sound) return <View style={[styles.screen, {paddingTop:insets.top + 24, paddingHorizontal:24}]}><AppText accessibilityRole="header" style={styles.title}>Ses bulunamadı</AppText><Pressable testID="sound.not-found.back" accessibilityRole="button" accessibilityLabel="Geri" onPress={() => router.canGoBack() ? router.back() : router.replace(routes.library)} style={styles.back}><AppText>{router.canGoBack() ? 'Geri' : 'Library’ye dön'}</AppText></Pressable></View>;
  // Losing navigation focus unmounts the session, including forward/deep links.
  return focused ? <PlayerSession key={sound.id} sound={sound} /> : <View style={styles.screen} />;
}
function PlayerSession({ sound }: {sound: typeof sounds[number]}) {
  const router = useRouter(), insets = useSafeAreaInsets(), window = useWindowDimensions(), bloom = useBloomLocalState();
  const controller = useMemo(() => createSoundPlaybackController(expoSoundPort(sound.source, qa)), [sound.source]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.open();
    if (AppState.currentState !== 'active') controller.suspend();
    const subscription = AppState.addEventListener('change', next => next === 'active' ? controller.foreground() : controller.suspend());
    return () => { subscription.remove(); controller.close(); };
  }, [controller]);
  const back = () => {
    if (bloom.getAcceptedState() !== bloom.getDurableState()) return;
    controller.close(); router.canGoBack() ? router.back() : router.replace(routes.library);
  };
  const unavailable = state.phase === 'loading' || state.phase === 'error' || state.busy;
  const statusLabel = state.phase === 'loading' ? 'Ses yükleniyor…' : state.phase === 'error' ? 'Ses kullanılamıyor' : state.phase === 'buffering' || state.busy ? 'Hazırlanıyor…' : state.phase === 'ended' ? 'Süre doldu' : state.playing ? 'Çalıyor' : state.elapsed ? 'Duraklatıldı' : 'Oynatmaya hazır';
  return <View style={styles.screen}>
    <View style={{ position:'absolute', top:0, left:0, right:0, height:window.height * .64 }}><SoundScene id={sound.id} playing={state.playing} /></View>
    <View pointerEvents="none" style={{ position:'absolute', top:window.height * .40, left:0, right:0, height:window.height * .26 }}><SvgXml xml={fade} width="100%" height="100%" /></View>
    <ScrollView contentContainerStyle={{flexGrow:1, paddingTop:insets.top + 60, paddingBottom:Math.max(24,insets.bottom + 12), justifyContent:'flex-end', paddingHorizontal:24}}>
      <View style={{minHeight:window.height * .30}} />
      <View style={styles.body}>
        <AppText style={styles.eyebrow}>RAHATLATICI SES</AppText>
        <AppText accessibilityRole="header" style={styles.title}>{sound.title}</AppText>
        <AppText style={styles.description}>{sound.description}</AppText>
        <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel="Dinleme süresi" accessibilityValue={state.duration ? { min:0, max:state.duration, now:Math.min(state.duration,Math.floor(state.elapsed)), text:`${formatSoundTime(state.elapsed)} dinlendi, ${formatSoundTime(state.remaining ?? 0)} kaldı` } : {text:`${formatSoundTime(state.elapsed)} dinlendi, sınırsız`}}>
          <View style={{height:5, backgroundColor:'#fff', width:`${state.duration ? Math.min(100,state.elapsed / state.duration * 100) : 0}%`}} />
        </View>
        <View style={styles.times}><AppText testID="sound.elapsed" style={styles.time}>{formatSoundTime(state.elapsed)}</AppText><AppText testID="sound.remaining" style={styles.time}>{state.remaining === null ? 'Sınırsız' : `${formatSoundTime(Math.ceil(state.remaining))} kaldı`}</AppText></View>
        <View style={styles.controls}>
          <Pressable testID="sound.rewind" accessibilityRole="button" accessibilityLabel="15 saniye geri" disabled={unavailable} onPress={() => void controller.seekBy(-15)} style={[styles.side, unavailable && styles.disabled]}><SvgXml xml={seekIcon(false)} width={24} height={24} /><AppText style={styles.seekNumber}>15</AppText></Pressable>
          <Pressable testID="sound.play" accessibilityRole="button" accessibilityLabel={state.playing ? 'Duraklat' : 'Oynat'} accessibilityState={{disabled:unavailable}} disabled={unavailable} onPress={() => void controller.toggle()} style={({pressed}) => [styles.play, unavailable && styles.disabled, pressed && {opacity:.8}]}><SvgXml xml={state.playing ? pause : play} width={28} height={28} /></Pressable>
          <Pressable testID="sound.forward" accessibilityRole="button" accessibilityLabel="15 saniye ileri" disabled={unavailable} onPress={() => void controller.seekBy(15)} style={[styles.side, unavailable && styles.disabled]}><SvgXml xml={seekIcon(true)} width={24} height={24} /><AppText style={styles.seekNumber}>15</AppText></Pressable>
        </View>
        <AppText testID="sound.status" accessibilityLiveRegion="polite" style={styles.status}>{statusLabel}</AppText>
        <View style={styles.durations}>{soundDurations.map(seconds => <Pressable key={seconds} testID={`sound.duration.${seconds}`} accessibilityRole="button" accessibilityState={{selected:state.duration === seconds, disabled:state.busy}} disabled={state.busy} onPress={() => controller.setDuration(seconds)} style={[styles.duration, state.duration === seconds && {backgroundColor:'#3a4bff'}]}><AppText style={styles.durationText}>{seconds ? `${seconds / 60} dk` : 'Sınırsız'}</AppText></Pressable>)}</View>
        <AppText style={styles.note}>Süre bitince ses durur. Uygulamadan ayrıldığında duraklatılır.</AppText>
        {!!state.message && <AppText testID="sound.message" accessibilityLiveRegion="polite" style={styles.note}>{state.message}</AppText>}
        <Pressable testID={state.phase === 'error' ? 'sound.retry' : 'sound.stop'} accessibilityRole="button" onPress={() => state.phase === 'error' ? controller.open() : controller.stop()} style={{minHeight:44, alignItems:'center', justifyContent:'center'}}><AppText style={{fontSize:14,color:'#aab3ff'}}>{state.phase === 'error' ? 'Yeniden dene' : 'Durdur ve sıfırla'}</AppText></Pressable>
        {qa && <Pressable testID="sound.qa.timer" accessibilityRole="button" accessibilityLabel="QA: 5 saniyelik süre" onPress={() => controller.setQaDuration(5)} style={{minHeight:44,alignItems:'center',justifyContent:'center'}}><AppText style={styles.note}>QA · 5 saniye</AppText></Pressable>}
      </View>
    </ScrollView>
    <Pressable testID="sound.back" accessibilityRole="button" accessibilityLabel="Geri" onPress={back} style={[styles.back, {position:'absolute',top:insets.top + 8,left:20}]}><AppText style={{fontSize:30,lineHeight:34}}>‹</AppText></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#000'}, body:{paddingTop:12},
  back:{minWidth:44,minHeight:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.4)'},
  eyebrow:{fontSize:13,lineHeight:18,fontFamily:'Inter_700Bold',letterSpacing:.8,color:'#aab3ff'},
  title:{fontSize:30,lineHeight:37,fontFamily:'Inter_700Bold',letterSpacing:-.4,marginTop:6,color:'#fff'},
  description:{fontSize:15,lineHeight:22.5,color:'#8e8e93',marginTop:8},
  progress:{height:5,borderRadius:3,backgroundColor:'#252529',overflow:'hidden',marginTop:22},
  times:{flexDirection:'row',justifyContent:'space-between',marginTop:8},time:{fontSize:13,lineHeight:18,color:'#8e8e93',fontVariant:['tabular-nums']},
  controls:{flexDirection:'row',gap:36,alignItems:'center',justifyContent:'center',marginTop:14},
  play:{width:80,height:80,borderRadius:40,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  side:{width:48,height:48,borderRadius:24,backgroundColor:'#141415',alignItems:'center',justifyContent:'center'},
  seekNumber:{position:'absolute',top:23,fontSize:8,lineHeight:12,color:'#fff'},
  status:{textAlign:'center',color:'#8e8e93',fontSize:12,lineHeight:18,marginTop:8},
  durations:{flexDirection:'row',gap:8,marginTop:14},duration:{flex:1,minHeight:44,borderRadius:999,backgroundColor:'#141415',alignItems:'center',justifyContent:'center',paddingVertical:10},durationText:{fontSize:14,lineHeight:20,fontFamily:'Inter_600SemiBold',color:'#fff'},
  note:{fontSize:13,lineHeight:19,color:'#77777e',textAlign:'center',marginTop:12},disabled:{opacity:.4}
});
