import type { BloomOnboardingQuizResult } from "../onboarding/types";

// Completion records a recommendation, not acceptance or activation of a plan.
// The completed result owns its timestamp; there is no second clock or identity.
export type ProductOnboardingState =
  | { status: "notCompleted"; result: null }
  | { status: "completed"; result: BloomOnboardingQuizResult };
