import type { ISODateString, PreferenceAnswer, SupportStyle, UUID } from "./shared";

export type UserGoal =
  | "pauseBeforeAutomaticHabits"
  | "reduceAdultContentLoops"
  | "masturbateMoreMindfully"
  | "reduceRushing"
  | "understandTriggers"
  | "improveArousalAwareness"
  | "buildCalmerRoutines";

export type CommonMoment =
  | "boredom"
  | "stress"
  | "tiredness"
  | "alone"
  | "afterSocialMedia"
  | "other";

export type SensitiveWindow = "morning" | "afternoon" | "evening" | "lateNight";

export interface OnboardingAnswers {
  id: UUID;
  userId: UUID;
  goals: UserGoal[];
  commonMoments: CommonMoment[];
  sensitiveWindows: SensitiveWindow[];
  adultContentStartsAutomatically?: PreferenceAnswer;
  adultContentBeforeRushedMasturbation?: PreferenceAnswer;
  rushingPresent?: PreferenceAnswer;
  preferredSupportStyle: SupportStyle;
  medicalRedFlags: "none" | "present" | "preferNotToSay";
  completedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
