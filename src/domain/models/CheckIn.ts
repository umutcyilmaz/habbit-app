import type { AwarenessLevel, ISODateString, Source, SyncStatus, UUID } from "./shared";

export interface DailyCheckIn {
  id: UUID;
  userId: UUID;
  checkedInAt: ISODateString;
  source: Source;
  mood?: "calm" | "bored" | "stressed" | "tired" | "restless" | "neutral" | "other";
  bodyAwareness?: AwarenessLevel;
  arousalAwareness?: AwarenessLevel;
  currentMoment?: "boredom" | "stress" | "alone" | "afterSocialMedia" | "evening" | "other";
  intention?: "unclear" | "somewhatIntentional" | "intentional" | "preferNotToSay";
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
