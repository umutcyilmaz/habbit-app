import { isDeepStrictEqual } from "node:util";
import {
  bloomOnboardingQuestions,
  scoreBloomOnboarding,
  type BloomOnboardingAnswers,
  type BloomOnboardingQuizResult,
  type OnboardingSafetyAnswer
} from "../src/domain/onboarding";
import {
  behaviorFrequencyValues,
  erectionQualityValues,
  explicitContentFrequencyValues,
  masturbationTechniqueValues,
  reductionDifficultyValues,
  safetySignalValues
} from "../src/domain/onboarding/types";

const completedAt = "2026-09-11T12:00:00.000Z";
const highContent = {
  unplannedContentUse: "almostAlways",
  activityInterruption: "almostAlways",
  contentTriggeredMasturbation: "almostAlways",
  repeatedContentReturn: "almostAlways",
  difficultyReducingContent: "almostAlways"
} as const;
const highResponse = {
  erectionQuality: 1,
  erectionMaintenanceDifficulty: "almostAlways",
  delayedOrDifficultEjaculation: "almostAlways"
} as const;
const highStimulation = {
  masturbationTechniques: ["veryTightPressure"],
  techniqueDependency: "almostAlways"
} as const;
const unknownContent = {
  unplannedContentUse: "notSure",
  activityInterruption: "notSure",
  contentTriggeredMasturbation: "notSure",
  repeatedContentReturn: "notSure",
  difficultyReducingContent: "neverTriedToReduce"
} as const;
const unknownResponse = {
  erectionQuality: "notSure",
  erectionMaintenanceDifficulty: "notSure",
  delayedOrDifficultEjaculation: "notSure"
} as const;
const unknownStimulation = {
  masturbationTechniques: ["notSure"],
  techniqueDependency: "notSure"
} as const;

function verifyBloomOnboarding() {
  verifyQuestionCatalog();
  verifyStartingStrategiesAndResetGate();
  verifyContentThresholdsAndStrongSignals();
  verifyResponseThresholdsAndStrongSignals();
  verifyTechniqueDependency();
  verifyUnknownEvidenceAndConfidence();
  verifyFrequencyAndSafetyIndependence();
  verifyRawAnswersAndDeterminism();
  verifyMalformedInputs();

  console.log("Bloom onboarding verification passed.");
}

function verifyQuestionCatalog() {
  const expectedOptions: Record<keyof BloomOnboardingAnswers, readonly unknown[]> = {
    explicitContentFrequency: explicitContentFrequencyValues,
    unplannedContentUse: behaviorFrequencyValues,
    activityInterruption: behaviorFrequencyValues,
    contentTriggeredMasturbation: behaviorFrequencyValues,
    repeatedContentReturn: behaviorFrequencyValues,
    difficultyReducingContent: reductionDifficultyValues,
    erectionQuality: erectionQualityValues,
    erectionMaintenanceDifficulty: behaviorFrequencyValues,
    masturbationTechniques: masturbationTechniqueValues,
    techniqueDependency: behaviorFrequencyValues,
    delayedOrDifficultEjaculation: behaviorFrequencyValues,
    safetySignals: safetySignalValues
  };
  const ids = bloomOnboardingQuestions.map((question) => question.id);
  assertResult(ids.length === 12 && new Set(ids).size === 12 && isDeepStrictEqual(ids, Object.keys(answers())),
    "The public questionnaire should cover all 12 raw answer fields exactly once in question order.");
  for (const [index, question] of bloomOnboardingQuestions.entries()) {
    assertResult(question.questionNumber === index + 1 && question.prompt.trim().length > 0,
      "Question numbers should follow the agreed order and provide a prompt.");
    const optionValues = question.options.map((option) => option.value);
    assertResult(new Set(optionValues).size === optionValues.length &&
      isDeepStrictEqual(new Set(optionValues), new Set(expectedOptions[question.id])),
    `Question ${question.questionNumber} should expose every typed answer option once.`);
    assertResult(question.options.every((option) => option.label.trim().length > 0), "Every answer option should have a label.");
    const isMultiSelect = question.questionNumber === 9 || question.questionNumber === 12;
    assertResult((question.type === "multi_select") === isMultiSelect, "Only technique and safety questions should support multiple selections.");
    if (question.type === "multi_select") {
      assertResult(isDeepStrictEqual(question.exclusiveOptions, question.id === "masturbationTechniques" ? ["notSure"] : ["none"]),
        "Question exclusivity must agree with scorer validation: Q9 Not sure and Q12 None stand alone.");
    }
  }
  assertResult(bloomOnboardingQuestions[0].purpose === "context" && bloomOnboardingQuestions[11].purpose === "safetyFlag",
    "Frequency and safety must retain their independent questionnaire purposes.");
}

function verifyStartingStrategiesAndResetGate() {
  const stable = score();
  assertResult(stable.recommendation === "masturbation_tracking", "A stable profile should start with tracking.");
  assertResult(stable.recommendationConfidence === "high", "Complete, stable answers should support a clear tracking recommendation.");
  assertResult(!stable.resetEligible, "A stable profile must not qualify for Reset.");
  for (const dimension of ["contentDysregulation", "erectionResponseConcern", "stimulationPattern"] as const) {
    assertResult(stable.dimensions[dimension] === "low", `Stable ${dimension} should be low.`);
    assertResult(stable.evidence[dimension].normalizedScore === 0, `Stable ${dimension} evidence should be zero.`);
  }

  assertResult(score(highContent).recommendation === "content_free", "Strong content dysregulation should independently recommend Content-Free.");
  const responseOnly = score(highResponse);
  assertResult(responseOnly.dimensions.erectionResponseConcern === "high" && !responseOnly.resetEligible,
    "High response concern without stimulation dependency must not qualify for Reset.");
  assertResult(responseOnly.recommendation === "masturbation_tracking", "Response concern alone should start with tracking.");

  const stimulationOnly = score(highStimulation);
  assertResult(stimulationOnly.dimensions.stimulationPattern === "high" && !stimulationOnly.resetEligible,
    "High stimulation dependency with stable response must not qualify for Reset.");
  assertResult(stimulationOnly.recommendation === "masturbation_tracking", "Stimulation dependency alone should start with tracking.");

  const reset = score({ ...highResponse, ...highStimulation });
  assertResult(reset.resetEligible && reset.recommendation === "reset", "High response concern plus high stimulation dependency should qualify for Reset.");
  const combined = score({ ...highContent, ...highResponse, ...highStimulation });
  assertResult(combined.resetEligible && combined.recommendation === "reset_and_content_free", "Independent high content signals should add Content-Free to eligible Reset.");
  assertResult(score({ ...highContent, ...highResponse }).recommendation === "content_free",
    "Response concern without stimulation dependency should preserve independently justified Content-Free.");
  assertResult(score({ ...highContent, ...highStimulation }).recommendation === "content_free",
    "Stimulation dependency without response concern should preserve independently justified Content-Free.");
}

function verifyContentThresholdsAndStrongSignals() {
  // These profiles exercise the product boundaries directly; they do not
  // reproduce the scorer's weighted-average implementation as a test oracle.
  const partialContent = { activityInterruption: "notSure", repeatedContentReturn: "notSure" } as const;
  const cases = [
    { answers: { ...partialContent, contentTriggeredMasturbation: "rarely", difficultyReducingContent: "sometimes" }, score: 30, level: "low" },
    { answers: { ...partialContent, unplannedContentUse: "rarely", contentTriggeredMasturbation: "rarely", difficultyReducingContent: "sometimes" }, score: 35, level: "medium" },
    { answers: { ...partialContent, contentTriggeredMasturbation: "often", difficultyReducingContent: "often" }, score: 60, level: "high" },
    { answers: { ...partialContent, unplannedContentUse: "sometimes", contentTriggeredMasturbation: "often", difficultyReducingContent: "sometimes" }, score: 60, level: "medium" }
  ] as const;
  for (const fixture of cases) {
    const result = score(fixture.answers);
    assertResult(result.evidence.contentDysregulation.normalizedScore === fixture.score,
      `Content threshold fixture should score ${fixture.score}.`);
    assertResult(result.dimensions.contentDysregulation === fixture.level,
      `Content score ${fixture.score} with this evidence should classify as ${fixture.level}.`);
  }

  for (const field of Object.keys(highContent) as (keyof typeof highContent)[]) {
    const isolated = score({ [field]: "almostAlways" });
    assertResult(isolated.dimensions.contentDysregulation !== "high", `One isolated strong answer (${field}) must not classify content dysregulation as high.`);
  }
  const isolatedAboveThreshold = score({
    unplannedContentUse: "notSure", activityInterruption: "notSure",
    contentTriggeredMasturbation: "almostAlways", repeatedContentReturn: "sometimes",
    difficultyReducingContent: "sometimes"
  });
  assertResult(isolatedAboveThreshold.evidence.contentDysregulation.normalizedScore === 70 &&
    isolatedAboveThreshold.evidence.contentDysregulation.strongSignalCount === 1 &&
    isolatedAboveThreshold.dimensions.contentDysregulation === "medium",
  "An elevated average with only one strong behavioral signal must still fail the high gate.");
  const ordinarySignal = score({ unplannedContentUse: "often" }).evidence.contentDysregulation.normalizedScore!;
  assertResult(score({ contentTriggeredMasturbation: "often" }).evidence.contentDysregulation.normalizedScore === ordinarySignal * 2,
    "Content-triggered masturbation should carry twice an ordinary content signal's weight.");
  assertResult(score({ difficultyReducingContent: "often" }).evidence.contentDysregulation.normalizedScore === ordinarySignal * 2,
    "Difficulty reducing content should carry twice an ordinary content signal's weight.");
}

function verifyResponseThresholdsAndStrongSignals() {
  const cases = [
    { answers: { erectionQuality: 7, erectionMaintenanceDifficulty: "sometimes" }, score: 30, level: "low" },
    { answers: { erectionQuality: 7, erectionMaintenanceDifficulty: "sometimes", delayedOrDifficultEjaculation: "rarely" }, score: 35, level: "medium" },
    { answers: { erectionQuality: 3, erectionMaintenanceDifficulty: "sometimes", delayedOrDifficultEjaculation: "rarely" }, score: 55, level: "medium" },
    { answers: { erectionQuality: 3, erectionMaintenanceDifficulty: "often" }, score: 60, level: "high" },
    { answers: { erectionQuality: 1, erectionMaintenanceDifficulty: "sometimes", delayedOrDifficultEjaculation: "sometimes" }, score: 70, level: "medium" }
  ] as const;
  for (const fixture of cases) {
    const result = score(fixture.answers);
    assertResult(closeTo(result.evidence.erectionResponseConcern.normalizedScore, fixture.score) &&
      result.dimensions.erectionResponseConcern === fixture.level,
    `Response concern ${fixture.score} should respect the ${fixture.level} boundary and strong-signal gate.`);
  }
  const qualityScores = [40, 40, 30, 30, 20, 20, 10, 10, 0, 0];
  for (let quality = 1; quality <= 10; quality += 1) {
    const result = score({ erectionQuality: quality as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 });
    assertResult(result.evidence.erectionResponseConcern.normalizedScore === qualityScores[quality - 1],
      `Erection quality ${quality} should map to the documented response band.`);
    assertResult(result.dimensions.erectionResponseConcern !== "high", "Erection quality alone must not create the strongest response classification.");
  }
}

function verifyTechniqueDependency() {
  for (const technique of masturbationTechniqueValues.filter((value) => value !== "notSure")) {
    const techniqueOnly = score({ masturbationTechniques: [technique] });
    assertResult(techniqueOnly.dimensions.stimulationPattern === "low" && !techniqueOnly.resetEligible,
      `Technique choice ${technique} without dependency should remain low and not qualify for Reset.`);
  }
  const manyTechniques = score({ masturbationTechniques: ["veryHighSpeed", "veryTightPressure", "proneRubbing"] });
  assertResult(manyTechniques.evidence.stimulationPattern.normalizedScore === 20,
    "Multiple technique selections must not accumulate extra dependency evidence.");
  const moderateDependency = score({ ...highStimulation, techniqueDependency: "sometimes" });
  assertResult(moderateDependency.evidence.stimulationPattern.normalizedScore === 60 &&
    moderateDependency.dimensions.stimulationPattern === "medium", "A technique plus moderate dependency must not pass the high dependency gate.");
  const strongDependency = score({ ...highStimulation, techniqueDependency: "often" });
  assertResult(strongDependency.dimensions.stimulationPattern === "high", "Strong dependency with supporting technique evidence can classify as high.");
  const noTechniqueSupport = score({ techniqueDependency: "almostAlways", ...highResponse });
  assertResult(noTechniqueSupport.evidence.stimulationPattern.normalizedScore === 80 &&
    noTechniqueSupport.dimensions.stimulationPattern === "medium" && !noTechniqueSupport.resetEligible,
  "Dependency without supporting technique evidence should remain conservative even with high response concern.");
}

function verifyUnknownEvidenceAndConfidence() {
  const unknownReduction = score({
    unplannedContentUse: "sometimes", activityInterruption: "sometimes",
    contentTriggeredMasturbation: "sometimes", repeatedContentReturn: "sometimes",
    difficultyReducingContent: "neverTriedToReduce"
  });
  assertResult(unknownReduction.evidence.contentDysregulation.normalizedScore === 50 &&
    unknownReduction.evidence.contentDysregulation.answeredCount === 4,
  "Never having tried to reduce must be excluded from both score numerator and denominator, rather than scored zero.");
  const unknownResponseAnswer = score({ ...highResponse, delayedOrDifficultEjaculation: "notSure" });
  assertResult(unknownResponseAnswer.evidence.erectionResponseConcern.normalizedScore === 100 &&
    unknownResponseAnswer.evidence.erectionResponseConcern.answeredCount === 2,
  "An unknown response answer should reduce evidence coverage without diluting known concern.");

  const allUnknown = score({ ...unknownContent, ...unknownResponse, ...unknownStimulation });
  assertResult(allUnknown.recommendation === "masturbation_tracking" && allUnknown.recommendationConfidence === "uncertain", "Entirely unknown evidence should produce uncertain tracking guidance.");
  for (const dimension of ["contentDysregulation", "erectionResponseConcern", "stimulationPattern"] as const) {
    assertResult(allUnknown.dimensions[dimension] === "uncertain" && allUnknown.evidence[dimension].normalizedScore === null,
      `Entirely unknown ${dimension} should remain uncertain with no invented zero score.`);
  }
  assertResult(score({ ...unknownContent, unplannedContentUse: "almostAlways", activityInterruption: "almostAlways" }).dimensions.contentDysregulation === "uncertain",
    "Two known content answers are insufficient to establish a content classification.");
  assertResult(score({ ...unknownResponse, erectionQuality: 1 }).dimensions.erectionResponseConcern === "uncertain",
    "One known response answer is insufficient to establish response concern.");
  assertResult(score({ ...highStimulation, masturbationTechniques: ["notSure"] }).dimensions.stimulationPattern === "uncertain" &&
    score({ ...highStimulation, techniqueDependency: "notSure" }).dimensions.stimulationPattern === "uncertain",
  "Both technique and dependency evidence are needed for a stimulation classification.");

  const mediumContentConfidence = score({ ...highContent, difficultyReducingContent: "neverTriedToReduce" });
  assertResult(mediumContentConfidence.dimensions.contentDysregulation === "high" &&
    mediumContentConfidence.recommendationConfidence === "medium" && mediumContentConfidence.recommendation === "masturbation_tracking",
  "High content signals with medium confidence should collect tracking data first.");
  const lowContentConfidence = score({ ...highContent, repeatedContentReturn: "notSure", difficultyReducingContent: "neverTriedToReduce" });
  assertResult(lowContentConfidence.dimensions.contentDysregulation === "high" &&
    lowContentConfidence.recommendationConfidence === "low" && lowContentConfidence.recommendation === "masturbation_tracking",
  "High content signals with only three known answers should fall back to tracking with low confidence.");
  const uncertainReset = score({ ...highResponse, ...highStimulation, delayedOrDifficultEjaculation: "notSure" });
  assertResult(uncertainReset.resetEligible && uncertainReset.recommendationConfidence === "medium" &&
    uncertainReset.recommendation === "masturbation_tracking",
  "Reset eligibility should remain the two-dimension gate while insufficient recommendation confidence prefers tracking.");
  const uncertainCombined = score({ ...highContent, ...highResponse, ...highStimulation, difficultyReducingContent: "neverTriedToReduce" });
  assertResult(uncertainCombined.resetEligible && uncertainCombined.recommendationConfidence === "medium" &&
    uncertainCombined.recommendation === "masturbation_tracking",
  "Combined guidance should use the weaker qualifying dimension's confidence.");

  assertResult(score({ ...highContent, ...unknownResponse, ...unknownStimulation }).recommendation === "content_free",
    "Unknown independent response dimensions should not downgrade clear Content-Free evidence.");
  assertResult(score({ ...unknownContent, ...highResponse, ...highStimulation }).recommendation === "reset",
    "Unknown independent content evidence should not downgrade clear Reset evidence.");
  const ambiguous = score({
    unplannedContentUse: "sometimes", activityInterruption: "sometimes",
    contentTriggeredMasturbation: "sometimes", repeatedContentReturn: "sometimes",
    difficultyReducingContent: "sometimes", erectionQuality: 5,
    erectionMaintenanceDifficulty: "sometimes", delayedOrDifficultEjaculation: "sometimes",
    ...highStimulation, techniqueDependency: "sometimes"
  });
  assertResult(ambiguous.recommendation === "masturbation_tracking" && ambiguous.recommendationConfidence === "medium",
    "Medium or ambiguous evidence should conservatively start with tracking.");
  assertResult(score(unknownStimulation).recommendationConfidence === "low", "An uncertain dimension should reduce tracking confidence to low.");
  assertResult(score({ difficultyReducingContent: "notSure" }).recommendationConfidence === "medium",
    "Incomplete but otherwise stable evidence should reduce tracking confidence to medium.");
}

function verifyFrequencyAndSafetyIndependence() {
  const profiles = [{}, highContent, { ...highResponse, ...highStimulation }, { ...highContent, ...highResponse, ...highStimulation }];
  const safetyCombinations: OnboardingSafetyAnswer[][] = [["none"]];
  const combinableSignals = safetySignalValues.filter((value) => value !== "none");
  for (let mask = 1; mask < 2 ** combinableSignals.length; mask += 1) {
    safetyCombinations.push(combinableSignals.filter((_, index) => (mask & (1 << index)) !== 0));
  }
  for (const profile of profiles) {
    const baseline = score(profile);
    for (const frequency of explicitContentFrequencyValues) {
      for (const safetySignals of safetyCombinations) {
        const result = score({ ...profile, explicitContentFrequency: frequency, safetySignals });
        assertResult(result.recommendation === baseline.recommendation &&
          result.resetEligible === baseline.resetEligible &&
          result.recommendationConfidence === baseline.recommendationConfidence &&
          isDeepStrictEqual(result.evidence, baseline.evidence),
        "Raw content frequency and every valid safety combination must leave recommendation, eligibility, confidence, and scores unchanged.");
        const expectedSafety = safetySignals.includes("none") ? "noneReported" :
          safetySignals.every((value) => value === "unsure") ? "uncertain" : "reported";
        assertResult(result.safetyFlag === expectedSafety && result.dimensions.safetyFlag === expectedSafety,
          "Safety should report explicit concerns, retain uncertainty, and agree across result fields.");
        assertResult(result.dimensions.contentDysregulation === baseline.dimensions.contentDysregulation &&
          result.dimensions.erectionResponseConcern === baseline.dimensions.erectionResponseConcern &&
          result.dimensions.stimulationPattern === baseline.dimensions.stimulationPattern,
        "Safety and frequency must not change any behavioral dimension.");
      }
    }
  }
}

function verifyRawAnswersAndDeterminism() {
  const input = answers({ ...highContent, ...highResponse, ...highStimulation,
    explicitContentFrequency: "dailyOrMore", masturbationTechniques: ["other", "veryHighSpeed"],
    safetySignals: ["pain", "unsure"] });
  const original = JSON.parse(JSON.stringify(input)) as BloomOnboardingAnswers;
  Object.freeze(input.masturbationTechniques);
  Object.freeze(input.safetySignals);
  Object.freeze(input);
  const first = scoreBloomOnboarding(input, completedAt);
  const second = scoreBloomOnboarding(input, completedAt);
  assertResult(isDeepStrictEqual(first, second), "The same answers and completion time must produce identical results.");
  assertResult(isDeepStrictEqual(input, original) && isDeepStrictEqual(first.answers, original), "Scoring must preserve every raw answer and avoid mutating input.");
  assertResult(first.answers !== input && first.answers.masturbationTechniques !== input.masturbationTechniques &&
    first.answers.safetySignals !== input.safetySignals, "Results should own copies of raw answer arrays for later persistence.");
  assertResult(first.completedAt === completedAt && first.quizVersion === 1 && first.scoringVersion === 1,
    "The result should retain the explicit completion time and version its question/scoring contracts.");
  assertResult(first.dimensions.recommendationConfidence === first.recommendationConfidence,
    "Result and dimension confidence must agree.");
  const later = scoreBloomOnboarding(input, "2026-09-12T12:00:00.000Z");
  assertResult(isDeepStrictEqual({ ...later, completedAt }, first), "Passing a different completion time must not change scoring.");
}

function verifyMalformedInputs() {
  for (const key of Object.keys(answers()) as (keyof BloomOnboardingAnswers)[]) {
    const missing: Partial<BloomOnboardingAnswers> = { ...answers() };
    delete missing[key];
    assertThrows(() => scoreUnknown(missing), `Missing required answer ${key} must be rejected.`);
    assertThrows(() => scoreUnknown({ ...answers(), [key]: null }), `Null answer ${key} must be rejected.`);
  }
  const malformed: unknown[] = [null, undefined, [], "answers", 42,
    { ...answers(), explicitContentFrequency: "veryOften" },
    { ...answers(), unplannedContentUse: "neverTriedToReduce" },
    { ...answers(), activityInterruption: true },
    { ...answers(), contentTriggeredMasturbation: 4 },
    { ...answers(), repeatedContentReturn: "ALWAYS" },
    { ...answers(), difficultyReducingContent: "unknown" },
    { ...answers(), erectionMaintenanceDifficulty: 2 },
    { ...answers(), techniqueDependency: false },
    { ...answers(), delayedOrDifficultEjaculation: [] },
    ...[0, 11, 5.5, Number.NaN, Number.POSITIVE_INFINITY, "10"].map((erectionQuality) => ({ ...answers(), erectionQuality })),
    ...[[], new Array(1), ["invalid"], ["veryHighSpeed", "veryHighSpeed"], ["notSure", "other"], "normalHandTechnique"].map((masturbationTechniques) => ({ ...answers(), masturbationTechniques })),
    ...[[], new Array(1), ["invalid"], ["pain", "pain"], ["none", "pain"], ["none", "unsure"], "none"].map((safetySignals) => ({ ...answers(), safetySignals }))
  ];
  for (const value of malformed) {
    assertThrows(() => scoreUnknown(value), "Malformed answers must be rejected rather than coerced into behavioral evidence.");
  }
  for (const invalidTime of ["", "2026-09-11", "2026-09-11T12:00:00Z", "2026-02-30T12:00:00.000Z", "2026-09-11T12:00:00.000+00:00"]) {
    assertThrows(() => scoreBloomOnboarding(answers(), invalidTime), "Invalid or noncanonical completion timestamps must be rejected.");
  }
}

function answers(overrides: Partial<BloomOnboardingAnswers> = {}): BloomOnboardingAnswers {
  return {
    explicitContentFrequency: "never",
    unplannedContentUse: "never",
    activityInterruption: "never",
    contentTriggeredMasturbation: "never",
    repeatedContentReturn: "never",
    difficultyReducingContent: "never",
    erectionQuality: 10,
    erectionMaintenanceDifficulty: "never",
    masturbationTechniques: ["normalHandTechnique"],
    techniqueDependency: "never",
    delayedOrDifficultEjaculation: "never",
    safetySignals: ["none"],
    ...overrides
  };
}

function score(overrides: Partial<BloomOnboardingAnswers> = {}): BloomOnboardingQuizResult {
  return scoreBloomOnboarding(answers(overrides), completedAt);
}

function scoreUnknown(value: unknown): BloomOnboardingQuizResult {
  return scoreBloomOnboarding(value as BloomOnboardingAnswers, completedAt);
}

function assertThrows(action: () => unknown, message: string) {
  let threw = false;
  try {
    action();
  } catch {
    threw = true;
  }
  assertResult(threw, message);
}

function closeTo(actual: number | null, expected: number): boolean {
  return actual !== null && Math.abs(actual - expected) < 1e-10;
}

function assertResult(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

verifyBloomOnboarding();
