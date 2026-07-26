import type { DemoAppState } from "./demoTypes";

const sensitiveWindow = {
  label: "Evening support",
  startTime: "22:00",
  endTime: "08:00"
} as const;

export function createDemoInitialState(): DemoAppState {
  return {
    user: {
      name: "Mert",
      currentWeek: 1,
      currentDay: 3
    },
    checkIns: [],
    pauseSessions: [],
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
}

export const demoInitialState: DemoAppState = createDemoInitialState();
