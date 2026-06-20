import type { DemoAppState } from "./demoTypes";

const sensitiveWindow = {
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
  checkIns: [
    {
      id: "initial-check-in-1",
      createdAt: "2026-06-18T19:30:00.000Z",
      mood: "bored",
      moment: "evening"
    },
    {
      id: "initial-check-in-2",
      createdAt: "2026-06-19T21:10:00.000Z",
      mood: "restless",
      moment: "boredom"
    }
  ],
  pauseSessions: [
    {
      id: "initial-pause-1",
      completedAt: "2026-06-19T21:12:00.000Z",
      durationSeconds: 90,
      nextChoice: "Reflect"
    }
  ],
  protection: {
    status: "suggested",
    level: "balanced",
    sensitiveWindow
  },
  settings: {
    personalizationEnabled: true,
    notificationsPaused: false,
    useDiscreetNotifications: true
  }
};
