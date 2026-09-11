import type {
  OnboardingDimensions,
  OnboardingRecommendation,
  OnboardingSignalLevel
} from "../models/OnboardingDimensions";
import type {
  BehaviorFrequencyAnswer,
  BloomOnboardingAnswers,
  BloomOnboardingQuizResult,
  OnboardingScoreEvidence,
  ReductionDifficultyAnswer
} from "./types";
import { validateBloomOnboardingAnswers, validateBloomOnboardingCompletedAt } from "./validation";

type Severity = 0 | 1 | 2 | 3 | 4;
type Signal = { severity: Severity | null; weight: number };
type Confidence = OnboardingDimensions["recommendationConfidence"];
type ScoredDimensions = Pick<OnboardingDimensions,
  "contentDysregulation" | "erectionResponseConcern" | "stimulationPattern">;

const severityByFrequency: Record<Exclude<BehaviorFrequencyAnswer, "notSure">, Severity> = {
  never: 0, rarely: 1, sometimes: 2, often: 3, almostAlways: 4
};
const supportingTechniques = new Set<string>([
  "veryHighSpeed", "veryTightPressure", "frictionThroughClothing",
  "rubbingAgainstBedPillowSurface", "proneRubbing"
]);

// Provisional product heuristics, not calibrated medical measurements. See README.
// The caller supplies time: identical answers and completedAt yield an identical
// result. This function reads no clock, storage, routes, or app state.
export function scoreBloomOnboarding(
  answers: BloomOnboardingAnswers,
  completedAt: string
): BloomOnboardingQuizResult {
  answers = validateBloomOnboardingAnswers(answers);
  completedAt = validateBloomOnboardingCompletedAt(completedAt);

  // Q1 is deliberately absent from all scoring and confidence inputs.
  const content = summarize([
    { severity: frequencySeverity(answers.unplannedContentUse), weight: 1 },
    { severity: frequencySeverity(answers.activityInterruption), weight: 1 },
    { severity: frequencySeverity(answers.contentTriggeredMasturbation), weight: 2 },
    { severity: frequencySeverity(answers.repeatedContentReturn), weight: 1 },
    { severity: frequencySeverity(answers.difficultyReducingContent), weight: 2 }
  ]);
  const response = summarize([
    { severity: qualityConcern(answers.erectionQuality), weight: 2 },
    { severity: frequencySeverity(answers.erectionMaintenanceDifficulty), weight: 2 },
    { severity: frequencySeverity(answers.delayedOrDifficultEjaculation), weight: 1 }
  ]);
  const techniqueSupport = answers.masturbationTechniques.includes("notSure")
    ? null
    : answers.masturbationTechniques.some((technique) => supportingTechniques.has(technique)) ? 4 : 0;
  const dependency = frequencySeverity(answers.techniqueDependency);
  const stimulation = summarize([
    { severity: techniqueSupport, weight: 1 },
    { severity: dependency, weight: 4 }
  ]);

  const scoredDimensions: ScoredDimensions = {
    contentDysregulation: content.answeredCount < 3
      ? "uncertain" : level(content.normalizedScore, content.strongSignalCount >= 2),
    erectionResponseConcern: response.answeredCount < 2
      ? "uncertain" : level(response.normalizedScore, response.strongSignalCount >= 2),
    stimulationPattern: stimulation.answeredCount < 2
      ? "uncertain" : level(stimulation.normalizedScore, dependency !== null && dependency >= 3 && techniqueSupport === 4)
  };
  const resetEligible = scoredDimensions.erectionResponseConcern === "high" &&
    scoredDimensions.stimulationPattern === "high";
  const contentFreeEligible = scoredDimensions.contentDysregulation === "high";
  const candidate: OnboardingRecommendation = resetEligible
    ? contentFreeEligible ? "reset_and_content_free" : "reset"
    : contentFreeEligible ? "content_free" : "masturbation_tracking";
  const evidence = {
    contentDysregulation: content,
    erectionResponseConcern: response,
    stimulationPattern: stimulation
  };
  const recommendationConfidence = confidenceFor(candidate, scoredDimensions, evidence);
  // Eligibility remains the high/high fact even if incomplete evidence makes
  // the initial recommendation tracking. No feature is started here.
  const recommendation = recommendationConfidence === "high" ? candidate : "masturbation_tracking";
  const safetyFlag = getSafetyFlag(answers.safetySignals);

  return {
    quizVersion: 1,
    scoringVersion: 1,
    answers,
    dimensions: { ...scoredDimensions, safetyFlag, recommendationConfidence },
    recommendation,
    recommendationConfidence,
    resetEligible,
    safetyFlag,
    completedAt,
    evidence
  };
}

function frequencySeverity(answer: ReductionDifficultyAnswer): Severity | null {
  return answer === "notSure" || answer === "neverTriedToReduce" ? null : severityByFrequency[answer];
}

function qualityConcern(answer: BloomOnboardingAnswers["erectionQuality"]): Severity | null {
  if (answer === "notSure") return null;
  if (answer <= 2) return 4;
  if (answer <= 4) return 3;
  if (answer <= 6) return 2;
  if (answer <= 8) return 1;
  return 0;
}

function summarize(signals: readonly Signal[]): OnboardingScoreEvidence {
  let weightedSeverity = 0;
  let answeredWeight = 0;
  let answeredCount = 0;
  let strongSignalCount = 0;
  for (const { severity, weight } of signals) {
    if (severity === null) continue;
    weightedSeverity += severity * weight;
    answeredWeight += weight;
    answeredCount += 1;
    if (severity >= 3) strongSignalCount += 1;
  }
  return {
    normalizedScore: answeredWeight === 0 ? null : weightedSeverity / (4 * answeredWeight) * 100,
    answeredCount,
    totalCount: signals.length,
    strongSignalCount
  };
}

function level(score: number | null, highSupported: boolean): OnboardingSignalLevel {
  if (score === null) return "uncertain";
  if (score < 35) return "low";
  if (score >= 60 && highSupported) return "high";
  return "medium";
}

function confidenceFor(
  candidate: OnboardingRecommendation,
  dimensions: ScoredDimensions,
  evidence: BloomOnboardingQuizResult["evidence"]
): Confidence {
  // Confidence is support for the proposed starting action, not certainty about
  // a person. Independent dimensions do not contradict one another.
  const contentConfidence = evidence.contentDysregulation.answeredCount === 5 ? "high"
    : evidence.contentDysregulation.answeredCount === 4 ? "medium" : "low";
  const resetConfidence = evidence.erectionResponseConcern.answeredCount === 3 ? "high" : "medium";
  if (candidate === "content_free") return contentConfidence;
  if (candidate === "reset") return resetConfidence;
  if (candidate === "reset_and_content_free") {
    if (contentConfidence === "low") return "low";
    return contentConfidence === "high" && resetConfidence === "high" ? "high" : "medium";
  }

  const levels = Object.values(dimensions);
  if (levels.every((value) => value === "uncertain")) return "uncertain";
  if (levels.some((value) => value === "uncertain")) return "low";
  if (levels.some((value) => value === "medium") ||
    Object.values(evidence).some((value) => value.answeredCount < value.totalCount)) return "medium";
  return "high";
}

function getSafetyFlag(signals: BloomOnboardingAnswers["safetySignals"]): OnboardingDimensions["safetyFlag"] {
  // Q12 changes reported context only; it cannot affect any recommendation input.
  if (signals.some((signal) => signal !== "none" && signal !== "unsure")) return "reported";
  return signals.includes("unsure") ? "uncertain" : "noneReported";
}
