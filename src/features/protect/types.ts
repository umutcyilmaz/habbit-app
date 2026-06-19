export type ProtectionStatus = "suggested" | "setup" | "active" | "paused" | "off";

export type ProtectionLevel = "gentle" | "balanced" | "strong";

export interface SensitiveWindow {
  id: string;
  label: string;
  statusLabel: string;
  startTime: string;
  endTime: string;
  repeatLabel: string;
  reason: string;
}

export interface ProtectionSchedule {
  startTime: string;
  endTime: string;
  repeatLabel: string;
}

export interface ProtectionSetupState {
  schedule: ProtectionSchedule;
  level: ProtectionLevel;
}

export type ProtectedWindowAction =
  | "startPause"
  | "quickCheckIn"
  | "continueMindfully"
  | "notNow";

export interface ProtectionLevelOption {
  id: ProtectionLevel;
  title: string;
  description: string;
}

export interface ProtectedWindowPreviewAction {
  id: ProtectedWindowAction;
  label: string;
}
