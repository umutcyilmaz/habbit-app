import type { ISODateString, UUID } from "./shared";

export type CurrentResetBaselineSelfReport = {
  erectionDecline: "clear" | "mild" | "none" | "notSure";
  needsStrongerOrFasterStimulation: "clearly" | "somewhat" | "no";
  climaxTakesLonger: "clearly" | "somewhat" | "no" | "notSure";
  difficultyArousingWithoutExplicitContent: "yes" | "sometimes" | "no" | "notTried";
};

// Historical questionnaire facts remain readable without inventing answers to
// the current questions or rewriting an existing journey's baseline.
export type LegacyResetBaselineSelfReport = {
  urgeIntensity: "low" | "medium" | "high" | "notSure" | "preferNotToSay";
  abilityToPause: "difficult" | "sometimesPossible" | "manageable" | "notSure" | "preferNotToSay";
  spontaneousOrMorningErections: "often" | "sometimes" | "rarely" | "notSure" | "preferNotToSay";
};

export type ResetBaseline = {
  id: UUID;
  capturedAt: ISODateString;
  // Missing aggregates mean unknown, not zero. These are observations from
  // completed sessions, not a diagnosis or a frequency-based problem score.
  averageIntervalSeconds?: number;
  averageErectionQuality?: number;
  explicitContentSessionRatio?: number;
  selfReport: CurrentResetBaselineSelfReport | LegacyResetBaselineSelfReport;
};
