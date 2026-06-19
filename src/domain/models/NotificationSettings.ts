import type { ISODateString, UUID } from "./shared";

export interface NotificationSettings {
  id: UUID;
  userId: UUID;
  remindersEnabled: boolean;
  protectionNotificationsEnabled: boolean;
  weeklyReviewEnabled: boolean;
  discreetWordingEnabled: boolean;
  quietHoursStartLocal?: string;
  quietHoursEndLocal?: string;
  preferredReminderTimeLocal?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
