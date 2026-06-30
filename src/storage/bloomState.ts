import { storageClient } from "./storageClient";

const bloomStateStorageKey = "bloom.localState.v1";

export type ActivePlan = {
  primaryPattern: "pornLoop";
  secondaryPattern: "pressurePattern";
  planName: "Porn loop reset";
};

export type TenDayResetState = {
  startedAt: string | null;
  completedDates: string[];
  lastCompletedAt: string | null;
};

export type BloomDebugState = {
  dateOffsetDays: number;
};

export type BloomLocalState = {
  activePlan: ActivePlan;
  tenDayReset: TenDayResetState;
  debug: BloomDebugState;
};

export const defaultBloomLocalState: BloomLocalState = {
  activePlan: {
    primaryPattern: "pornLoop",
    secondaryPattern: "pressurePattern",
    planName: "Porn loop reset"
  },
  tenDayReset: {
    startedAt: null,
    completedDates: [],
    lastCompletedAt: null
  },
  debug: {
    dateOffsetDays: 0
  }
};

export function getTodayKey(dateOffsetDays = 0, date = new Date()) {
  const simulatedDate = new Date(date);
  simulatedDate.setDate(simulatedDate.getDate() + dateOffsetDays);
  const year = simulatedDate.getFullYear();
  const month = String(simulatedDate.getMonth() + 1).padStart(2, "0");
  const day = String(simulatedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getResetDay(resetState: TenDayResetState, todayKey = getTodayKey()) {
  if (resetState.startedAt === null) {
    return 1;
  }

  const startDate = dateFromKey(getDateKey(resetState.startedAt));
  const todayDate = dateFromKey(todayKey);
  const elapsedDays = Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000);

  return clampDay(elapsedDays + 1);
}

export function getCompletedResetDayCount(resetState: TenDayResetState) {
  return Math.min(new Set(resetState.completedDates).size, 10);
}

export function isTodayCompleted(resetState: TenDayResetState, todayKey = getTodayKey()) {
  return resetState.completedDates.includes(todayKey);
}

export function startTenDayResetState(
  state: BloomLocalState,
  todayKey = getTodayKey(state.debug.dateOffsetDays)
): BloomLocalState {
  if (state.tenDayReset.startedAt !== null) {
    return state;
  }

  return {
    ...state,
    tenDayReset: {
      ...state.tenDayReset,
      startedAt: todayKey
    }
  };
}

export function completeTodayResetState(
  state: BloomLocalState,
  todayKey = getTodayKey(state.debug.dateOffsetDays),
  completedAt = new Date().toISOString()
): BloomLocalState {
  const resetStartedState = startTenDayResetState(state, todayKey);
  const completedDateSet = new Set(resetStartedState.tenDayReset.completedDates);
  completedDateSet.add(todayKey);

  return {
    ...resetStartedState,
    tenDayReset: {
      ...resetStartedState.tenDayReset,
      completedDates: Array.from(completedDateSet).sort(),
      lastCompletedAt: completedAt
    }
  };
}

export async function loadBloomLocalState() {
  try {
    const storedState = await storageClient.getItem<unknown>(bloomStateStorageKey);

    if (!isBloomLocalState(storedState)) {
      return defaultBloomLocalState;
    }

    return mergeWithDefaultState(storedState);
  } catch (error) {
    console.warn("Failed to load Bloom local state.", error);
    return defaultBloomLocalState;
  }
}

export async function saveBloomLocalState(state: BloomLocalState) {
  await storageClient.setItem(bloomStateStorageKey, state);
}

function mergeWithDefaultState(state: BloomLocalState): BloomLocalState {
  return {
    activePlan: {
      ...defaultBloomLocalState.activePlan,
      ...state.activePlan
    },
    tenDayReset: {
      ...defaultBloomLocalState.tenDayReset,
      ...state.tenDayReset,
      completedDates: Array.from(new Set(state.tenDayReset.completedDates)).sort()
    },
    debug: {
      ...defaultBloomLocalState.debug,
      ...state.debug
    }
  };
}

function isBloomLocalState(value: unknown): value is BloomLocalState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isActivePlan(value.activePlan) &&
    isTenDayResetState(value.tenDayReset) &&
    (value.debug === undefined || isBloomDebugState(value.debug))
  );
}

function isActivePlan(value: unknown): value is ActivePlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.primaryPattern === "pornLoop" &&
    value.secondaryPattern === "pressurePattern" &&
    value.planName === "Porn loop reset"
  );
}

function isTenDayResetState(value: unknown): value is TenDayResetState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (typeof value.startedAt === "string" || value.startedAt === null) &&
    Array.isArray(value.completedDates) &&
    value.completedDates.every((date) => typeof date === "string") &&
    (typeof value.lastCompletedAt === "string" || value.lastCompletedAt === null)
  );
}

function isBloomDebugState(value: unknown): value is BloomDebugState {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.dateOffsetDays === "number" && Number.isFinite(value.dateOffsetDays);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function dateFromKey(dateKey: string) {
  const [year = "0", month = "1", day = "1"] = dateKey.split("-");

  return new Date(Number(year), Number(month) - 1, Number(day));
}

function getDateKey(value: string) {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function clampDay(day: number) {
  return Math.min(Math.max(day, 1), 10);
}
