/** Provisional HTML examples, ONLY for the in-memory preview. No program policy. */
export const kegelPreviewConfig = {
  repetitions: 10,
  contractionSeconds: 3,
  relaxationSeconds: 3,
  countdownSeconds: 3,
  trainer: { holdSeconds: 3, repetitions: 3, minimumHoldSeconds: 2.5, longHoldSeconds: 7, advanceDelayMs: 1400 },
  dailyTarget: 3,
  setNames: ["Sabah", "Öğle", "Akşam"],
  exampleLevels: [
    { name: "Temel", seconds: 3 },
    { name: "Uzun tutuş", seconds: 5 },
    { name: "Dayanıklılık", seconds: 8 },
    { name: "Tam güç", seconds: 10 }
  ],
  exampleProgressionDays: 7,
  tips: ["Kası içeri ve yukarı çek", "Nefes almaya devam et", "Kalçan ve karnın gevşek", "Tamamen bırak", "Acele yok, ritmi takip et"]
} as const;

export type KegelWorkoutConfig = { repetitions:number; contractionSeconds:number; relaxationSeconds:number; countdownSeconds:number };
