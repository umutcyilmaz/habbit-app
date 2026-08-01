declare const __DEV__: boolean;

type E2EModeEnvironment = {
  isDevelopment: boolean;
  environmentValue: string | undefined;
};

type BloomTimerDurations = {
  pauseRoundSeconds: number;
  resetSeconds: number;
  arousalPauseSeconds: number;
};

export const productionTimerDurations: BloomTimerDurations = {
  pauseRoundSeconds: 90,
  resetSeconds: 120,
  arousalPauseSeconds: 30
};

export const e2eTimerDurations: BloomTimerDurations = {
  pauseRoundSeconds: 3,
  resetSeconds: 3,
  arousalPauseSeconds: 3
};

export function resolveE2EMode({
  isDevelopment,
  environmentValue
}: E2EModeEnvironment) {
  return isDevelopment && environmentValue === "1";
}

export function resolveBloomTimerDurations(
  environment: E2EModeEnvironment
): BloomTimerDurations {
  return resolveE2EMode(environment)
    ? e2eTimerDurations
    : productionTimerDurations;
}

const isDevelopmentRuntime =
  typeof __DEV__ !== "undefined" && __DEV__;

export const isE2EMode = resolveE2EMode({
  isDevelopment: isDevelopmentRuntime,
  environmentValue: process.env.EXPO_PUBLIC_E2E_MODE
});

const timerDurations = resolveBloomTimerDurations({
  isDevelopment: isDevelopmentRuntime,
  environmentValue: process.env.EXPO_PUBLIC_E2E_MODE
});

export const pauseRoundDurationSeconds =
  timerDurations.pauseRoundSeconds;
export const resetDurationSeconds = timerDurations.resetSeconds;
export const arousalPauseDurationSeconds =
  timerDurations.arousalPauseSeconds;
