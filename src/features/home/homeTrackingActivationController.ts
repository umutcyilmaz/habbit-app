import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import { canEnableMasturbationTracking } from "../../domain/productPolicy/getMasturbationTrackingAvailability";
import type { MasturbationTrackingState } from "../../domain/models/MasturbationTrackingState";
import type { BloomLocalState } from "../../storage/bloomState";

type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
};

export type HomeTrackingActivationSnapshot = {
  busy: boolean;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};

export function createHomeTrackingActivationController(options: Options) {
  let snapshot: HomeTrackingActivationSnapshot = { busy: false, result: null, message: null };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: HomeTrackingActivationSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const observe = (promise: Promise<BloomPersistedMutationResult>): Promise<BloomPersistedMutationResult> => {
    const observed = promise.then((result) => {
      inFlight = null;
      publish({ busy: false, result, message: result.ok ? null : failureMessage(result) });
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Güncel kayıt durumunu kontrol et." });
      throw error;
    });
    inFlight = observed;
    return observed;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    enable: (expectedTracking: MasturbationTrackingState): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      if (snapshot.result?.ok || (snapshot.result !== null && snapshot.result.accepted)) return null;
      const current = options.getState();
      if (current.masturbationTracking !== expectedTracking || expectedTracking.enabled ||
        !canEnableMasturbationTracking(current.resetJourney)) {
        publish({ ...snapshot, message: "Takip şu anda başlatılamıyor. Güncel durumunu kontrol et." });
        return null;
      }
      publish({ busy: true, result: null, message: null });
      try { return observe(options.flowActions.tracking.enable()); }
      catch (error) {
        publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Güncel kayıt durumunu kontrol et." });
        return Promise.reject(error);
      }
    },
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const result = snapshot.result;
      if (result === null || result.ok || !result.retryable || !options.getState().masturbationTracking.enabled) return null;
      publish({ ...snapshot, busy: true, message: null });
      try { return observe(options.retryPersistedMutation(result.retryToken)); }
      catch (error) {
        publish({ ...snapshot, busy: false, message: "Kaydetme tamamlanamadı. Güncel kayıt durumunu kontrol et." });
        return Promise.reject(error);
      }
    }
  };
}

function failureMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Kaydetme henüz doğrulanmadı. Aynı değişikliği yeniden kaydetmeyi dene.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "Kayıt daha yeni bir değişiklikle güncellendi. Güncel durumu kontrol et.";
  if (result.accepted) return result.retryable
    ? "Takip bu oturumda açıldı, ancak kaydedilemedi. Yeniden kaydetmeyi dene."
    : "Takibin kaydedildiği doğrulanamadı. Güncel durumu kontrol et.";
  return "Takip şu anda başlatılamıyor. Güncel durumunu kontrol et.";
}
