import type { ISODateString, SyncStatus, UUID } from "./shared";

export interface WeeklyReview {
  id: UUID;
  userId: UUID;
  weekStart: ISODateString;
  weekEnd: ISODateString;
  completedAt?: ISODateString;
  selectedPatterns: string[];
  helpfulActions: string[];
  nextWeekFocus?: "eveningPause" | "lessRushedRoutine" | "socialMediaTransition" | "arousalAwareness" | "custom";
  customFocus?: string;
  privateNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
