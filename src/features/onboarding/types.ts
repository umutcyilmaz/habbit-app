export type OnboardingStepId =
  | "welcome"
  | "safetyNote"
  | "privacyTrust"
  | "goals"
  | "startingPoint"
  | "startingProfile"
  | "startingPlan";

export type OnboardingGoalId =
  | "pauseBeforeAutomaticHabits"
  | "reduceAdultContentLoops"
  | "masturbateMoreMindfully"
  | "reduceRushing"
  | "understandTriggers"
  | "improveArousalAwareness"
  | "buildCalmerRoutine"
  | "notSureYet";

export type FamiliarPatternId =
  | "automaticWhenBored"
  | "rushWithoutSignals"
  | "understandPatterns"
  | "notSureYet";

export type TriggerId =
  | "boredom"
  | "nighttime"
  | "socialMedia"
  | "emptyTime"
  | "stress"
  | "desire"
  | "notSure";

export type OnboardingSupportStyle = "gentle" | "balanced" | "strong";

export interface OnboardingDraft {
  currentStepId: OnboardingStepId;
  selectedGoals: OnboardingGoalId[];
  familiarPattern?: FamiliarPatternId;
  triggers: TriggerId[];
  supportStyle: OnboardingSupportStyle;
}
