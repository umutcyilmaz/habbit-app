export type SettingsRouteTarget =
  | "/settings/privacy"
  | "/settings/data-controls"
  | "/settings/notifications"
  | "/settings/app-lock"
  | "/settings/subscription";

export type SettingsSectionId = "account" | "privacy" | "preferences" | "support";

export type SettingsItemId =
  | "profile"
  | "subscription"
  | "privacyOverview"
  | "dataControls"
  | "appLock"
  | "notifications"
  | "personalization"
  | "safetyNote"
  | "help";

export type SettingsItemStatus = "available" | "comingNext";

export interface SettingsItem {
  id: SettingsItemId;
  title: string;
  description: string;
  status: SettingsItemStatus;
  route?: SettingsRouteTarget;
}

export interface SettingsSection {
  id: SettingsSectionId;
  title: string;
  items: readonly SettingsItem[];
}

export type PrivacyPrincipleAccent = "sage" | "lavender" | "peach";

export interface PrivacyPrinciple {
  id: string;
  title: string;
  body: string;
  accent: PrivacyPrincipleAccent;
}

export type DataControlItemId =
  | "storedData"
  | "personalization"
  | "exportData"
  | "deleteSpecific"
  | "deleteAll";

export interface DataControlItem {
  id: DataControlItemId;
  title: string;
  body: string;
  caution: boolean;
  actionLabel?: string;
  statusLabel?: string;
}

export type NotificationPreferenceId =
  | "eveningCheckIn"
  | "sensitiveWindow"
  | "practiceReminder"
  | "weeklyReview"
  | "pauseAll";

export interface NotificationPreference {
  id: NotificationPreferenceId;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export type AppLockOptionId = "requireUnlock" | "hidePreviews" | "lockAfterInactivity";

export interface AppLockOption {
  id: AppLockOptionId;
  label: string;
  description: string;
  enabled: boolean;
}

export type SubscriptionOptionId = "viewPremium" | "restorePurchases";

export interface SubscriptionOption {
  id: SubscriptionOptionId;
  label: string;
}

export interface SubscriptionSettingsContent {
  essentialTitle: string;
  essentialBody: string;
  premiumTitle: string;
  premiumBody: string;
  options: readonly SubscriptionOption[];
}
