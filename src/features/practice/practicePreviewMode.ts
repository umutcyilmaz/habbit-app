import Constants from "expo-constants";
import { isE2EMode } from "../../shared/runtime/e2eMode";
export function resolvePracticePreviewEnabled(development:boolean,e2e:boolean,bundle:string|undefined,flag:string|undefined) {
  return development && e2e && bundle==="com.umutcyilmaz.bloom.e2e" && flag==="1";
}
export const practicePreviewEnabled=resolvePracticePreviewEnabled(typeof __DEV__!=="undefined"&&__DEV__,isE2EMode,Constants.expoConfig?.ios?.bundleIdentifier,process.env.EXPO_PUBLIC_PRACTICE_PREVIEW);
