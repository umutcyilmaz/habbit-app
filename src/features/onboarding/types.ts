import type { OnboardingAnswers, UserGoal } from "../../domain/models";

export type OnboardingStepId =
  | "welcome"
  | "safetyNote"
  | "privacyTrust"
  | "goalSelection"
  | "adaptiveQuestions"
  | "startingProfile"
  | "startingPlan";

export interface OnboardingDraft {
  currentStepId: OnboardingStepId;
  selectedGoals: UserGoal[];
  answers?: Partial<OnboardingAnswers>;
}
