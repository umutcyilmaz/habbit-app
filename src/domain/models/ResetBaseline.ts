import type { ISODateString, UUID } from "./shared";

export type ResetBaseline = {
  id: UUID;
  capturedAt: ISODateString;
  // Missing aggregates mean unknown, not zero. These are observations from
  // completed sessions, not a diagnosis or a frequency-based problem score.
  averageIntervalSeconds?: number;
  averageErectionQuality?: number;
  explicitContentSessionRatio?: number;
  selfReport: {
    urgeIntensity: "low" | "medium" | "high" | "notSure" | "preferNotToSay";
    abilityToPause: "difficult" | "sometimesPossible" | "manageable" | "notSure" | "preferNotToSay";
    spontaneousOrMorningErections: "often" | "sometimes" | "rarely" | "notSure" | "preferNotToSay";
  };
};
