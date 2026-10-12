import type { BloomProductAcknowledgedActions } from "../../app/providers/bloomProductAcknowledgedActions";
import type { BloomLocalState } from "../../storage/bloomState";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { CompletedKegelSession } from "../../domain/models/KegelState";

export type KegelSaveOperation = {
  busy: boolean;
  operation: "onboarding" | "session" | "confirm" | null;
  sessionId: string | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};

export function createKegelPersistenceController(options: {
  actions: BloomProductAcknowledgedActions["kegel"];
  getState: () => BloomLocalState;
  getDurableState: () => BloomLocalState;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  confirmCurrentPersistence: () => Promise<BloomPersistedMutationResult>;
}) {
  let snapshot: KegelSaveOperation = {busy:false,operation:null,sessionId:null,result:null,message:null};
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<()=>void>();
  const publish = (next: KegelSaveOperation) => {snapshot=next;listeners.forEach(fn=>fn());};
  const observe = (command:()=>Promise<BloomPersistedMutationResult>) => {
    publish({...snapshot,busy:true,message:null});
    // Publish busy before invoking the existing acknowledged action. A second
    // synchronous callback cannot create another operation or session identity.
    const promise = Promise.resolve().then(command).then(result => {
      inFlight=null;
      publish({...snapshot,busy:false,result,message:result.ok ? null : result.accepted
        ? snapshot.operation==="onboarding" ? "Tanıtımın bu cihaza kaydedildiği doğrulanmadı. Aynı kaydı yeniden dene." : "Setin tamamlandı, ancak bu cihaza kaydedildiği doğrulanmadı. Aynı kaydı yeniden dene."
        : "Kayıt kabul edilmedi. Yerel veriyi kontrol edip aynı isteği yeniden dene."});
      return result;
    }, error => {
      inFlight=null;publish({...snapshot,busy:false,message:"Kayıt kontrolü tamamlanamadı. Güncel durumun kaydını doğrula."});
      throw error;
    });
    inFlight=promise;
    return promise;
  };
  const run = (operation:"onboarding"|"session", sessionId:string|null, command:()=>Promise<BloomPersistedMutationResult>) => {
    if(snapshot.busy) return snapshot.operation===operation && snapshot.sessionId===sessionId ? inFlight : null;
    if(snapshot.operation===operation && snapshot.sessionId===sessionId && snapshot.result?.ok) {
      const durable=options.getDurableState();
      const stillSaved=operation==="onboarding" ? durable.kegel.onboardingCompletedAt!==null : durable.kegel.sessions.some(s=>s.id===sessionId);
      // A cached receipt cannot resurrect or acknowledge a record invalidated
      // by a later deletion/hydration lifecycle.
      return options.getState()===durable && stillSaved ? Promise.resolve(snapshot.result) : null;
    }
    if(snapshot.result && !snapshot.result.ok && snapshot.result.accepted) return null;
    if(options.getState()!==options.getDurableState()) return null;
    publish({busy:false,operation,sessionId,result:null,message:null});
    return observe(command);
  };
  return {
    subscribe: (listener:()=>void) => {listeners.add(listener);return ()=>{listeners.delete(listener);};},
    getSnapshot: ()=>snapshot,
    completeOnboarding: (completedAt:string) => run("onboarding",null,()=>options.actions.completeOnboarding(completedAt)),
    saveSession: (session:CompletedKegelSession) => run("session",session.id,()=>options.actions.saveCompletedSession(session)),
    retry: () => {
      if(snapshot.busy) return inFlight;
      const result=snapshot.result;
      if(!result || result.ok || !result.retryable) return null;
      return observe(()=>options.retryPersistedMutation(result.retryToken));
    },
    confirmCurrentSave: () => snapshot.busy ? inFlight : observe(options.confirmCurrentPersistence)
  };
}
