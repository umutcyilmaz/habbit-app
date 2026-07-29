import {
  isValidBloomDateKey,
  isValidBloomIsoTimestamp,
  isValidBloomTime
} from "./bloomValueValidation";

export const MAX_BLOOM_NOTE_LENGTH = 5000;

export type BloomMutationFailureReason =
  | "invalidRecord"
  | "invalidSession"
  | "noteTooLong"
  | "stateUnavailable";

export type BloomMutationResult =
  | { ok: true }
  | { ok: false; reason: BloomMutationFailureReason };

export type BloomNoteSubmissionResult =
  | { ok: true; note: string | null }
  | { ok: false; reason: "noteTooLong" };

export function prepareBloomNoteSubmission(
  value: string
): BloomNoteSubmissionResult {
  if (value.length > MAX_BLOOM_NOTE_LENGTH) {
    return { ok: false, reason: "noteTooLong" };
  }

  const note = value.trim();
  return { ok: true, note: note.length > 0 ? note : null };
}

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

export const bloomCheckInMoods = [
  "neutral",
  "bored",
  "restless",
  "stressed",
  "calm"
] as const;

export const bloomCheckInMoments = [
  "evening",
  "boredom",
  "alone",
  "stress",
  "scrolling"
] as const;

export const bloomCheckInEventTypes = [
  "nothing",
  "urge",
  "paused",
  "adultContent",
  "masturbated",
  "both"
] as const;

export type BloomCheckInMood = (typeof bloomCheckInMoods)[number];
export type BloomCheckInMoment = (typeof bloomCheckInMoments)[number];
export type BloomCheckInEventType = (typeof bloomCheckInEventTypes)[number];

export type BloomCheckInRecord = {
  id: string;
  createdAt: string;
  mood: BloomCheckInMood;
  moment: BloomCheckInMoment;
  eventType?: BloomCheckInEventType;
  note?: string;
};

export type BloomCheckInState = {
  records: BloomCheckInRecord[];
};

export const pauseTriggerIds = [
  "boredom",
  "stress",
  "loneliness",
  "nighttime",
  "socialMedia",
  "tiredness",
  "desire",
  "habit",
  "notSure"
] as const;

export const pauseHelpfulActionIds = [
  "pause90",
  "breathe3",
  "logAndClose",
  "continueMindfully"
] as const;

export const pauseIntensityAfterChanges = [
  "lower",
  "aboutTheSame",
  "higher"
] as const;

export const pauseTruthIds = [
  "calmer",
  "canWaitLonger",
  "stillPulled",
  "wantSupport",
  "notSure"
] as const;

export const pauseNextStepIds = [
  "savePause",
  "breathe3",
  "leaveRoom",
  "putPhoneAway",
  "messageSupport",
  "continueMindfully"
] as const;

export const pauseSessionPhases = [
  "checkIn",
  "timer",
  "afterPause"
] as const;

export type PauseTriggerId = (typeof pauseTriggerIds)[number];
export type PauseHelpfulActionId = (typeof pauseHelpfulActionIds)[number];
export type PauseIntensityAfterChange =
  (typeof pauseIntensityAfterChanges)[number];
export type PauseTruthId = (typeof pauseTruthIds)[number];
export type PauseNextStepId = (typeof pauseNextStepIds)[number];
export type PauseSessionPhase = (typeof pauseSessionPhases)[number];

export type PauseSessionDraft = {
  id: string;
  startedAt: string;
  phase: PauseSessionPhase;
  triggers: PauseTriggerId[];
  intensityBefore?: number;
  selectedAction?: PauseHelpfulActionId;
  timerStartedAt?: string;
  timerDurationSeconds: number;
  elapsedDurationSeconds: number;
};

export type PauseSessionPatch = Partial<
  Omit<PauseSessionDraft, "id" | "startedAt">
>;

export type PauseSessionCompletionData = {
  intensityAfterChange?: PauseIntensityAfterChange;
  feltTruth?: PauseTruthId;
  nextStep?: PauseNextStepId;
  durationSeconds?: number;
};

export type PauseRecord = {
  id: string;
  startedAt: string;
  completedAt: string;
  triggers: PauseTriggerId[];
  intensityBefore?: number;
  intensityAfterChange?: PauseIntensityAfterChange;
  selectedAction?: PauseHelpfulActionId;
  feltTruth?: PauseTruthId;
  nextStep?: PauseNextStepId;
  durationSeconds: number;
};

export type PauseState = {
  activeSession: PauseSessionDraft | null;
  records: PauseRecord[];
};

export const arousalPracticeModes = [
  "softAwareness",
  "onePause",
  "practicePlus"
] as const;

export const arousalFocusOptions = [
  "noticeRising",
  "onePause",
  "reduceRushing",
  "stayRelaxed",
  "withoutAdultContent",
  "justObserve"
] as const;

export const arousalAdultContentOptions = ["no", "yes", "notSure"] as const;
export const arousalFirmnessPlanOptions = [
  "finish",
  "tryAgain",
  "appSuggest"
] as const;
export const arousalFirmnessChangeOptions = [
  "noChange",
  "slightlyDecreased",
  "decreasedCouldContinue",
  "decreasedDifficult",
  "notSure"
] as const;
export const arousalAfterPauseNextSteps = [
  "continueGently",
  "pauseMore",
  "finishToday"
] as const;
export const arousalEndingChoices = [
  "finishedBeforeClimax",
  "climaxed",
  "firmnessDecreased",
  "feltAnxious",
  "stoppedByChoice",
  "other"
] as const;
export const arousalPressureOptions = [
  "low",
  "medium",
  "high",
  "veryHigh"
] as const;
export const arousalAfterwardFeelings = [
  "calm",
  "satisfied",
  "neutral",
  "empty",
  "uneasy",
  "anxious",
  "frustrated",
  "notSure"
] as const;
export const arousalDurationPreferences = [
  "notLogged",
  "estimated",
  "exact"
] as const;
export const arousalPauseCountBuckets = ["0", "1", "2", "3plus"] as const;

export type ArousalPracticeMode = (typeof arousalPracticeModes)[number];
export type ArousalFocus = (typeof arousalFocusOptions)[number];
export type ArousalAdultContentChoice =
  (typeof arousalAdultContentOptions)[number];
export type ArousalFirmnessPlan =
  (typeof arousalFirmnessPlanOptions)[number];
export type ArousalFirmnessChange =
  (typeof arousalFirmnessChangeOptions)[number];
export type ArousalAfterPauseNextStep =
  (typeof arousalAfterPauseNextSteps)[number];
export type ArousalEndingChoice = (typeof arousalEndingChoices)[number];
export type ArousalPressure = (typeof arousalPressureOptions)[number];
export type ArousalAfterwardFeeling =
  (typeof arousalAfterwardFeelings)[number];
export type ArousalDurationPreference =
  (typeof arousalDurationPreferences)[number];
export type ArousalPauseCountBucket =
  (typeof arousalPauseCountBuckets)[number];

export type ArousalControlSessionValues = {
  mode?: ArousalPracticeMode;
  focus?: ArousalFocus;
  adultContent?: ArousalAdultContentChoice;
  firmnessPlan?: ArousalFirmnessPlan;
  startingArousalLevel?: number;
  currentArousalLevel?: number;
  pauseZoneLevel?: number;
  afterPauseLevel?: number;
  afterPauseNextStep?: ArousalAfterPauseNextStep;
  endingChoice?: ArousalEndingChoice;
  highestArousal?: number;
  pauseCount?: number;
  pauseCountBucket?: ArousalPauseCountBucket;
  controlFeeling?: number;
  anxietyLevel?: number;
  pleasureQuality?: number;
  pressureRushing?: ArousalPressure;
  firmnessChange?: ArousalFirmnessChange;
  afterwardFeeling?: ArousalAfterwardFeeling;
  reflectionCompleted?: boolean;
  durationPreference?: ArousalDurationPreference;
  durationSeconds?: number | null;
  note?: string;
};

export type ArousalControlPracticeLog = {
  id: string;
  startedAt: string;
  completedAt: string;
  dateKey: string;
  completionStatus?: "completed" | "legacyCompleted";
} & ArousalControlSessionValues;

export type ArousalControlDraft = {
  id: string;
  startedAt: string;
  dateKey: string;
} & ArousalControlSessionValues;

export type ArousalSessionPatch = Partial<ArousalControlSessionValues>;

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
  checkIns: BloomCheckInState;
  pause: PauseState;
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
    checkIns: {
      records: []
    },
    pause: {
      activeSession: null,
      records: []
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

export function saveBloomCheckInRecordState(
  state: BloomLocalState,
  record: BloomCheckInRecord
): BloomLocalState {
  if (!isValidBloomCheckInRecord(record)) {
    return state;
  }

  const recordsById = new Map(
    state.checkIns.records.map((savedRecord) => [savedRecord.id, savedRecord])
  );
  const existingRecord = recordsById.get(record.id);
  recordsById.set(
    record.id,
    existingRecord === undefined
      ? record
      : {
          ...existingRecord,
          ...record,
          ...(record.eventType === undefined &&
          existingRecord.eventType !== undefined
            ? { eventType: existingRecord.eventType }
            : {}),
          ...(record.note === undefined && existingRecord.note !== undefined
            ? { note: existingRecord.note }
            : {})
        }
  );

  return {
    ...state,
    checkIns: {
      records: sortCheckInRecords(Array.from(recordsById.values()))
    }
  };
}

export function getNewestBloomCheckInRecords(
  records: readonly BloomCheckInRecord[]
): BloomCheckInRecord[] {
  return sortCheckInRecords(records);
}

export function getLatestBloomCheckInRecord(
  records: readonly BloomCheckInRecord[]
): BloomCheckInRecord | null {
  return getNewestBloomCheckInRecords(records)[0] ?? null;
}

export function startPauseSessionState(
  state: BloomLocalState,
  session: PauseSessionDraft
): BloomLocalState {
  if (!isValidPauseSessionDraft(session)) {
    return state;
  }

  return {
    ...state,
    pause: {
      ...state.pause,
      activeSession: session
    }
  };
}

export function updatePauseSessionState(
  state: BloomLocalState,
  sessionId: string,
  patch: PauseSessionPatch
): BloomLocalState {
  const activeSession = state.pause.activeSession;

  if (activeSession === null || activeSession.id !== sessionId) {
    return state;
  }

  const updatedSession: PauseSessionDraft = {
    ...activeSession,
    ...patch,
    id: activeSession.id,
    startedAt: activeSession.startedAt
  };

  if (!isValidPauseSessionDraft(updatedSession)) {
    return state;
  }

  return {
    ...state,
    pause: {
      ...state.pause,
      activeSession: updatedSession
    }
  };
}

export function addPauseSessionDurationState(
  state: BloomLocalState,
  sessionId: string,
  seconds: number
): BloomLocalState {
  const activeSession = state.pause.activeSession;

  if (
    activeSession === null ||
    activeSession.id !== sessionId ||
    !Number.isSafeInteger(seconds) ||
    seconds <= 0
  ) {
    return state;
  }

  const timerDurationSeconds =
    activeSession.timerDurationSeconds + seconds;

  if (!Number.isSafeInteger(timerDurationSeconds)) {
    return state;
  }

  return updatePauseSessionState(state, sessionId, {
    timerDurationSeconds
  });
}

export function completePauseSessionState(
  state: BloomLocalState,
  sessionId: string,
  completionData: PauseSessionCompletionData,
  completedAt = new Date().toISOString()
): BloomLocalState {
  const activeSession = state.pause.activeSession;

  if (
    activeSession === null ||
    activeSession.id !== sessionId ||
    !isValidBloomIsoTimestamp(completedAt)
  ) {
    return state;
  }

  const existingRecord = state.pause.records.find(
    (record) => record.id === sessionId
  );

  if (existingRecord !== undefined) {
    return {
      ...state,
      pause: {
        activeSession: null,
        records: state.pause.records
      }
    };
  }

  const record: PauseRecord = {
    id: activeSession.id,
    startedAt: activeSession.startedAt,
    completedAt,
    triggers: activeSession.triggers,
    durationSeconds:
      completionData.durationSeconds ?? activeSession.elapsedDurationSeconds,
    ...(activeSession.intensityBefore !== undefined
      ? { intensityBefore: activeSession.intensityBefore }
      : {}),
    ...(activeSession.selectedAction !== undefined
      ? { selectedAction: activeSession.selectedAction }
      : {}),
    ...(completionData.intensityAfterChange !== undefined
      ? { intensityAfterChange: completionData.intensityAfterChange }
      : {}),
    ...(completionData.feltTruth !== undefined
      ? { feltTruth: completionData.feltTruth }
      : {}),
    ...(completionData.nextStep !== undefined
      ? { nextStep: completionData.nextStep }
      : {})
  };

  if (!isValidPauseRecord(record)) {
    return state;
  }

  return {
    ...state,
    pause: {
      activeSession: null,
      records: sortPauseRecords([...state.pause.records, record])
    }
  };
}

export function discardPauseSessionState(
  state: BloomLocalState,
  sessionId: string
): BloomLocalState {
  if (state.pause.activeSession?.id !== sessionId) {
    return state;
  }

  return {
    ...state,
    pause: {
      ...state.pause,
      activeSession: null
    }
  };
}

export function getLatestPauseRecord(
  records: readonly PauseRecord[]
): PauseRecord | null {
  return sortPauseRecords(records)[0] ?? null;
}

export function getPauseSavedRouteState(
  pauseState: PauseState
): "collect-completion" | "show-record" | "redirect" {
  if (pauseState.activeSession !== null) {
    return "collect-completion";
  }

  return getLatestPauseRecord(pauseState.records) !== null
    ? "show-record"
    : "redirect";
}

export function startArousalSessionState(
  state: BloomLocalState,
  session: ArousalControlDraft
): BloomLocalState {
  if (!isValidArousalDraft(session)) {
    return state;
  }

  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      draft: session
    }
  };
}

export function resumeArousalSessionState(
  state: BloomLocalState,
  sessionId: string
): BloomLocalState {
  if (state.arousalControl.draft?.id !== sessionId) {
    return state;
  }

  return state;
}

export function updateArousalSessionState(
  state: BloomLocalState,
  sessionId: string,
  patch: ArousalSessionPatch
): BloomLocalState {
  const draft = state.arousalControl.draft;

  if (draft === null || draft.id !== sessionId) {
    return state;
  }

  const updatedDraft: ArousalControlDraft = {
    ...draft,
    ...patch,
    id: draft.id,
    startedAt: draft.startedAt,
    dateKey: draft.dateKey
  };

  if (!isValidArousalDraft(updatedDraft)) {
    return state;
  }

  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      draft: updatedDraft
    }
  };
}

export function discardArousalSessionState(
  state: BloomLocalState,
  sessionId: string
): BloomLocalState {
  if (state.arousalControl.draft?.id !== sessionId) {
    return state;
  }

  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      draft: null
    }
  };
}

export function completeArousalSessionState(
  state: BloomLocalState,
  sessionId: string,
  completionData: ArousalSessionPatch,
  completedAt = new Date().toISOString()
): BloomLocalState {
  const draft = state.arousalControl.draft;

  if (
    draft === null ||
    draft.id !== sessionId ||
    !isValidBloomIsoTimestamp(completedAt)
  ) {
    return state;
  }

  const existingLog = state.arousalControl.logs.find(
    (log) => log.id === sessionId
  );

  if (existingLog !== undefined) {
    return {
      ...state,
      arousalControl: {
        draft: null,
        logs: state.arousalControl.logs
      }
    };
  }

  const completedDraft: ArousalControlDraft = {
    ...draft,
    ...completionData,
    id: draft.id,
    startedAt: draft.startedAt,
    dateKey: draft.dateKey
  };

  if (!isCompletableArousalDraft(completedDraft)) {
    return state;
  }

  const log: ArousalControlPracticeLog = {
    ...completedDraft,
    completedAt,
    completionStatus: "completed"
  };

  return {
    ...state,
    arousalControl: {
      draft: null,
      logs: sortArousalLogs([...state.arousalControl.logs, log])
    }
  };
}

export function editCompletedArousalLogState(
  state: BloomLocalState,
  logId: string,
  patch: Pick<ArousalControlSessionValues, "note">
): BloomLocalState {
  const logIndex = state.arousalControl.logs.findIndex(
    (log) => log.id === logId
  );

  if (logIndex < 0) {
    return state;
  }

  const currentLog = state.arousalControl.logs[logIndex];

  if (
    currentLog === undefined ||
    !isValidCompletedArousalLog(currentLog)
  ) {
    return state;
  }

  const nextLog: ArousalControlPracticeLog = {
    ...currentLog
  };
  const noteResult =
    patch.note === undefined
      ? { ok: true as const, note: null }
      : prepareBloomNoteSubmission(patch.note);

  if (!noteResult.ok) {
    return state;
  }

  if (noteResult.note === null) {
    delete nextLog.note;
  } else {
    nextLog.note = noteResult.note;
  }

  const nextLogs = [...state.arousalControl.logs];
  nextLogs[logIndex] = nextLog;

  return {
    ...state,
    arousalControl: {
      ...state.arousalControl,
      logs: sortArousalLogs(nextLogs)
    }
  };
}

export function getLatestArousalControlLog(
  logs: readonly ArousalControlPracticeLog[]
) {
  return sortArousalLogs(logs)[0] ?? null;
}

export function getLatestValidArousalLog(
  logs: readonly ArousalControlPracticeLog[]
): ArousalControlPracticeLog | null {
  return sortArousalLogs(logs).find(isValidCompletedArousalLog) ?? null;
}

export function isValidCompletedArousalLog(
  value: unknown
): value is ArousalControlPracticeLog {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidBase =
    isSafeId(value.id) &&
    isValidBloomIsoTimestamp(value.startedAt) &&
    isValidBloomIsoTimestamp(value.completedAt) &&
    isValidBloomDateKey(value.dateKey) &&
    isValidArousalSessionValues(value) &&
    hasValidArousalDuration(value);

  if (!hasValidBase) {
    return false;
  }

  if (value.completionStatus === "legacyCompleted") {
    return hasGenuineLegacyArousalCompletionEvidence(value);
  }

  return (
    value.completionStatus === "completed" &&
    includesString(arousalPracticeModes, value.mode) &&
    includesString(arousalFocusOptions, value.focus) &&
    includesString(arousalAdultContentOptions, value.adultContent) &&
    includesString(arousalFirmnessPlanOptions, value.firmnessPlan) &&
    includesString(arousalEndingChoices, value.endingChoice) &&
    value.reflectionCompleted === true &&
    includesString(arousalDurationPreferences, value.durationPreference)
  );
}

export function hasGenuineLegacyArousalCompletionEvidence(
  value: unknown
): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isSafeId(value.id) &&
    isValidBloomIsoTimestamp(value.startedAt) &&
    isValidBloomIsoTimestamp(value.completedAt) &&
    isValidBloomDateKey(value.dateKey) &&
    isOptionalBoundedInteger(value.highestArousal, 0, 10) &&
    value.highestArousal !== undefined &&
    isNonNegativeInteger(value.pauseCount) &&
    isOptionalBoundedInteger(value.controlFeeling, 0, 10) &&
    value.controlFeeling !== undefined &&
    isOptionalBoundedInteger(value.pleasureQuality, 0, 10) &&
    value.pleasureQuality !== undefined &&
    includesString(arousalPressureOptions, value.pressureRushing) &&
    includesString(arousalAfterwardFeelings, value.afterwardFeeling) &&
    hasValidArousalDuration(value) &&
    isValidArousalSessionValues(value)
  );
}

export function isArousalSessionReadyForCompletion(
  draft: ArousalControlDraft
): boolean {
  return (
    isValidArousalDraft(draft) &&
    includesString(arousalPracticeModes, draft.mode) &&
    includesString(arousalFocusOptions, draft.focus) &&
    includesString(arousalAdultContentOptions, draft.adultContent) &&
    includesString(arousalFirmnessPlanOptions, draft.firmnessPlan) &&
    includesString(arousalEndingChoices, draft.endingChoice) &&
    draft.reflectionCompleted === true
  );
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

export function createBloomRecordId(
  prefix: "check-in" | "pause" | "arousal",
  now = new Date(),
  randomValue = Math.random()
) {
  const timestamp = now.toISOString().replace(/[^0-9A-Za-z]/g, "");
  const nonce = Math.floor(randomValue * 0x100000000)
    .toString(36)
    .padStart(7, "0");

  return `${prefix}-${timestamp}-${nonce}`;
}

function sortArousalLogs(logs: readonly ArousalControlPracticeLog[]) {
  return [...logs].sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt));
}

function sortCheckInRecords(records: readonly BloomCheckInRecord[]) {
  return [...records].sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt)
  );
}

function sortPauseRecords(records: readonly PauseRecord[]) {
  return [...records].sort(
    (first, second) =>
      Date.parse(second.completedAt) - Date.parse(first.completedAt)
  );
}

export function isValidBloomCheckInRecord(
  record: BloomCheckInRecord
): boolean {
  return (
    isSafeId(record.id) &&
    isValidBloomIsoTimestamp(record.createdAt) &&
    includesString(bloomCheckInMoods, record.mood) &&
    includesString(bloomCheckInMoments, record.moment) &&
    (record.eventType === undefined ||
      includesString(bloomCheckInEventTypes, record.eventType)) &&
    (record.note === undefined ||
      record.note.length <= MAX_BLOOM_NOTE_LENGTH)
  );
}

function isValidPauseSessionDraft(session: PauseSessionDraft): boolean {
  return (
    isSafeId(session.id) &&
    isValidBloomIsoTimestamp(session.startedAt) &&
    includesString(pauseSessionPhases, session.phase) &&
    session.triggers.every((trigger) =>
      includesString(pauseTriggerIds, trigger)
    ) &&
    new Set(session.triggers).size === session.triggers.length &&
    isOptionalBoundedInteger(session.intensityBefore, 0, 10) &&
    (session.selectedAction === undefined ||
      includesString(pauseHelpfulActionIds, session.selectedAction)) &&
    (session.timerStartedAt === undefined ||
      isValidBloomIsoTimestamp(session.timerStartedAt)) &&
    isNonNegativeInteger(session.timerDurationSeconds) &&
    session.timerDurationSeconds > 0 &&
    isNonNegativeInteger(session.elapsedDurationSeconds) &&
    session.elapsedDurationSeconds <= session.timerDurationSeconds
  );
}

function isValidPauseRecord(record: PauseRecord): boolean {
  return (
    isSafeId(record.id) &&
    isValidBloomIsoTimestamp(record.startedAt) &&
    isValidBloomIsoTimestamp(record.completedAt) &&
    record.triggers.every((trigger) =>
      includesString(pauseTriggerIds, trigger)
    ) &&
    new Set(record.triggers).size === record.triggers.length &&
    isOptionalBoundedInteger(record.intensityBefore, 0, 10) &&
    (record.intensityAfterChange === undefined ||
      includesString(
        pauseIntensityAfterChanges,
        record.intensityAfterChange
      )) &&
    (record.selectedAction === undefined ||
      includesString(pauseHelpfulActionIds, record.selectedAction)) &&
    (record.feltTruth === undefined ||
      includesString(pauseTruthIds, record.feltTruth)) &&
    (record.nextStep === undefined ||
      includesString(pauseNextStepIds, record.nextStep)) &&
    isNonNegativeInteger(record.durationSeconds)
  );
}

function isValidArousalDraftBase(draft: ArousalControlDraft): boolean {
  return (
    isSafeId(draft.id) &&
    isValidBloomIsoTimestamp(draft.startedAt) &&
    isValidBloomDateKey(draft.dateKey)
  );
}

function isValidArousalDraft(draft: ArousalControlDraft): boolean {
  return (
    isValidArousalDraftBase(draft) &&
    isValidArousalSessionValues(draft)
  );
}

function isCompletableArousalDraft(
  draft: ArousalControlDraft
): boolean {
  return (
    isArousalSessionReadyForCompletion(draft) &&
    includesString(arousalDurationPreferences, draft.durationPreference) &&
    hasValidArousalDuration(draft)
  );
}

function isValidArousalSessionValues(
  value: Record<string, unknown>
): boolean {
  return (
    isOptionalEnum(value.mode, arousalPracticeModes) &&
    isOptionalEnum(value.focus, arousalFocusOptions) &&
    isOptionalEnum(value.adultContent, arousalAdultContentOptions) &&
    isOptionalEnum(value.firmnessPlan, arousalFirmnessPlanOptions) &&
    isOptionalBoundedInteger(value.startingArousalLevel, 0, 10) &&
    isOptionalBoundedInteger(value.currentArousalLevel, 0, 10) &&
    isOptionalBoundedInteger(value.pauseZoneLevel, 0, 10) &&
    isOptionalBoundedInteger(value.afterPauseLevel, 0, 10) &&
    isOptionalEnum(value.afterPauseNextStep, arousalAfterPauseNextSteps) &&
    isOptionalEnum(value.endingChoice, arousalEndingChoices) &&
    isOptionalBoundedInteger(value.highestArousal, 0, 10) &&
    (value.pauseCount === undefined ||
      isNonNegativeInteger(value.pauseCount)) &&
    isOptionalEnum(value.pauseCountBucket, arousalPauseCountBuckets) &&
    isOptionalBoundedInteger(value.controlFeeling, 0, 10) &&
    isOptionalBoundedInteger(value.anxietyLevel, 0, 10) &&
    isOptionalBoundedInteger(value.pleasureQuality, 0, 10) &&
    isOptionalEnum(value.pressureRushing, arousalPressureOptions) &&
    isOptionalEnum(value.firmnessChange, arousalFirmnessChangeOptions) &&
    isOptionalEnum(value.afterwardFeeling, arousalAfterwardFeelings) &&
    (value.reflectionCompleted === undefined ||
      typeof value.reflectionCompleted === "boolean") &&
    isOptionalEnum(
      value.durationPreference,
      arousalDurationPreferences
    ) &&
    (value.durationSeconds === undefined ||
      value.durationSeconds === null ||
      isNonNegativeInteger(value.durationSeconds)) &&
    (value.note === undefined ||
      (typeof value.note === "string" &&
        value.note.length <= MAX_BLOOM_NOTE_LENGTH))
  );
}

function hasValidArousalDuration(value: Record<string, unknown>): boolean {
  if (
    !includesString(
      arousalDurationPreferences,
      value.durationPreference
    )
  ) {
    return false;
  }

  if (value.durationPreference === "notLogged") {
    return value.durationSeconds === undefined || value.durationSeconds === null;
  }

  return (
    isNonNegativeInteger(value.durationSeconds) &&
    value.durationSeconds > 0
  );
}

function includesString<const TValues extends readonly string[]>(
  values: TValues,
  value: unknown
): value is TValues[number] {
  return (
    typeof value === "string" &&
    values.some((candidate) => candidate === value)
  );
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1000
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isOptionalBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number
): boolean {
  return (
    value === undefined ||
    (isNonNegativeInteger(value) && value >= minimum && value <= maximum)
  );
}

function isOptionalEnum<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues
): boolean {
  return value === undefined || includesString(values, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
