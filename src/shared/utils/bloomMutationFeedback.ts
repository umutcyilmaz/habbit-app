import type {
  BloomPersistedMutationResult
} from "../../app/providers/bloomLocalStateMutationRuntime";

export type BloomMutationFeedback = {
  didSave: boolean;
  message: string;
};

export function resolveBloomMutationFeedback(
  result: BloomPersistedMutationResult,
  successMessage: string,
  failureMessage: string
): BloomMutationFeedback {
  return result.ok && result.persisted
    ? { didSave: true, message: successMessage }
    : { didSave: false, message: failureMessage };
}
