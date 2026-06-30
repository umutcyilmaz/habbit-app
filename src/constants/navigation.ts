export const tabRoutes = [
  {
    name: "today",
    title: "Today"
  },
  {
    name: "log",
    title: "Log"
  },
  {
    name: "exercises",
    title: "Exercises"
  },
  {
    name: "progress",
    title: "Progress"
  },
  {
    name: "protect",
    title: "Protect"
  }
] as const;

export const routes = {
  home: "/(tabs)/today",
  log: "/(tabs)/log",
  exercises: "/(tabs)/exercises",
  debugBloomState: "/debug/bloom-state",
  whatShouldIUse: "/guidance/what-should-i-use",
  onboardingResult: "/onboarding/result",
  arousalControl: "/exercises/arousal-control",
  arousalControlMode: "/exercises/arousal-control/mode",
  arousalControlCheckIn: "/exercises/arousal-control/check-in",
  arousalControlPractice: "/exercises/arousal-control/practice",
  arousalControlPause: "/exercises/arousal-control/pause",
  arousalControlAfterPause: "/exercises/arousal-control/after-pause",
  arousalControlFinish: "/exercises/arousal-control/finish",
  arousalControlReflection: "/exercises/arousal-control/reflection",
  arousalControlDuration: "/exercises/arousal-control/duration",
  arousalControlSaved: "/exercises/arousal-control/saved",
  arousalControlProgressPreview: "/exercises/arousal-control/progress-preview",
  progress: "/(tabs)/progress",
  protect: "/(tabs)/protect",
  protectSetup: "/protect/setup",
  protectActive: "/protect/active",
  protectNightSetup: "/protect/night-setup",
  protectIntercept: "/protect/intercept",
  tenDayReset: "/reset/ten-day",
  tenDayResetPractice: "/reset/ten-day/practice",
  tenDayResetSaved: "/reset/ten-day/saved",
  pause: "/pause",
  pauseCheckIn: "/pause/check-in",
  pauseTimer: "/pause/timer",
  pauseSaved: "/pause/saved",
  settings: "/settings",
  settingsPrivacy: "/settings/privacy",
  settingsDataControls: "/settings/data-controls",
  settingsNotifications: "/settings/notifications",
  settingsAppLock: "/settings/app-lock",
  settingsSubscription: "/settings/subscription"
} as const;
