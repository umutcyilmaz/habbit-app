import Constants from "expo-constants";
import { isE2EMode } from "../../shared/runtime/e2eMode";

export function resolveKegelPreviewEnabled(development: boolean, e2e: boolean, bundleIdentifier: string | undefined, flag: string | undefined) {
  return development && e2e && bundleIdentifier === "com.umutcyilmaz.bloom.e2e" && flag === "1";
}

export const kegelPreviewEnabled = resolveKegelPreviewEnabled(
  typeof __DEV__ !== "undefined" && __DEV__, isE2EMode, Constants.expoConfig?.ios?.bundleIdentifier, process.env.EXPO_PUBLIC_KEGEL_PREVIEW
);
