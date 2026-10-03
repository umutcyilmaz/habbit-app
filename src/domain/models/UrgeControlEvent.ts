import type { ISODateString, UUID } from "./shared";

export type UrgeControlTechnique =
  | "changeEnvironment"
  | "grounding54321"
  | "cognitiveTask"
  | "urgeSurfing"
  | "personalReminder";

export type UrgeControlOutcome = "reduced" | "stillStrong" | "stronger" | "unchanged";

export type LegacyUrgeControlTrigger =
  | "boredom"
  | "stress"
  | "loneliness"
  | "sleeplessnessNighttime"
  | "sexualDesire"
  | "habitAutomatic"
  | "notSure";

// Compatibility name for the historical single-choice operation.
export type UrgeControlTrigger = LegacyUrgeControlTrigger;

export type CurrentUrgeControlTrigger =
  | "boredom"
  | "stress"
  | "loneliness"
  | "fatigue"
  | "explicitContentCue"
  | "habitAutomatic"
  | "specificSituation"
  | "other";

export type UrgeControlSecondLineAction =
  | "putPhoneInAnotherRoom"
  | "doAnotherTask"
  | "messageSupportPerson";

type LegacyUrgeControlEventProgress = {
  id: UUID;
  // Absence is historical identity, never a field added during hydration.
  flowVersion?: never;
  triggers?: never;
  startedAt: ISODateString;
  interruptCompletedAt?: ISODateString;
  phoneAwayStartedAt?: ISODateString;
  phoneAwayEndedAt?: ISODateString;
  secondLineAction?: UrgeControlSecondLineAction;
};

export type LegacyUrgeControlEvent = LegacyUrgeControlEventProgress &
  (
    | {
        status: "active";
        selectedTechnique?: UrgeControlTechnique;
        outcome?: UrgeControlOutcome;
        trigger?: LegacyUrgeControlTrigger;
      }
    | {
        status: "completed";
        completedAt: ISODateString;
        selectedTechnique: UrgeControlTechnique;
        outcome: UrgeControlOutcome;
        trigger: LegacyUrgeControlTrigger;
      }
  );

type CurrentUrgeControlEventIdentity = {
  id: UUID;
  flowVersion: 2;
  startedAt: ISODateString;
  selectedTechnique?: never;
  phoneAwayStartedAt?: never;
  phoneAwayEndedAt?: never;
  trigger?: never;
  secondLineAction?: never;
};

export type CurrentUrgeControlEvent = CurrentUrgeControlEventIdentity &
  (
    | {
        status: "active";
        interruptCompletedAt?: ISODateString;
        outcome?: UrgeControlOutcome;
        // Undefined is unfinished; [] explicitly finalizes/skips the question.
        triggers?: CurrentUrgeControlTrigger[];
      }
    | {
        status: "completed";
        interruptCompletedAt: ISODateString;
        outcome: UrgeControlOutcome;
        triggers: CurrentUrgeControlTrigger[];
        completedAt: ISODateString;
      }
  );

export type UrgeControlEvent = CurrentUrgeControlEvent | LegacyUrgeControlEvent;
