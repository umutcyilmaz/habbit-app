export type ISODateString = string;
export type UUID = string;

export type SupportStyle = "gentle" | "balanced" | "direct";

export type Source =
  | "onboarding"
  | "today"
  | "log"
  | "pause"
  | "protect"
  | "progress"
  | "settings";

export type SyncStatus = "localOnly" | "pending" | "synced" | "error";

export type PreferenceAnswer = "often" | "sometimes" | "rarely" | "preferNotToSay";
export type AwarenessLevel = "low" | "medium" | "high" | "preferNotToSay";
export type FeelingAfter = "calmer" | "same" | "moreActivated" | "unclear" | "preferNotToSay";
