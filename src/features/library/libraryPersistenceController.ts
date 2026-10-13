import type { BloomProductAcknowledgedActions } from "../../app/providers/bloomProductAcknowledgedActions";
import type { BloomLocalState } from "../../storage/bloomState";
import type { LibraryStateKind } from "../../storage/bloomLibraryTransitions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";

export type LibrarySaveRequest = { kind: LibraryStateKind; id: string; enabled: boolean };
export function createLibraryPersistenceController(options: {
  actions: BloomProductAcknowledgedActions["library"];
  getState: () => BloomLocalState;
  getDurableState: () => BloomLocalState;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  confirmCurrentPersistence: () => Promise<BloomPersistedMutationResult>;
}) {
  let snapshot: {busy:boolean;request:LibrarySaveRequest|null;result:BloomPersistedMutationResult|null;message:string|null} = {busy:false,request:null,result:null,message:null};
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<()=>void>();
  const publish = (next:typeof snapshot) => { snapshot=next; listeners.forEach(listener=>listener()); };
  const observe = (command:()=>Promise<BloomPersistedMutationResult>) => {
    publish({...snapshot,busy:true,message:null});
    inFlight=Promise.resolve().then(command).then(result=>{
      inFlight=null;
      publish({...snapshot,busy:false,result,message:result.ok ? null : "Bu cihaza kaydetme doğrulanmadı. Yeniden dene."});
      return result;
    }, error=>{
      inFlight=null; publish({...snapshot,busy:false,result:null,message:"Kayıt kontrolü tamamlanamadı. Güncel kaydı doğrula."});
      throw error;
    });
    return inFlight;
  };
  return {
    subscribe: (listener:()=>void) => {listeners.add(listener);return ()=>{listeners.delete(listener);};},
    getSnapshot: ()=>snapshot,
    set: (request:LibrarySaveRequest) => {
      if(snapshot.busy) return null;
      if(options.getState()!==options.getDurableState() || (snapshot.result && !snapshot.result.ok && snapshot.result.retryable)) return null;
      publish({busy:false,request,result:null,message:null});
      return observe(()=>options.actions.setArticleState(request.kind,request.id,request.enabled));
    },
    retry: () => {
      if(snapshot.busy) return inFlight;
      const result=snapshot.result;
      if(!result || result.ok || !result.retryable) return null;
      // Retry the acknowledged write, never replay a toggle against accepted state.
      return observe(()=>options.retryPersistedMutation(result.retryToken));
    },
    confirm: () => snapshot.busy ? inFlight : observe(options.confirmCurrentPersistence)
  };
}
