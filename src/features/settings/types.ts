export type SettingsSectionId =
  | "privacyOverview"
  | "dataControls"
  | "notifications"
  | "appLock"
  | "subscription";

export interface SettingsSection {
  id: SettingsSectionId;
  title: string;
  description: string;
}
