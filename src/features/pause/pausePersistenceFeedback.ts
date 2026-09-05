import type { BloomPersistedMutationResult } from "../../app/providers/BloomLocalStateProvider";

export function getPausePersistenceErrorMessage(
  result: BloomPersistedMutationResult
) {
  if (result.ok) {
    return null;
  }

  if (result.reason === "persistenceUnknown") {
    return "Bloom is still confirming this Pause in local storage. You can leave safely or try again; it is not shown as saved yet.";
  }

  if (result.reason === "persistenceSuperseded") {
    return "A newer change replaced this Pause save request. This request did not mark the Pause as saved.";
  }

  if (result.retryable) {
    return "Your Pause is recorded for this session, but Bloom couldn’t save it to local storage. Try saving again.";
  }

  if (result.accepted) {
    return "Saving was interrupted because Bloom’s local data changed. Return to Pause before trying again.";
  }

  return "Bloom couldn’t complete this Pause right now. Try again.";
}
