// Qualitative starting hypotheses, independent of the existing quiz's scores and
// pattern IDs. Frequency alone must not determine concern or recommendation.
export type OnboardingSignalLevel = "low" | "medium" | "high" | "uncertain";

export type OnboardingDimensions = {
  contentDysregulation: OnboardingSignalLevel;
  erectionResponseConcern: OnboardingSignalLevel;
  stimulationPattern: OnboardingSignalLevel;
  safetyFlag: "noneReported" | "reported" | "uncertain";
  recommendationConfidence: "low" | "medium" | "high" | "uncertain";
};

// Low, medium, or uncertain recommendation confidence should prefer
// Masturbation Tracking first so real behavioral data can be collected.
// The pure engine lives in domain/onboarding; these are not medical categories.
export type OnboardingRecommendation =
  | "masturbation_tracking"
  | "content_free"
  | "reset"
  | "reset_and_content_free";
