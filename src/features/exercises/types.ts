export type ExerciseStatus = "available" | "comingNext" | "premiumLater";

export type ExerciseRouteTarget = "/pause" | "/(tabs)/log";

export type ExerciseId =
  | "ninetySecondPause"
  | "breathingReset"
  | "quickCheckIn"
  | "privateReflection"
  | "arousalAwareness"
  | "contentSupport"
  | "eveningWindDown";

export type ExerciseCategoryId =
  | "pauseGrounding"
  | "awarenessReflection"
  | "arousalAwareness"
  | "contentSupport"
  | "eveningSupport";

export interface ExerciseDuration {
  label: string;
}

export interface ExerciseItem {
  id: ExerciseId;
  title: string;
  description: string;
  duration: ExerciseDuration;
  status: ExerciseStatus;
  actionLabel: string;
  route?: ExerciseRouteTarget;
}

export interface ExerciseCategory {
  id: ExerciseCategoryId;
  title: string;
  items: ExerciseItem[];
}

export interface RecommendedExercise {
  title: string;
  exercise: ExerciseItem;
  reason: string;
  primaryCta: string;
  secondaryCta: string;
  helpCopy: string;
}
