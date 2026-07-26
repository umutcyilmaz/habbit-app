import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { BloomHydrationBoundary } from "./BloomHydrationBoundary";
import { BloomLocalStateProvider } from "./BloomLocalStateProvider";
import { DemoAppStateProvider } from "./DemoAppStateProvider";
import { LocalDataLifecycleProvider } from "./LocalDataLifecycleProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <BloomLocalStateProvider>
        <DemoAppStateProvider>
          <LocalDataLifecycleProvider>
            <StatusBar style="dark" />
            <BloomHydrationBoundary>{children}</BloomHydrationBoundary>
          </LocalDataLifecycleProvider>
        </DemoAppStateProvider>
      </BloomLocalStateProvider>
    </SafeAreaProvider>
  );
}
