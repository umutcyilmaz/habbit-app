import type { BloomMutationResult } from "../../storage/bloomState";

export type BloomMutationFeedback = {
  didSave: boolean;
  message: string;
};

export function resolveBloomMutationFeedback(
  result: BloomMutationResult,
  successMessage: string,
  failureMessage: string
): BloomMutationFeedback {
  return result.ok
    ? { didSave: true, message: successMessage }
    : { didSave: false, message: failureMessage };
}
