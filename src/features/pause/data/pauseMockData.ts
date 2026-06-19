import type {
  PauseCheckInState,
  PauseSelectableOption,
  PauseSessionSummary,
  PauseSupportOption,
  PauseTrigger
} from "../types";

export const PAUSE_INITIAL_SECONDS = 90;
export const PAUSE_EXTENSION_SECONDS = 60;

export const pauseTriggerOptions: Array<PauseSelectableOption<PauseTrigger>> = [
  { id: "boredom", label: "Boredom" },
  { id: "nighttime", label: "Nighttime" },
  { id: "socialMedia", label: "Social media" },
  { id: "stress", label: "Stress" },
  { id: "desire", label: "Desire" },
  { id: "habit", label: "Habit" },
  { id: "emptyTime", label: "Empty time" },
  { id: "notSure", label: "Not sure" }
];

export const pauseSupportOptions: Array<PauseSelectableOption<PauseSupportOption>> = [
  { id: "ninetySecondPause", label: "90-Second Pause" },
  { id: "breathingReset", label: "Breathing reset" },
  { id: "privateReflection", label: "Private reflection" },
  { id: "stepAway", label: "Step away for now" },
  { id: "continueMindfully", label: "Continue mindfully" }
];

export const defaultPauseCheckInState: PauseCheckInState = {
  urgeStrength: 7,
  triggers: ["boredom", "nighttime"],
  supportOption: "ninetySecondPause"
};

export const pauseTriggerLabels: Record<PauseTrigger, string> = {
  boredom: "Boredom",
  nighttime: "Nighttime",
  socialMedia: "Social media",
  stress: "Stress",
  desire: "Desire",
  habit: "Habit",
  emptyTime: "Empty time",
  notSure: "Not sure"
};

export const pauseSupportLabels: Record<PauseSupportOption, string> = {
  ninetySecondPause: "90-Second Pause",
  breathingReset: "Breathing reset",
  privateReflection: "Private reflection",
  stepAway: "Step away for now",
  continueMindfully: "Continue mindfully"
};

export const defaultPauseSessionSummary: PauseSessionSummary = {
  urgeBefore: 7,
  urgeAfter: 4,
  triggers: ["boredom", "nighttime"],
  tool: "ninetySecondPause",
  observation: "Evening boredom may be a useful signal to watch this week."
};

export const pauseSupportLines = [
  "An urge can feel intense and still pass.",
  "You do not have to decide immediately.",
  "If the feeling changes, that is okay."
];
