import type { BloomPersistedMutationResult } from "../../app/providers/bloomLocalStateMutationRuntime";
import type { BloomLocalState } from "../../storage/bloomState";

export function getBloomPersistenceRecovery(
  operation: { busy: boolean; result: BloomPersistedMutationResult | null },
  acceptedState: BloomLocalState,
  durableState: BloomLocalState
) {
  const retryable = operation.result !== null && !operation.result.ok && operation.result.retryable;
  // Compare the whole snapshot: a stale receipt may be superseded by a change
  // in a different slice. Durable equality is not evidence the old command saved.
  const unconfirmed = acceptedState !== durableState;
  const navigationBlocked = operation.busy || retryable || unconfirmed;
  return {
    navigationBlocked,
    canConfirmCurrentSave: !operation.busy && !retryable && unconfirmed,
    recoveryGuidance: navigationBlocked
      ? operation.busy
        ? "Güncel durumun kaydı kontrol ediliyor. Lütfen bekle. Uygulamayı tamamen kapatırsan doğrulanmamış değişiklik kaybolabilir."
        : retryable
        ? "Kaydetme doğrulanana kadar bu ekran açık kalır. Kaydetmeyi tekrar dene. Uygulamayı tamamen kapatırsan doğrulanmamış değişiklik kaybolabilir."
        : "Güncel durumun kaydı doğrulanmadı. Güncel durumu kaydet düğmesini kullan. Uygulamayı tamamen kapatırsan doğrulanmamış değişiklik kaybolabilir."
      : operation.result !== null && !operation.result.ok && operation.result.accepted
        ? "Önceki isteğin kayıt onayı artık kullanılamıyor. Güncel durum bu cihaza kaydedilmiş. Kapatıp güncel ekrana dönebilirsin."
        : null
  };
}
