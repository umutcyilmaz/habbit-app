import type { BloomOnboardingQuizResult } from "../onboarding/types";
import type { OnboardingRecommendation } from "./OnboardingDimensions";
import type { ISODateString } from "./shared";

// An explicit historical user action, separate from the stored scoring result.
export type ProductPlanAcceptance = {
  acceptedAt: ISODateString;
  recommendation: OnboardingRecommendation;
};

// Saving a quiz result leaves acceptance pending. The result owns completion
// time; an acceptance has its own explicitly supplied action time.
export type ProductOnboardingState =
  | { status: "notCompleted"; result: null }
  | {
      status: "completed";
      result: BloomOnboardingQuizResult;
      planAcceptance: ProductPlanAcceptance | null;
    };
