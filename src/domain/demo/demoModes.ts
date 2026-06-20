export type DemoMode =
  | "normal"
  | "firstUse"
  | "lowData"
  | "protectionActive"
  | "protectionPaused"
  | "protectionOff"
  | "offlinePreview";

export const demoModes: readonly DemoMode[] = [
  "normal",
  "firstUse",
  "lowData",
  "protectionActive",
  "protectionPaused",
  "protectionOff",
  "offlinePreview"
] as const;
