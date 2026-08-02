import { Redirect } from "expo-router";

import { BloomStateDebugScreen } from "../../src/features/debug/screens/BloomStateDebugScreen";
import { debugToolsEnabled } from "../../src/shared/runtime/debugTools";

export default function BloomStateDebugRoute() {
  if (!debugToolsEnabled) {
    return <Redirect href="/" />;
  }

  return <BloomStateDebugScreen />;
}
