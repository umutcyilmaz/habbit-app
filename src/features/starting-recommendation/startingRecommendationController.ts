import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { BloomLocalState } from "../../storage/bloomState";
import { getStartingRecommendationView, sameStartingRecommendationFacts, type StartingRecommendationFacts, type AcceptedStartingRecommendation } from "./startingRecommendationView";

export type StartingRecommendationOperationSnapshot = {
  busy: boolean;
  acceptedFacts: AcceptedStartingRecommendation | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};
type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  onPersisted?: (accepted: AcceptedStartingRecommendation) => void;
};
const unavailable = "Bu öneri artık kullanılamıyor. Güncel kayıtlarını kontrol etmek için Bugüne dön.";

export function createStartingRecommendationController(options: Options) {
  let snapshot: StartingRecommendationOperationSnapshot = { busy: false, acceptedFacts: null, result: null, message: null };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: StartingRecommendationOperationSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };
  function observe(promise: Promise<BloomPersistedMutationResult>, acceptedFacts: AcceptedStartingRecommendation | null) {
    const observed = promise.then((result) => {
      inFlight = null;
      publish({ busy: false, acceptedFacts, result, message: result.ok ? acceptedFacts === null ? unavailable : null : persistenceMessage(result) });
      if (result.ok && acceptedFacts !== null && sameStartingRecommendationFacts(options.getState(), acceptedFacts)) options.onPersisted?.(acceptedFacts);
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
    accept: (expected: StartingRecommendationFacts): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      if (snapshot.acceptedFacts !== null || snapshot.result !== null && !snapshot.result.ok && snapshot.result.accepted) return null;
      const current = options.getState();
      if (!sameStartingRecommendationFacts(current, expected) || getStartingRecommendationView(current).kind === "unavailable") {
        publish({ ...snapshot, message: unavailable });
        return null;
      }
      publish({ busy: true, acceptedFacts: null, result: null, message: null });
      try {
        const pending = options.flowActions.onboarding.acceptRecommendation();
        const acceptedState = options.getState();
        const successor = acceptedState.productOnboarding;
        const acceptedFacts = successor !== current.productOnboarding && successor.status === "completed" && successor.planAcceptance !== null
          ? acceptedState as AcceptedStartingRecommendation : null;
        publish({ ...snapshot, acceptedFacts });
        return observe(pending, acceptedFacts);
      } catch (error) {
        publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Güncel durumu kontrol ederek tekrar dene." });
        return Promise.reject(error);
      }
    },
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, acceptedFacts } = snapshot;
      if (result === null || result.ok || !result.retryable || acceptedFacts === null || !sameStartingRecommendationFacts(options.getState(), acceptedFacts)) return null;
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), acceptedFacts);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Kaydetme henüz doğrulanmadı. Aynı kaydı yeniden kaydetmeyi dene.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "Kayıt daha yeni bir değişiklikle güncellendi. Güncel durumu kontrol et.";
  if (result.accepted) return result.retryable
    ? "Başlangıç planın burada tutuluyor, ancak kaydedilemedi. Devam etmeden önce yeniden kaydetmeyi dene."
    : "Başlangıç planın kabul edildi, ancak kaydetme doğrulanamadı. Güncel kaydı kontrol et.";
  return unavailable;
}
