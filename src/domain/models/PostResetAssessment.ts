import type { ISODateString, UUID } from "./shared";

export type PostResetAssessment = {
  id: UUID;
  resetJourneyId: UUID;
  resetAttemptId: UUID;
  baselineId: UUID;
  completedAt: ISODateString;
  urgeIntensityChange: "decreased" | "same" | "increased" | "notSure" | "preferNotToSay";
  abilityToPauseChange: "harder" | "same" | "easier" | "notSure" | "preferNotToSay";
  spontaneousErectionChange: "lessFrequent" | "same" | "moreFrequent" | "notSure" | "preferNotToSay";
  overallSexualResponseChange: "worse" | "same" | "better" | "notSure" | "preferNotToSay";
  // This answer never gates tracking; the 15-day restriction has already ended.
  readinessToRestartTracking: "ready" | "notReady" | "notSure";
};
