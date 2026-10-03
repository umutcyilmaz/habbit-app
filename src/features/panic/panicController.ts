import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { BehaviorSlipReason } from "../../domain/models/BehaviorSlip";
import type { ISODateString } from "../../domain/models/shared";
import type { BloomLocalState } from "../../storage/bloomState";
import { getPanicView, samePanicFacts, type PanicFacts } from "./panicView";

export type PanicOperation = "startUrge" | "recordSlip";
export type PanicOperationSnapshot = {
  busy: boolean;
  operation: PanicOperation | null;
  reason: BehaviorSlipReason | null;
  acceptedState: BloomLocalState | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};
type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  getDisplayTime: () => ISODateString;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  onPersisted?: (operation: PanicOperation, acceptedState: BloomLocalState) => void;
};
const unavailable = "Bu işlem artık gösterilen kayıtlar için kullanılamıyor. Güncel durumu kontrol ederek tekrar dene.";

export function createPanicController(options: Options) {
  let snapshot: PanicOperationSnapshot = {
    busy: false, operation: null, reason: null, acceptedState: null, result: null, message: null
  };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: PanicOperationSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };
  function observe(promise: Promise<BloomPersistedMutationResult>, operation: PanicOperation,
    reason: BehaviorSlipReason | null, acceptedState: BloomLocalState | null) {
    const observed = promise.then((result) => {
      inFlight = null;
      publish({ busy: false, operation, reason, acceptedState, result, message: result.ok ? null : persistenceMessage(result) });
      if (result.ok && acceptedState !== null && samePanicFacts(options.getState(), acceptedState)) {
        options.onPersisted?.(operation, acceptedState);
      }
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Kaydın durumunu kontrol etmek için bu ekranı yeniden aç." });
      throw error;
    });
    inFlight = observed;
    return observed;
  }
  function run(operation: PanicOperation, reason: BehaviorSlipReason | null, expected: PanicFacts) {
    if (snapshot.busy) return snapshot.operation === operation && snapshot.reason === reason ? inFlight : null;
    if (snapshot.acceptedState !== null || (snapshot.result !== null && !snapshot.result.ok && snapshot.result.accepted)) return null;
    const current = options.getState();
    const view = getPanicView(current, reason, options.getDisplayTime());
    if (!samePanicFacts(current, expected) || view.kind !== "choices" ||
      (operation === "recordSlip" && (!view.canConfirmSlip || reason === null))) {
      publish({ ...snapshot, message: unavailable });
      return null;
    }
    publish({ busy: true, operation, reason, acceptedState: null, result: null, message: null });
    try {
      const pending = operation === "startUrge"
        ? options.flowActions.urgeControl.start()
        : options.flowActions.behaviorSlip.record(reason!);
      const successor = options.getState();
      const acceptedState = samePanicFacts(successor, current) ? null : successor;
      publish({ ...snapshot, acceptedState });
      return observe(pending, operation, reason, acceptedState);
    } catch (error) {
      publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Güncel durumu kontrol ederek tekrar dene." });
      return Promise.reject(error);
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    startUrge: (expected: PanicFacts) => run("startUrge", null, expected),
    recordSlip: (reason: BehaviorSlipReason, expected: PanicFacts) => run("recordSlip", reason, expected),
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, operation, reason, acceptedState } = snapshot;
      if (result === null || result.ok || !result.retryable || operation === null) return null;
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), operation, reason, acceptedState);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Kaydetme henüz doğrulanmadı. Aynı kaydı yeniden kaydetmeyi dene.";
  if (result.reason === "persistenceSuperseded" || result.reason === "persistenceInvalidated") return "Bu işlem daha yeni bir değişiklikle geçersiz oldu. Güncel durumu görmek için ekranı yeniden aç.";
  if (result.accepted) return result.retryable
    ? "Değişikliğin burada tutuluyor, ancak kaydedilemedi. Devam etmeden önce yeniden kaydetmeyi dene."
    : "Değişiklik kabul edildi, ancak kaydetme doğrulanamadı. Güncel kaydı kontrol etmek için ekranı yeniden aç.";
  if (result.reason === "hydrationPending" || result.reason === "stateUnavailable" || result.reason === "deletionInProgress") {
    return "Yerel veriler bu işlem için henüz hazır değil. Hazır olduğunda tekrar dene.";
  }
  return unavailable;
}
