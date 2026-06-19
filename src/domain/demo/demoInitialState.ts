import type { DemoAppState } from "./demoTypes";

const suggestedSensitiveWindow = {
  label: "Evening support",
  startTime: "22:00",
  endTime: "00:00"
} as const;

export const demoInitialState: DemoAppState = {
  user: {
    name: "Mert",
    currentWeek: 1,
    currentDay: 3
  },
  onboarding: {
    selectedGoals: ["Build awareness", "Add a pause", "Notice evening patterns"],
    supportStyle: "balanced",
    suggestedSensitiveWindow
  },
  checkIns: [
    {
      id: "demo-check-in-1",
      createdAt: "2026-06-17T19:30:00.000Z",
      mood: "bored",
      momentTag: "evening",
      intention: "pause"
    },
    {
      id: "demo-check-in-2",
      createdAt: "2026-06-18T21:10:00.000Z",
      mood: "restless",
      momentTag: "boredom",
      intention: "reflect"
    }
  ],
  pauseSessions: [
    {
      id: "demo-pause-1",
      completedAt: "2026-06-18T21:12:00.000Z",
      durationSeconds: 90,
      choice: "reflect"
    }
  ],
  logs: [
    {
      id: "demo-log-1",
      loggedAt: "2026-06-18T21:20:00.000Z",
      title: "Evening reflection",
      body: "A short demo note about noticing the evening moment.",
      tags: ["evening", "boredom"]
    }
  ],
  exercises: [
    {
      exerciseId: "ninety-second-pause",
      title: "90-Second Pause",
      completedCount: 1
    },
    {
      exerciseId: "breathing-reset",
      title: "Breathing Reset",
      completedCount: 0
    }
  ],
  protection: {
    status: "suggested",
    sensitiveWindow: suggestedSensitiveWindow,
    level: "balanced"
  },
  settings: {
    personalizationEnabled: true,
    notificationsPaused: false,
    useDiscreetNotifications: true
  }
};
