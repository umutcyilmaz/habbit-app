import type {
  NormalizedScores,
  PatternId,
  QuizFlags,
  QuizResult,
  QuizScores,
  ScoredPatternId
} from "../../storage/bloomState";

type ScoreArea = keyof QuizScores;
type TriggerFlag = Exclude<keyof QuizFlags, "firmnessConcern">;

export type FrequencyAnswerValue = 0 | 1 | 2 | 3;

export type FrequencyQuestionId =
  | "porn_empty_moments"
  | "porn_without_desire"
  | "porn_to_masturbation"
  | "automatic_phone_loop"
  | "pressure_speed_friction"
  | "force_arousal"
  | "mechanical_get_it_done"
  | "specific_pressure_dependency"
  | "arousal_rises_fast"
  | "notice_too_late"
  | "too_late_to_slow"
  | "checking_firmness";

export type TriggerOptionId =
  | "bathroom"
  | "workBreak"
  | "gamingBreak"
  | "beforeSleep"
  | "bored"
  | "stressed"
  | "alone"
  | "scrolling"
  | "notSure";

export type QuizAnswerMap = Record<string, unknown>;

type ScoreWeights = Partial<Record<ScoreArea, number>>;

export type ScoreContribution = {
  area: ScoreArea;
  value: number;
};

export type QuizQuestionContribution = {
  selectedLabels: string[];
  scoreContributions: ScoreContribution[];
  flags: Array<keyof QuizFlags>;
  note: string;
};

export type QuizScoringPreview = {
  result: QuizResult | null;
  scores: QuizScores;
  normalizedScores: NormalizedScores;
  isComplete: boolean;
  answeredFrequencyCount: number;
  answeredStepCount: number;
  totalSteps: number;
  activeFlags: Array<keyof QuizFlags>;
};

export type DebugProfileId =
  | "pornLoop"
  | "mixedPornPressure"
  | "pressurePattern"
  | "controlTiming"
  | "generalStartingPoint";

export type FrequencyQuestion = {
  id: FrequencyQuestionId;
  type: "frequency";
  question: string;
  scoring: ScoreWeights;
};

export type TriggerQuestion = {
  id: "loop_triggers";
  type: "multiSelect";
  question: string;
  subtitle: string;
  options: readonly { id: TriggerOptionId; label: string }[];
};

export type QuizQuestion = FrequencyQuestion | TriggerQuestion;

export type CompleteQuizAnswerFixture = Record<
  FrequencyQuestionId,
  FrequencyAnswerValue
> & {
  loop_triggers: TriggerOptionId[];
};

export const frequencyAnswers: readonly {
  label: string;
  value: FrequencyAnswerValue;
}[] = [
  { label: "Never", value: 0 },
  { label: "Sometimes", value: 1 },
  { label: "Often", value: 2 },
  { label: "Very often", value: 3 }
];

export const triggerOptions: readonly { id: TriggerOptionId; label: string }[] = [
  { id: "bathroom", label: "Bathroom" },
  { id: "workBreak", label: "Work break" },
  { id: "gamingBreak", label: "Gaming break" },
  { id: "beforeSleep", label: "Before sleep" },
  { id: "bored", label: "When bored" },
  { id: "stressed", label: "When stressed" },
  { id: "alone", label: "When alone" },
  { id: "scrolling", label: "Scrolling on my phone" },
  { id: "notSure", label: "Not sure" }
];

const frequencyQuestions: readonly FrequencyQuestion[] = [
  {
    id: "porn_empty_moments",
    type: "frequency",
    question: "Do you open porn during empty moments, even without a clear desire to masturbate?",
    scoring: { PL: 1 }
  },
  {
    id: "porn_without_desire",
    type: "frequency",
    question: "Do you start watching porn before you actually feel a clear desire?",
    scoring: { PL: 1 }
  },
  {
    id: "porn_to_masturbation",
    type: "frequency",
    question: "After opening porn, do you continue into masturbation even if the desire was not there at first?",
    scoring: { PL: 1, PP: 0.5 }
  },
  {
    id: "automatic_phone_loop",
    type: "frequency",
    question: "When bored, alone, stressed, or scrolling, does porn feel like the easiest thing to open?",
    scoring: { PL: 1 }
  },
  {
    id: "pressure_speed_friction",
    type: "frequency",
    question: "Do you sometimes masturbate with pressure, speed, or friction just to finish?",
    scoring: { PP: 1 }
  },
  {
    id: "force_arousal",
    type: "frequency",
    question: "Do you continue masturbating even when arousal or firmness does not feel fully present?",
    scoring: { PP: 1, FC: 0.5 }
  },
  {
    id: "mechanical_get_it_done",
    type: "frequency",
    question: "Does masturbation sometimes feel mechanical or like something to get out of the way?",
    scoring: { PP: 1 }
  },
  {
    id: "specific_pressure_dependency",
    type: "frequency",
    question: "Do you rely on a specific pressure, position, speed, or friction to feel enough stimulation?",
    scoring: { PP: 1 }
  },
  {
    id: "arousal_rises_fast",
    type: "frequency",
    question: "Does arousal rise faster than you expect?",
    scoring: { CT: 1 }
  },
  {
    id: "notice_too_late",
    type: "frequency",
    question: "Do you notice that you are close to climax later than you would like?",
    scoring: { CT: 1 }
  },
  {
    id: "too_late_to_slow",
    type: "frequency",
    question: "When you try to slow down, does it often feel too late?",
    scoring: { CT: 1, PP: 0.5 }
  },
  {
    id: "checking_firmness",
    type: "frequency",
    question: "Do you check or test your erection to make sure it is working?",
    scoring: { FC: 1, PP: 0.5 }
  }
];

export const quizQuestions: readonly QuizQuestion[] = [
  ...frequencyQuestions,
  {
    id: "loop_triggers",
    type: "multiSelect",
    question: "When does the loop usually start?",
    subtitle: "Choose any that feel familiar.",
    options: triggerOptions
  }
];

export const defaultQuizResult: QuizResult = {
  scores: {
    PL: 0,
    PP: 0,
    CT: 0,
    FC: 0
  },
  normalizedScores: {
    PL: 0,
    PP: 0,
    CT: 0,
    FC: 0
  },
  primaryPattern: "generalStartingPoint",
  secondaryPattern: null,
  flags: {
    eveningWindow: false,
    emptyMoments: false,
    boredom: false,
    aloneTime: false,
    stressTrigger: false,
    phoneLoop: false,
    firmnessConcern: false
  },
  resultTitle: "A simple starting point",
  resultBody:
    "Your answers do not point strongly to one pattern yet. Bloom can start with a simple check-in and adjust as you use the app.",
  planName: "Starting plan",
  recommendedFirstAction: "startQuickCheckIn",
  firstPlanSteps: [
    {
      title: "Notice the moment",
      description: "Use a quick check-in when something feels automatic or unclear."
    },
    {
      title: "Try a short pause",
      description: "Use the 90-Second Pause when you want space before acting."
    },
    {
      title: "Let the plan adjust",
      description: "Bloom can personalize your next step as you add a few entries."
    }
  ],
  chips: ["General starting point"],
  completedAt: new Date(0).toISOString()
};

const allNeverFrequencyAnswers: Record<FrequencyQuestionId, FrequencyAnswerValue> = {
  porn_empty_moments: 0,
  porn_without_desire: 0,
  porn_to_masturbation: 0,
  automatic_phone_loop: 0,
  pressure_speed_friction: 0,
  force_arousal: 0,
  mechanical_get_it_done: 0,
  specific_pressure_dependency: 0,
  arousal_rises_fast: 0,
  notice_too_late: 0,
  too_late_to_slow: 0,
  checking_firmness: 0
};

export const debugQuizAnswerFixtures = {
  pornLoop: {
    ...allNeverFrequencyAnswers,
    porn_empty_moments: 3,
    porn_without_desire: 3,
    porn_to_masturbation: 3,
    automatic_phone_loop: 3,
    loop_triggers: ["beforeSleep", "bored", "scrolling"]
  },
  mixedPornPressure: {
    ...allNeverFrequencyAnswers,
    porn_empty_moments: 3,
    porn_without_desire: 3,
    porn_to_masturbation: 3,
    automatic_phone_loop: 3,
    pressure_speed_friction: 3,
    force_arousal: 3,
    mechanical_get_it_done: 3,
    specific_pressure_dependency: 3,
    checking_firmness: 3,
    loop_triggers: ["bathroom", "beforeSleep", "bored", "stressed", "alone", "scrolling"]
  },
  pressurePattern: {
    ...allNeverFrequencyAnswers,
    pressure_speed_friction: 3,
    force_arousal: 3,
    mechanical_get_it_done: 3,
    specific_pressure_dependency: 3,
    checking_firmness: 3,
    loop_triggers: ["stressed"]
  },
  controlTiming: {
    ...allNeverFrequencyAnswers,
    arousal_rises_fast: 3,
    notice_too_late: 3,
    too_late_to_slow: 3,
    loop_triggers: ["notSure"]
  },
  generalStartingPoint: {
    ...allNeverFrequencyAnswers,
    loop_triggers: ["notSure"]
  }
} satisfies Record<DebugProfileId, CompleteQuizAnswerFixture>;

export function getDebugQuizAnswers(profileId: DebugProfileId): CompleteQuizAnswerFixture {
  const fixture = debugQuizAnswerFixtures[profileId];

  return {
    ...fixture,
    loop_triggers: [...fixture.loop_triggers]
  };
}

export function createDebugQuizResult(
  profileId: DebugProfileId,
  completedAt = new Date().toISOString()
): QuizResult {
  return scoreOnboardingQuiz(getDebugQuizAnswers(profileId), completedAt);
}


const triggerMaxBonuses: QuizScores = {
  PL: 2.5,
  PP: 0.5,
  CT: 0,
  FC: 0
};

export const MINIMUM_PROFILE_SIGNAL = 0.35;
export const SECONDARY_STRONG_SIGNAL = 0.5;
export const SECONDARY_CLOSE_GAP = 0.12;
export const MIXED_PATTERN_SIGNAL = 0.5;
export const PARTIAL_PREVIEW_FREQUENCY_THRESHOLD = 4;

const scoreTieEpsilon = 0.0001;
// Exact or near-exact ties favor the lighter starting path: PL, then CT, then PP.
const patternTiePriority: Record<ScoredPatternId, number> = {
  pornLoop: 0,
  controlTiming: 1,
  pressurePattern: 2
};

export function scoreOnboardingQuiz(
  answers: QuizAnswerMap,
  completedAt = new Date().toISOString()
): QuizResult {
  const scores = createEmptyScores();
  const flags: QuizFlags = {
    eveningWindow: false,
    emptyMoments: false,
    boredom: false,
    aloneTime: false,
    stressTrigger: false,
    phoneLoop: false,
    firmnessConcern: false
  };

  for (const question of frequencyQuestions) {
    const answer = getFrequencyAnswer(answers[question.id]);
    addWeightedScores(scores, question.scoring, answer);
  }

  applyTriggerScores(getTriggerAnswers(answers.loop_triggers), scores, flags);

  const normalizedScores = getNormalizedScores(scores, getMaxPossibleScores());
  flags.firmnessConcern = normalizedScores.FC >= 0.5;

  const rankedPatterns = rankPatterns(normalizedScores);
  const primaryCandidate = rankedPatterns[0] ?? { id: "pornLoop", score: 0 };
  const secondaryCandidate = rankedPatterns[1] ?? { id: "pressurePattern", score: 0 };
  const primaryNormalized = primaryCandidate.score;

  if (primaryNormalized < MINIMUM_PROFILE_SIGNAL) {
    return buildGeneralStartingResult({
      scores,
      normalizedScores,
      flags,
      completedAt
    });
  }

  const mixedPornPressure = isStrongPornPressurePair(normalizedScores);

  if (mixedPornPressure) {
    const pornLoopRanksFirst =
      normalizedScores.PL > normalizedScores.PP ||
      areScoresTied(normalizedScores.PL, normalizedScores.PP);

    return buildQuizResult({
      scores,
      normalizedScores,
      flags,
      primaryPattern: pornLoopRanksFirst ? "pornLoop" : "pressurePattern",
      secondaryPattern: pornLoopRanksFirst ? "pressurePattern" : "pornLoop",
      mixedPornPressure: true,
      completedAt
    });
  }

  const secondaryPattern =
    secondaryCandidate.score >= SECONDARY_STRONG_SIGNAL ||
    (secondaryCandidate.score >= MINIMUM_PROFILE_SIGNAL &&
      primaryCandidate.score - secondaryCandidate.score <=
        SECONDARY_CLOSE_GAP + scoreTieEpsilon)
      ? secondaryCandidate.id
      : null;

  return buildQuizResult({
    scores,
    normalizedScores,
    flags,
    primaryPattern: primaryCandidate.id,
    secondaryPattern,
    mixedPornPressure: false,
    completedAt
  });
}

export function calculateQuizResultPreview(
  answers: QuizAnswerMap,
  completedAt = new Date().toISOString()
): QuizScoringPreview {
  const scoredResult = scoreOnboardingQuiz(answers, completedAt);
  const answeredFrequencyCount = frequencyQuestions.filter(
    (question) => getSelectedFrequencyAnswer(answers[question.id]) !== null
  ).length;
  const triggerAnswered = Array.isArray(answers.loop_triggers);
  const answeredStepCount = answeredFrequencyCount + (triggerAnswered ? 1 : 0);
  const hasEnoughFrequencyAnswers =
    answeredFrequencyCount >= PARTIAL_PREVIEW_FREQUENCY_THRESHOLD;

  return {
    result: hasEnoughFrequencyAnswers ? scoredResult : null,
    scores: scoredResult.scores,
    normalizedScores: scoredResult.normalizedScores,
    isComplete: answeredStepCount === quizQuestions.length,
    answeredFrequencyCount,
    answeredStepCount,
    totalSteps: quizQuestions.length,
    activeFlags: getActiveFlags(scoredResult.flags)
  };
}

export function getQuizQuestionContribution(
  question: QuizQuestion,
  answers: QuizAnswerMap
): QuizQuestionContribution {
  if (question.type === "multiSelect") {
    const selectedTriggers = getTriggerAnswers(answers.loop_triggers);
    const selectedLabels = selectedTriggers.map(getTriggerLabel);
    const triggerEffects = getTriggerEffects(selectedTriggers);

    if (selectedTriggers.length === 0) {
      return {
        selectedLabels,
        scoreContributions: [],
        flags: [],
        note: "No trigger selected yet."
      };
    }

    if (selectedTriggers.includes("notSure")) {
      return {
        selectedLabels,
        scoreContributions: [],
        flags: [],
        note: "Not sure selected. Trigger flags are ignored."
      };
    }

    return {
      selectedLabels,
      scoreContributions: scoresToContributions(triggerEffects.scores),
      flags: triggerEffects.flags,
      note: "Trigger effects from current selection."
    };
  }

  const selectedAnswer = getSelectedFrequencyAnswer(answers[question.id]);

  if (selectedAnswer === null) {
    return {
      selectedLabels: [],
      scoreContributions: [],
      flags: [],
      note: "No answer selected yet."
    };
  }

  return {
    selectedLabels: [getFrequencyAnswerLabel(selectedAnswer)],
    scoreContributions: scoringToContributions(question.scoring, selectedAnswer),
    flags: [],
    note: selectedAnswer === 0 ? "No score added." : "Contribution from this answer."
  };
}

function applyTriggerScores(
  selectedTriggers: TriggerOptionId[],
  scores: QuizScores,
  flags: QuizFlags
) {
  const triggerEffects = getTriggerEffects(selectedTriggers);

  for (const area of scoreAreas) {
    scores[area] += triggerEffects.scores[area];
  }

  for (const flag of triggerEffects.flags) {
    flags[flag] = true;
  }
}

function buildGeneralStartingResult({
  scores,
  normalizedScores,
  flags,
  completedAt
}: {
  scores: QuizScores;
  normalizedScores: NormalizedScores;
  flags: QuizFlags;
  completedAt: string;
}): QuizResult {
  return addComputedFields({
    scores,
    normalizedScores,
    flags,
    primaryPattern: "generalStartingPoint",
    secondaryPattern: null,
    resultTitle: "A simple starting point",
    resultBody:
      "Your answers do not point strongly to one pattern yet. Bloom can start with a simple check-in and adjust as you use the app.",
    planName: "Starting plan",
    recommendedFirstAction: "startQuickCheckIn",
    firstPlanSteps: [
      {
        title: "Notice the moment",
        description: "Use a quick check-in when something feels automatic or unclear."
      },
      {
        title: "Try a short pause",
        description: "Use the 90-Second Pause when you want space before acting."
      },
      {
        title: "Let the plan adjust",
        description: "Bloom can personalize your next step as you add a few entries."
      }
    ],
    chips: [
      "General starting point",
      ...(flags.firmnessConcern ? ["Firmness concern"] : [])
    ],
    completedAt
  });
}

function buildQuizResult({
  scores,
  normalizedScores,
  flags,
  primaryPattern,
  secondaryPattern,
  mixedPornPressure,
  completedAt
}: {
  scores: QuizScores;
  normalizedScores: NormalizedScores;
  flags: QuizFlags;
  primaryPattern: ScoredPatternId;
  secondaryPattern: ScoredPatternId | null;
  mixedPornPressure: boolean;
  completedAt: string;
}): QuizResult {
  if (mixedPornPressure) {
    return addComputedFields({
      scores,
      normalizedScores,
      flags,
      primaryPattern,
      secondaryPattern,
      resultTitle: "Porn loop + pressure pattern",
      resultBody:
        "Porn may be starting the loop before real desire is present, and masturbation may sometimes happen with pressure or rushing.",
      planName: "Porn loop reset",
      recommendedFirstAction: "setupProtection",
      firstPlanSteps: [
        {
          title: "Pause before porn",
          description: "Create friction before opening adult content."
        },
        {
          title: "Step away from pressure",
          description: "Avoid forced masturbation and checking for now."
        },
        {
          title: "Rebuild with practice",
          description: "Use guided practice when real desire is present."
        }
      ],
      chips: [
        "Porn loop",
        "Pressure pattern",
        ...(flags.eveningWindow ? ["Evening window"] : []),
        ...(flags.phoneLoop ? ["Phone loop"] : []),
        ...(flags.firmnessConcern ? ["Firmness concern"] : [])
      ],
      completedAt
    });
  }

  if (primaryPattern === "pornLoop") {
    return addComputedFields({
      scores,
      normalizedScores,
      flags,
      primaryPattern,
      secondaryPattern,
      resultTitle: "Porn loop pattern",
      resultBody:
        "Porn may be starting the loop before real desire is present. Bloom can help you create a pause first.",
      planName: "Porn loop reset",
      recommendedFirstAction: "setupProtection",
      firstPlanSteps: [
        {
          title: "Pause before porn",
          description: "Create friction before opening adult content."
        },
        {
          title: "Notice the trigger",
          description: "Check in when the loop feels automatic."
        },
        {
          title: "Rebuild with practice",
          description: "Use guided practice when real desire is present."
        }
      ],
      chips: [
        "Porn loop",
        ...(flags.emptyMoments ? ["Empty moments"] : []),
        ...(flags.eveningWindow ? ["Evening window"] : []),
        ...(flags.phoneLoop ? ["Phone loop"] : []),
        ...(flags.firmnessConcern ? ["Firmness concern"] : [])
      ],
      completedAt
    });
  }

  if (primaryPattern === "pressurePattern") {
    return addComputedFields({
      scores,
      normalizedScores,
      flags,
      primaryPattern,
      secondaryPattern,
      resultTitle: "Pressure pattern",
      resultBody:
        "Masturbation may sometimes happen with pressure, rushing, or checking. Bloom can help you take a short reset and rebuild with more awareness.",
      planName: "10-Day Reset",
      recommendedFirstAction: "startReset",
      firstPlanSteps: [
        {
          title: "Take a short reset",
          description: "Step away from porn, masturbation, and checking."
        },
        {
          title: "Reduce pressure",
          description: "Give the pressure pattern a short break."
        },
        {
          title: "Rebuild with practice",
          description: "Use guided practice when real desire is present."
        }
      ],
      chips: [
        "Pressure pattern",
        ...(flags.firmnessConcern ? ["Firmness concern"] : [])
      ],
      completedAt
    });
  }

  return addComputedFields({
    scores,
    normalizedScores,
    flags,
    primaryPattern,
    secondaryPattern,
    resultTitle: "Control and timing practice",
    resultBody:
      "Arousal may rise quickly or become harder to slow down later. Bloom can help you notice the rise earlier.",
    planName: "Arousal control practice",
    recommendedFirstAction: "startArousalPractice",
    firstPlanSteps: [
      {
        title: "Notice the rise earlier",
        description: "Use arousal levels to understand where you are."
      },
      {
        title: "Pause before it feels too late",
        description: "Practice pausing around your pause zone."
      },
      {
        title: "Reflect after practice",
        description: "Save what changed without judging the outcome."
      }
    ],
    chips: [
      "Control and timing",
      ...(secondaryPattern === "pressurePattern" ? ["Pressure pattern"] : []),
      ...(flags.firmnessConcern ? ["Firmness concern"] : [])
    ],
    completedAt
  });
}

function addComputedFields(result: QuizResult) {
  return {
    ...result,
    chips: result.chips.length > 0 ? result.chips : [getPatternLabel(result.primaryPattern)]
  };
}

function getMaxPossibleScores() {
  const frequencyMax = frequencyQuestions.reduce((totals, question) => {
    addWeightedScores(totals, question.scoring, 3);
    return totals;
  }, createEmptyScores());

  return {
    PL: frequencyMax.PL + triggerMaxBonuses.PL,
    PP: frequencyMax.PP + triggerMaxBonuses.PP,
    CT: frequencyMax.CT + triggerMaxBonuses.CT,
    FC: frequencyMax.FC + triggerMaxBonuses.FC
  };
}

function getNormalizedScores(scores: QuizScores, maxScores: QuizScores): NormalizedScores {
  return {
    PL: normalizeScore(scores.PL, maxScores.PL),
    PP: normalizeScore(scores.PP, maxScores.PP),
    CT: normalizeScore(scores.CT, maxScores.CT),
    FC: normalizeScore(scores.FC, maxScores.FC)
  };
}

function normalizeScore(score: number, maxScore: number) {
  if (maxScore <= 0) {
    return 0;
  }

  return Number(Math.min(score / maxScore, 1).toFixed(4));
}

function rankPatterns(scores: NormalizedScores) {
  return [
    { id: "pornLoop", score: scores.PL },
    { id: "pressurePattern", score: scores.PP },
    { id: "controlTiming", score: scores.CT }
  ].sort((first, second) => {
    const scoreDifference = second.score - first.score;

    if (!areScoresTied(first.score, second.score)) {
      return scoreDifference;
    }

    return (
      patternTiePriority[first.id as ScoredPatternId] -
      patternTiePriority[second.id as ScoredPatternId]
    );
  }) as Array<{
    id: ScoredPatternId;
    score: number;
  }>;
}

function addWeightedScores(scores: QuizScores, weights: ScoreWeights, multiplier: number) {
  for (const area of scoreAreas) {
    scores[area] += (weights[area] ?? 0) * multiplier;
  }
}

function createEmptyScores(): QuizScores {
  return {
    PL: 0,
    PP: 0,
    CT: 0,
    FC: 0
  };
}

function getFrequencyAnswer(value: unknown): FrequencyAnswerValue {
  return getSelectedFrequencyAnswer(value) ?? 0;
}

function getSelectedFrequencyAnswer(value: unknown): FrequencyAnswerValue | null {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null;
}

function getTriggerAnswers(value: unknown): TriggerOptionId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TriggerOptionId =>
    triggerOptions.some((option) => option.id === item)
  );
}

export function getPatternLabel(pattern: PatternId) {
  switch (pattern) {
    case "generalStartingPoint":
      return "General starting point";
    case "pressurePattern":
      return "Pressure pattern";
    case "controlTiming":
      return "Control and timing";
    case "pornLoop":
    default:
      return "Porn loop";
  }
}

export function getRecommendedFirstActionLabel(action: QuizResult["recommendedFirstAction"]) {
  switch (action) {
    case "startQuickCheckIn":
      return "Start a Quick Check-In";
    case "startReset":
      return "Start 10-Day Reset";
    case "startArousalPractice":
      return "Start Arousal Control Practice";
    case "setupProtection":
    default:
      return "Set up Protection";
  }
}

function getTriggerEffects(selectedTriggers: TriggerOptionId[]) {
  const scores = createEmptyScores();
  const flags = new Set<TriggerFlag>();

  if (selectedTriggers.includes("notSure")) {
    return {
      scores,
      flags: [] as TriggerFlag[]
    };
  }

  if (selectedTriggers.includes("beforeSleep")) {
    flags.add("eveningWindow");
  }

  if (selectedTriggers.includes("bored")) {
    flags.add("boredom");
    scores.PL += 1;
  }

  if (selectedTriggers.includes("alone")) {
    flags.add("aloneTime");
  }

  if (selectedTriggers.includes("stressed")) {
    flags.add("stressTrigger");
    scores.PP += 0.5;
  }

  if (selectedTriggers.includes("scrolling")) {
    flags.add("emptyMoments");
    flags.add("phoneLoop");
    scores.PL += 1;
  }

  if (
    selectedTriggers.some((trigger) =>
      ["bathroom", "workBreak", "gamingBreak"].includes(trigger)
    )
  ) {
    flags.add("emptyMoments");
    scores.PL += 0.5;
  }

  if (
    selectedTriggers.includes("beforeSleep") &&
    (selectedTriggers.includes("bored") || selectedTriggers.includes("alone"))
  ) {
    flags.add("eveningWindow");
  }

  return {
    scores,
    flags: Array.from(flags)
  };
}

function scoringToContributions(weights: ScoreWeights, multiplier: number) {
  const scores = createEmptyScores();
  addWeightedScores(scores, weights, multiplier);

  return scoresToContributions(scores);
}

function scoresToContributions(scores: QuizScores) {
  return scoreAreas
    .map((area) => ({
      area,
      value: scores[area]
    }))
    .filter((contribution) => contribution.value > 0);
}

function getActiveFlags(flags: QuizFlags) {
  return (Object.entries(flags) as Array<[keyof QuizFlags, boolean]>)
    .filter(([, enabled]) => enabled)
    .map(([flag]) => flag);
}

function getFrequencyAnswerLabel(value: FrequencyAnswerValue) {
  return frequencyAnswers.find((answer) => answer.value === value)?.label ?? "Not selected";
}

function getTriggerLabel(value: TriggerOptionId) {
  return triggerOptions.find((option) => option.id === value)?.label ?? value;
}

function isStrongPornPressurePair(scores: NormalizedScores) {
  // When all three axes tie, PL + PP is the intentional v1 simplification.
  return (
    scores.PL >= MIXED_PATTERN_SIGNAL &&
    scores.PP >= MIXED_PATTERN_SIGNAL &&
    scores.PL + scoreTieEpsilon >= scores.CT &&
    scores.PP + scoreTieEpsilon >= scores.CT
  );
}

function areScoresTied(first: number, second: number) {
  return Math.abs(first - second) <= scoreTieEpsilon;
}

const scoreAreas: readonly ScoreArea[] = ["PL", "PP", "CT", "FC"];
