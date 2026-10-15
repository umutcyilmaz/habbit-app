import { createUrgeExerciseTimer } from "../exercise/urgeExerciseTimer";

export {
  formatUrgeExerciseTime as formatUrgePreviewTime,
  getUrgeExerciseBreath as getUrgePreviewBreath,
  urgeExerciseMinutes as urgePreviewMinutes
} from "../exercise/urgeExerciseTimer";
export type {
  UrgeExercisePhase as UrgePreviewPhase,
  UrgeExerciseSnapshot as UrgePreviewSnapshot
} from "../exercise/urgeExerciseTimer";

// Compatibility adapter for the gated Phase 11.8.1 completion fixture.
export function createUrgePreviewTimer(now: () => number, completionFixture = false) {
  return createUrgeExerciseTimer(now, completionFixture
    ? { initialDurationMs: 2_000, allowDurationSelection: false }
    : undefined);
}
