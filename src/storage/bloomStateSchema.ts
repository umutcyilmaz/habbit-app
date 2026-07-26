import {
  activePlanFromQuizResult,
  createDefaultBloomState,
  type ActivePlan,
  type ArousalControlDraft,
  type ArousalControlPracticeLog,
  type ArousalControlState,
  type BloomDebugState,
  type BloomLocalState,
  type NormalizedScores,
  type OnboardingState,
  type PatternId,
  type ProtectionState,
  type QuizFlags,
  type QuizPlanStep,
  type QuizResult,
  type QuizScores,
  type RecommendedFirstAction,
  type TenDayResetState
} from "./bloomState";

export const BLOOM_PERSISTENCE_VERSION = 2 as const;

export type PersistedBloomEnvelopeV2 = {
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
      envelope: PersistedBloomEnvelopeV2;
    }
  | {
      status: "legacy";
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

const patternIds = ["pornLoop", "pressurePattern", "controlTiming"] as const;
const recommendedActions = [
  "setupProtection",
  "startReset",
  "startArousalPractice"
] as const;
const protectionWindows = ["evening", "night", "custom"] as const;
const durationPreferences = ["notLogged", "estimated", "exact"] as const;
const pressureRushingValues = ["low", "medium", "high", "veryHigh"] as const;
const afterwardFeelingValues = [
  "calm",
  "satisfied",
  "neutral",
  "empty",
  "uneasy",
  "anxious",
  "frustrated",
  "notSure"
] as const;
const firmnessChangeValues = [
  "No change",
  "Slightly decreased",
  "Decreased, but I could continue",
  "Decreased and continuing felt difficult",
  "Not sure",
  "noChange",
  "slightlyDecreased",
  "decreasedCouldContinue",
  "decreasedDifficult",
  "notSure"
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
      state: value
    };
  }

  if (!isFiniteNumber(value.version) || !Number.isInteger(value.version)) {
    return {
      status: "invalid",
      error: "Persisted Bloom data has an invalid version."
    };
  }

  if (value.version !== BLOOM_PERSISTENCE_VERSION) {
    return {
      status: "unsupported-version",
      version: value.version
    };
  }

  if (!isDateLikeString(value.savedAt) || !("state" in value)) {
    return {
      status: "invalid",
      error: "Persisted Bloom data has an invalid version 2 envelope."
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

export function validateAndNormalizeBloomState(value: unknown): BloomStateValidationResult {
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
      arousalControl: normalizeArousalControl(record.arousalControl, defaults.arousalControl)
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
    completedAt: optionalNullableDateString(
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
    patternIds,
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
    completedAt: requiredDateString(
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
      patternIds,
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
      : normalizeDateKeyArray(record.completedDates, "state.tenDayReset.completedDates");

  return {
    startedAt: optionalNullableDateString(
      record.startedAt,
      defaults.startedAt,
      "state.tenDayReset.startedAt"
    ),
    completedDates: Array.from(new Set(completedDates)).sort(),
    lastCompletedAt: optionalNullableDateString(
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

  return {
    isEnabled: optionalBoolean(record.isEnabled, defaults.isEnabled),
    setupCompletedAt: optionalNullableDateString(
      record.setupCompletedAt,
      defaults.setupCompletedAt,
      "state.protection.setupCompletedAt"
    ),
    preferredWindow: optionalNullableEnum(
      record.preferredWindow,
      protectionWindows,
      defaults.preferredWindow,
      "state.protection.preferredWindow"
    ),
    adultContentPauseEnabled: optionalBoolean(
      record.adultContentPauseEnabled,
      defaults.adultContentPauseEnabled
    ),
    lastProtectionPauseAt: optionalNullableDateString(
      record.lastProtectionPauseAt,
      defaults.lastProtectionPauseAt,
      "state.protection.lastProtectionPauseAt"
    )
  };
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
      : normalizeArousalDraft(record.draft);
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

  return {
    ...normalizePracticeOptionalFields(record, "state.arousalControl.draft"),
    ...(record.id !== undefined
      ? { id: requiredString(record.id, "state.arousalControl.draft.id") }
      : {}),
    startedAt: requiredDateString(record.startedAt, "state.arousalControl.draft.startedAt"),
    ...(record.completedAt !== undefined
      ? {
          completedAt: requiredDateString(
            record.completedAt,
            "state.arousalControl.draft.completedAt"
          )
        }
      : {}),
    dateKey: requiredDateKey(record.dateKey, "state.arousalControl.draft.dateKey")
  };
}

function normalizeArousalLogs(value: unknown): ArousalControlPracticeLog[] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError("state.arousalControl.logs must be an array.");
  }

  const logsById = new Map<string, ArousalControlPracticeLog>();

  value.forEach((logValue, index) => {
    const path = `state.arousalControl.logs[${index}]`;
    const record = requireRecord(logValue, path);
    const log: ArousalControlPracticeLog = {
      ...normalizePracticeOptionalFields(record, path),
      id: requiredString(record.id, `${path}.id`),
      startedAt: requiredDateString(record.startedAt, `${path}.startedAt`),
      completedAt: requiredDateString(record.completedAt, `${path}.completedAt`),
      dateKey: requiredDateKey(record.dateKey, `${path}.dateKey`)
    };

    logsById.set(log.id, log);
  });

  return Array.from(logsById.values()).sort(
    (first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt)
  );
}

function normalizePracticeOptionalFields(
  record: Record<string, unknown>,
  path: string
): Partial<ArousalControlPracticeLog> {
  const highestArousal = optionalBoundedNumber(record.highestArousal, 0, 10, `${path}.highestArousal`);
  const pauseCount = optionalNonNegativeInteger(record.pauseCount, `${path}.pauseCount`);
  const controlFeeling = optionalBoundedNumber(record.controlFeeling, 0, 10, `${path}.controlFeeling`);
  const anxietyLevel = optionalBoundedNumber(record.anxietyLevel, 0, 10, `${path}.anxietyLevel`);
  const pleasureQuality = optionalPatternString(
    record.pleasureQuality,
    /^(?:10|[0-9])\/10$/,
    `${path}.pleasureQuality`
  );
  const pressureRushing = optionalKnownString(
    record.pressureRushing,
    pressureRushingValues,
    `${path}.pressureRushing`
  );
  const firmnessChange = optionalKnownString(
    record.firmnessChange,
    firmnessChangeValues,
    `${path}.firmnessChange`
  );
  const afterwardFeeling = optionalKnownString(
    record.afterwardFeeling,
    afterwardFeelingValues,
    `${path}.afterwardFeeling`
  );
  const durationPreference = optionalEnumValue(
    record.durationPreference,
    durationPreferences,
    `${path}.durationPreference`
  );
  const durationSeconds = optionalNullableNonNegativeInteger(
    record.durationSeconds,
    `${path}.durationSeconds`
  );

  return {
    ...(highestArousal !== undefined ? { highestArousal } : {}),
    ...(pauseCount !== undefined ? { pauseCount } : {}),
    ...(controlFeeling !== undefined ? { controlFeeling } : {}),
    ...(anxietyLevel !== undefined ? { anxietyLevel } : {}),
    ...(pleasureQuality !== undefined ? { pleasureQuality } : {}),
    ...(pressureRushing !== undefined ? { pressureRushing } : {}),
    ...(firmnessChange !== undefined ? { firmnessChange } : {}),
    ...(afterwardFeeling !== undefined ? { afterwardFeeling } : {}),
    ...(durationPreference !== undefined ? { durationPreference } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {})
  };
}

function actionFromPattern(pattern: PatternId): RecommendedFirstAction {
  switch (pattern) {
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

  if (typeof value !== "string" || value.length > 5000) {
    throw new BloomStateValidationError(`${path} must be a string.`);
  }

  return value;
}

function requiredDateString(value: unknown, path: string): string {
  if (!isDateLikeString(value)) {
    throw new BloomStateValidationError(`${path} must be a valid date string.`);
  }

  return value;
}

function optionalNullableDateString(
  value: unknown,
  fallback: string | null,
  path: string
): string | null {
  if (value === undefined) {
    return fallback;
  }

  return value === null ? null : requiredDateString(value, path);
}

function requiredDateKey(value: unknown, path: string): string {
  if (typeof value !== "string" || !isValidDateKey(value)) {
    throw new BloomStateValidationError(`${path} must be a valid YYYY-MM-DD date.`);
  }

  return value;
}

function normalizeDateKeyArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new BloomStateValidationError(`${path} must be an array.`);
  }

  return value.map((dateKey, index) => requiredDateKey(dateKey, `${path}[${index}]`));
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

function optionalKnownString<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
  path: string
): string | undefined {
  return optionalEnumValue(value, values, path);
}

function optionalPatternString(
  value: unknown,
  pattern: RegExp,
  path: string
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const stringValue = requiredString(value, path);

  if (!pattern.test(stringValue)) {
    throw new BloomStateValidationError(`${path} has an unsupported value.`);
  }

  return stringValue;
}

function finiteNumber(value: unknown, path: string): number {
  if (!isFiniteNumber(value)) {
    throw new BloomStateValidationError(`${path} must be a finite number.`);
  }

  return value;
}

function optionalBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return clamp(finiteNumber(value, path), minimum, maximum);
}

function optionalNonNegativeInteger(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return Math.max(0, Math.round(finiteNumber(value, path)));
}

function optionalNullableNonNegativeInteger(
  value: unknown,
  path: string
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return Math.max(0, Math.round(finiteNumber(value, path)));
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

function isDateLikeString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (isValidDateKey(value) || Number.isFinite(Date.parse(value)))
  );
}

function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    return false;
  }

  const [, yearValue = "", monthValue = "", dayValue = ""] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isEnumValue<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues
): value is TValues[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
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
