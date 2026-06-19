import type { FeelingAfter, ISODateString, Source, SyncStatus, UUID } from "./shared";

export interface PauseSession {
  id: UUID;
  userId: UUID;
  startedAt: ISODateString;
  completedAt?: ISODateString;
  durationSeconds: number;
  source: Source;
  contextTags: string[];
  protectionWindowId?: UUID;
  completed: boolean;
  afterPauseChoice?: "continueIntentionally" | "doSomethingElse" | "reflect" | "skip";
  feelingAfter?: FeelingAfter;
  linkedLogEntryId?: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
