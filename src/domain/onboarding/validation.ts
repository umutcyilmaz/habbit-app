import {
  behaviorFrequencyValues,
  erectionQualityValues,
  explicitContentFrequencyValues,
  masturbationTechniqueValues,
  reductionDifficultyValues,
  safetySignalValues,
  type BloomOnboardingAnswers,
  type BloomOnboardingQuizResult,
  type OnboardingScoreEvidence
} from "./types";

const singleAnswers = {
  explicitContentFrequency: explicitContentFrequencyValues,
  unplannedContentUse: behaviorFrequencyValues,
  activityInterruption: behaviorFrequencyValues,
  contentTriggeredMasturbation: behaviorFrequencyValues,
  repeatedContentReturn: behaviorFrequencyValues,
  difficultyReducingContent: reductionDifficultyValues,
  erectionQuality: erectionQualityValues,
  erectionMaintenanceDifficulty: behaviorFrequencyValues,
  techniqueDependency: behaviorFrequencyValues,
  delayedOrDifficultEjaculation: behaviorFrequencyValues
};
const signalLevels = ["low", "medium", "high", "uncertain"] as const;
const safetyFlags = ["noneReported", "reported", "uncertain"] as const;
const recommendations = ["masturbation_tracking", "content_free", "reset", "reset_and_content_free"] as const;

// These helpers validate facts and return detached snapshots. They do not
// import the scorer, infer missing answers, or apply recommendation thresholds.
export function validateBloomOnboardingAnswers(value: unknown): BloomOnboardingAnswers {
  const path = "onboarding.answers";
  const record = exactObject(value, [...Object.keys(singleAnswers), "masturbationTechniques", "safetySignals"], path);
  for (const key of Object.keys(singleAnswers) as Array<keyof typeof singleAnswers>) {
    choice(record[key], singleAnswers[key], `${path}.${key}`);
  }
  const masturbationTechniques = selection(record.masturbationTechniques, masturbationTechniqueValues, "notSure", `${path}.masturbationTechniques`);
  const safetySignals = selection(record.safetySignals, safetySignalValues, "none", `${path}.safetySignals`);
  // Spreading the validated record preserves the raw question-key order. The
  // copied selections retain their order without sharing mutable input arrays.
  const singleAnswerSnapshot = record as Pick<BloomOnboardingAnswers, keyof typeof singleAnswers>;
  return { ...singleAnswerSnapshot, masturbationTechniques, safetySignals };
}

export function validateBloomOnboardingCompletedAt(value: unknown): string {
  const parsedTime = typeof value === "string" ? Date.parse(value) : NaN;
  ensure(typeof value === "string" && Number.isFinite(parsedTime) && new Date(parsedTime).toISOString() === value,
    "onboarding.completedAt", "must be a canonical ISO timestamp");
  return value;
}

export function validateBloomOnboardingResult(value: unknown): BloomOnboardingQuizResult {
  const path = "onboarding.result";
  const record = exactObject(value, [
    "quizVersion", "scoringVersion", "answers", "dimensions", "recommendation",
    "recommendationConfidence", "resetEligible", "safetyFlag", "completedAt", "evidence"
  ], path);
  const rawDimensions = exactObject(record.dimensions, [
    "contentDysregulation", "erectionResponseConcern", "stimulationPattern", "safetyFlag", "recommendationConfidence"
  ], `${path}.dimensions`);
  const dimensions = {
    contentDysregulation: choice(rawDimensions.contentDysregulation, signalLevels, `${path}.dimensions.contentDysregulation`),
    erectionResponseConcern: choice(rawDimensions.erectionResponseConcern, signalLevels, `${path}.dimensions.erectionResponseConcern`),
    stimulationPattern: choice(rawDimensions.stimulationPattern, signalLevels, `${path}.dimensions.stimulationPattern`),
    safetyFlag: choice(rawDimensions.safetyFlag, safetyFlags, `${path}.dimensions.safetyFlag`),
    recommendationConfidence: choice(rawDimensions.recommendationConfidence, signalLevels, `${path}.dimensions.recommendationConfidence`)
  };
  const recommendationConfidence = choice(record.recommendationConfidence, signalLevels, `${path}.recommendationConfidence`);
  const safetyFlag = choice(record.safetyFlag, safetyFlags, `${path}.safetyFlag`);
  ensure(recommendationConfidence === dimensions.recommendationConfidence, path, "has conflicting recommendation confidence fields");
  ensure(safetyFlag === dimensions.safetyFlag, path, "has conflicting safety flag fields");
  ensure(typeof record.resetEligible === "boolean", `${path}.resetEligible`, "must be a boolean");
  const rawEvidence = exactObject(record.evidence,
    ["contentDysregulation", "erectionResponseConcern", "stimulationPattern"], `${path}.evidence`);

  return {
    quizVersion: choice(record.quizVersion, [1], `${path}.quizVersion`),
    scoringVersion: choice(record.scoringVersion, [1], `${path}.scoringVersion`),
    answers: validateBloomOnboardingAnswers(record.answers),
    dimensions,
    recommendation: choice(record.recommendation, recommendations, `${path}.recommendation`),
    recommendationConfidence,
    resetEligible: record.resetEligible,
    safetyFlag,
    completedAt: validateBloomOnboardingCompletedAt(record.completedAt),
    evidence: {
      contentDysregulation: evidence(rawEvidence.contentDysregulation, 5, `${path}.evidence.contentDysregulation`),
      erectionResponseConcern: evidence(rawEvidence.erectionResponseConcern, 3, `${path}.evidence.erectionResponseConcern`),
      stimulationPattern: evidence(rawEvidence.stimulationPattern, 2, `${path}.evidence.stimulationPattern`)
    }
  };
}

function evidence(value: unknown, totalCount: number, path: string): OnboardingScoreEvidence {
  const record = exactObject(value, ["normalizedScore", "answeredCount", "totalCount", "strongSignalCount"], path);
  ensure(record.totalCount === totalCount, `${path}.totalCount`, "does not match this result version");
  const answeredCount = integer(record.answeredCount, totalCount, `${path}.answeredCount`);
  const strongSignalCount = integer(record.strongSignalCount, answeredCount, `${path}.strongSignalCount`);
  const normalizedScore = record.normalizedScore;
  ensure(normalizedScore === null || (typeof normalizedScore === "number" && Number.isFinite(normalizedScore) &&
    normalizedScore >= 0 && normalizedScore <= 100), `${path}.normalizedScore`, "must be null or a finite number from 0 to 100");
  // Null means no numerical evidence, not a score of zero. Do not reconcile
  // these counts or scores with raw answers or with a derived dimension band.
  ensure((normalizedScore === null) === (answeredCount === 0), path, "has inconsistent score availability and answered count");
  return { normalizedScore, answeredCount, totalCount, strongSignalCount };
}

function exactObject(value: unknown, fields: readonly string[], path: string): Record<string, unknown> {
  ensure(typeof value === "object" && value !== null && !Array.isArray(value), path, "must be an object");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  ensure(keys.length === fields.length && keys.every((key) => fields.includes(key)), path, "must contain exactly the supported fields");
  return record;
}

function choice<const Values extends readonly (string | number)[]>(value: unknown, allowed: Values, path: string): Values[number] {
  ensure(allowed.some((candidate) => candidate === value), path, "has an unsupported or missing value");
  return value as Values[number];
}

function selection<const Values extends readonly string[]>(value: unknown, allowed: Values, exclusive: string, path: string): Values[number][] {
  ensure(Array.isArray(value) && value.length > 0, path, "must be a nonempty selection");
  const values = Array.from(value, (entry) => choice(entry, allowed, path));
  ensure(new Set(values).size === values.length && (!values.includes(exclusive) || values.length === 1),
    path, "contains duplicate or mutually exclusive answers");
  return values;
}

function integer(value: unknown, maximum: number, path: string): number {
  ensure(typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum,
    path, "must be an integer in range");
  return value;
}

function ensure(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new TypeError(`${path} ${message}.`);
}
