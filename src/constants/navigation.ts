export const tabRoutes = [
  {
    name: "today",
    title: "Ana sayfa",
    href: "/(tabs)/today"
  },
  {
    name: "library",
    title: "Library",
    href: "/(tabs)/library"
  },
  {
    name: "kegel",
    title: "Kegel",
    href: "/bloom/kegel"
  },
  {
    name: "profile",
    title: "Profil",
    href: "/(tabs)/profile"
  }
] as const;

export type BloomTab = (typeof tabRoutes)[number];
// Compatibility routes stay registered without becoming visible tab items.
export const hiddenLegacyTabs = ["log", "exercises", "progress", "protect"] as const;

export const routes = {
  home: "/(tabs)/today",
  library: "/(tabs)/library",
  kegel: "/bloom/kegel",
  profile: "/(tabs)/profile",
  log: "/(tabs)/log",
  exercises: "/(tabs)/exercises",
  debugBloomState: "/debug/bloom-state",
  whatShouldIUse: "/guidance/what-should-i-use",
  onboarding: "/onboarding",
  onboardingQuiz: "/onboarding/quiz",
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

export type AppRoute = (typeof routes)[keyof typeof routes];
