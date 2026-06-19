export type ExerciseId =
  | "ninetySecondPause"
  | "breathingReset"
  | "arousalAwareness"
  | "contentSupport";

export interface ExerciseSummary {
  id: ExerciseId;
  title: string;
  durationSeconds?: number;
}
