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
  settings: "/settings",
  settingsPrivacy: "/settings/privacy",
  settingsDataControls: "/settings/data-controls",
  settingsNotifications: "/settings/notifications",
  settingsAppLock: "/settings/app-lock",
  settingsSubscription: "/settings/subscription"
} as const;
