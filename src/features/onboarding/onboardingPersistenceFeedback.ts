import type { BloomPersistedMutationResult } from "../../app/providers/BloomLocalStateProvider";

export function getOnboardingPersistenceErrorMessage(
  result: BloomPersistedMutationResult
) {
  if (result.ok) {
    return null;
  }

  if (result.reason === "persistenceUnknown") {
    return "Bloom is still confirming your starting plan in local storage. You can leave safely or try again; it is not shown as saved yet.";
  }

  if (result.reason === "persistenceSuperseded") {
    return "A newer change replaced this starting-plan save request. This request did not mark onboarding as saved.";
  }

  if (result.retryable) {
    return "Your starting plan is ready for this session, but Bloom couldn’t save it to local storage. Try saving again.";
  }

  if (result.accepted) {
    return "Saving was interrupted because Bloom’s local data changed. Return to onboarding before trying again.";
  }

  return "Bloom couldn’t save your starting plan right now. Try again.";
}
