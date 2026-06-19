import type { UserGoal } from "./Onboarding";
import type { ISODateString, SupportStyle, SyncStatus, UUID } from "./shared";

export interface UserPlan {
  id: UUID;
  userId: UUID;
  activeGoals: UserGoal[];
  supportStyle: SupportStyle;
  startingProfileSummary?: string;
  currentFocus?: string;
  suggestedActions: Array<"quickCheckIn" | "pauseNow" | "dailyLog" | "exercise" | "protectionWindow">;
  protectionWindowIds: UUID[];
  reminderEnabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
