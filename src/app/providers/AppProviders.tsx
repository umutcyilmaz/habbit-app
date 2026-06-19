import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {children}
    </SafeAreaProvider>
  );
}
