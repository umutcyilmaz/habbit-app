import {
  activePlanFromQuizResult,
  arousalAdultContentOptions,
  arousalAfterPauseNextSteps,
  arousalAfterwardFeelings,
  arousalDurationPreferences,
  arousalEndingChoices,
  arousalFirmnessChangeOptions,
  arousalFirmnessPlanOptions,
  arousalFocusOptions,
  arousalPauseCountBuckets,
  arousalPracticeModes,
  arousalPressureOptions,
  bloomCheckInEventTypes,
  bloomCheckInMoments,
  bloomCheckInMoods,
  createDefaultBloomState,
  hasGenuineLegacyArousalCompletionEvidence,
  pauseHelpfulActionIds,
  pauseIntensityAfterChanges,
  pauseNextStepIds,
  pauseSessionPhases,
  pauseTriggerIds,
  pauseTruthIds,
  type ActivePlan,
  type ArousalControlDraft,
  type ArousalFirmnessChange,
  type ArousalControlPracticeLog,
  type ArousalControlSessionValues,
  type ArousalControlState,
  type BloomCheckInRecord,
  type BloomCheckInState,
  type BloomDebugState,
  type BloomLocalState,
  MAX_BLOOM_NOTE_LENGTH,
  MAX_RESET_DAYS,
  type NormalizedScores,
  type OnboardingState,
  type PatternId,
  type PauseRecord,
  type PauseSessionDraft,
  type PauseState,
  type ProtectionLevel,
  type ProtectionState,
  type ProtectionStatus,
  type QuizFlags,
  type QuizPlanStep,
  type QuizResult,
  type QuizScores,
  type RecommendedFirstAction,
  type TenDayResetState
} from "./bloomState";
import {
  isValidBloomDateKey,
  isValidBloomIsoTimestamp,
  isValidBloomTime
} from "./bloomValueValidation";
import {
  normalizeContentFree,
  normalizeMasturbationTracking,
  normalizeResetJourney,
  normalizeUrgeControl
} from "./bloomProductStateSchema";
import { normalizeProductOnboarding } from "./bloomOnboardingSchema";

export {
  isValidBloomDateKey,
  isValidBloomIsoTimestamp,
  isValidBloomTime
} from "./bloomValueValidation";

export const BLOOM_PERSISTENCE_VERSION = 5 as const;

export type PersistedBloomEnvelopeV2 = {
  version: 2;
  savedAt: string;
  state: unknown;
};

export type PersistedBloomEnvelopeV3 = {
  version: 3;
  savedAt: string;
  state: unknown;
};

export type PersistedBloomEnvelopeV4 = {
  version: 4;
  savedAt: string;
  state: unknown;
};

export type PersistedBloomEnvelopeV5 = {
  version: typeof BLOOM_PERSISTENCE_VERSION;
  savedAt: string;
  state: unknown;
};

export type ParsedPersistedPayload =
  | { success: true; value: unknown }
  | { success: false; error: string };

export type PersistedEnvelopeReadResult =
  | {
      status: "current";
      envelope: PersistedBloomEnvelopeV5;
    }
  | {
      status: "legacy";
      sourceVersion: 2 | 3 | 4 | null;
      state: unknown;
    }
  | {
      status: "unsupported-version";
      version: number;
    }
  | {
      status: "invalid";
      error: string;
    };

export type BloomStateValidationResult =
  | {
      success: true;
      state: BloomLocalState;
      wasNormalized: boolean;
    }
  | {
      success: false;
      error: string;
    };

const scoredPatternIds = ["pornLoop", "pressurePattern", "controlTiming"] as const;
const patternIds = [...scoredPatternIds, "generalStartingPoint"] as const;
const recommendedActions = [
  "setupProtection",
  "startReset",
  "startArousalPractice",
  "startQuickCheckIn"
] as const;
const protectionStatuses = [
  "off",
  "active",
  "paused"
] as const satisfies readonly ProtectionStatus[];
const protectionLevels = [
  "gentle",
  "balanced",
  "strong"
] as const satisfies readonly ProtectionLevel[];
const protectionWindows = [
  "evening",
  "night",
  "custom",
  "alwaysOn"
] as const;
const legacyFirmnessChangeValues = [
  "No change",
  "Slightly decreased",
  "Decreased, but I could continue",
  "Decreased and continuing felt difficult",
  "Not sure"
] as const;

export function parsePersistedPayload(rawPayload: string): ParsedPersistedPayload {
  try {
    return {
      success: true,
      value: JSON.parse(rawPayload) as unknown
    };
  } catch {
    return {
      success: false,
      error: "Persisted Bloom data is not valid JSON."
    };
  }
}

export function readPersistedEnvelope(value: unknown): PersistedEnvelopeReadResult {
  if (!isRecord(value)) {
    return {
      status: "invalid",
      error: "Persisted Bloom data must be an object."
    };
  }

  if (!("version" in value)) {
    return {
      status: "legacy",
      sourceVersion: null,
      state: value
    };
  }

  if (!isFiniteNumber(value.version) || !Number.isInteger(value.version)) {
    return {
      status: "invalid",
      error: "Persisted Bloom data has an invalid version."
    };
  }

  if (
    value.version !== BLOOM_PERSISTENCE_VERSION &&
    value.version !== 4 &&
    value.version !== 3 &&
    value.version !== 2
  ) {
    return {
      status: "unsupported-version",
      version: value.version
    };
  }

  if (!isValidBloomIsoTimestamp(value.savedAt) || !("state" in value)) {
    return {
      status: "invalid",
      error: `Persisted Bloom data has an invalid version ${value.version} envelope.`
    };
  }

  if (value.version === 2 || value.version === 3 || value.version === 4) {
    return {
      status: "legacy",
      sourceVersion: value.version,
      state: value.state
    };
  }

  return {
    status: "current",
    envelope: {
      version: BLOOM_PERSISTENCE_VERSION,
      savedAt: value.savedAt,
      state: value.state
    }
  };
}

export function validateAndNormalizeBloomState(
  value: unknown,
  mode: "current" | "v4" | "v3" | "legacy" = "current"
): BloomStateValidationResult {
  try {
    const record = requireRecord(value, "state");
    const defaults = createDefaultBloomState();
    const onboarding = normalizeOnboarding(record.onboarding, defaults.onboarding);
    const state: BloomLocalState = {
      activePlan:
        onboarding.quizResult !== null
          ? activePlanFromQuizResult(onboarding.quizResult)
          : normalizeActivePlan(record.activePlan, defaults.activePlan),
      onboarding,
      tenDayReset: normalizeTenDayReset(record.tenDayReset, defaults.tenDayReset),
      debug: normalizeDebug(record.debug, defaults.debug),
      protection: normalizeProtection(record.protection, defaults.protection),
      checkIns: normalizeCheckIns(record.checkIns, defaults.checkIns),
      pause: normalizePause(record.pause, defaults.pause),
      arousalControl: normalizeArousalControl(record.arousalControl, defaults.arousalControl),
      // Raw/v2 legacy features have different semantics. V3 already contains
      // the Phase 1B facts, so migration validates and preserves those slices.
      masturbationTracking:
        mode === "legacy"
          ? defaults.masturbationTracking
          : normalizeMasturbationTracking(record.masturbationTracking),
      contentFree:
        mode === "legacy"
          ? defaults.contentFree
          : normalizeContentFree(record.contentFree),
      resetJourney:
        mode === "legacy"
          ? defaults.resetJourney
          : normalizeResetJourney(record.resetJourney),
      urgeControl:
        mode === "legacy"
          ? defaults.urgeControl
          : normalizeUrgeControl(record.urgeControl),
      // V4 owns onboarding results but never acceptance. V3 and older schemas
      // cannot supply either fact, even if similarly named properties exist.
      productOnboarding:
        mode === "current" || mode === "v4"
          ? normalizeProductOnboarding(record.productOnboarding, mode)
          : defaults.productOnboarding
    };

    return {
      success: true,
      state,
      wasNormalized: !areJsonValuesEqual(value, state)
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof BloomStateValidationError
          ? error.message
          : "Persisted Bloom data could not be validated."
    };
  }
}

function normalizeOnboarding(value: unknown, defaults: OnboardingState): OnboardingState {
  const record = optionalRecord(value, "state.onboarding");

  if (record === null) {
    return defaults;
  }

  const quizResult = normalizeNullableQuizResult(record.quizResult);

  return {
    completed:
      quizResult !== null
        ? true
        : optionalBoolean(record.completed, defaults.completed),
    quizAnswers: normalizeQuizAnswers(record.quizAnswers),
    quizResult,
    completedAt: optionalNullableIsoTimestamp(
      record.completedAt,
      quizResult?.completedAt ?? defaults.completedAt,
      "state.onboarding.completedAt"
    )
  };
}

function normalizeQuizAnswers(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  const record = requireRecord(value, "state.onboarding.quizAnswers");
  const answers: Record<string, unknown> = {};

  for (const [key, answer] of Object.entries(record)) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(key)) {
      throw new BloomStateValidationError(
        "state.onboarding.quizAnswers contains an invalid key."
      );
    }

    if (answer === null || typeof answer === "boolean") {
      answers[key] = answer;
      continue;
    }

    if (isFiniteNumber(answer)) {
      answers[key] = clamp(Math.round(answer), 0, 3);
      continue;
    }

    if (isSafeString(answer)) {
      answers[key] = answer;
      continue;
    }

    if (Array.isArray(answer) && answer.every(isSafeString)) {
      answers[key] = Array.from(new Set(answer));
      continue;
    }

    throw new BloomStateValidationError(
      `state.onboarding.quizAnswers.${key} has an unsupported value.`
    );
  }

  return answers;
}

function normalizeNullableQuizResult(value: unknown): QuizResult | null {
  if (value === undefined || value === null) {
    return null;
  }

  const record = requireRecord(value, "state.onboarding.quizResult");
  const primaryPattern = requiredEnum(
    record.primaryPattern,
    patternIds,
    "state.onboarding.quizResult.primaryPattern"
  );
  const secondaryPattern = optionalNullableEnum(
    record.secondaryPattern,
    scoredPatternIds,
    null,
    "state.onboarding.quizResult.secondaryPattern"
  );

  return {
    scores: normalizeScores(record.scores, false),
    normalizedScores: normalizeScores(record.normalizedScores, true),
    primaryPattern,
    secondaryPattern,
    flags: normalizeQuizFlags(record.flags),
    resultTitle: requiredString(
      record.resultTitle,
      "state.onboarding.quizResult.resultTitle"
    ),
    resultBody: optionalText(
      record.resultBody,
      "",
      "state.onboarding.quizResult.resultBody"
    ),
    planName: requiredString(record.planName, "state.onboarding.quizResult.planName"),
    recommendedFirstAction: optionalEnum(
      record.recommendedFirstAction,
      recommendedActions,
      actionFromPattern(primaryPattern),
      "state.onboarding.quizResult.recommendedFirstAction"
    ),
    firstPlanSteps: normalizePlanSteps(record.firstPlanSteps),
    chips: normalizeStringArray(record.chips, "state.onboarding.quizResult.chips"),
    completedAt: requiredIsoTimestamp(
      record.completedAt,
      "state.onboarding.quizResult.completedAt"
    )
  };
}

function normalizeScores(value: unknown, normalized: boolean): QuizScores | NormalizedScores {
  if (value === undefined) {
    return { PL: 0, PP: 0, CT: 0, FC: 0 };
  }

  const record = requireRecord(
    value,
    normalized
      ? "state.onboarding.quizResult.normalizedScores"
      : "state.onboarding.quizResult.scores"
  );
  const legacyKeys = {
    PL: "pornLoop",
    PP: "pressurePattern",
    CT: "controlTiming",
    FC: "firmnessConcern"
  } as const;
  const readScore = (key: keyof QuizScores) => {
    const rawScore = record[key] ?? record[legacyKeys[key]] ?? 0;
    const score = finiteNumber(rawScore, `quizResult.${normalized ? "normalizedScores" : "scores"}.${key}`);
    return normalized ? clamp(score, 0, 1) : Math.max(score, 0);
  };

  return {
    PL: readScore("PL"),
    PP: readScore("PP"),
    CT: readScore("CT"),
    FC: readScore("FC")
  };
}

function normalizeQuizFlags(value: unknown): QuizFlags {
  const record = optionalRecord(value, "state.onboarding.quizResult.flags") ?? {};

  return {
    eveningWindow: optionalBoolean(record.eveningWindow, false),
    emptyMoments: optionalBoolean(record.emptyMoments, false),
    boredom: optionalBoolean(record.boredom, false),
    aloneTime: optionalBoolean(record.aloneTime, false),
    stressTrigger: optionalBoolean(record.stressTrigger, false),
    phoneLoop: optionalBoolean(record.phoneLoop, false),
    firmnessConcern: optionalBoolean(record.firmnessConcern, false)
  };
}

function normalizePlanSteps(value: unknown): QuizPlanStep[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new BloomStateValidationError(
      "state.onboarding.quizResult.firstPlanSteps must be an array."
    );
  }

  return value.map((step, index) => {
    const record = requireRecord(
      step,
      `state.onboarding.quizResult.firstPlanSteps[${index}]`
    );

    return {
      title: requiredString(record.title, `firstPlanSteps[${index}].title`),
      description: requiredString(
        record.description,
        `firstPlanSteps[${index}].description`
      )
    };
  });
}

function normalizeActivePlan(value: unknown, defaults: ActivePlan): ActivePlan {
  const record = optionalRecord(value, "state.activePlan");

  if (record === null) {
    return defaults;
  }

  return {
    primaryPattern: optionalEnum(
      record.primaryPattern,
      patternIds,
      defaults.primaryPattern,
      "state.activePlan.primaryPattern"
    ),
    secondaryPattern: optionalNullableEnum(
      record.secondaryPattern,
      scoredPatternIds,
      defaults.secondaryPattern,
      "state.activePlan.secondaryPattern"
    ),
    planName: optionalString(record.planName, defaults.planName, "state.activePlan.planName"),
    resultTitle: optionalString(
      record.resultTitle,
      defaults.resultTitle,
      "state.activePlan.resultTitle"
    ),
    recommendedFirstAction: optionalEnum(
      record.recommendedFirstAction,
      recommendedActions,
      defaults.recommendedFirstAction,
      "state.activePlan.recommendedFirstAction"
    )
  };
}

function normalizeTenDayReset(value: unknown, defaults: TenDayResetState): TenDayResetState {
  const record = optionalRecord(value, "state.tenDayReset");

  if (record === null) {
    return defaults;
  }

  const completedDates =
    record.completedDates === undefined
      ? defaults.completedDates
      : normalizeResetDateKeyArray(
          record.completedDates,
          "state.tenDayReset.completedDates"
        );

  return {
    startedAt: optionalNullableResetStartDate(
      record.startedAt,
      defaults.startedAt,
      "state.tenDayReset.startedAt"
    ),
    completedDates: Array.from(new Set(completedDates))
      .sort()
      .slice(0, MAX_RESET_DAYS),
    lastCompletedAt: optionalNullableIsoTimestamp(
      record.lastCompletedAt,
      defaults.lastCompletedAt,
      "state.tenDayReset.lastCompletedAt"
    )
  };
}

function normalizeDebug(value: unknown, defaults: BloomDebugState): BloomDebugState {
  const record = optionalRecord(value, "state.debug");

  if (record === null || record.dateOffsetDays === undefined) {
    return defaults;
  }

  return {
    dateOffsetDays: clamp(
      Math.trunc(finiteNumber(record.dateOffsetDays, "state.debug.dateOffsetDays")),
      -30,
      3650
    )
  };
}

function normalizeProtection(value: unknown, defaults: ProtectionState): ProtectionState {
  const record = optionalRecord(value, "state.protection");

  if (record === null) {
    return defaults;
  }

  const status =
    record.status !== undefined
      ? requiredEnum(
          record.status,
          protectionStatuses,
          "state.protection.status"
        )
      : record.isEnabled === undefined
        ? defaults.status
        : optionalBoolean(record.isEnabled, false)
          ? "active"
          : "off";
  const preferredWindow = optionalNullableEnum(
    record.preferredWindow,
    protectionWindows,
    defaults.preferredWindow,
    "state.protection.preferredWindow"
  );
  const defaultNightStartTime =
    preferredWindow === "night" ? "22:00" : defaults.nightStartTime;
  const defaultNightEndTime =
    preferredWindow === "night" ? "08:00" : defaults.nightEndTime;

  return {
    status,
    setupCompletedAt: optionalNullableIsoTimestamp(
      record.setupCompletedAt,
      defaults.setupCompletedAt,
      "state.protection.setupCompletedAt"
    ),
    preferredWindow,
    level: optionalNullableEnum(
      record.level,
      protectionLevels,
      defaults.level,
      "state.protection.level"
    ),
    adultContentPauseEnabled: optionalBoolean(
      record.adultContentPauseEnabled,
      defaults.adultContentPauseEnabled
    ),
    nightStartTime: optionalNullableTime(
      record.nightStartTime,
      defaultNightStartTime,
      "state.protection.nightStartTime"
    ),
    nightEndTime: optionalNullableTime(
      record.nightEndTime,
      defaultNightEndTime,
      "state.protection.nightEndTime"
    ),
    lastProtectionPauseAt: optionalNullableIsoTimestamp(
      record.lastProtectionPauseAt,
      defaults.lastProtectionPauseAt,
      "state.protection.lastProtectionPauseAt"
    )
  };
}

function normalizeCheckIns(
  value: unknown,
  defaults: BloomCheckInState
): BloomCheckInState {
  const record = optionalRecord(value, "state.checkIns");

  if (record === null) {
    return defaults;
  }

  return {
    records:
      record.records === undefined
        ? defaults.records
        : normalizeCheckInRecords(record.records)
  };
}

function normalizeCheckInRecords(value: unknown): BloomCheckInRecord[] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError(
      "state.checkIns.records must be an array."
    );
  }

  const recordsById = new Map<string, BloomCheckInRecord>();

  value.forEach((recordValue, index) => {
    const path = `state.checkIns.records[${index}]`;
    const record = tryNormalizeRecord(() => {
      const rawRecord = requireRecord(recordValue, path);
      const eventType = optionalEnumValue(
        rawRecord.eventType,
        bloomCheckInEventTypes,
        `${path}.eventType`
      );
      const note = optionalSavedNote(rawRecord.note, `${path}.note`);

      return {
        id: requiredString(rawRecord.id, `${path}.id`),
        createdAt: requiredIsoTimestamp(
          rawRecord.createdAt,
          `${path}.createdAt`
        ),
        mood: requiredEnum(
          rawRecord.mood,
          bloomCheckInMoods,
          `${path}.mood`
        ),
        moment: requiredEnum(
          rawRecord.moment,
          bloomCheckInMoments,
          `${path}.moment`
        ),
        ...(eventType !== undefined ? { eventType } : {}),
        ...(note !== undefined ? { note } : {})
      } satisfies BloomCheckInRecord;
    });

    if (record !== null) {
      recordsById.set(record.id, record);
    }
  });

  return Array.from(recordsById.values()).sort(
    (first, second) =>
      Date.parse(second.createdAt) - Date.parse(first.createdAt)
  );
}

function normalizePause(value: unknown, defaults: PauseState): PauseState {
  const record = optionalRecord(value, "state.pause");

  if (record === null) {
    return defaults;
  }

  const activeSession =
    record.activeSession === undefined || record.activeSession === null
      ? null
      : tryNormalizeRecord(() =>
          normalizePauseSessionDraft(record.activeSession)
        );

  return {
    activeSession,
    records:
      record.records === undefined
        ? defaults.records
        : normalizePauseRecords(record.records)
  };
}

function normalizePauseSessionDraft(value: unknown): PauseSessionDraft {
  const path = "state.pause.activeSession";
  const record = requireRecord(value, path);
  const intensityBefore = optionalStrictBoundedInteger(
    record.intensityBefore,
    0,
    10,
    `${path}.intensityBefore`
  );
  const selectedAction = optionalEnumValue(
    record.selectedAction,
    pauseHelpfulActionIds,
    `${path}.selectedAction`
  );
  const timerStartedAt =
    record.timerStartedAt === undefined || record.timerStartedAt === null
      ? undefined
      : requiredIsoTimestamp(
          record.timerStartedAt,
          `${path}.timerStartedAt`
        );

  return {
    id: requiredString(record.id, `${path}.id`),
    startedAt: requiredIsoTimestamp(record.startedAt, `${path}.startedAt`),
    phase: optionalEnum(
      record.phase,
      pauseSessionPhases,
      "checkIn",
      `${path}.phase`
    ),
    triggers: normalizeEnumArray(
      record.triggers,
      pauseTriggerIds,
      `${path}.triggers`
    ),
    ...(intensityBefore !== undefined ? { intensityBefore } : {}),
    ...(selectedAction !== undefined ? { selectedAction } : {}),
    ...(timerStartedAt !== undefined ? { timerStartedAt } : {}),
    timerDurationSeconds: requiredPositiveInteger(
      record.timerDurationSeconds,
      `${path}.timerDurationSeconds`
    ),
    elapsedDurationSeconds: requiredIntegerInRange(
      record.elapsedDurationSeconds,
      0,
      requiredPositiveInteger(
        record.timerDurationSeconds,
        `${path}.timerDurationSeconds`
      ),
      `${path}.elapsedDurationSeconds`
    )
  };
}

function normalizePauseRecords(value: unknown): PauseRecord[] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError(
      "state.pause.records must be an array."
    );
  }

  const recordsById = new Map<string, PauseRecord>();

  value.forEach((recordValue, index) => {
    const path = `state.pause.records[${index}]`;
    const record = tryNormalizeRecord(() => {
      const rawRecord = requireRecord(recordValue, path);
      const intensityBefore = optionalStrictBoundedInteger(
        rawRecord.intensityBefore,
        0,
        10,
        `${path}.intensityBefore`
      );
      const intensityAfterChange = optionalEnumValue(
        rawRecord.intensityAfterChange,
        pauseIntensityAfterChanges,
        `${path}.intensityAfterChange`
      );
      const selectedAction = optionalEnumValue(
        rawRecord.selectedAction,
        pauseHelpfulActionIds,
        `${path}.selectedAction`
      );
      const feltTruth = optionalEnumValue(
        rawRecord.feltTruth,
        pauseTruthIds,
        `${path}.feltTruth`
      );
      const nextStep = optionalEnumValue(
        rawRecord.nextStep,
        pauseNextStepIds,
        `${path}.nextStep`
      );

      return {
        id: requiredString(rawRecord.id, `${path}.id`),
        startedAt: requiredIsoTimestamp(
          rawRecord.startedAt,
          `${path}.startedAt`
        ),
        completedAt: requiredIsoTimestamp(
          rawRecord.completedAt,
          `${path}.completedAt`
        ),
        triggers: normalizeEnumArray(
          rawRecord.triggers,
          pauseTriggerIds,
          `${path}.triggers`
        ),
        ...(intensityBefore !== undefined ? { intensityBefore } : {}),
        ...(intensityAfterChange !== undefined
          ? { intensityAfterChange }
          : {}),
        ...(selectedAction !== undefined ? { selectedAction } : {}),
        ...(feltTruth !== undefined ? { feltTruth } : {}),
        ...(nextStep !== undefined ? { nextStep } : {}),
        durationSeconds: requiredNonNegativeInteger(
          rawRecord.durationSeconds,
          `${path}.durationSeconds`
        )
      } satisfies PauseRecord;
    });

    if (record !== null) {
      recordsById.set(record.id, record);
    }
  });

  return Array.from(recordsById.values()).sort(
    (first, second) =>
      Date.parse(second.completedAt) - Date.parse(first.completedAt)
  );
}

function normalizeArousalControl(
  value: unknown,
  defaults: ArousalControlState
): ArousalControlState {
  const record = optionalRecord(value, "state.arousalControl");

  if (record === null) {
    return defaults;
  }

  const draft =
    record.draft === undefined || record.draft === null
      ? null
      : tryNormalizeRecord(() => normalizeArousalDraft(record.draft));
  const logs =
    record.logs === undefined
      ? defaults.logs
      : normalizeArousalLogs(record.logs);

  return {
    draft,
    logs
  };
}

function normalizeArousalDraft(value: unknown): ArousalControlDraft {
  const record = requireRecord(value, "state.arousalControl.draft");
  const startedAt = requiredIsoTimestamp(
    record.startedAt,
    "state.arousalControl.draft.startedAt"
  );

  return {
    ...normalizeArousalSessionValues(
      record,
      "state.arousalControl.draft"
    ),
    id:
      record.id === undefined
        ? createLegacyArousalId(startedAt)
        : requiredString(record.id, "state.arousalControl.draft.id"),
    startedAt,
    dateKey: requiredDateKey(
      record.dateKey,
      "state.arousalControl.draft.dateKey"
    )
  };
}

function normalizeArousalLogs(value: unknown): ArousalControlPracticeLog[] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError("state.arousalControl.logs must be an array.");
  }

  const logsById = new Map<string, ArousalControlPracticeLog>();

  value.forEach((logValue, index) => {
    const path = `state.arousalControl.logs[${index}]`;
    const log = tryNormalizeRecord(() => {
      const record = requireRecord(logValue, path);
      const persistedCompletionStatus = optionalEnumValue(
        record.completionStatus,
        ["completed", "legacyCompleted"] as const,
        `${path}.completionStatus`
      );

      const normalizedLog = {
        ...normalizeArousalSessionValues(record, path),
        id: requiredString(record.id, `${path}.id`),
        startedAt: requiredIsoTimestamp(
          record.startedAt,
          `${path}.startedAt`
        ),
        completedAt: requiredIsoTimestamp(
          record.completedAt,
          `${path}.completedAt`
        ),
        dateKey: requiredDateKey(record.dateKey, `${path}.dateKey`)
      } satisfies ArousalControlPracticeLog;
      const completionStatus =
        persistedCompletionStatus ??
        (hasGenuineLegacyArousalCompletionEvidence(normalizedLog)
          ? "legacyCompleted"
          : undefined);

      return {
        ...normalizedLog,
        ...(completionStatus !== undefined ? { completionStatus } : {})
      } satisfies ArousalControlPracticeLog;
    });

    if (log !== null) {
      logsById.set(log.id, log);
    }
  });

  return Array.from(logsById.values()).sort((first, second) => {
    if (first.completedAt === second.completedAt) {
      return 0;
    }

    return first.completedAt < second.completedAt ? 1 : -1;
  });
}

function normalizeArousalSessionValues(
  record: Record<string, unknown>,
  path: string
): Partial<ArousalControlSessionValues> {
  const mode = optionalEnumValue(
    record.mode,
    arousalPracticeModes,
    `${path}.mode`
  );
  const focus = optionalEnumValue(
    record.focus,
    arousalFocusOptions,
    `${path}.focus`
  );
  const adultContent = optionalEnumValue(
    record.adultContent,
    arousalAdultContentOptions,
    `${path}.adultContent`
  );
  const firmnessPlan = optionalEnumValue(
    record.firmnessPlan,
    arousalFirmnessPlanOptions,
    `${path}.firmnessPlan`
  );
  const startingArousalLevel = optionalStrictBoundedInteger(
    record.startingArousalLevel,
    0,
    10,
    `${path}.startingArousalLevel`
  );
  const currentArousalLevel = optionalStrictBoundedInteger(
    record.currentArousalLevel,
    0,
    10,
    `${path}.currentArousalLevel`
  );
  const pauseZoneLevel = optionalStrictBoundedInteger(
    record.pauseZoneLevel,
    0,
    10,
    `${path}.pauseZoneLevel`
  );
  const afterPauseLevel = optionalStrictBoundedInteger(
    record.afterPauseLevel,
    0,
    10,
    `${path}.afterPauseLevel`
  );
  const afterPauseNextStep = optionalEnumValue(
    record.afterPauseNextStep,
    arousalAfterPauseNextSteps,
    `${path}.afterPauseNextStep`
  );
  const endingChoice = optionalEnumValue(
    record.endingChoice,
    arousalEndingChoices,
    `${path}.endingChoice`
  );
  const highestArousal = optionalStrictBoundedInteger(
    record.highestArousal,
    0,
    10,
    `${path}.highestArousal`
  );
  const pauseCount = optionalStrictNonNegativeInteger(
    record.pauseCount,
    `${path}.pauseCount`
  );
  const pauseCountBucket = optionalEnumValue(
    record.pauseCountBucket,
    arousalPauseCountBuckets,
    `${path}.pauseCountBucket`
  );
  const controlFeeling = optionalStrictBoundedInteger(
    record.controlFeeling,
    0,
    10,
    `${path}.controlFeeling`
  );
  const anxietyLevel = optionalStrictBoundedInteger(
    record.anxietyLevel,
    0,
    10,
    `${path}.anxietyLevel`
  );
  const pleasureQuality = optionalLegacyScore(
    record.pleasureQuality,
    `${path}.pleasureQuality`
  );
  const pressureRushing = optionalEnumValue(
    record.pressureRushing,
    arousalPressureOptions,
    `${path}.pressureRushing`
  );
  const firmnessChange = optionalFirmnessChange(
    record.firmnessChange,
    `${path}.firmnessChange`
  );
  const afterwardFeeling = optionalEnumValue(
    record.afterwardFeeling,
    arousalAfterwardFeelings,
    `${path}.afterwardFeeling`
  );
  const reflectionCompleted = optionalBooleanValue(
    record.reflectionCompleted,
    `${path}.reflectionCompleted`
  );
  const durationPreference = optionalEnumValue(
    record.durationPreference,
    arousalDurationPreferences,
    `${path}.durationPreference`
  );
  const durationSeconds = optionalNullableStrictNonNegativeInteger(
    record.durationSeconds,
    `${path}.durationSeconds`
  );
  const note = optionalSavedNote(record.note, `${path}.note`);

  return {
    ...(mode !== undefined ? { mode } : {}),
    ...(focus !== undefined ? { focus } : {}),
    ...(adultContent !== undefined ? { adultContent } : {}),
    ...(firmnessPlan !== undefined ? { firmnessPlan } : {}),
    ...(startingArousalLevel !== undefined
      ? { startingArousalLevel }
      : {}),
    ...(currentArousalLevel !== undefined
      ? { currentArousalLevel }
      : {}),
    ...(pauseZoneLevel !== undefined ? { pauseZoneLevel } : {}),
    ...(afterPauseLevel !== undefined ? { afterPauseLevel } : {}),
    ...(afterPauseNextStep !== undefined ? { afterPauseNextStep } : {}),
    ...(endingChoice !== undefined ? { endingChoice } : {}),
    ...(highestArousal !== undefined ? { highestArousal } : {}),
    ...(pauseCount !== undefined ? { pauseCount } : {}),
    ...(pauseCountBucket !== undefined ? { pauseCountBucket } : {}),
    ...(controlFeeling !== undefined ? { controlFeeling } : {}),
    ...(anxietyLevel !== undefined ? { anxietyLevel } : {}),
    ...(pleasureQuality !== undefined ? { pleasureQuality } : {}),
    ...(pressureRushing !== undefined ? { pressureRushing } : {}),
    ...(firmnessChange !== undefined ? { firmnessChange } : {}),
    ...(afterwardFeeling !== undefined ? { afterwardFeeling } : {}),
    ...(reflectionCompleted !== undefined ? { reflectionCompleted } : {}),
    ...(durationPreference !== undefined ? { durationPreference } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(note !== undefined ? { note } : {})
  };
}

function actionFromPattern(pattern: PatternId): RecommendedFirstAction {
  switch (pattern) {
    case "generalStartingPoint":
      return "startQuickCheckIn";
    case "pressurePattern":
      return "startReset";
    case "controlTiming":
      return "startArousalPractice";
    case "pornLoop":
    default:
      return "setupProtection";
  }
}

function optionalRecord(value: unknown, path: string): Record<string, unknown> | null {
  return value === undefined ? null : requireRecord(value, path);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new BloomStateValidationError(`${path} must be an object.`);
  }

  return value;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new BloomStateValidationError("A persisted Bloom boolean is invalid.");
  }

  return value;
}

function optionalBooleanValue(
  value: unknown,
  path: string
): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new BloomStateValidationError(`${path} must be a boolean.`);
  }

  return value;
}

function requiredString(value: unknown, path: string): string {
  if (!isSafeString(value)) {
    throw new BloomStateValidationError(`${path} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown, fallback: string, path: string): string {
  return value === undefined ? fallback : requiredString(value, path);
}

function optionalText(value: unknown, fallback: string, path: string): string {
  if (value === undefined) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    value.length > MAX_BLOOM_NOTE_LENGTH
  ) {
    throw new BloomStateValidationError(`${path} must be a string.`);
  }

  return value;
}

function requiredIsoTimestamp(value: unknown, path: string): string {
  if (!isValidBloomIsoTimestamp(value)) {
    throw new BloomStateValidationError(
      `${path} must be a canonical ISO timestamp.`
    );
  }

  return value;
}

function optionalNullableIsoTimestamp(
  value: unknown,
  fallback: string | null,
  path: string
): string | null {
  if (value === undefined) {
    return fallback;
  }

  return value === null ? null : requiredIsoTimestamp(value, path);
}

function optionalNullableResetStartDate(
  value: unknown,
  fallback: string | null,
  path: string
): string | null {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  if (isValidBloomDateKey(value)) {
    return value;
  }

  if (isValidBloomIsoTimestamp(value)) {
    return value.slice(0, 10);
  }

  throw new BloomStateValidationError(
    `${path} must be a valid YYYY-MM-DD date or canonical ISO timestamp.`
  );
}

function optionalNullableTime(
  value: unknown,
  fallback: string | null,
  path: string
): string | null {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  if (!isValidBloomTime(value)) {
    throw new BloomStateValidationError(
      `${path} must use 24-hour HH:mm format.`
    );
  }

  return value;
}

function requiredDateKey(value: unknown, path: string): string {
  if (!isValidBloomDateKey(value)) {
    throw new BloomStateValidationError(`${path} must be a valid YYYY-MM-DD date.`);
  }

  return value;
}

function normalizeResetDateKeyArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError(`${path} must be an array.`);
  }

  return value.filter(isValidBloomDateKey);
}

function normalizeStringArray(value: unknown, path: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || !value.every(isSafeString)) {
    throw new BloomStateValidationError(`${path} must be an array of strings.`);
  }

  return Array.from(new Set(value));
}

function normalizeEnumArray<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  path: string
): TValues[number][] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError(`${path} must be an array.`);
  }

  const normalized = value.map((item, index) =>
    requiredEnum(item, values, `${path}[${index}]`)
  );

  return Array.from(new Set(normalized));
}

function requiredEnum<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  path: string
): TValues[number] {
  if (!isEnumValue(value, values)) {
    throw new BloomStateValidationError(`${path} has an unsupported value.`);
  }

  return value;
}

function optionalEnum<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  fallback: TValues[number],
  path: string
): TValues[number] {
  return value === undefined ? fallback : requiredEnum(value, values, path);
}

function optionalNullableEnum<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  fallback: TValues[number] | null,
  path: string
): TValues[number] | null {
  if (value === undefined) {
    return fallback;
  }

  return value === null ? null : requiredEnum(value, values, path);
}

function optionalEnumValue<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  path: string
): TValues[number] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredEnum(value, values, path);
}

function optionalSavedNote(
  value: unknown,
  path: string
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.length > MAX_BLOOM_NOTE_LENGTH
  ) {
    throw new BloomStateValidationError(`${path} must be a saved note.`);
  }

  return value;
}

function optionalLegacyScore(
  value: unknown,
  path: string
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    return requiredIntegerInRange(value, 0, 10, path);
  }

  if (
    typeof value === "string" &&
    /^(?:10|[0-9])\/10$/.test(value)
  ) {
    return Number(value.split("/")[0]);
  }

  throw new BloomStateValidationError(`${path} has an unsupported value.`);
}

function optionalFirmnessChange(
  value: unknown,
  path: string
): ArousalFirmnessChange | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (isEnumValue(value, arousalFirmnessChangeOptions)) {
    return value;
  }

  if (isEnumValue(value, legacyFirmnessChangeValues)) {
    const legacyMap: Record<
      (typeof legacyFirmnessChangeValues)[number],
      ArousalFirmnessChange
    > = {
      "No change": "noChange",
      "Slightly decreased": "slightlyDecreased",
      "Decreased, but I could continue": "decreasedCouldContinue",
      "Decreased and continuing felt difficult": "decreasedDifficult",
      "Not sure": "notSure"
    };

    return legacyMap[value];
  }

  throw new BloomStateValidationError(`${path} has an unsupported value.`);
}

function finiteNumber(value: unknown, path: string): number {
  if (!isFiniteNumber(value)) {
    throw new BloomStateValidationError(`${path} must be a finite number.`);
  }

  return value;
}

function requiredNonNegativeInteger(value: unknown, path: string): number {
  return requiredIntegerInRange(
    value,
    0,
    Number.MAX_SAFE_INTEGER,
    path
  );
}

function requiredPositiveInteger(value: unknown, path: string): number {
  return requiredIntegerInRange(
    value,
    1,
    Number.MAX_SAFE_INTEGER,
    path
  );
}

function requiredIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string
): number {
  const numberValue = finiteNumber(value, path);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < minimum ||
    numberValue > maximum
  ) {
    throw new BloomStateValidationError(
      `${path} must be an integer between ${minimum} and ${maximum}.`
    );
  }

  return numberValue;
}

function optionalStrictBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredIntegerInRange(value, minimum, maximum, path);
}

function optionalStrictNonNegativeInteger(
  value: unknown,
  path: string
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredNonNegativeInteger(value, path);
}

function optionalNullableStrictNonNegativeInteger(
  value: unknown,
  path: string
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return requiredNonNegativeInteger(value, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1000;
}

function isEnumValue<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues
): value is TValues[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function tryNormalizeRecord<T>(normalize: () => T): T | null {
  try {
    return normalize();
  } catch (error) {
    if (error instanceof BloomStateValidationError) {
      return null;
    }

    throw error;
  }
}

function createLegacyArousalId(startedAt: string) {
  return `arousal-${startedAt.replace(/[^0-9A-Za-z]/g, "")}`;
}

function areJsonValuesEqual(first: unknown, second: unknown): boolean {
  try {
    return JSON.stringify(first) === JSON.stringify(second);
  } catch {
    return false;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

class BloomStateValidationError extends Error {}
