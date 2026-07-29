import type { DemoAppState } from "./demoTypes";

export function createDemoInitialState(): DemoAppState {
  return {
    settings: {
      personalizationEnabled: true,
      notificationsPaused: false,
      useDiscreetNotifications: true
    }
  };
}

export const demoInitialState: DemoAppState = createDemoInitialState();
