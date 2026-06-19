import type { ISODateString, SupportStyle, SyncStatus, UUID } from "./shared";

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ProtectionWindow {
  id: UUID;
  userId: UUID;
  label: string;
  daysOfWeek: DayOfWeek[];
  startTimeLocal: string;
  endTimeLocal: string;
  timezone: string;
  enabled: boolean;
  supportStyle: SupportStyle;
  actions: Array<"delayPrompt" | "ninetySecondPause" | "discreetReminder" | "suggestExercise">;
  notificationEnabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
