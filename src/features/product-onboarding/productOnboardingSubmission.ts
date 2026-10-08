import { scoreBloomOnboarding } from "../../domain/onboarding/scoreBloomOnboarding";
import type { BloomOnboardingAnswers, BloomOnboardingQuizResult } from "../../domain/onboarding/types";
import type { BloomPersistedMutationResult, BloomPersistenceRetryToken } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { ProductOnboardingState } from "../../domain/models/ProductOnboardingState";

type Dependencies = {
  save: (result: BloomOnboardingQuizResult) => Promise<BloomPersistedMutationResult>;
  retry: (token: BloomPersistenceRetryToken) => Promise<BloomPersistedMutationResult>;
  getOnboarding: () => ProductOnboardingState;
};
type Snapshot = {
  busy: boolean;
  result: BloomOnboardingQuizResult | null;
  accepted: ProductOnboardingState | null;
  retryToken: BloomPersistenceRetryToken | null;
  persisted: boolean;
  message: string | null;
};

// Module lifetime intentionally survives route unmount/remount while the local
// persistence runtime and its retry token remain alive in this JS session.
let snapshot: Snapshot = { busy: false, result: null, accepted: null, retryToken: null, persisted: false, message: null };
let inFlight: Promise<BloomPersistedMutationResult> | null = null;
const listeners = new Set<() => void>();
const publish = (next: Snapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };

export const productOnboardingSubmission = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  clearIfObsolete(current: ProductOnboardingState) {
    if (!snapshot.busy && snapshot.result !== null &&
      (current.status === "notCompleted" || current.status === "completed" && current.planAcceptance !== null)) {
      publish({ busy: false, result: null, accepted: null, retryToken: null, persisted: false, message: null });
    }
  },
  submit(answers: BloomOnboardingAnswers, dependencies: Dependencies): Promise<BloomPersistedMutationResult> | null {
    if (snapshot.busy) return inFlight;
    if (snapshot.result !== null) return null;
    if (dependencies.getOnboarding().status !== "notCompleted") return null;
    const completedAt = new Date().toISOString();
    const result = scoreBloomOnboarding(answers, completedAt);
    publish({ busy: true, result, accepted: null, retryToken: null, persisted: false, message: null });
    try {
      const pending = dependencies.save(result);
      const accepted = dependencies.getOnboarding();
      publish({ ...snapshot, accepted: accepted.status === "completed" && accepted.result.completedAt === completedAt ? accepted : null });
      return observe(pending);
    } catch {
      publish({ ...snapshot, busy: false, message: "Kaydetme başlatılamadı. Yanıtlarını kontrol edip tekrar dene." });
      return null;
    }
  },
  retry(dependencies: Dependencies): Promise<BloomPersistedMutationResult> | null {
    if (snapshot.busy) return inFlight;
    const { retryToken, accepted } = snapshot;
    if (retryToken === null || accepted === null || dependencies.getOnboarding() !== accepted) return null;
    publish({ ...snapshot, busy: true, message: null });
    return observe(dependencies.retry(retryToken));
  }
};

function observe(pending: Promise<BloomPersistedMutationResult>): Promise<BloomPersistedMutationResult> {
  const watched = pending.then((receipt) => {
    inFlight = null;
    publish({ ...snapshot, busy: false, result: receipt.accepted ? snapshot.result : null, persisted: receipt.ok && snapshot.accepted !== null,
      retryToken: !receipt.ok && receipt.retryable ? receipt.retryToken : null,
      message: receipt.ok ? null : receipt.accepted
        ? receipt.retryable ? "Yanıtların bu oturumda tutuluyor, ancak cihaza kaydedilemedi. Yeniden dene." : "Kaydetme doğrulanamadı. Lütfen bu ekranda kal."
        : "Yanıtlar kaydedilemedi. Lütfen tekrar dene." });
    return receipt;
  }, () => {
    inFlight = null;
    publish({ ...snapshot, busy: false, message: "Kaydetme doğrulanamadı. Lütfen bu ekranda kal." });
    throw new Error("Product onboarding persistence was not confirmed.");
  });
  inFlight = watched;
  return watched;
}
