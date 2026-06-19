import type { ExerciseCategory, RecommendedExercise } from "../types";

const ninetySecondPause = {
  id: "ninetySecondPause",
  title: "90-Second Pause",
  description: "Create a short moment before reacting.",
  duration: { label: "1-3 min" },
  status: "available",
  actionLabel: "Start",
  route: "/pause"
} as const;

export const exerciseCategories: ExerciseCategory[] = [
  {
    id: "pauseGrounding",
    title: "Pause & Grounding",
    items: [
      ninetySecondPause,
      {
        id: "breathingReset",
        title: "Breathing Reset",
        description: "Slow down and notice what is present.",
        duration: { label: "2 min" },
        status: "comingNext",
        actionLabel: "Preview only"
      }
    ]
  },
  {
    id: "awarenessReflection",
    title: "Awareness & Reflection",
    items: [
      {
        id: "quickCheckIn",
        title: "Quick Check-In",
        description: "Notice your current state with a few small signals.",
        duration: { label: "1 min" },
        status: "available",
        actionLabel: "Start",
        route: "/(tabs)/log"
      },
      {
        id: "privateReflection",
        title: "Private Reflection",
        description: "Write a short note for yourself.",
        duration: { label: "2 min" },
        status: "comingNext",
        actionLabel: "Preview only"
      }
    ]
  },
  {
    id: "arousalAwareness",
    title: "Arousal Awareness",
    items: [
      {
        id: "arousalAwareness",
        title: "Arousal Awareness Practice",
        description: "Notice arousal earlier without chasing outcomes.",
        duration: { label: "3-5 min" },
        status: "comingNext",
        actionLabel: "Preview only"
      }
    ]
  },
  {
    id: "contentSupport",
    title: "Content Support",
    items: [
      {
        id: "contentSupport",
        title: "Content Support",
        description: "Add a gentle pause before an automatic content loop continues.",
        duration: { label: "1-3 min" },
        status: "comingNext",
        actionLabel: "Preview only"
      }
    ]
  },
  {
    id: "eveningSupport",
    title: "Evening Support",
    items: [
      {
        id: "eveningWindDown",
        title: "Evening Wind-Down",
        description: "Prepare for sensitive hours with a calmer routine.",
        duration: { label: "5 min" },
        status: "comingNext",
        actionLabel: "Preview only"
      }
    ]
  }
];

export const recommendedExercise: RecommendedExercise = {
  title: "Recommended for tonight",
  exercise: ninetySecondPause,
  reason: "A short pause may help when the evening feels automatic.",
  primaryCta: "Start Pause",
  secondaryCta: "Why this helps",
  helpCopy: "A short pause creates a little space before the next choice. You remain in control."
};
