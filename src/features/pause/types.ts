export type PauseTrigger =
  | "boredom"
  | "nighttime"
  | "socialMedia"
  | "stress"
  | "desire"
  | "habit"
  | "emptyTime"
  | "notSure";

export type PauseSupportOption =
  | "ninetySecondPause"
  | "breathingReset"
  | "privateReflection"
  | "stepAway"
  | "continueMindfully";

export interface PauseCheckInState {
  urgeStrength: number;
  triggers: PauseTrigger[];
  supportOption: PauseSupportOption;
}

export interface PauseSessionSummary {
  urgeBefore: number;
  urgeAfter: number;
  triggers: PauseTrigger[];
  tool: PauseSupportOption;
  observation: string;
}

export interface PauseTimerState {
  remainingSeconds: number;
  isComplete: boolean;
}

export interface PauseSelectableOption<TValue extends string> {
  id: TValue;
  label: string;
}
