import type {
  NormalizedScores,
  PatternId,
  QuizFlags,
  QuizResult,
  QuizScores
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
  result: QuizResult;
  isComplete: boolean;
  answeredStepCount: number;
  totalSteps: number;
  activeFlags: Array<keyof QuizFlags>;
};

export type DebugProfileId =
  | "pornLoop"
  | "mixedPornPressure"
  | "pressurePattern"
  | "controlTiming";

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
  primaryPattern: "pornLoop",
  secondaryPattern: "pressurePattern",
  flags: {
    eveningWindow: true,
    emptyMoments: true,
    boredom: false,
    aloneTime: false,
    stressTrigger: false,
    phoneLoop: false,
    firmnessConcern: true
  },
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
  chips: ["Porn loop", "Pressure pattern", "Evening window", "Firmness concern"],
  completedAt: new Date(0).toISOString()
};

export function createDebugQuizResult(
  profileId: DebugProfileId,
  completedAt = new Date().toISOString()
): QuizResult {
  switch (profileId) {
    case "mixedPornPressure":
      return {
        scores: {
          PL: 10,
          PP: 9,
          CT: 2,
          FC: 4
        },
        normalizedScores: {
          PL: 0.85,
          PP: 0.75,
          CT: 0.25,
          FC: 0.55
        },
        primaryPattern: "pornLoop",
        secondaryPattern: "pressurePattern",
        flags: {
          eveningWindow: true,
          emptyMoments: true,
          boredom: true,
          aloneTime: true,
          stressTrigger: false,
          phoneLoop: true,
          firmnessConcern: true
        },
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
        chips: ["Porn loop", "Pressure pattern", "Evening window", "Phone loop", "Firmness concern"],
        completedAt
      };
    case "pressurePattern":
      return {
        scores: {
          PL: 2,
          PP: 10,
          CT: 3,
          FC: 4
        },
        normalizedScores: {
          PL: 0.2,
          PP: 0.85,
          CT: 0.35,
          FC: 0.55
        },
        primaryPattern: "pressurePattern",
        secondaryPattern: null,
        flags: {
          eveningWindow: false,
          emptyMoments: false,
          boredom: false,
          aloneTime: false,
          stressTrigger: true,
          phoneLoop: false,
          firmnessConcern: true
        },
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
        chips: ["Pressure pattern", "Firmness concern"],
        completedAt
      };
    case "controlTiming":
      return {
        scores: {
          PL: 1,
          PP: 3,
          CT: 9,
          FC: 1
        },
        normalizedScores: {
          PL: 0.1,
          PP: 0.3,
          CT: 0.9,
          FC: 0.2
        },
        primaryPattern: "controlTiming",
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
        chips: ["Control and timing"],
        completedAt
      };
    case "pornLoop":
    default:
      return {
        scores: {
          PL: 10,
          PP: 3,
          CT: 1,
          FC: 1
        },
        normalizedScores: {
          PL: 0.85,
          PP: 0.25,
          CT: 0.15,
          FC: 0.2
        },
        primaryPattern: "pornLoop",
        secondaryPattern: null,
        flags: {
          eveningWindow: true,
          emptyMoments: true,
          boredom: true,
          aloneTime: false,
          stressTrigger: false,
          phoneLoop: true,
          firmnessConcern: false
        },
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
        chips: ["Porn loop", "Empty moments", "Evening window", "Phone loop"],
        completedAt
      };
  }
}


const triggerMaxBonuses: QuizScores = {
  PL: 2.5,
  PP: 0.5,
  CT: 0,
  FC: 0
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
  const secondaryPattern =
    secondaryCandidate.score >= 0.5 || primaryCandidate.score - secondaryCandidate.score <= 0.18
      ? secondaryCandidate.id
      : null;
  const mixedPornPressure =
    normalizedScores.PL >= 0.5 &&
    normalizedScores.PP >= 0.5 &&
    isPornPressurePair(primaryCandidate.id, secondaryPattern);

  return buildQuizResult({
    scores,
    normalizedScores,
    flags,
    primaryPattern: primaryCandidate.id,
    secondaryPattern,
    mixedPornPressure,
    completedAt
  });
}

export function calculateQuizResultPreview(answers: QuizAnswerMap): QuizScoringPreview {
  const result = scoreOnboardingQuiz(answers);
  const answeredFrequencyCount = frequencyQuestions.filter(
    (question) => getSelectedFrequencyAnswer(answers[question.id]) !== null
  ).length;
  const triggerAnswered = Array.isArray(answers.loop_triggers);
  const answeredStepCount = answeredFrequencyCount + (triggerAnswered ? 1 : 0);

  return {
    result,
    isComplete: answeredStepCount === quizQuestions.length,
    answeredStepCount,
    totalSteps: quizQuestions.length,
    activeFlags: getActiveFlags(result.flags)
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
  primaryPattern: PatternId;
  secondaryPattern: PatternId | null;
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
  ].sort((first, second) => second.score - first.score) as Array<{
    id: PatternId;
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

function isPornPressurePair(primaryPattern: PatternId, secondaryPattern: PatternId | null) {
  return (
    (primaryPattern === "pornLoop" && secondaryPattern === "pressurePattern") ||
    (primaryPattern === "pressurePattern" && secondaryPattern === "pornLoop")
  );
}

const scoreAreas: readonly ScoreArea[] = ["PL", "PP", "CT", "FC"];
