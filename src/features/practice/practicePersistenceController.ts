import type { BloomProductAcknowledgedActions } from "../../app/providers/bloomProductAcknowledgedActions";
import type { BloomLocalState } from "../../storage/bloomState";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import { PRACTICE_INTRO_VERSION, type CompletedPracticeSession, type PracticeIntroduction } from "../../domain/models/PracticeState";
import { normalizeCompletedPracticeSession, practicePayloadEqual } from "../../storage/bloomPracticeSchema";
import { getPracticeAvailability } from "../../domain/productPolicy/getPracticeAvailability";

type Operation = { busy:boolean; kind:"introduction"|"session"|null; result:BloomPersistedMutationResult|null; message:string|null; locked:boolean };
export function createPracticePersistenceController(options:{
  actions:BloomProductAcknowledgedActions["practice"];getState:()=>BloomLocalState;getDurableState:()=>BloomLocalState;isReady:()=>boolean;
  retryPersistedMutation:(token:BloomPersistenceRetryToken)=>Promise<BloomPersistedMutationResult>;
  confirmCurrentPersistence:()=>Promise<BloomPersistedMutationResult>;
}) {
  let snapshot:Operation={busy:false,kind:null,result:null,message:null,locked:false};
  let pending:Promise<BloomPersistedMutationResult>|null=null;
  let record:CompletedPracticeSession|null=null, intro:PracticeIntroduction|null=null;
  const listeners=new Set<()=>void>();
  const publish=(patch:Partial<Operation>)=>{snapshot={...snapshot,...patch};listeners.forEach(f=>f());};
  const confirmed=()=>options.isReady()&&options.getState()===options.getDurableState();
  const saved=()=>{if(!record||!confirmed()||!snapshot.result?.ok)return false;const s=options.getDurableState().practice.sessions.find(s=>s.id===record!.id);return !!s&&practicePayloadEqual(s,record);};
  const observe=(command:()=>Promise<BloomPersistedMutationResult>)=>{
    publish({busy:true,message:null});
    pending=Promise.resolve().then(command).then(result=>{
      pending=null;publish({busy:false,result,locked:result.accepted,message:result.ok?null:result.accepted?"Kaydın bu cihaza yazıldığı doğrulanmadı. Aynı kaydı yeniden dene.":"Kayıt kabul edilmedi. Güncel durumu kontrol edip aynı isteği yeniden dene."});return result;
    },error=>{pending=null;publish({busy:false,locked:true,message:"Kayıt kontrolü tamamlanamadı. Güncel kaydı doğrula."});throw error;});return pending;
  };
  const allowed=()=>getPracticeAvailability(options.getDurableState(),options.isReady(),options.getState()).canStart;
  return {
    subscribe:(f:()=>void)=>{listeners.add(f);return ()=>{listeners.delete(f);};},getSnapshot:()=>snapshot,getRecord:()=>record,isSaved:saved,
    acknowledgeIntroduction:(input:PracticeIntroduction)=>{
      // One controller owns one introduction/run. Deletion or rehydration
      // cannot replay an older acknowledged preference into a fresh lifecycle.
      if(record!==null || intro!==null && snapshot.result?.ok && options.getDurableState().practice.introduction?.version!==PRACTICE_INTRO_VERSION) {
        publish({message:"Önceki tanıtım onayı artık geçerli değil. Bu ekrandan çıkıp pratiği yeniden aç."});return null;
      }
      if(snapshot.busy)return snapshot.kind==="introduction"?pending:null;
      if(!allowed()||snapshot.locked&&!snapshot.result?.ok)return null;
      if(options.getDurableState().practice.introduction?.version===PRACTICE_INTRO_VERSION)return null;
      intro??=Object.freeze({...input});publish({kind:"introduction",result:null});return observe(()=>options.actions.acknowledgeIntroduction(intro!));
    },
    save:(input:CompletedPracticeSession)=>{
      if(snapshot.busy)return snapshot.kind==="session"?pending:null;
      if(record&&record.id!==input.id)return null;
      if(saved())return Promise.resolve(snapshot.result!);
      // Accepted identities can only be retried with their runtime token. A
      // superseded/invalidated operation must reconcile current truth first.
      if(snapshot.kind==="session"&&snapshot.locked)return null;
      if(!allowed())return null;
      record??=freezePracticeRecord(input);publish({kind:"session",result:null});return observe(()=>options.actions.saveCompletedSession(record!));
    },
    retry:()=>{if(snapshot.busy)return pending;const r=snapshot.result;return r&&!r.ok&&r.retryable?observe(()=>options.retryPersistedMutation(r.retryToken)):null;},
    confirm:()=>snapshot.busy?pending:observe(options.confirmCurrentPersistence)
  };
}
export function freezePracticeRecord(input:CompletedPracticeSession):CompletedPracticeSession {
  const value=normalizeCompletedPracticeSession(input);
  value.pauses.forEach(Object.freeze);value.arousalReports.forEach(Object.freeze);
  Object.freeze(value.pauses);Object.freeze(value.arousalReports);Object.freeze(value.feelings);Object.freeze(value.timezone);
  return Object.freeze(value);
}
