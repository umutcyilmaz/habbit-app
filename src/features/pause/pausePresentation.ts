import type {
  PauseHelpfulActionId,
  PauseIntensityAfterChange,
  PauseNextStepId,
  PauseTriggerId,
  PauseTruthId
} from "../../storage/bloomState";

export const pauseTriggerLabels: Record<PauseTriggerId, string> = {
  boredom: "Boredom",
  stress: "Stress",
  loneliness: "Loneliness",
  nighttime: "Nighttime",
  socialMedia: "Social media",
  tiredness: "Tiredness",
  desire: "Desire",
  habit: "Habit",
  notSure: "Not sure"
};

export const pauseHelpfulActionLabels: Record<PauseHelpfulActionId, string> = {
  pause90: "Pause for 90 seconds",
  breathe3: "Breathe for 3 minutes",
  logAndClose: "Log and close",
  continueMindfully: "Continue mindfully"
};

export const pauseIntensityAfterLabels: Record<
  PauseIntensityAfterChange,
  string
> = {
  lower: "Lower",
  aboutTheSame: "About the same",
  higher: "Higher"
};

export const pauseTruthLabels: Record<PauseTruthId, string> = {
  calmer: "I feel calmer",
  canWaitLonger: "I can wait longer",
  stillPulled: "I still feel pulled",
  wantSupport: "I want support",
  notSure: "Not sure"
};

export const pauseNextStepLabels: Record<PauseNextStepId, string> = {
  savePause: "Save this pause",
  breathe3: "3-min breathing",
  leaveRoom: "Leave the room",
  putPhoneAway: "Put phone away",
  messageSupport: "Message support",
  continueMindfully: "Continue mindfully"
};

export function formatPauseDuration(durationSeconds: number) {
  if (durationSeconds < 60) {
    return `${durationSeconds} sec`;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return seconds === 0
    ? `${minutes} min`
    : `${minutes} min ${seconds} sec`;
}
