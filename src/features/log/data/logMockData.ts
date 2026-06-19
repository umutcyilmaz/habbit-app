import type {
  FeelingOption,
  LogEntryOption,
  QuickCheckInFormState,
  SelectableOption,
  SupportToolOption
} from "../types";

export const logEntryOptions: LogEntryOption[] = [
  {
    id: "nothing",
    label: "Nothing happened",
    description: "Save a simple check-in for today."
  },
  {
    id: "urge",
    label: "I felt an urge",
    description: "Notice the moment without adding pressure."
  },
  {
    id: "pausedUrge",
    label: "I paused an urge",
    description: "Capture what helped create a little space."
  },
  {
    id: "adultContent",
    label: "I watched adult content",
    description: "Full reflection support will come later."
  },
  {
    id: "masturbation",
    label: "I masturbated",
    description: "A mindful reflection flow will come later."
  },
  {
    id: "both",
    label: "Both happened",
    description: "Combined reflection support will come later."
  },
  {
    id: "quickCheckIn",
    label: "Quick check-in only",
    description: "Keep this light and private."
  }
];

export const feelingOptions: Array<SelectableOption<FeelingOption>> = [
  { id: "bored", label: "Bored" },
  { id: "calm", label: "Calm" },
  { id: "restless", label: "Restless" },
  { id: "stressed", label: "Stressed" },
  { id: "lonely", label: "Lonely" },
  { id: "curious", label: "Curious" },
  { id: "notSure", label: "Not sure" }
];

export const supportToolOptions: Array<SelectableOption<SupportToolOption>> = [
  { id: "noneToday", label: "None today" },
  { id: "pause", label: "Pause" },
  { id: "breathing", label: "Breathing" },
  { id: "privateReflection", label: "Private reflection" },
  { id: "exercise", label: "Exercise" },
  { id: "protection", label: "Protection" }
];

export const defaultQuickCheckInValues: QuickCheckInFormState = {
  awarenessRating: 4,
  groundedRating: 5,
  strongestFeeling: "bored",
  supportTools: ["noneToday"],
  privateNote: ""
};

export const feelingLabels: Record<FeelingOption, string> = {
  bored: "Bored",
  calm: "Calm",
  restless: "Restless",
  stressed: "Stressed",
  lonely: "Lonely",
  curious: "Curious",
  notSure: "Not sure"
};

export const supportToolLabels: Record<SupportToolOption, string> = {
  noneToday: "None today",
  pause: "Pause",
  breathing: "Breathing",
  privateReflection: "Private reflection",
  exercise: "Exercise",
  protection: "Protection"
};
