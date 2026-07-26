import type {
  DemoAppState,
  DemoCheckIn,
  DemoPauseSession,
  DemoProtectionStatus,
  DemoSupportLevel
} from "./demoTypes";
import { createDemoInitialState } from "./demoInitialState";

export type DemoAppAction =
  | {
      type: "ADD_CHECK_IN";
      payload: DemoCheckIn;
    }
  | {
      type: "ADD_PAUSE_SESSION";
      payload: DemoPauseSession;
    }
  | {
      type: "SET_PROTECTION_STATUS";
      payload: DemoProtectionStatus;
    }
  | {
      type: "SET_PROTECTION_LEVEL";
      payload: DemoSupportLevel;
    }
  | {
      type: "TOGGLE_PERSONALIZATION";
    }
  | {
      type: "TOGGLE_NOTIFICATION_PREFERENCE";
      payload: "notificationsPaused" | "useDiscreetNotifications";
    }
  | {
      type: "RESET_DEMO_STATE";
    };

export function demoAppStateReducer(state: DemoAppState, action: DemoAppAction): DemoAppState {
  switch (action.type) {
    case "ADD_CHECK_IN":
      return {
        ...state,
        checkIns: [action.payload, ...state.checkIns]
      };
    case "ADD_PAUSE_SESSION":
      return {
        ...state,
        pauseSessions: [action.payload, ...state.pauseSessions]
      };
    case "SET_PROTECTION_STATUS":
      return {
        ...state,
        protection: {
          ...state.protection,
          status: action.payload
        }
      };
    case "SET_PROTECTION_LEVEL":
      return {
        ...state,
        protection: {
          ...state.protection,
          level: action.payload
        }
      };
    case "TOGGLE_PERSONALIZATION":
      return {
        ...state,
        settings: {
          ...state.settings,
          personalizationEnabled: !state.settings.personalizationEnabled
        }
      };
    case "TOGGLE_NOTIFICATION_PREFERENCE":
      return {
        ...state,
        settings: {
          ...state.settings,
          [action.payload]: !state.settings[action.payload]
        }
      };
    case "RESET_DEMO_STATE":
      return createDemoInitialState();
    default:
      return state;
  }
}
