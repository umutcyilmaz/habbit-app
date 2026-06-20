import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { DemoAppStateProvider } from "./DemoAppStateProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <DemoAppStateProvider>
        <StatusBar style="dark" />
        {children}
      </DemoAppStateProvider>
    </SafeAreaProvider>
  );
}
