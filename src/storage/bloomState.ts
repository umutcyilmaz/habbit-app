import {
  isValidBloomDateKey,
  isValidBloomIsoTimestamp,
  isValidBloomTime
} from "./bloomValueValidation";

export type ScoredPatternId = "pornLoop" | "pressurePattern" | "controlTiming";

export type PatternId = ScoredPatternId | "generalStartingPoint";

export type RecommendedFirstAction =
  | "setupProtection"
  | "startReset"
  | "startArousalPractice"
  | "startQuickCheckIn";

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
  secondaryPattern: ScoredPatternId | null;
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
  secondaryPattern: ScoredPatternId | null;
  planName: string;
  resultTitle: string;
  recommendedFirstAction: RecommendedFirstAction;
};

export type TenDayResetState = {
  startedAt: string | null;
  completedDates: string[];
  lastCompletedAt: string | null;
};

export const MAX_RESET_DAYS = 10;

export type BloomDebugState = {
  dateOffsetDays: number;
};

export type ProtectionStatus = "off" | "active" | "paused";

export type ProtectionLevel = "gentle" | "balanced" | "strong";

export type ProtectionWindow = "evening" | "night" | "custom" | "alwaysOn";

export type ProtectionState = {
  status: ProtectionStatus;
  setupCompletedAt: string | null;
  preferredWindow: ProtectionWindow | null;
  level: ProtectionLevel | null;
  adultContentPauseEnabled: boolean;
  nightStartTime: string | null;
  nightEndTime: string | null;
  lastProtectionPauseAt: string | null;
};

export type ProtectionConfiguration = {
  preferredWindow: ProtectionWindow;
  level: ProtectionLevel;
  adultContentPauseEnabled: boolean;
  nightStartTime: string | null;
  nightEndTime: string | null;
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

export function createDefaultBloomState(): BloomLocalState {
  return {
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
      status: "off",
      setupCompletedAt: null,
      preferredWindow: null,
      level: null,
      adultContentPauseEnabled: false,
      nightStartTime: null,
      nightEndTime: null,
      lastProtectionPauseAt: null
    },
    arousalControl: {
      draft: null,
      logs: []
    }
  };
}

export const defaultBloomLocalState: BloomLocalState = createDefaultBloomState();

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
  if (!isResetStarted(resetState)) {
    return 1;
  }

  const completedDates = getCompletedResetDates(resetState);

  if (completedDates.length >= MAX_RESET_DAYS) {
    return MAX_RESET_DAYS;
  }

  if (isValidBloomDateKey(todayKey) && completedDates.includes(todayKey)) {
    return Math.max(1, completedDates.length);
  }

  return Math.min(completedDates.length + 1, MAX_RESET_DAYS);
}

export function getCompletedResetDayCount(resetState: TenDayResetState) {
  return getCompletedResetDates(resetState).length;
}

export function isTodayCompleted(resetState: TenDayResetState, todayKey = getTodayKey()) {
  return (
    isValidBloomDateKey(todayKey) &&
    getCompletedResetDates(resetState).includes(todayKey)
  );
}

export function getCompletedResetDates(
  resetState: Pick<TenDayResetState, "completedDates">
): string[] {
  if (!Array.isArray(resetState.completedDates)) {
    return [];
  }

  return Array.from(
    new Set(resetState.completedDates.filter(isValidBloomDateKey))
  )
    .sort()
    .slice(0, MAX_RESET_DAYS);
}

export function getResetStartedDateKey(
  resetState: Pick<TenDayResetState, "startedAt">
): string | null {
  const { startedAt } = resetState;

  if (typeof startedAt !== "string") {
    return null;
  }

  if (isValidBloomDateKey(String(startedAt))) {
    return startedAt;
  }

  if (isValidBloomIsoTimestamp(String(startedAt))) {
    return startedAt.slice(0, 10);
  }

  return null;
}

export function isResetStarted(
  resetState: Pick<TenDayResetState, "startedAt">
): boolean {
  return getResetStartedDateKey(resetState) !== null;
}

export function isResetProgramComplete(
  resetState: Pick<TenDayResetState, "startedAt" | "completedDates">
): boolean {
  return (
    isResetStarted(resetState) &&
    getCompletedResetDates(resetState).length === MAX_RESET_DAYS
  );
}

export function startTenDayResetState(
  state: BloomLocalState,
  todayKey = getTodayKey(state.debug.dateOffsetDays)
): BloomLocalState {
  if (
    isResetStarted(state.tenDayReset) ||
    !isValidBloomDateKey(todayKey)
  ) {
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
  if (
    !isValidBloomDateKey(todayKey) ||
    !isValidBloomIsoTimestamp(completedAt)
  ) {
    return state;
  }

  const resetStartedState = startTenDayResetState(state, todayKey);
  const completedDates = getCompletedResetDates(
    resetStartedState.tenDayReset
  );

  if (
    !isResetStarted(resetStartedState.tenDayReset) ||
    completedDates.length >= MAX_RESET_DAYS ||
    completedDates.includes(todayKey)
  ) {
    return state;
  }

  const nextCompletedDates = [...completedDates, todayKey].sort();

  return {
    ...resetStartedState,
    tenDayReset: {
      ...resetStartedState.tenDayReset,
      completedDates: nextCompletedDates,
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

export function configureProtectionState(
  state: BloomLocalState,
  configuration: ProtectionConfiguration,
  configuredAt = new Date().toISOString()
): BloomLocalState {
  if (
    !isValidBloomIsoTimestamp(configuredAt) ||
    !isProtectionWindow(configuration.preferredWindow) ||
    !isProtectionLevel(configuration.level) ||
    typeof configuration.adultContentPauseEnabled !== "boolean" ||
    (configuration.nightStartTime !== null &&
      !isValidBloomTime(configuration.nightStartTime)) ||
    (configuration.nightEndTime !== null &&
      !isValidBloomTime(configuration.nightEndTime)) ||
    (configuration.preferredWindow === "night" &&
      (configuration.nightStartTime === null ||
        configuration.nightEndTime === null))
  ) {
    return state;
  }

  return {
    ...state,
    protection: {
      ...state.protection,
      ...configuration,
      status:
        state.protection.status === "paused" ? "paused" : "active",
      setupCompletedAt:
        state.protection.setupCompletedAt ?? configuredAt
    }
  };
}

export function pauseProtectionState(state: BloomLocalState): BloomLocalState {
  if (state.protection.status !== "active") {
    return state;
  }

  return {
    ...state,
    protection: {
      ...state.protection,
      status: "paused"
    }
  };
}

export function resumeProtectionState(state: BloomLocalState): BloomLocalState {
  if (state.protection.status !== "paused") {
    return state;
  }

  return {
    ...state,
    protection: {
      ...state.protection,
      status: "active"
    }
  };
}

export function turnOffProtectionState(state: BloomLocalState): BloomLocalState {
  if (state.protection.status === "off") {
    return state;
  }

  return {
    ...state,
    protection: {
      ...state.protection,
      status: "off"
    }
  };
}

export function recordProtectionPauseState(
  state: BloomLocalState,
  pausedAt = new Date().toISOString()
): BloomLocalState {
  if (!isValidBloomIsoTimestamp(pausedAt)) {
    return state;
  }

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

export function activePlanFromQuizResult(quizResult: QuizResult): ActivePlan {
  return {
    primaryPattern: quizResult.primaryPattern,
    secondaryPattern: quizResult.secondaryPattern,
    planName: quizResult.planName,
    resultTitle: quizResult.resultTitle,
    recommendedFirstAction: quizResult.recommendedFirstAction
  };
}

function createArousalControlId(startedAt: string) {
  return `arousal-${startedAt.replace(/[^0-9A-Za-z]/g, "")}`;
}

function sortArousalLogs(logs: readonly ArousalControlPracticeLog[]) {
  return [...logs].sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt));
}

function isProtectionWindow(value: unknown): value is ProtectionWindow {
  return (
    value === "evening" ||
    value === "night" ||
    value === "custom" ||
    value === "alwaysOn"
  );
}

function isProtectionLevel(value: unknown): value is ProtectionLevel {
  return value === "gentle" || value === "balanced" || value === "strong";
}
