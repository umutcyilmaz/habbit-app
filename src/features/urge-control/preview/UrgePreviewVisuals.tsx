import { UrgeExerciseAtmosphere, UrgeExerciseLCD } from "../exercise/UrgeExerciseVisuals";

export const UrgePreviewAtmosphere = UrgeExerciseAtmosphere;
export function UrgePreviewLCD({ remainingMs }: { remainingMs: number }) {
  return <UrgeExerciseLCD remainingMs={remainingMs} testID="urge.preview.lcd" />;
}
