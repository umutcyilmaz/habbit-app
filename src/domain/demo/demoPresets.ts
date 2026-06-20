import type { DemoMode } from "./demoModes";
import type { DemoAppState, DemoCheckIn, DemoPauseSession } from "./demoTypes";

const sensitiveWindow = {
  label: "Evening support",
  startTime: "22:00",
  endTime: "00:00"
} as const;

const normalCheckIns: readonly DemoCheckIn[] = [
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
] as const;

const normalPauseSessions: readonly DemoPauseSession[] = [
  {
    id: "initial-pause-1",
    completedAt: "2026-06-19T21:12:00.000Z",
    durationSeconds: 90,
    nextChoice: "Reflect"
  }
] as const;

function createBaseState(demoMode: DemoMode): DemoAppState {
  return {
    demoMode,
    isOfflinePreview: false,
    user: {
      name: "Mert",
      currentWeek: 1,
      currentDay: 3
    },
    checkIns: normalCheckIns,
    pauseSessions: normalPauseSessions,
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

export function createDemoStateForMode(demoMode: DemoMode): DemoAppState {
  const baseState = createBaseState(demoMode);

  switch (demoMode) {
    case "firstUse":
      return {
        ...baseState,
        user: {
          ...baseState.user,
          currentDay: 1
        },
        checkIns: [],
        pauseSessions: [],
        protection: {
          ...baseState.protection,
          status: "suggested"
        }
      };
    case "lowData":
      return {
        ...baseState,
        checkIns: normalCheckIns.slice(0, 1),
        pauseSessions: [],
        protection: {
          ...baseState.protection,
          status: "suggested"
        }
      };
    case "protectionActive":
      return {
        ...baseState,
        protection: {
          ...baseState.protection,
          status: "active"
        }
      };
    case "protectionPaused":
      return {
        ...baseState,
        protection: {
          ...baseState.protection,
          status: "paused"
        }
      };
    case "protectionOff":
      return {
        ...baseState,
        protection: {
          ...baseState.protection,
          status: "off"
        }
      };
    case "offlinePreview":
      return {
        ...baseState,
        isOfflinePreview: true
      };
    case "normal":
    default:
      return baseState;
  }
}

export const normalDemoState = () => createDemoStateForMode("normal");
