import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import type { CompletedKegelSession, KegelProgramSnapshot, KegelSessionMetrics } from "../../../domain/models/KegelState";
import { AppText } from "../../../shared/components/v4/AppText";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { getBloomPersistenceRecovery } from "../../../shared/navigation/bloomPersistenceRecovery";
import { BloomBottomNavigation } from "../../../shared/navigation/BloomBottomNavigation";
import { kegelConfig } from "../kegelConfig";
import { createKegelPersistenceController } from "../kegelPersistenceController";
import { failNextKegelQaSave, kegelPersistenceQaEnabled } from "../kegelPersistenceQa";
import { deriveKegelSummary, kegelLocalDate } from "../kegelSummary";
import { getKegelSetName } from "../kegelSession";
import { kegelColors as c } from "../kegelTheme";
import { KegelButton } from "../components/KegelUI";
import { KegelHomeScreen } from "./KegelHomeScreen";
import { KegelIntroScreen } from "./KegelIntroScreen";
import { KegelExerciseScreen } from "./KegelExerciseScreen";
import { KegelCompletionScreen } from "./KegelCompletionScreen";

type Run = {id:string;startedAt:string;program:KegelProgramSnapshot;setName:string};
export function KegelFeatureScreen({qa=false,showBottomNavigation=false}:{qa?:boolean;showBottomNavigation?:boolean}) {
  const router=useRouter();
  const bloom=useBloomLocalState();
  const [stage,setStage]=useState<"home"|"intro"|"exercise"|"completed">("home");
  const [run,setRun]=useState<Run|null>(null);
  const [record,setRecord]=useState<CompletedKegelSession|null>(null);
  const capturedRecord=useRef<CompletedKegelSession|null>(null);
  const startAfterIntro=useRef(false);
  const [clock,setClock]=useState(()=>bloom.now());
  const mounted=useRef(true);
  const controller=useMemo(()=>createKegelPersistenceController({actions:bloom.productActions.kegel,
    getState:bloom.getAcceptedState,getDurableState:bloom.getDurableState,
    retryPersistedMutation:bloom.retryPersistedMutation,confirmCurrentPersistence:bloom.confirmCurrentPersistence}),
    [bloom.productActions,bloom.getAcceptedState,bloom.getDurableState,bloom.retryPersistedMutation,bloom.confirmCurrentPersistence]);
  const operation=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const recovery=getBloomPersistenceRecovery(operation,bloom.state,bloom.durableState);
  const obsoleteAccepted=operation.result!==null && !operation.result.ok && operation.result.accepted && !operation.result.retryable;
  const allowNavigation=usePersistenceNavigationGuard(recovery.navigationBlocked);
  const summary=deriveKegelSummary(bloom.durableState.kegel,clock);
  const introduced=bloom.durableState.kegel.onboardingCompletedAt!==null;
  const saved=!!record && operation.result?.ok===true && bloom.durableState.kegel.sessions.some(s=>s.id===record.id);
  const invoke=(pending:ReturnType<typeof controller.retry>)=>{if(pending) void pending.catch(()=>{});};
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  useEffect(()=>{const timer=setInterval(()=>setClock(bloom.now()),1000);return ()=>clearInterval(timer);},[bloom.now]);
  const start=()=>{
    const currentOperation=controller.getSnapshot();
    if(!mounted.current || currentOperation.busy || currentOperation.result && !currentOperation.result.ok && currentOperation.result.accepted || bloom.getAcceptedState()!==bloom.getDurableState() || recovery.navigationBlocked || !bloom.hasHydrated) return;
    startAfterIntro.current=false;
    const date=bloom.now();
    const program:KegelProgramSnapshot={configurationId:kegelConfig.configurationId,provisional:true,
      repetitions:kegelConfig.repetitions,contractionSeconds:kegelConfig.contractionSeconds,
      relaxationSeconds:kegelConfig.relaxationSeconds,countdownSeconds:kegelConfig.countdownSeconds,dailyTarget:kegelConfig.dailyTarget};
    const id=`kegel-${date.getTime()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    setRun({id,startedAt:date.toISOString(),program,setName:getKegelSetName(summary.done)});
    capturedRecord.current=null;setRecord(null);setStage("exercise");
  };
  useEffect(()=>{
    // Consume only the explicit finish intent, after the existing durable guard
    // opens. Re-rendered receipts or revisiting technique cannot start a set.
    if(stage==="intro" && startAfterIntro.current && operation.operation==="onboarding" && operation.result?.ok && introduced) start();
  },[stage,operation,introduced,start]);
  const finish=(metrics:KegelSessionMetrics)=>{
    if(!mounted.current || !run) return;
    let completed=capturedRecord.current;
    if(completed===null) {
      const now=bloom.now();
      completed={id:run.id,status:"completed",startedAt:run.startedAt,completedAt:now.toISOString(),
        completionDate:kegelLocalDate(now),completionUtcOffsetMinutes:now.getTimezoneOffset(),program:run.program,
        completedRepetitions:run.program.repetitions,metrics};
      capturedRecord.current=completed;setRecord(completed);setStage("completed");
    }
    invoke(controller.saveSession(completed));
  };
  const finishIntro=()=>{
    if(introduced){start();return;}
    startAfterIntro.current=true;
    invoke(controller.completeOnboarding(bloom.now().toISOString()));
  };
  const close=()=>{if(controller.getSnapshot().busy || bloom.getAcceptedState()!==bloom.getDurableState() || recovery.navigationBlocked) return;allowNavigation();router.canGoBack() ? router.back() : router.replace("/");};
  if(!bloom.hasHydrated) return <View style={{flex:1,backgroundColor:c.canvas,padding:24}}><AppText>Yerel kayıtlar kontrol ediliyor.</AppText></View>;
  return <View testID="kegel.persisted-feature" style={{flex:1,backgroundColor:c.canvas}}><StatusBar style="light" />
    {stage==="home" && <KegelHomeScreen introduced={introduced} data={summary} onIntro={()=>setStage("intro")} onStart={start} onMenu={close} />}
    {stage==="intro" && <KegelIntroScreen onClose={()=>{if(!recovery.navigationBlocked){startAfterIntro.current=false;setStage("home");}}} onFinish={finishIntro} finishBusy={operation.busy} />}
    {stage==="exercise" && run && <KegelExerciseScreen key={run.id} workout={run.program} setName={run.setName} onComplete={finish}
      onExit={()=>{capturedRecord.current=null;setRun(null);setStage("home");}} />}
    {stage==="completed" && record && <KegelCompletionScreen fromRun session={record} saveStatus={saved ? "saved" : operation.busy ? "saving" : "failed"} allowDismiss={!recovery.navigationBlocked && !saved}
      onDone={()=>{if(!recovery.navigationBlocked){if(!saved)setRecord(null);setClock(bloom.now());setStage("home");}}} />}
    {(operation.busy || operation.message || recovery.navigationBlocked) && <View testID="kegel.save-status" style={{padding:16,gap:8,backgroundColor:c.card}}>
      <AppText accessibilityLiveRegion="polite">{operation.busy ? "Kaydediliyor…" : operation.message ?? recovery.recoveryGuidance}</AppText>
      {!operation.busy && operation.result && !operation.result.ok && operation.result.retryable && <KegelButton testID="kegel.save.retry" label="Aynı kaydı yeniden kaydet" onPress={()=>invoke(controller.retry())} />}
      {!operation.busy && !recovery.navigationBlocked && operation.message && (!operation.result || !operation.result.ok && !operation.result.accepted) && <KegelButton testID="kegel.save.retry-rejected" label="Aynı isteği yeniden dene"
        onPress={()=>record ? invoke(controller.saveSession(record)) : finishIntro()} />}
      {(recovery.canConfirmCurrentSave || obsoleteAccepted && !operation.busy) && <KegelButton testID="kegel.save.confirm" label="Güncel kaydı doğrula" onPress={()=>invoke(controller.confirmCurrentSave())} />}
    </View>}
    {qa && kegelPersistenceQaEnabled && stage==="home" && <View style={{padding:8,gap:4}}>
      <AppText testID="kegel.qa.count">Kalıcı seans: {bloom.durableState.kegel.sessions.length}</AppText>
      <View style={{flexDirection:"row",gap:6}}><KegelButton testID="kegel.qa.fail" label="QA: sonraki kayıt hata" secondary onPress={failNextKegelQaSave} style={{flex:1,minHeight:40}} />
        {record && <KegelButton testID="kegel.qa.duplicate" label="QA: aynı tamamlanma" secondary onPress={()=>invoke(controller.saveSession(record))} style={{flex:1,minHeight:40}} />}</View>
    </View>}
    {showBottomNavigation && stage==="home" && <BloomBottomNavigation active="kegel" blocked={recovery.navigationBlocked} onSelect={tab=>{
      const currentOperation=controller.getSnapshot();
      if(tab.name==="kegel" || currentOperation.busy || bloom.getAcceptedState()!==bloom.getDurableState() || recovery.navigationBlocked) return;
      router.dismissTo(tab.href);
    }} />}
  </View>;
}
