import type {
  ProtectionLevel,
  ProtectionLevelOption,
  ProtectionSchedule,
  ProtectedWindowPreviewAction,
  SensitiveWindow
} from "../types";

export const protectExplanation = {
  title: "A pause, not a hard stop",
  copy: "Protection creates a short moment before continuing. You remain in control and can turn it off anytime.",
  note: "Use this when a certain time of day feels more automatic."
} as const;

export const suggestedSensitiveWindow: SensitiveWindow = {
  id: "evening-window",
  label: "Sensitive Window Support",
  statusLabel: "Suggested",
  startTime: "22:00",
  endTime: "00:00",
  repeatLabel: "Every evening",
  reason: "Recent logs suggest evenings may be a sensitive window."
};

export const defaultProtectionSchedule: ProtectionSchedule = {
  startTime: suggestedSensitiveWindow.startTime,
  endTime: suggestedSensitiveWindow.endTime,
  repeatLabel: suggestedSensitiveWindow.repeatLabel
};

export const defaultProtectionLevel: ProtectionLevel = "balanced";

export const protectionLevelOptions: ProtectionLevelOption[] = [
  {
    id: "gentle",
    title: "Gentle",
    description: "A short awareness prompt before continuing."
  },
  {
    id: "balanced",
    title: "Balanced",
    description: "A short pause with a suggested support tool."
  },
  {
    id: "strong",
    title: "Strong",
    description: "A longer pause with optional reflection."
  }
];

export const previewActions: ProtectedWindowPreviewAction[] = [
  {
    id: "startPause",
    label: "Start 90-Second Pause"
  },
  {
    id: "quickCheckIn",
    label: "Quick Check-In"
  },
  {
    id: "continueMindfully",
    label: "Continue mindfully"
  },
  {
    id: "notNow",
    label: "Not now"
  }
];
