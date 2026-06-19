import type { ISODateString, UUID } from "./shared";

export interface PrivacySettings {
  id: UUID;
  userId: UUID;
  appLockEnabled: boolean;
  biometricUnlockEnabled: boolean;
  analyticsEnabled: boolean;
  crashReportsEnabled: boolean;
  privateNotesEnabled: boolean;
  dataExportAvailable: boolean;
  lastDataDeletionAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
