import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { BloomLocalStateProvider } from "./BloomLocalStateProvider";
import { DemoAppStateProvider } from "./DemoAppStateProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <BloomLocalStateProvider>
        <DemoAppStateProvider>
          <StatusBar style="dark" />
          {children}
        </DemoAppStateProvider>
      </BloomLocalStateProvider>
    </SafeAreaProvider>
  );
}
