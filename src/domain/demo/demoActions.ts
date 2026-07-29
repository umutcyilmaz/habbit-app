import type { DemoAppState } from "./demoTypes";
import { createDemoInitialState } from "./demoInitialState";

export type DemoAppAction =
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
