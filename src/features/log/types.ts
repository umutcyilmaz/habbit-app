export type LogEntryType =
  | "nothing"
  | "urge"
  | "pausedUrge"
  | "adultContent"
  | "masturbation"
  | "both"
  | "quickCheckIn";

export type FeelingOption =
  | "bored"
  | "calm"
  | "restless"
  | "stressed"
  | "lonely"
  | "curious"
  | "notSure";

export type SupportToolOption =
  | "noneToday"
  | "pause"
  | "breathing"
  | "privateReflection"
  | "exercise"
  | "protection";

export type LogScreenMode = "selector" | "quickCheckIn" | "saved";

export interface LogEntryOption {
  id: LogEntryType;
  label: string;
  description: string;
}

export interface QuickCheckInFormState {
  awarenessRating: number;
  groundedRating: number;
  strongestFeeling: FeelingOption;
  supportTools: SupportToolOption[];
  privateNote: string;
}

export interface QuickCheckInSummary {
  awarenessRating: number;
  groundedRating: number;
  strongestFeeling: FeelingOption;
  supportTools: SupportToolOption[];
}

export interface SelectableOption<TValue extends string> {
  id: TValue;
  label: string;
}
