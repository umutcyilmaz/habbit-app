import { storageClient } from "./storageClient";

const bloomStateStorageKey = "bloom.localState.v1";

export type PatternId = "pornLoop" | "pressurePattern" | "controlTiming";

export type RecommendedFirstAction =
  | "setupProtection"
  | "startReset"
  | "startArousalPractice";

export type QuizScores = {
  PL: number;
  PP: number;
  CT: number;
  FC: number;
};

export type NormalizedScores = QuizScores;

export type QuizFlags = {
  eveningWindow: boolean;
  emptyMoments: boolean;
  boredom: boolean;
  aloneTime: boolean;
  stressTrigger: boolean;
  phoneLoop: boolean;
  firmnessConcern: boolean;
};

export type QuizPlanStep = {
  title: string;
  description: string;
};

export type QuizResult = {
  scores: QuizScores;
  normalizedScores: NormalizedScores;
  primaryPattern: PatternId;
  secondaryPattern: PatternId | null;
  flags: QuizFlags;
  resultTitle: string;
  resultBody: string;
  planName: string;
  recommendedFirstAction: RecommendedFirstAction;
  firstPlanSteps: QuizPlanStep[];
  chips: string[];
  completedAt: string;
};

export type ActivePlan = {
  primaryPattern: PatternId;
  secondaryPattern: PatternId | null;
  planName: string;
  resultTitle: string;
  recommendedFirstAction: RecommendedFirstAction;
};

export type TenDayResetState = {
  startedAt: string | null;
  completedDates: string[];
  lastCompletedAt: string | null;
};

export type BloomDebugState = {
  dateOffsetDays: number;
};

export type ProtectionWindow = "evening" | "night" | "custom";

export type ProtectionState = {
  isEnabled: boolean;
  setupCompletedAt: string | null;
  preferredWindow: ProtectionWindow | null;
  adultContentPauseEnabled: boolean;
  lastProtectionPauseAt: string | null;
};

export type ArousalControlPracticeLog = {
  id: string;
  startedAt: string;
  completedAt: string;
  dateKey: string;
  highestArousal?: number;
  pauseCount?: number;
  controlFeeling?: number;
  anxietyLevel?: number;
  pleasureQuality?: string;
  pressureRushing?: string;
  firmnessChange?: string;
  afterwardFeeling?: string;
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

export type OnboardingState = {
  completed: boolean;
  quizAnswers: Record<string, unknown>;
  quizResult: QuizResult | null;
  completedAt: string | null;
};

export type BloomLocalState = {
  activePlan: ActivePlan;
  onboarding: OnboardingState;
  tenDayReset: TenDayResetState;
  debug: BloomDebugState;
  protection: ProtectionState;
  arousalControl: ArousalControlState;
};

export const defaultBloomLocalState: BloomLocalState = {
  activePlan: {
    primaryPattern: "pornLoop",
    secondaryPattern: "pressurePattern",
    planName: "Porn loop reset",
    resultTitle: "Porn loop + pressure pattern",
    recommendedFirstAction: "setupProtection"
  },
  onboarding: {
    completed: false,
    quizAnswers: {},
    quizResult: null,
    completedAt: null
  },
  tenDayReset: {
    startedAt: null,
    completedDates: [],
    lastCompletedAt: null
  },
  debug: {
    dateOffsetDays: 0
  },
  protection: {
    isEnabled: false,
    setupCompletedAt: null,
    preferredWindow: null,
    adultContentPauseEnabled: false,
    lastProtectionPauseAt: null
  },
  arousalControl: {
    draft: null,
    logs: []
  }
};

export function getTodayKey(dateOffsetDays = 0, date = new Date()) {
  const simulatedDate = new Date(date);
  simulatedDate.setDate(simulatedDate.getDate() + dateOffsetDays);

  return [
    simulatedDate.getFullYear(),
    String(simulatedDate.getMonth() + 1).padStart(2, "0"),
    String(simulatedDate.getDate()).padStart(2, "0")
  ].join("-");
}

export function getResetDay(resetState: TenDayResetState, todayKey = getTodayKey()) {
  if (resetState.startedAt === null) {
    return 1;
  }

  const startDate = dateFromKey(getDateKey(resetState.startedAt));
  const todayDate = dateFromKey(todayKey);
  const elapsedDays = Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000);

  return Math.min(Math.max(elapsedDays + 1, 1), 10);
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

export function saveOnboardingResultState(
  state: BloomLocalState,
  quizAnswers: Record<string, unknown>,
  quizResult: QuizResult
): BloomLocalState {
  return {
    ...state,
    activePlan: activePlanFromQuizResult(quizResult),
    onboarding: {
      completed: true,
      quizAnswers,
      quizResult,
      completedAt: quizResult.completedAt
    }
  };
}

export function saveOnboardingResultForFreshJourneyState(
  state: BloomLocalState,
  quizAnswers: Record<string, unknown>,
  quizResult: QuizResult
): BloomLocalState {
  const onboardingState = saveOnboardingResultState(state, quizAnswers, quizResult);

  return {
    ...onboardingState,
    tenDayReset: defaultBloomLocalState.tenDayReset,
    protection: defaultBloomLocalState.protection,
    arousalControl: {
      ...onboardingState.arousalControl,
      draft: null
    }
  };
}

export function clearOnboardingResultState(state: BloomLocalState): BloomLocalState {
  return {
    ...state,
    activePlan: defaultBloomLocalState.activePlan,
    onboarding: defaultBloomLocalState.onboarding
  };
}

export function enableProtectionState(
  state: BloomLocalState,
  preferredWindow: ProtectionWindow = "evening",
  enabledAt = new Date().toISOString()
): BloomLocalState {
  return {
    ...state,
    protection: {
      ...state.protection,
      isEnabled: true,
      setupCompletedAt: state.protection.setupCompletedAt ?? enabledAt,
      preferredWindow,
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

export function updateArousalControlDraftState(
  state: BloomLocalState,
  patch: Partial<ArousalControlDraft>,
  now = new Date()
): BloomLocalState {
  const currentDraft =
    state.arousalControl.draft ??
    ({
      id: createArousalControlId(now.toISOString()),
      startedAt: now.toISOString(),
      dateKey: getTodayKey(state.debug.dateOffsetDays, now)
    } satisfies ArousalControlDraft);

  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      draft: {
        ...currentDraft,
        ...patch,
        startedAt: patch.startedAt ?? currentDraft.startedAt,
        dateKey: patch.dateKey ?? currentDraft.dateKey
      }
    }
  };
}

export function completeArousalControlPracticeState(
  state: BloomLocalState,
  completedAt = new Date().toISOString()
): BloomLocalState {
  const draft = state.arousalControl.draft;

  if (draft === null) {
    return state;
  }

  const log = createArousalControlPracticeLogFromDraft(draft, completedAt);
  const logsById = new Map(state.arousalControl.logs.map((savedLog) => [savedLog.id, savedLog]));
  logsById.set(log.id, log);

  return {
    ...state,
    arousalControl: {
      draft: null,
      logs: sortArousalLogs(Array.from(logsById.values()))
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

export function getLatestArousalControlLog(logs: readonly ArousalControlPracticeLog[]) {
  return sortArousalLogs(logs)[0] ?? null;
}

export async function loadBloomLocalState() {
  const storedState = await storageClient.getItem<Partial<BloomLocalState>>(bloomStateStorageKey);

  if (!isRecord(storedState)) {
    return defaultBloomLocalState;
  }

  return mergeWithDefaultState(storedState);
}

export async function saveBloomLocalState(state: BloomLocalState) {
  await storageClient.setItem(bloomStateStorageKey, state);
}

function mergeWithDefaultState(state: Partial<BloomLocalState>): BloomLocalState {
  const tenDayReset = state.tenDayReset ?? defaultBloomLocalState.tenDayReset;
  const arousalControl = state.arousalControl ?? defaultBloomLocalState.arousalControl;
  const onboarding = state.onboarding ?? defaultBloomLocalState.onboarding;

  return {
    activePlan: {
      ...defaultBloomLocalState.activePlan,
      ...state.activePlan
    },
    onboarding: {
      ...defaultBloomLocalState.onboarding,
      ...onboarding,
      quizAnswers: onboarding.quizAnswers ?? {},
      quizResult: normalizeQuizResult(onboarding.quizResult ?? null)
    },
    tenDayReset: {
      ...defaultBloomLocalState.tenDayReset,
      ...tenDayReset,
      completedDates: Array.from(new Set(tenDayReset.completedDates ?? [])).sort()
    },
    debug: {
      ...defaultBloomLocalState.debug,
      ...state.debug
    },
    protection: {
      ...defaultBloomLocalState.protection,
      ...state.protection
    },
    arousalControl: {
      draft: arousalControl.draft ?? null,
      logs: sortArousalLogs(arousalControl.logs ?? [])
    }
  };
}

function activePlanFromQuizResult(quizResult: QuizResult): ActivePlan {
  return {
    primaryPattern: quizResult.primaryPattern,
    secondaryPattern: quizResult.secondaryPattern,
    planName: quizResult.planName,
    resultTitle: quizResult.resultTitle,
    recommendedFirstAction: quizResult.recommendedFirstAction
  };
}

function normalizeQuizResult(quizResult: QuizResult | null): QuizResult | null {
  if (quizResult === null) {
    return null;
  }

  const legacyScores = quizResult.scores as QuizScores & {
    pornLoop?: number;
    pressurePattern?: number;
    controlTiming?: number;
    firmnessConcern?: number;
  };
  const scores: QuizScores = {
    PL: legacyScores.PL ?? legacyScores.pornLoop ?? 0,
    PP: legacyScores.PP ?? legacyScores.pressurePattern ?? 0,
    CT: legacyScores.CT ?? legacyScores.controlTiming ?? 0,
    FC: legacyScores.FC ?? legacyScores.firmnessConcern ?? 0
  };
  const normalizedScores = quizResult.normalizedScores ?? {
    PL: 0,
    PP: 0,
    CT: 0,
    FC: 0
  };

  return {
    ...quizResult,
    scores,
    normalizedScores,
    flags: {
      eveningWindow: quizResult.flags.eveningWindow,
      emptyMoments: quizResult.flags.emptyMoments,
      boredom: quizResult.flags.boredom,
      aloneTime: quizResult.flags.aloneTime,
      stressTrigger: quizResult.flags.stressTrigger ?? false,
      phoneLoop: quizResult.flags.phoneLoop ?? false,
      firmnessConcern: quizResult.flags.firmnessConcern
    }
  };
}

function createArousalControlId(startedAt: string) {
  return `arousal-${startedAt.replace(/[^0-9A-Za-z]/g, "")}`;
}

function sortArousalLogs(logs: readonly ArousalControlPracticeLog[]) {
  return [...logs].sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt));
}

function dateFromKey(dateKey: string) {
  const [year = "0", month = "1", day = "1"] = dateKey.split("-");

  return new Date(Number(year), Number(month) - 1, Number(day));
}

function getDateKey(value: string) {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
