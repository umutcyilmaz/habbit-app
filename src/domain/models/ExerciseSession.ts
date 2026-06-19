import type { ISODateString, SyncStatus, UUID } from "./shared";

export interface ExerciseSession {
  id: UUID;
  userId: UUID;
  exerciseId: string;
  exerciseType: "pause" | "breathing" | "arousalAwareness" | "reflection" | "routine";
  startedAt: ISODateString;
  completedAt?: ISODateString;
  durationSeconds?: number;
  helpfulness?: "notForMe" | "somewhat" | "helpful" | "preferNotToSay";
  privateNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
