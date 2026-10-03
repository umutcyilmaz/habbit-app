import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { ResetJourney } from "../../domain/models/ResetJourney";
import type { ISODateString } from "../../domain/models/shared";
import type { BloomLocalState } from "../../storage/bloomState";
import { getResetRecommendationView, sameResetRecommendationFacts, type ResetRecommendationFacts } from "./resetRecommendationView";

export type AcceptedResetRecommendation = Extract<ResetJourney, { status: "baseline_pending" }>;
export type ResetRecommendationOperationSnapshot = {
  busy: boolean;
  acceptedReset: AcceptedResetRecommendation | null;
  acceptedFacts: ResetRecommendationFacts | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};
type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  getDisplayTime: () => ISODateString;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  onPersisted?: (accepted: AcceptedResetRecommendation) => void;
};
const unavailable = "Bu öneri artık kullanılamıyor. Güncel kayıtlarını kontrol etmek için Bugüne dön.";

export function createResetRecommendationController(options: Options) {
  let snapshot: ResetRecommendationOperationSnapshot = { busy: false, acceptedReset: null, acceptedFacts: null, result: null, message: null };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: ResetRecommendationOperationSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };
  function observe(promise: Promise<BloomPersistedMutationResult>, acceptedReset: AcceptedResetRecommendation | null,
    acceptedFacts: ResetRecommendationFacts | null) {
    const observed = promise.then((result) => {
      inFlight = null;
      publish({ busy: false, acceptedReset, acceptedFacts, result, message: result.ok ? acceptedReset === null ? unavailable : null : persistenceMessage(result) });
      if (result.ok && acceptedReset !== null && acceptedFacts !== null && sameResetRecommendationFacts(options.getState(), acceptedFacts)) options.onPersisted?.(acceptedReset);
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Güncel kaydın durumunu kontrol etmek için bu ekranı yeniden aç." });
      throw error;
    });
    inFlight = observed;
    return observed;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    accept: (expected: ResetRecommendationFacts): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      if (snapshot.acceptedReset !== null || snapshot.result !== null && !snapshot.result.ok && snapshot.result.accepted) return null;
      const current = options.getState();
      if (!sameResetRecommendationFacts(current, expected) || getResetRecommendationView(current, options.getDisplayTime()).kind === "unavailable") {
        publish({ ...snapshot, message: unavailable });
        return null;
      }
      publish({ busy: true, acceptedReset: null, acceptedFacts: null, result: null, message: null });
      try {
        const pending = options.flowActions.reset.acceptRecommendation();
        const acceptedState = options.getState();
        const successor = acceptedState.resetJourney;
        const acceptedReset = successor !== current.resetJourney && successor.status === "baseline_pending" ? successor : null;
        const acceptedFacts = acceptedReset === null ? null : acceptedState;
        publish({ ...snapshot, acceptedReset, acceptedFacts });
        return observe(pending, acceptedReset, acceptedFacts);
      } catch (error) {
        publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Güncel durumu kontrol ederek tekrar dene." });
        return Promise.reject(error);
      }
    },
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, acceptedReset, acceptedFacts } = snapshot;
      if (result === null || result.ok || !result.retryable || acceptedReset === null || options.getState().resetJourney !== acceptedReset) return null;
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), acceptedReset, acceptedFacts);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Kaydetme henüz doğrulanmadı. Aynı kaydı yeniden kaydetmeyi dene.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "Kayıt daha yeni bir değişiklikle güncellendi. Güncel durumu kontrol et.";
  if (result.accepted) return result.retryable
    ? "Reset hazırlığın burada tutuluyor, ancak kaydedilemedi. Devam etmeden önce yeniden kaydetmeyi dene."
    : "Reset hazırlığın kabul edildi, ancak kaydetme doğrulanamadı. Güncel kaydı kontrol et.";
  return unavailable;
}
