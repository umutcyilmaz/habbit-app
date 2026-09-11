import type { OnboardingDimensions, OnboardingRecommendation } from "../models/OnboardingDimensions";
import type { ErectionQuality } from "../models/MasturbationSession";
import type { ISODateString } from "../models/shared";

export const behaviorFrequencyValues = ["never", "rarely", "sometimes", "often", "almostAlways", "notSure"] as const;
export type BehaviorFrequencyAnswer = typeof behaviorFrequencyValues[number];

export const explicitContentFrequencyValues = ["never", "lessThanWeekly", "weekly", "severalDaysAWeek", "dailyOrMore", "notSure"] as const;
export type ExplicitContentFrequencyAnswer = typeof explicitContentFrequencyValues[number];

export const reductionDifficultyValues = [...behaviorFrequencyValues, "neverTriedToReduce"] as const;
export type ReductionDifficultyAnswer = typeof reductionDifficultyValues[number];

export const erectionQualityValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "notSure"] as const;
export type TypicalErectionQualityAnswer = ErectionQuality | "notSure";

export const masturbationTechniqueValues = [
  "normalHandTechnique", "veryHighSpeed", "veryTightPressure", "frictionThroughClothing",
  "rubbingAgainstBedPillowSurface", "proneRubbing", "other", "notSure"
] as const;
export type MasturbationTechniqueAnswer = typeof masturbationTechniqueValues[number];

export const safetySignalValues = [
  "suddenPersistentErectionChange", "pain", "numbnessOrSensationChange",
  "newMarkedCurvature", "none", "unsure"
] as const;
export type OnboardingSafetyAnswer = typeof safetySignalValues[number];

// A completed questionnaire answers every question. Explicit unknown answers
// preserve uncertainty; missing or malformed answers are not scored as zero.
export type BloomOnboardingAnswers = {
  readonly explicitContentFrequency: ExplicitContentFrequencyAnswer;
  readonly unplannedContentUse: BehaviorFrequencyAnswer;
  readonly activityInterruption: BehaviorFrequencyAnswer;
  readonly contentTriggeredMasturbation: BehaviorFrequencyAnswer;
  readonly repeatedContentReturn: BehaviorFrequencyAnswer;
  readonly difficultyReducingContent: ReductionDifficultyAnswer;
  readonly erectionQuality: TypicalErectionQualityAnswer;
  readonly erectionMaintenanceDifficulty: BehaviorFrequencyAnswer;
  readonly masturbationTechniques: readonly MasturbationTechniqueAnswer[];
  readonly techniqueDependency: BehaviorFrequencyAnswer;
  readonly delayedOrDifficultEjaculation: BehaviorFrequencyAnswer;
  readonly safetySignals: readonly OnboardingSafetyAnswer[];
};

// Internal provisional evidence, never a clinical measurement or display score.
export type OnboardingScoreEvidence = {
  normalizedScore: number | null;
  answeredCount: number;
  totalCount: number;
  strongSignalCount: number;
};

export type BloomOnboardingQuizResult = {
  quizVersion: 1;
  scoringVersion: 1;
  answers: BloomOnboardingAnswers;
  dimensions: OnboardingDimensions;
  recommendation: OnboardingRecommendation;
  recommendationConfidence: OnboardingDimensions["recommendationConfidence"];
  resetEligible: boolean;
  safetyFlag: OnboardingDimensions["safetyFlag"];
  completedAt: ISODateString;
  evidence: {
    contentDysregulation: OnboardingScoreEvidence;
    erectionResponseConcern: OnboardingScoreEvidence;
    stimulationPattern: OnboardingScoreEvidence;
  };
};
