declare const __DEV__: boolean;

export function resolveDebugToolsEnabled(isDevelopment: boolean): boolean {
  return isDevelopment === true;
}

export const debugToolsEnabled = resolveDebugToolsEnabled(
  typeof __DEV__ !== "undefined" && __DEV__
);
