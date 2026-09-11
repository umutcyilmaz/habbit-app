import { erectionQualityValues } from "./types";
import type {
  BehaviorFrequencyAnswer,
  BloomOnboardingAnswers,
  TypicalErectionQualityAnswer
} from "./types";

type QuestionOption<Value> = {
  readonly value: Value;
  readonly label: string;
};

type QuestionCopy = {
  readonly questionNumber: number;
  readonly prompt: string;
  readonly supportingText?: string;
  readonly purpose:
    | "context"
    | "contentDysregulation"
    | "erectionResponseConcern"
    | "stimulationPattern"
    | "safetyFlag";
};

// The question ID determines both its selection mode and its allowed values.
// Copy stays here; the scorer uses only the raw answer types and values.
type QuestionFor<Id extends keyof BloomOnboardingAnswers> = QuestionCopy & (
  BloomOnboardingAnswers[Id] extends readonly (infer Value)[]
    ? {
        readonly id: Id;
        readonly type: "multi_select";
        readonly options: readonly QuestionOption<Value>[];
        readonly exclusiveOptions: readonly Value[];
      }
    : {
        readonly id: Id;
        readonly type: "single_select";
        readonly options: readonly QuestionOption<BloomOnboardingAnswers[Id]>[];
      }
);

export type BloomOnboardingQuestion = {
  [Id in keyof BloomOnboardingAnswers]: QuestionFor<Id>;
}[keyof BloomOnboardingAnswers];

const frequencyOptions = [
  { value: "never", label: "Never" },
  { value: "rarely", label: "Rarely" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "almostAlways", label: "Almost always" },
  { value: "notSure", label: "Not sure" }
] as const satisfies readonly QuestionOption<BehaviorFrequencyAnswer>[];

const erectionQualityOptions: readonly QuestionOption<TypicalErectionQualityAnswer>[] =
  erectionQualityValues.map((value) => ({
    value,
    label: value === "notSure" ? "Not sure" : String(value)
  }));

export const bloomOnboardingQuestions = [
  {
    id: "explicitContentFrequency",
    type: "single_select",
    questionNumber: 1,
    prompt: "In the last 4 weeks, how often did you intentionally view explicit content?",
    purpose: "context",
    options: [
      { value: "never", label: "Never" },
      { value: "lessThanWeekly", label: "Less than once a week" },
      { value: "weekly", label: "About once a week" },
      { value: "severalDaysAWeek", label: "Several days a week" },
      { value: "dailyOrMore", label: "Daily or more often" },
      { value: "notSure", label: "Not sure" }
    ]
  },
  {
    id: "unplannedContentUse",
    type: "single_select",
    questionNumber: 2,
    prompt: "In the last 4 weeks, how often did you open explicit content without planning to, while doing something else?",
    purpose: "contentDysregulation",
    options: frequencyOptions
  },
  {
    id: "activityInterruption",
    type: "single_select",
    questionNumber: 3,
    prompt: "In the last 4 weeks, how often did you interrupt study, work, or another daily activity to briefly switch to explicit content?",
    purpose: "contentDysregulation",
    options: frequencyOptions
  },
  {
    id: "contentTriggeredMasturbation",
    type: "single_select",
    questionNumber: 4,
    prompt: "In the last 4 weeks, how often did viewing explicit content lead to masturbation when you had not initially intended to masturbate?",
    purpose: "contentDysregulation",
    options: frequencyOptions
  },
  {
    id: "repeatedContentReturn",
    type: "single_select",
    questionNumber: 5,
    prompt: "In the last 4 weeks, how often did you repeatedly return to explicit content on the same day after closing it?",
    purpose: "contentDysregulation",
    options: frequencyOptions
  },
  {
    id: "difficultyReducingContent",
    type: "single_select",
    questionNumber: 6,
    prompt: "In the last 4 weeks, how often was it difficult to stick to a decision to reduce or not view explicit content?",
    purpose: "contentDysregulation",
    options: [
      ...frequencyOptions,
      { value: "neverTriedToReduce", label: "I have never tried to reduce or stop viewing it" }
    ]
  },
  {
    id: "erectionQuality",
    type: "single_select",
    questionNumber: 7,
    prompt: "In the last 4 weeks, how would you describe your typical erection quality during masturbation?",
    supportingText: "Use your own experience: 1 means very low quality and 10 means very high quality. Choose Not sure if you do not have a clear answer.",
    purpose: "erectionResponseConcern",
    options: erectionQualityOptions
  },
  {
    id: "erectionMaintenanceDifficulty",
    type: "single_select",
    questionNumber: 8,
    prompt: "In the last 4 weeks, how often was it difficult to maintain an erection during masturbation?",
    purpose: "erectionResponseConcern",
    options: frequencyOptions
  },
  {
    id: "masturbationTechniques",
    type: "multi_select",
    questionNumber: 9,
    prompt: "Which techniques did you typically use during masturbation in the last 4 weeks?",
    supportingText: "Select all that apply, or choose Not sure on its own.",
    purpose: "stimulationPattern",
    options: [
      { value: "normalHandTechnique", label: "Hand stimulation at a comfortable speed and pressure" },
      { value: "veryHighSpeed", label: "Very high speed" },
      { value: "veryTightPressure", label: "Very tight pressure" },
      { value: "frictionThroughClothing", label: "Friction through clothing" },
      { value: "rubbingAgainstBedPillowSurface", label: "Rubbing against a bed, pillow, or another surface" },
      { value: "proneRubbing", label: "Rubbing while lying face down" },
      { value: "other", label: "Another technique" },
      { value: "notSure", label: "Not sure" }
    ],
    exclusiveOptions: ["notSure"]
  },
  {
    id: "techniqueDependency",
    type: "single_select",
    questionNumber: 10,
    prompt: "In the last 4 weeks, how often was it difficult to continue or finish masturbating without your usual pressure, speed, position, or technique?",
    purpose: "stimulationPattern",
    options: frequencyOptions
  },
  {
    id: "delayedOrDifficultEjaculation",
    type: "single_select",
    questionNumber: 11,
    prompt: "In the last 4 weeks, how often did masturbation take much longer than you wanted, or was ejaculation difficult?",
    purpose: "erectionResponseConcern",
    options: frequencyOptions
  },
  {
    id: "safetySignals",
    type: "multi_select",
    questionNumber: 12,
    prompt: "Have you noticed any of the following?",
    supportingText: "Select all that apply. You can select Not sure alongside something you have noticed. Select None of these on its own.",
    purpose: "safetyFlag",
    options: [
      { value: "suddenPersistentErectionChange", label: "A sudden, lasting change in erections" },
      { value: "pain", label: "Pain" },
      { value: "numbnessOrSensationChange", label: "Numbness or a change in sensation" },
      { value: "newMarkedCurvature", label: "A new, noticeable curvature" },
      { value: "none", label: "None of these" },
      { value: "unsure", label: "Not sure" }
    ],
    exclusiveOptions: ["none"]
  }
] as const satisfies readonly BloomOnboardingQuestion[];
