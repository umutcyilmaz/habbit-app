import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { usePathname } from "expo-router";

import { BloomHydrationBoundary } from "./BloomHydrationBoundary";
import { BloomLocalStateProvider, type BloomLocalStateRuntime } from "./BloomLocalStateProvider";
import { DemoAppStateProvider } from "./DemoAppStateProvider";
import { phase10QaEnabled } from "../../features/debug/phase10/phase10QaMode";
import { Phase10QaProvider, usePhase10QaSession } from "../../features/debug/phase10/Phase10QaProvider";
import { LocalDataLifecycleProvider } from "./LocalDataLifecycleProvider";
import { kegelPreviewEnabled } from "../../features/kegel/kegelPreviewMode";
import { kegelPreviewRuntime } from "../../features/kegel/kegelPreviewRuntime";
import { kegelPersistenceQaEnabled, kegelPersistenceQaRuntime } from "../../features/kegel/kegelPersistenceQa";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      {kegelPersistenceQaEnabled ? <LocalProviders runtime={kegelPersistenceQaRuntime}>{children}</LocalProviders> : kegelPreviewEnabled ? <LocalProviders runtime={kegelPreviewRuntime}>{children}</LocalProviders> : phase10QaEnabled ? <Phase10QaProvider>
        <LocalProviders>{children}</LocalProviders>
      </Phase10QaProvider> : <LocalProviders>{children}</LocalProviders>}
    </SafeAreaProvider>
  );
}

function LocalProviders({ children, runtime }: PropsWithChildren<{runtime?:BloomLocalStateRuntime}>) {
  const qa = usePhase10QaSession();
  return (
    <BloomLocalStateProvider {...(runtime ? {runtime} : qa ? { runtime: qa.runtime } : {})}>
      <DemoAppStateProvider>
        <LocalDataLifecycleProvider>
          <StatusBar style="dark" />
          <BloomHydrationBoundary keepChildrenMountedDuringLoading={qa !== null}>
            <RouteStatusBar />
            {children}
          </BloomHydrationBoundary>
        </LocalDataLifecycleProvider>
      </DemoAppStateProvider>
    </BloomLocalStateProvider>
  );
}

// The boundary uses the light legacy canvas; its fallback retains the dark
// status bar above. Product routes use the dark V4 canvas once mounted.
function RouteStatusBar() {
  const pathname = usePathname();
  const darkCanvas = pathname === "/" || pathname === "/today" ||
    pathname.startsWith("/bloom/") || pathname.startsWith("/settings") || pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") || pathname === "/debug/phase10";
  return <StatusBar style={darkCanvas ? "light" : "dark"} />;
}
