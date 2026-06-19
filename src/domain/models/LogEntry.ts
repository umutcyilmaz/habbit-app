import type {
  AwarenessLevel,
  FeelingAfter,
  ISODateString,
  Source,
  SyncStatus,
  UUID
} from "./shared";

export interface LogEntry {
  id: UUID;
  userId: UUID;
  loggedAt: ISODateString;
  source: Source;
  type: "quickCheckIn" | "contentReflection" | "arousalAwareness" | "routineNote";
  momentTags: string[];
  triggerTags: string[];
  adultContentInvolved?: boolean;
  rushingPresent?: boolean;
  masturbationFeltMindful?: "yes" | "somewhat" | "no" | "preferNotToSay";
  intentionBeforeMoment?: AwarenessLevel;
  feelingAfter?: FeelingAfter;
  privateNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
