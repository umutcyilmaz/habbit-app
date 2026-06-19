import { appConfig } from "../app/config/appConfig";

export const appCopy = {
  tagline: appConfig.APP_TAGLINE,
  foundationNote: "Placeholder foundation only. Real flows will be added in later phases.",
  settingsSubtitle: "Trust controls and preferences will live outside the bottom tabs."
} as const;

export const modulePlaceholders = {
  today: {
    title: "Today",
    purpose: "Home base for calm daily awareness and the next useful action.",
    responsibilities: [
      "Daily recommendation",
      "Quick actions",
      "Weekly progress preview",
      "Settings access"
    ],
    primaryAction: "Pause Now"
  },
  log: {
    title: "Log",
    purpose: "A private place to capture moments and reflections without judgment.",
    responsibilities: [
      "Daily check-ins",
      "Event logs",
      "Private reflections",
      "Pattern learning"
    ],
    primaryAction: "Add a future log"
  },
  exercises: {
    title: "Exercises",
    purpose: "Simple practices for pausing, resetting, and noticing arousal with more care.",
    responsibilities: [
      "90-Second Pause",
      "Breathing reset",
      "Arousal awareness",
      "Content support"
    ],
    primaryAction: "Preview exercises"
  },
  progress: {
    title: "Progress",
    purpose: "Gentle observations that help users notice patterns over time.",
    responsibilities: [
      "Gentle observations",
      "Weekly review",
      "Helpful tools",
      "Sensitive windows"
    ],
    primaryAction: "View future insights"
  },
  protect: {
    title: "Protect",
    purpose: "Optional support around sensitive windows while the user remains in control.",
    responsibilities: [
      "Sensitive window support",
      "Gentle pause",
      "Protection levels",
      "User remains in control"
    ],
    primaryAction: "Set up future support"
  },
  settings: {
    title: "Settings",
    purpose: "Privacy, data, notifications, app lock, and subscription entry points.",
    responsibilities: [
      "Privacy overview",
      "Data controls",
      "Notifications",
      "App lock",
      "Subscription"
    ],
    primaryAction: "Return to Today"
  }
} as const;
