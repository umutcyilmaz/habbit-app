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

export type ArousalControlMode = "softAwareness" | "onePausePractice" | "practicePlus";

export type ArousalControlPracticeLog = {
  id: string;
  startedAt: string;
  completedAt: string;
  dateKey: string;
  mode?: ArousalControlMode;
  focusIntention?: string;
  adultContentContext?: "no" | "yes" | "notSure";
  firmnessDecreasePreference?: string;
  highestArousal?: number;
  pauseCount?: number;
  afterPauseArousal?: number;
  anxietyLevel?: number;
  afterPauseNextStep?: string;
  finishOutcome?: string;
  controlFeeling?: number;
  pleasureQuality?: string;
  pressureRushing?: string;
  afterwardFeeling?: string;
  firmnessChange?: string;
  durationPreference?: "notLogged" | "estimated" | "exact";
  durationSeconds?: number | null;
};

export type ArousalControlDraft = Partial<ArousalControlPracticeLog> & {
  startedAt: string;
  dateKey: string;
};

export type ArousalControlState = {
  draft: ArousalControlDraft | null;
  logs: ArousalControlPracticeLog[];
};

export type ProtectionWindow = "evening" | "night" | "custom";

export type ProtectionState = {
  isEnabled: boolean;
  setupCompletedAt: string | null;
  preferredWindow: ProtectionWindow | null;
  adultContentPauseEnabled: boolean;
  lastProtectionPauseAt: string | null;
};

export type BloomLocalState = {
  activePlan: ActivePlan;
  tenDayReset: TenDayResetState;
  debug: BloomDebugState;
  arousalControl: ArousalControlState;
  protection: ProtectionState;
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
  },
  arousalControl: {
    draft: null,
    logs: []
  },
  protection: {
    isEnabled: false,
    setupCompletedAt: null,
    preferredWindow: null,
    adultContentPauseEnabled: false,
    lastProtectionPauseAt: null
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

export function startArousalControlDraftState(
  state: BloomLocalState,
  initial: Partial<ArousalControlDraft> = {},
  now = new Date()
): BloomLocalState {
  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      draft: createArousalControlDraft(state, initial, now)
    }
  };
}

export function updateArousalControlDraftState(
  state: BloomLocalState,
  patch: Partial<ArousalControlDraft>,
  now = new Date()
): BloomLocalState {
  const currentDraft = state.arousalControl.draft ?? createArousalControlDraft(state, {}, now);
  const nextDraft = {
    ...currentDraft,
    ...patch,
    startedAt: patch.startedAt ?? currentDraft.startedAt,
    dateKey: patch.dateKey ?? currentDraft.dateKey
  };

  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      draft: nextDraft
    }
  };
}

export function incrementArousalControlPauseCountState(
  state: BloomLocalState,
  now = new Date()
): BloomLocalState {
  const currentDraft = state.arousalControl.draft ?? createArousalControlDraft(state, {}, now);

  return updateArousalControlDraftState(
    state,
    {
      pauseCount: (currentDraft.pauseCount ?? 0) + 1
    },
    now
  );
}

export function completeArousalControlPracticeState(
  state: BloomLocalState,
  completedAt = new Date().toISOString()
): BloomLocalState {
  const draft = state.arousalControl.draft;

  if (draft === null) {
    return state;
  }

  const completedLog = createArousalControlPracticeLogFromDraft(draft, completedAt);
  const existingLogIndex = state.arousalControl.logs.findIndex((log) => log.id === completedLog.id);
  const logs =
    existingLogIndex === -1
      ? [...state.arousalControl.logs, completedLog]
      : state.arousalControl.logs.map((log, index) =>
          index === existingLogIndex ? { ...log, ...completedLog } : log
        );

  return {
    ...state,
    arousalControl: {
      draft: null,
      logs: sortArousalControlLogs(dedupeArousalControlLogs(logs))
    }
  };
}

export function createArousalControlPracticeLogFromDraft(
  draft: ArousalControlDraft,
  completedAt = new Date().toISOString()
): ArousalControlPracticeLog {
  const id = draft.id ?? createArousalControlId(draft.startedAt);

  return {
    ...draft,
    id,
    startedAt: draft.startedAt,
    completedAt,
    dateKey: draft.dateKey
  };
}

export function clearArousalControlLogsState(state: BloomLocalState): BloomLocalState {
  return {
    ...state,
    arousalControl: defaultBloomLocalState.arousalControl
  };
}

export function getLatestArousalControlLog(
  logs: readonly ArousalControlPracticeLog[]
): ArousalControlPracticeLog | null {
  return sortArousalControlLogs(logs)[0] ?? null;
}

export function enableProtectionState(
  state: BloomLocalState,
  options: {
    preferredWindow?: ProtectionWindow;
  } = {},
  enabledAt = new Date().toISOString()
): BloomLocalState {
  return {
    ...state,
    protection: {
      ...state.protection,
      isEnabled: true,
      setupCompletedAt: state.protection.setupCompletedAt ?? enabledAt,
      preferredWindow: options.preferredWindow ?? state.protection.preferredWindow ?? "evening",
      adultContentPauseEnabled: true
    }
  };
}

export function disableProtectionState(state: BloomLocalState): BloomLocalState {
  return {
    ...state,
    protection: {
      ...state.protection,
      isEnabled: false
    }
  };
}

export function updateProtectionWindowState(
  state: BloomLocalState,
  preferredWindow: ProtectionWindow
): BloomLocalState {
  return {
    ...state,
    protection: {
      ...state.protection,
      preferredWindow
    }
  };
}

export function recordProtectionPauseState(
  state: BloomLocalState,
  pausedAt = new Date().toISOString()
): BloomLocalState {
  return {
    ...state,
    protection: {
      ...state.protection,
      lastProtectionPauseAt: pausedAt
    }
  };
}

export function clearProtectionState(state: BloomLocalState): BloomLocalState {
  return {
    ...state,
    protection: defaultBloomLocalState.protection
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

type PersistedBloomLocalState = Omit<BloomLocalState, "debug" | "arousalControl" | "protection"> & {
  debug?: BloomDebugState;
  arousalControl?: ArousalControlState;
  protection?: ProtectionState;
};

function mergeWithDefaultState(state: PersistedBloomLocalState): BloomLocalState {
  const arousalControl = state.arousalControl ?? defaultBloomLocalState.arousalControl;
  const protection = state.protection ?? defaultBloomLocalState.protection;

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
    },
    arousalControl: {
      draft: arousalControl.draft,
      logs: sortArousalControlLogs(dedupeArousalControlLogs(arousalControl.logs))
    },
    protection: {
      ...defaultBloomLocalState.protection,
      ...protection
    }
  };
}

function isBloomLocalState(value: unknown): value is PersistedBloomLocalState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isActivePlan(value.activePlan) &&
    isTenDayResetState(value.tenDayReset) &&
    (value.debug === undefined || isBloomDebugState(value.debug)) &&
    (value.arousalControl === undefined || isArousalControlState(value.arousalControl)) &&
    (value.protection === undefined || isProtectionState(value.protection))
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

function isArousalControlState(value: unknown): value is ArousalControlState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.draft === null || isArousalControlDraft(value.draft)) &&
    Array.isArray(value.logs) &&
    value.logs.every(isArousalControlPracticeLog)
  );
}

function isArousalControlDraft(value: unknown): value is ArousalControlDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.startedAt === "string" &&
    typeof value.dateKey === "string" &&
    (value.id === undefined || typeof value.id === "string")
  );
}

function isArousalControlPracticeLog(value: unknown): value is ArousalControlPracticeLog {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.dateKey === "string"
  );
}

function isProtectionState(value: unknown): value is ProtectionState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.isEnabled === "boolean" &&
    (typeof value.setupCompletedAt === "string" || value.setupCompletedAt === null) &&
    (isProtectionWindow(value.preferredWindow) || value.preferredWindow === null) &&
    typeof value.adultContentPauseEnabled === "boolean" &&
    (typeof value.lastProtectionPauseAt === "string" || value.lastProtectionPauseAt === null)
  );
}

function isProtectionWindow(value: unknown): value is ProtectionWindow {
  return value === "evening" || value === "night" || value === "custom";
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

function createArousalControlDraft(
  state: BloomLocalState,
  initial: Partial<ArousalControlDraft>,
  now: Date
): ArousalControlDraft {
  const startedAt = initial.startedAt ?? now.toISOString();

  return {
    ...initial,
    id: initial.id ?? createArousalControlId(startedAt),
    startedAt,
    dateKey: initial.dateKey ?? getTodayKey(state.debug.dateOffsetDays, now)
  };
}

function createArousalControlId(startedAt: string) {
  return `arousal-${startedAt.replace(/[^0-9A-Za-z]/g, "")}`;
}

function dedupeArousalControlLogs(logs: readonly ArousalControlPracticeLog[]) {
  const logsById = new Map<string, ArousalControlPracticeLog>();

  logs.forEach((log) => {
    logsById.set(log.id, log);
  });

  return Array.from(logsById.values());
}

function sortArousalControlLogs(logs: readonly ArousalControlPracticeLog[]) {
  return [...logs].sort((first, second) => {
    const firstTime = Date.parse(first.completedAt);
    const secondTime = Date.parse(second.completedAt);

    return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
  });
}
