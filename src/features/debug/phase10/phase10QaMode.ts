import Constants from "expo-constants";
import { isE2EMode } from "../../../shared/runtime/e2eMode";

export function resolvePhase10QaEnabled(isDevelopment: boolean, e2e: boolean, flag: string | undefined, bundleIdentifier: string | undefined) {
  return isDevelopment && e2e && flag === "1" && bundleIdentifier === "com.umutcyilmaz.bloom.e2e";
}

export const phase10QaEnabled = resolvePhase10QaEnabled(
  typeof __DEV__ !== "undefined" && __DEV__, isE2EMode,
  process.env.EXPO_PUBLIC_PHASE10_QA,
  Constants.expoConfig?.ios?.bundleIdentifier
);
