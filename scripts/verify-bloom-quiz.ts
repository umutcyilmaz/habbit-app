import {
  calculateQuizResultPreview,
  createDebugQuizResult,
  debugQuizAnswerFixtures,
  getDebugQuizAnswers,
  quizQuestions,
  scoreOnboardingQuiz,
  type CompleteQuizAnswerFixture,
  type DebugProfileId,
  type FrequencyAnswerValue,
  type FrequencyQuestionId,
  type QuizAnswerMap,
  type TriggerOptionId
} from "../src/features/onboarding/quiz";
import {
  createDefaultBloomState,
  saveOnboardingResultState,
  type QuizResult
} from "../src/storage/bloomState";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";

const fixedCompletedAt = "2026-07-26T12:00:00.000Z";
const sensitivePatternIds = new Set(["pornLoop", "pressurePattern", "controlTiming"]);
const resultsToCheck: QuizResult[] = [];

function verifyBloomQuiz() {
  verifyHighPornLoopAndPressure();
  verifyHighPornLoopOnly();
  verifyHighPressureOnly();
  verifyHighControlOnly();
  verifyAllNever();
  verifyAllSometimes();
  verifyNearlyTiedLowSignal();
  verifyStrongClosePornPressure();
  verifyFirmnessModifierWithLowRankedSignal();
  verifyTriggerOnlyPartialPreview();
  verifyNotSureTrigger();
  verifyAllVeryOften();
  verifyPressureControlTie();
  verifyPornControlTie();
  verifyDebugFixtures();
  verifyPartialPreviewThreshold();
  verifyMixedRequiresTopPositions();
  verifyPersistenceCompatibility();
  verifyNormalizedScoreBounds();

  console.log("Bloom quiz verification passed.");
}

function verifyHighPornLoopAndPressure() {
  const result = scoreFixture("mixedPornPressure");

  assertResult(
    result.resultTitle === "Porn loop + pressure pattern" &&
      result.recommendedFirstAction === "setupProtection",
    "High PL + high PP should produce the mixed result and Protection action."
  );
}

function verifyHighPornLoopOnly() {
  const result = scoreFixture("pornLoop");

  assertResult(
    result.resultTitle === "Porn loop pattern" &&
      result.primaryPattern === "pornLoop" &&
      result.secondaryPattern === null &&
      result.recommendedFirstAction === "setupProtection",
    "High PL only should produce Porn loop without an unsupported secondary."
  );
}

function verifyHighPressureOnly() {
  const result = scoreFixture("pressurePattern");

  assertResult(
    result.resultTitle === "Pressure pattern" &&
      result.primaryPattern === "pressurePattern" &&
      result.secondaryPattern === null &&
      result.recommendedFirstAction === "startReset",
    "High PP only should produce Pressure pattern and Reset."
  );
}

function verifyHighControlOnly() {
  const result = scoreFixture("controlTiming");

  assertResult(
    result.resultTitle === "Control and timing practice" &&
      result.primaryPattern === "controlTiming" &&
      result.secondaryPattern === null &&
      result.recommendedFirstAction === "startArousalPractice",
    "High CT only should produce Control and timing practice."
  );
}

function verifyAllNever() {
  const result = scoreFixture("generalStartingPoint");

  assertGeneralStartingPoint(result, "All Never");
  assertResult(
    result.recommendedFirstAction === "startQuickCheckIn",
    "All Never should recommend a Quick Check-In."
  );
}

function verifyAllSometimes() {
  const result = scoreAnswers(createUniformAnswers(1, ["notSure"]));

  assertGeneralStartingPoint(result, "All Sometimes");
  assertResult(
    Math.max(
      result.normalizedScores.PL,
      result.normalizedScores.PP,
      result.normalizedScores.CT
    ) < 0.35,
    "All Sometimes should remain below the minimum profile signal."
  );
}

function verifyNearlyTiedLowSignal() {
  const answers = createUniformAnswers(0, ["notSure"]);
  setFrequencyAnswers(answers, [
    "porn_empty_moments",
    "porn_without_desire",
    "porn_to_masturbation",
    "automatic_phone_loop",
    "pressure_speed_friction",
    "force_arousal",
    "mechanical_get_it_done",
    "specific_pressure_dependency",
    "checking_firmness"
  ], 1);
  const result = scoreAnswers(answers);

  assertGeneralStartingPoint(result, "Nearly tied low PL/PP");
  assertResult(
    result.secondaryPattern === null,
    "Nearly tied low signals must not create a secondary pattern."
  );
}

function verifyStrongClosePornPressure() {
  const result = scoreFixture("mixedPornPressure");

  assertResult(
    result.primaryPattern === "pornLoop" &&
      result.secondaryPattern === "pressurePattern",
    "Strong close PL/PP should keep the supported mixed pair."
  );
}

function verifyFirmnessModifierWithLowRankedSignal() {
  const answers = createUniformAnswers(0, ["notSure"]);
  answers.force_arousal = 3;
  answers.checking_firmness = 3;
  const result = scoreAnswers(answers);

  assertGeneralStartingPoint(result, "High FC with low PL/PP/CT");
  assertResult(
    result.flags.firmnessConcern &&
      result.chips.includes("Firmness concern") &&
      result.primaryPattern !== "pressurePattern",
    "Firmness concern should remain a modifier and must not force Pressure pattern."
  );
}

function verifyTriggerOnlyPartialPreview() {
  const preview = calculateQuizResultPreview(
    { loop_triggers: ["beforeSleep", "bored", "scrolling"] },
    fixedCompletedAt
  );

  assertResult(
    preview.result === null && preview.answeredFrequencyCount === 0,
    "A trigger-only preview should report not enough answers and no profile."
  );
}

function verifyNotSureTrigger() {
  const result = scoreFixture("generalStartingPoint");

  assertResult(
    Object.values(result.flags).every((flag) => !flag) &&
      Object.values(result.scores).every((score) => score === 0),
    "Not sure should add no trigger bonuses or flags."
  );
}

function verifyAllVeryOften() {
  const result = scoreAnswers(
    createUniformAnswers(3, [
      "bathroom",
      "workBreak",
      "gamingBreak",
      "beforeSleep",
      "bored",
      "stressed",
      "alone",
      "scrolling"
    ])
  );

  assertResult(
    result.resultTitle === "Porn loop + pressure pattern" &&
      result.primaryPattern === "pornLoop" &&
      result.secondaryPattern === "pressurePattern" &&
      result.recommendedFirstAction === "setupProtection" &&
      result.flags.firmnessConcern &&
      result.flags.eveningWindow &&
      result.flags.phoneLoop,
    "All Very often should use the intentional v1 PL + PP mixed result and preserve flags."
  );
}

function verifyPressureControlTie() {
  const answers = createUniformAnswers(0, ["stressed"]);
  setFrequencyAnswers(answers, [
    "porn_to_masturbation",
    "pressure_speed_friction",
    "force_arousal",
    "mechanical_get_it_done",
    "specific_pressure_dependency",
    "arousal_rises_fast",
    "notice_too_late",
    "too_late_to_slow",
    "checking_firmness"
  ], 3);
  const result = scoreAnswers(answers);

  assertResult(
    result.normalizedScores.PP === result.normalizedScores.CT &&
      result.primaryPattern === "controlTiming",
    "An exact PP/CT tie should select Control/Timing over Pressure."
  );
}

function verifyPornControlTie() {
  const answers = createUniformAnswers(0, ["bathroom", "bored", "scrolling"]);
  setFrequencyAnswers(answers, [
    "porn_empty_moments",
    "porn_without_desire",
    "porn_to_masturbation",
    "automatic_phone_loop",
    "arousal_rises_fast",
    "notice_too_late",
    "too_late_to_slow"
  ], 3);
  const result = scoreAnswers(answers);

  assertResult(
    result.normalizedScores.PL === result.normalizedScores.CT &&
      result.primaryPattern === "pornLoop",
    "An exact PL/CT tie should select Porn Loop over Control/Timing."
  );
}

function verifyDebugFixtures() {
  const expectations: Record<DebugProfileId, string> = {
    pornLoop: "Porn loop pattern",
    mixedPornPressure: "Porn loop + pressure pattern",
    pressurePattern: "Pressure pattern",
    controlTiming: "Control and timing practice",
    generalStartingPoint: "A simple starting point"
  };

  for (const profileId of Object.keys(expectations) as DebugProfileId[]) {
    const fixture = getDebugQuizAnswers(profileId);
    const scoredDirectly = scoreOnboardingQuiz(fixture, fixedCompletedAt);
    const debugResult = createDebugQuizResult(profileId, fixedCompletedAt);

    assertResult(
      quizQuestions.every((question) => question.id in fixture),
      `Debug fixture ${profileId} should answer every quiz question.`
    );
    assertResult(
      scoredDirectly.resultTitle === expectations[profileId] &&
        JSON.stringify(debugResult) === JSON.stringify(scoredDirectly),
      `Debug fixture ${profileId} should get its named result from the real scorer.`
    );
  }

  assertResult(
    Object.keys(debugQuizAnswerFixtures).length === Object.keys(expectations).length,
    "Every debug profile should have exactly one scorer-driven fixture."
  );
}

function verifyPartialPreviewThreshold() {
  const threeAnswers: QuizAnswerMap = {
    porn_empty_moments: 3,
    porn_without_desire: 3,
    porn_to_masturbation: 3
  };
  const earlyAnswers: QuizAnswerMap = {
    ...threeAnswers,
    automatic_phone_loop: 3
  };
  const lowEarlyAnswers: QuizAnswerMap = {
    porn_empty_moments: 0,
    porn_without_desire: 0,
    porn_to_masturbation: 0,
    automatic_phone_loop: 0
  };
  const hiddenPreview = calculateQuizResultPreview(threeAnswers, fixedCompletedAt);
  const earlyPreview = calculateQuizResultPreview(earlyAnswers, fixedCompletedAt);
  const lowEarlyPreview = calculateQuizResultPreview(lowEarlyAnswers, fixedCompletedAt);
  const finalResult = scoreOnboardingQuiz(earlyAnswers, fixedCompletedAt);

  assertResult(
    hiddenPreview.result === null,
    "One to three frequency answers should not expose a profile prediction."
  );
  assertResult(
    earlyPreview.result !== null &&
      JSON.stringify(earlyPreview.result) === JSON.stringify(finalResult),
    "An eligible preview and final submission should share the same scorer."
  );
  assertResult(
    lowEarlyPreview.result?.primaryPattern === "generalStartingPoint",
    "A low-signal preview after four frequency answers should be general."
  );
}

function verifyMixedRequiresTopPositions() {
  const answers = createUniformAnswers(0, ["notSure"]);
  setFrequencyAnswers(answers, [
    "porn_empty_moments",
    "porn_without_desire",
    "porn_to_masturbation",
    "automatic_phone_loop",
    "pressure_speed_friction",
    "force_arousal",
    "mechanical_get_it_done",
    "specific_pressure_dependency"
  ], 2);
  setFrequencyAnswers(answers, [
    "arousal_rises_fast",
    "notice_too_late",
    "too_late_to_slow"
  ], 3);
  const result = scoreAnswers(answers);

  assertResult(
    result.normalizedScores.PL >= 0.5 &&
      result.normalizedScores.PP >= 0.5 &&
      result.normalizedScores.CT > result.normalizedScores.PL &&
      result.resultTitle !== "Porn loop + pressure pattern",
    "PL + PP should be mixed only when both occupy the top score positions."
  );
}

function verifyPersistenceCompatibility() {
  for (const profileId of Object.keys(debugQuizAnswerFixtures) as DebugProfileId[]) {
    const answers = getDebugQuizAnswers(profileId);
    const result = scoreOnboardingQuiz(answers, fixedCompletedAt);
    const state = saveOnboardingResultState(createDefaultBloomState(), answers, result);
    const validation = validateAndNormalizeBloomState(state);

    assertResult(
      validation.success &&
        validation.state.onboarding.quizResult?.primaryPattern === result.primaryPattern &&
        validation.state.activePlan.recommendedFirstAction === result.recommendedFirstAction,
      `Persisted ${profileId} result should validate without changing its plan.`
    );
  }

  const generalAnswers = getDebugQuizAnswers("generalStartingPoint");
  const generalResult = scoreOnboardingQuiz(generalAnswers, fixedCompletedAt);
  const stateWithoutAction = saveOnboardingResultState(
    createDefaultBloomState(),
    generalAnswers,
    generalResult
  ) as unknown as {
    onboarding: { quizResult: Record<string, unknown> };
  };
  delete stateWithoutAction.onboarding.quizResult.recommendedFirstAction;
  const validation = validateAndNormalizeBloomState(stateWithoutAction);

  assertResult(
    validation.success &&
      validation.state.activePlan.recommendedFirstAction === "startQuickCheckIn",
    "A general persisted result with an omitted additive action should normalize to Quick Check-In."
  );
}

function verifyNormalizedScoreBounds() {
  for (const result of resultsToCheck) {
    assertResult(
      Object.values(result.normalizedScores).every((score) => score >= 0 && score <= 1),
      "Every normalized score should stay between 0 and 1."
    );
    assertResult(
      result.primaryPattern === "generalStartingPoint" ||
        sensitivePatternIds.has(result.primaryPattern),
      "Firmness Concern must never become a ranked primary pattern."
    );
  }
}

function scoreFixture(profileId: DebugProfileId) {
  return scoreAnswers(getDebugQuizAnswers(profileId));
}

function scoreAnswers(answers: QuizAnswerMap) {
  const result = scoreOnboardingQuiz(answers, fixedCompletedAt);
  resultsToCheck.push(result);
  return result;
}

function assertGeneralStartingPoint(result: QuizResult, scenario: string) {
  assertResult(
    result.primaryPattern === "generalStartingPoint" &&
      result.secondaryPattern === null &&
      result.resultTitle === "A simple starting point" &&
      !result.chips.some((chip) =>
        ["Porn loop", "Pressure pattern", "Control and timing"].includes(chip)
      ),
    `${scenario} should return a neutral general starting point without a sensitive claim.`
  );
}

function createUniformAnswers(
  value: FrequencyAnswerValue,
  triggers: TriggerOptionId[]
): CompleteQuizAnswerFixture {
  return {
    porn_empty_moments: value,
    porn_without_desire: value,
    porn_to_masturbation: value,
    automatic_phone_loop: value,
    pressure_speed_friction: value,
    force_arousal: value,
    mechanical_get_it_done: value,
    specific_pressure_dependency: value,
    arousal_rises_fast: value,
    notice_too_late: value,
    too_late_to_slow: value,
    checking_firmness: value,
    loop_triggers: [...triggers]
  };
}

function setFrequencyAnswers(
  answers: CompleteQuizAnswerFixture,
  questionIds: FrequencyQuestionId[],
  value: FrequencyAnswerValue
) {
  for (const questionId of questionIds) {
    answers[questionId] = value;
  }
}

function assertResult(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

verifyBloomQuiz();
