import type { BloomProductFlowActions } from "../../app/flows/bloomProductFlowActions";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { CurrentUrgeControlTrigger, LegacyUrgeControlTrigger, UrgeControlOutcome, UrgeControlTechnique } from "../../domain/models/UrgeControlEvent";
import type { UrgeControlState } from "../../domain/models/UrgeControlState";
import type { BloomLocalState } from "../../storage/bloomState";
import { getUrgeControlRouteView } from "./urgeControlView";

export type UrgeControlOperation = "completeInterrupt" | "selectTechnique" | "startPhoneAway" | "endPhoneAway" |
  "recordOutcome" | "recordTrigger" | "recordTriggers" | "complete" | "discardActive";
export type UrgeControlOperationSnapshot = {
  busy: boolean;
  operation: UrgeControlOperation | null;
  acceptedUrge: UrgeControlState | null;
  result: BloomPersistedMutationResult | null;
  message: string | null;
};
type Options = {
  flowActions: BloomProductFlowActions;
  getState: () => BloomLocalState;
  getDurableState: () => BloomLocalState;
  getRouteEventId: () => unknown;
  getDisplayTime: () => string;
  retryPersistedMutation: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  onPersisted?: (operation: UrgeControlOperation, acceptedUrge: UrgeControlState) => void;
};
const unavailable = "Bu işlem mevcut kayıt için kullanılamıyor. Güncel kaydı yeniden açın.";

export function createUrgeControlController(options: Options) {
  let snapshot: UrgeControlOperationSnapshot = { busy: false, operation: null, acceptedUrge: null, result: null, message: null };
  let inFlight: Promise<BloomPersistedMutationResult> | null = null;
  let operationKey: string | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: UrgeControlOperationSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };

  function observe(pending: Promise<BloomPersistedMutationResult>, operation: UrgeControlOperation, acceptedUrge: UrgeControlState | null) {
    const observed = pending.then((result) => {
      inFlight = null;
      publish({ busy: false, operation, acceptedUrge, result, message: result.ok ? null : persistenceMessage(result) });
      if (result.ok && acceptedUrge !== null && options.getState().urgeControl === acceptedUrge) {
        options.onPersisted?.(operation, acceptedUrge);
      }
      return result;
    }, (error: unknown) => {
      inFlight = null;
      publish({ ...snapshot, busy: false, message: "İşlem tamamlanamadı. Kaydetme durumu doğrulanana kadar bekleyin." });
      throw error;
    });
    inFlight = observed;
    return observed;
  }

  function run(operation: UrgeControlOperation, expectedUrge: UrgeControlState, command: () => Promise<BloomPersistedMutationResult>, value: unknown = null) {
    const key = JSON.stringify([operation, value]);
    if (snapshot.busy) return operationKey === key ? inFlight : null;
    const urge = options.getState().urgeControl;
    if (snapshot.acceptedUrge === urge && snapshot.result?.ok !== true && options.getDurableState().urgeControl !== urge) return null;
    const view = getUrgeControlRouteView(urge, options.getRouteEventId(), options.getDisplayTime());
    const stage = view.kind === "current" || view.kind === "legacy" ? view.progress.stage : null;
    const valid = urge === expectedUrge && stage !== null && (
      operation === "discardActive" ||
      operation === "completeInterrupt" && stage === "interrupt" ||
      operation === "recordOutcome" && stage === "outcome" ||
      operation === "recordTriggers" && view.kind === "current" && stage === "triggers" ||
      operation === "complete" && stage === "readyToComplete" ||
      view.kind === "legacy" && (
        operation === "selectTechnique" && stage === "technique" ||
        operation === "startPhoneAway" && stage === "phoneAwayReady" ||
        operation === "endPhoneAway" && stage === "phoneAwayActive" ||
        operation === "recordTrigger" && stage === "trigger"
      )
    );
    if (!valid) { publish({ ...snapshot, message: unavailable }); return null; }
    operationKey = key;
    publish({ busy: true, operation, acceptedUrge: null, result: null, message: null });
    try {
      const pending = command();
      const nextUrge = options.getState().urgeControl;
      const acceptedUrge = nextUrge === urge ? null : nextUrge;
      publish({ ...snapshot, acceptedUrge });
      return observe(pending, operation, acceptedUrge);
    } catch (error) {
      const nextUrge = options.getState().urgeControl;
      publish({ ...snapshot, busy: false, acceptedUrge: nextUrge === urge ? null : nextUrge,
        message: "İşlem tamamlanamadı. Kaydetme durumu doğrulanana kadar bekleyin." });
      return Promise.reject(error);
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    completeInterrupt: (expected: UrgeControlState) => run("completeInterrupt", expected, options.flowActions.urgeControl.completeInterrupt),
    selectTechnique: (technique: UrgeControlTechnique, expected: UrgeControlState) => run("selectTechnique", expected, () => options.flowActions.urgeControl.selectTechnique({ technique }), technique),
    startPhoneAway: (expected: UrgeControlState) => run("startPhoneAway", expected, options.flowActions.urgeControl.startPhoneAway),
    endPhoneAway: (expected: UrgeControlState) => run("endPhoneAway", expected, options.flowActions.urgeControl.endPhoneAway),
    recordOutcome: (outcome: UrgeControlOutcome, expected: UrgeControlState) => run("recordOutcome", expected, () => options.flowActions.urgeControl.recordOutcome({ outcome }), outcome),
    recordTrigger: (trigger: LegacyUrgeControlTrigger, expected: UrgeControlState) => run("recordTrigger", expected, () => options.flowActions.urgeControl.recordTrigger({ trigger }), trigger),
    recordTriggers: (triggers: CurrentUrgeControlTrigger[], expected: UrgeControlState) => run("recordTriggers", expected, () => options.flowActions.urgeControl.recordTriggers(triggers), triggers),
    complete: (expected: UrgeControlState) => run("complete", expected, options.flowActions.urgeControl.complete),
    discardActive: (expected: UrgeControlState) => run("discardActive", expected, options.flowActions.urgeControl.discardActive),
    retry: (): Promise<BloomPersistedMutationResult> | null => {
      if (snapshot.busy) return inFlight;
      const { result, operation, acceptedUrge } = snapshot;
      if (result === null || result.ok || !result.retryable || operation === null) return null;
      if (acceptedUrge !== null && options.getState().urgeControl !== acceptedUrge) {
        publish({ ...snapshot, message: unavailable }); return null;
      }
      publish({ ...snapshot, busy: true, message: null });
      return observe(options.retryPersistedMutation(result.retryToken), operation, acceptedUrge);
    }
  };
}

function persistenceMessage(result: Exclude<BloomPersistedMutationResult, { ok: true }>): string {
  if (result.reason === "persistenceUnknown") return "Kaydetme henüz doğrulanmadı. Aynı değişikliği yeniden kaydetmeyi deneyin.";
  if (result.accepted) return result.retryable ? "Değişiklik burada tutuluyor. Devam etmeden önce yeniden kaydetmeyi deneyin."
    : "Kaydetme doğrulanamadı. Güncel kaydın kaydetme durumunu kontrol edin.";
  if (result.reason === "hydrationPending" || result.reason === "stateUnavailable" || result.reason === "deletionInProgress") return "Yerel veriler henüz hazır değil.";
  return unavailable;
}
