import { appConfig } from "../../../app/config/appConfig";
import { routes } from "../../../constants/navigation";
import type {
  AppLockOption,
  DataControlItem,
  NotificationPreference,
  PrivacyPrinciple,
  SettingsSection,
  SubscriptionSettingsContent
} from "../types";

export const settingsTrustCard = {
  title: "Your space, your control",
  body: "You choose what to record, what to skip, and what to delete."
} as const;

export const settingsSections: readonly SettingsSection[] = [
  {
    id: "account",
    title: "Account",
    items: [
      {
        id: "profile",
        title: "Profile",
        description: "Name and basic preferences will live here.",
        status: "comingNext"
      },
      {
        id: "subscription",
        title: "Subscription",
        description: "Optional premium features without pressure.",
        status: "available",
        route: routes.settingsSubscription
      }
    ]
  },
  {
    id: "privacy",
    title: "Privacy",
    items: [
      {
        id: "privacyOverview",
        title: "Privacy Overview",
        description: "How personal reflections are handled in the product.",
        status: "available",
        route: routes.settingsPrivacy
      },
      {
        id: "dataControls",
        title: "Data Controls",
        description: "Review, export, or delete app history.",
        status: "available",
        route: routes.settingsDataControls
      },
      {
        id: "appLock",
        title: "App Lock",
        description: "Extra privacy options planned for later.",
        status: "available",
        route: routes.settingsAppLock
      }
    ]
  },
  {
    id: "preferences",
    title: "Preferences",
    items: [
      {
        id: "notifications",
        title: "Notifications",
        description: "Choose gentle reminders with discreet wording.",
        status: "available",
        route: routes.settingsNotifications
      },
      {
        id: "personalization",
        title: "Personalization",
        description: "Recommendation controls are represented in Data Controls.",
        status: "comingNext"
      }
    ]
  },
  {
    id: "support",
    title: "Support",
    items: [
      {
        id: "safetyNote",
        title: "Safety Note",
        description: "A plain-language support note will be added later.",
        status: "comingNext"
      },
      {
        id: "help",
        title: "Help",
        description: "Support contact and guidance are coming next.",
        status: "comingNext"
      }
    ]
  }
] as const;

export const privacyPrinciples: readonly PrivacyPrinciple[] = [
  {
    id: "skipQuestions",
    title: "You choose what to answer",
    body: "Sensitive questions can be skipped anytime.",
    accent: "sage"
  },
  {
    id: "savedData",
    title: "You control what is saved",
    body: "You can review and delete your history from Data Controls.",
    accent: "lavender"
  },
  {
    id: "patterns",
    title: "Patterns, not judgment",
    body: "The app uses small signals to support awareness, not to judge you.",
    accent: "sage"
  },
  {
    id: "wellnessSupport",
    title: "Support, not medical care",
    body: "This app is a wellness support tool. Care decisions belong with qualified professionals.",
    accent: "peach"
  }
] as const;

export const dataControlItems: readonly DataControlItem[] = [
  {
    id: "storedData",
    title: "What this app stores",
    body: "Check-ins, logs, pause sessions, exercise usage, protection preferences, and private notes may be used to personalize your experience.",
    caution: false,
    actionLabel: "Review stored data"
  },
  {
    id: "personalization",
    title: "Personalization controls",
    body: "Choose whether recent activity can be used to personalize Today recommendations and Progress insights.",
    caution: false
  },
  {
    id: "exportData",
    title: "Export my data",
    body: "Export is planned for a future version.",
    caution: false,
    statusLabel: "Coming next"
  },
  {
    id: "deleteSpecific",
    title: "Delete specific data",
    body: "Choose parts of your history to remove.",
    caution: false,
    statusLabel: "Coming next"
  },
  {
    id: "deleteAll",
    title: "Delete all local history",
    body: "This will be available before real persistence is enabled.",
    caution: true,
    actionLabel: "Preview delete flow"
  }
] as const;

export const notificationPreferences: readonly NotificationPreference[] = [
  {
    id: "eveningCheckIn",
    label: "Evening check-in",
    description: "A quiet reminder to reflect when the day is winding down.",
    defaultEnabled: true
  },
  {
    id: "sensitiveWindow",
    label: "Before sensitive window",
    description: "A neutral reminder before a planned support window.",
    defaultEnabled: true
  },
  {
    id: "practiceReminder",
    label: "Practice reminder",
    description: "A gentle nudge to use a pause or breathing exercise.",
    defaultEnabled: false
  },
  {
    id: "weeklyReview",
    label: "Weekly review",
    description: "A calm prompt to look back at recent patterns.",
    defaultEnabled: true
  },
  {
    id: "pauseAll",
    label: "Pause all reminders",
    description: "Turn off reminder previews in this local settings skeleton.",
    defaultEnabled: false
  }
] as const;

export const appLockOptions: readonly AppLockOption[] = [
  {
    id: "requireUnlock",
    label: "Require unlock when opening the app",
    description: "Planned for a future version.",
    enabled: false
  },
  {
    id: "hidePreviews",
    label: "Hide sensitive previews",
    description: "Preview content can be made more discreet later.",
    enabled: false
  },
  {
    id: "lockAfterInactivity",
    label: "Lock after inactivity",
    description: "A timed lock option can be added when app lock exists.",
    enabled: false
  }
] as const;

export const subscriptionSettingsContent: SubscriptionSettingsContent = {
  essentialTitle: "Essential support stays available",
  essentialBody:
    "Basic check-ins, pause tools, privacy overview, and deletion basics should remain available without premium.",
  premiumTitle: `${appConfig.APP_NAME} Plus / Premium later`,
  premiumBody:
    "Premium may include advanced insights, long-term trends, adaptive plans, custom routines, and expanded reports.",
  options: [
    {
      id: "viewPremium",
      label: "View premium options"
    },
    {
      id: "restorePurchases",
      label: "Restore purchases"
    }
  ]
} as const;
