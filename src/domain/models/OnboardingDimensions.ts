// Future qualitative inputs, independent of the existing quiz's scores and
// pattern IDs. Frequency alone must not determine concern or recommendation.
export type OnboardingDimensions = {
  contentDysregulation: "low" | "moderate" | "high" | "uncertain";
  erectionResponseConcern: "low" | "significant" | "uncertain";
  stimulationPattern: "flexible" | "specificStimulationReliance" | "uncertain";
  safetyFlag: "noneReported" | "reported" | "uncertain";
  recommendationConfidence: "low" | "medium" | "high" | "uncertain";
};

// Low, medium, or uncertain recommendation confidence should prefer
// Masturbation Tracking first so real behavioral data can be collected.
// This type does not implement scoring, routing, or medical interpretation.
export type OnboardingRecommendation =
  | "masturbation_tracking"
  | "content_free"
  | "reset"
  | "reset_and_content_free";
