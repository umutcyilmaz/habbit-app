import type { ISODateString, UUID } from "./shared";

export type UrgeControlTechnique =
  | "changeEnvironment"
  | "grounding54321"
  | "cognitiveTask"
  | "urgeSurfing"
  | "personalReminder";

export type UrgeControlOutcome = "reduced" | "stillStrong" | "stronger" | "unchanged";

export type UrgeControlTrigger =
  | "boredom"
  | "stress"
  | "loneliness"
  | "sleeplessnessNighttime"
  | "sexualDesire"
  | "habitAutomatic"
  | "notSure";

export type UrgeControlSecondLineAction =
  | "putPhoneInAnotherRoom"
  | "doAnotherTask"
  | "messageSupportPerson";

type UrgeControlEventProgress = {
  id: UUID;
  startedAt: ISODateString;
  interruptCompletedAt?: ISODateString;
  phoneAwayStartedAt?: ISODateString;
  phoneAwayEndedAt?: ISODateString;
  secondLineAction?: UrgeControlSecondLineAction;
};

export type UrgeControlEvent = UrgeControlEventProgress &
  (
    | {
        status: "active";
        selectedTechnique?: UrgeControlTechnique;
        outcome?: UrgeControlOutcome;
        trigger?: UrgeControlTrigger;
      }
    | {
        status: "completed";
        completedAt: ISODateString;
        selectedTechnique: UrgeControlTechnique;
        outcome: UrgeControlOutcome;
        trigger: UrgeControlTrigger;
      }
  );
