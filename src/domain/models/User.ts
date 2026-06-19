import type { ISODateString, SupportStyle, SyncStatus, UUID } from "./shared";

export interface User {
  id: UUID;
  displayName?: string;
  ageRange?: "18-24" | "25-34" | "35-44" | "45-54" | "55+";
  createdAt: ISODateString;
  updatedAt: ISODateString;
  onboardingCompletedAt?: ISODateString;
  locale?: string;
  timezone?: string;
  supportStyle: SupportStyle;
  privacySettingsId: UUID;
  notificationSettingsId: UUID;
  subscriptionStateId?: UUID;
  syncStatus: SyncStatus;
}
