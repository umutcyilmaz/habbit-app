import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { AppState, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { PRACTICE_INTRO_VERSION, type CompletedPracticeSession } from "../../domain/models/PracticeState";
import { PracticeText } from "./PracticeText";
import { getBloomPersistenceRecovery } from "../../shared/navigation/bloomPersistenceRecovery";
import { PracticePreviewScreen } from "./PracticePreviewScreen";
import { PracticeButton } from "./PracticeButton";
import { createPracticePersistenceController } from "./practicePersistenceController";
import type { PracticeSnapshot } from "./practiceSession";

export function PracticeFeatureScreen() {
  const bloom=useBloomLocalState(),router=useRouter(),insets=useSafeAreaInsets();
  const [notice,setNotice]=useState<string|null>(null);
  const mounted=useRef(true),startBusy=useRef(false),startEpoch=useRef(0);
  const [started,setStarted]=useState(false),[captured,setCaptured]=useState(false);
  const run=useRef<{startedAt:string;reports:CompletedPracticeSession["arousalReports"]}|null>(null);
  const payload=useRef<CompletedPracticeSession|null>(null);
  const controller=useMemo(()=>createPracticePersistenceController({actions:bloom.productActions.practice,getState:bloom.getAcceptedState,getDurableState:bloom.getDurableState,isReady:()=>bloom.getPracticeAvailability().reason!=="unavailable",
    retryPersistedMutation:bloom.retryPersistedMutation,confirmCurrentPersistence:bloom.confirmCurrentPersistence}),[bloom.productActions,bloom.getAcceptedState,bloom.getDurableState,bloom.retryPersistedMutation,bloom.confirmCurrentPersistence,bloom.getPracticeAvailability]);
  const operation=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const recovery=getBloomPersistenceRecovery(operation,bloom.state,bloom.durableState);
  const availability=bloom.getPracticeAvailability();
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;startEpoch.current++;};},[]);
  const permitted=()=>mounted.current&&!controller.getSnapshot().busy&&bloom.getPracticeAvailability().canStart;
  const invoke=(promise:ReturnType<typeof controller.retry>)=>{if(promise)void promise.catch(()=>{});};
  const start=async(startSession:()=>boolean)=>{
    if(startBusy.current||run.current||AppState.currentState!=="active"||!permitted())return false;
    startBusy.current=true;const epoch=++startEpoch.current;
    try {
      if(bloom.getDurableState().practice.introduction?.version!==PRACTICE_INTRO_VERSION) {
        const promise=controller.acknowledgeIntroduction({version:PRACTICE_INTRO_VERSION,acknowledgedAt:bloom.now().toISOString()});
        if(!promise||!(await promise).ok)return false;
      }
      if(AppState.currentState!=="active"||!mounted.current||epoch!==startEpoch.current||!permitted()||bloom.getDurableState().practice.introduction?.version!==PRACTICE_INTRO_VERSION)return false;
      // Commit the temporary runtime in this same JS turn, after the durable
      // acknowledgement and current guards. Never reserve a run before the
      // preview has actually started; a backgrounded attempt remains retryable.
      const startedAt=bloom.now().toISOString();
      if(!startSession())return false;
      run.current={startedAt,reports:[]};setStarted(true);return true;
    } finally {startBusy.current=false;}
  };
  const save=(snapshot:PracticeSnapshot)=>{
    if(!mounted.current||!run.current||snapshot.phase!=="summary"||snapshot.confirmingExit||!permitted())return;
    if(!payload.current) {
      const date=bloom.now(),pauseMs=snapshot.pauses.reduce((sum,p)=>sum+p.durationMs,0);
      payload.current={id:`practice-${date.getTime()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,version:1,source:"guided_practice",startedAt:run.current.startedAt,completedAt:date.toISOString(),timezone:{name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",utcOffsetMinutes:date.getTimezoneOffset()},foregroundExerciseMs:snapshot.elapsedMs,activeMs:snapshot.elapsedMs-pauseMs,intentionalPauseMs:pauseMs,pauses:snapshot.pauses.map(p=>({startMs:p.atMs,endMs:p.atMs+p.durationMs})),arousalReports:[...run.current.reports],erectionQuality:snapshot.quality,explicitContent:snapshot.content,ending:snapshot.ending,feelings:[...snapshot.feelings]};setCaptured(true);
    }
    try {invoke(controller.save(payload.current));} catch {setNotice("Bu pratiğin kayıt bilgileri doğrulanamadı. Kayıt oluşturulmadı; geçici özeti inceleyip çıkabilirsin.");}
  };
  const leave=()=>{if(!mounted.current||bloom.getPracticeAvailability().reason==="unavailable"||controller.getSnapshot().busy||bloom.getAcceptedState()!==bloom.getDurableState()||getBloomPersistenceRecovery(controller.getSnapshot(),bloom.getAcceptedState(),bloom.getDurableState()).navigationBlocked)return;router.replace(controller.isSaved()?"/bloom/practice/history":"/today");};
  const policyNotice=started&&!availability.canStart&&availability.reason!=="unavailable"&&!controller.isSaved()?"Reset tamamlanana kadar bu geçici pratik kaydedilemez. Önceki kayıtların korunur.":null;
  const status=(notice||policyNotice||operation.busy||operation.message||recovery.navigationBlocked||operation.locked&&!controller.isSaved()&&operation.kind==="session" )?<View testID="practice.save.status" style={{gap:8,paddingVertical:8}}>
    <PracticeText accessibilityLiveRegion="polite" style={{fontSize:14,lineHeight:20,color:"#aab3ff"}}>{operation.busy?"Kaydediliyor…":notice??policyNotice??operation.message??recovery.recoveryGuidance??"Bu pratiğin kaydı güncel kalıcı veride doğrulanamadı. Geçmişte yalnız doğrulanmış kayıtlar görünür."}</PracticeText>
    {!operation.busy&&operation.result&&!operation.result.ok&&operation.result.retryable?<PracticeButton testID="practice.save.retry" label="Aynı kaydı yeniden dene" onPress={()=>invoke(controller.retry())}/>:!operation.busy&&(recovery.canConfirmCurrentSave||operation.locked&&!controller.isSaved()&&!operation.result?.ok)?<PracticeButton testID="practice.save.confirm" label="Güncel kaydı doğrula" onPress={()=>invoke(controller.confirm())}/>:null}
  </View>:null;
  if(!started&&!availability.canStart&&operation.kind!=="introduction") return <View testID="practice.blocked" style={{flex:1,backgroundColor:"#000",paddingTop:insets.top,paddingHorizontal:20,paddingBottom:insets.bottom+20}}><ScrollView contentContainerStyle={{gap:16,paddingVertical:24}}><PracticeText textRole="display" variant="display">{availability.reason==="unavailable"?"Kayıtlar kontrol ediliyor":"Pratik duraklatıldı"}</PracticeText><PracticeText>{availability.reason==="unavailable"?"Kalıcı durum doğrulanana kadar yeni pratik başlatılamaz.":"Reset tamamlanıp gerekli kararlar kaydedilene kadar yeni pratik başlatılamaz. Önceki kayıtlarını görüntüleyebilirsin."}</PracticeText>{status}<PracticeButton testID="practice.blocked.history" label="Pratik geçmişi" disabled={recovery.navigationBlocked} onPress={()=>router.replace("/bloom/practice/history")}/><PracticeButton testID="practice.blocked.exit" label="Ana sayfaya dön" secondary disabled={recovery.navigationBlocked} onPress={leave}/></ScrollView></View>;
  return <PracticePreviewScreen production={{isNavigationBlockedNow:()=>bloom.getPracticeAvailability().reason==="unavailable"||getBloomPersistenceRecovery(controller.getSnapshot(),bloom.getAcceptedState(),bloom.getDurableState()).navigationBlocked,isSavedNow:controller.isSaved,isCapturedNow:()=>payload.current!==null,introduced:bloom.durableState.practice.introduction?.version===PRACTICE_INTRO_VERSION,busy:operation.busy,navigationBlocked:recovery.navigationBlocked,captured,saveDisabled:!availability.canStart,saved:controller.isSaved(),onStart:start,onSave:save,onReport:(atMs,level)=>{if(run.current)run.current.reports=[...run.current.reports,{atMs,level,reportedAt:bloom.now().toISOString()}];},onLeave:leave,recovery:status}}/>;
}
