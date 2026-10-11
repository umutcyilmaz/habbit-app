import { kegelPreviewConfig, type KegelWorkoutConfig } from "./kegelConfig";

export type KegelFrame = {
  phase: "countdown" | "contract" | "relax" | "completed";
  repetition: number;
  secondsLeft: number;
  progress: number;
};

// Pure active-time projection: pausing never consumes time; completion includes
// the final relaxation. No clock, persistence, history or legacy state here.
export function getKegelFrame(activeMs: number, config: KegelWorkoutConfig = kegelPreviewConfig): KegelFrame {
  const elapsed = Math.max(0, activeMs);
  const countdown = config.countdownSeconds * 1000;
  if (elapsed < countdown) return { phase: "countdown", repetition: 1, secondsLeft: Math.ceil((countdown - elapsed) / 1000), progress: 0 };
  const contraction = config.contractionSeconds * 1000;
  const relaxation = config.relaxationSeconds * 1000;
  const cycle = contraction + relaxation;
  const practice = elapsed - countdown;
  if (practice >= cycle * config.repetitions) return { phase: "completed", repetition: config.repetitions, secondsLeft: 0, progress: 0 };
  const within = practice % cycle;
  const contract = within < contraction;
  const phaseElapsed = contract ? within : within - contraction;
  const duration = contract ? contraction : relaxation;
  return {
    phase: contract ? "contract" : "relax",
    repetition: Math.floor(practice / cycle) + 1,
    secondsLeft: Math.max(1, Math.ceil((duration - phaseElapsed) / 1000)),
    progress: contract ? phaseElapsed / duration : 1 - phaseElapsed / duration
  };
}

export type KegelPreviewData = {
  kind: "empty" | "design";
  done: number;
  streak: number | null;
  total: number | null;
  week: readonly number[] | null;
  heat: readonly number[] | null;
  dayIndex: number | null;
};

export function createKegelPreviewData(kind: KegelPreviewData["kind"]): KegelPreviewData {
  if (kind === "empty") return { kind, done: 0, streak: null, total: null, week: null, heat: null, dayIndex: null };
  return { kind, done: 1, streak: 4, total: 340, week: [3, 3, 1, 0, 0, 0, 0],
    heat: [2,3,1,0,3,2,3,3,2,0,1,3,3,2,3,1,2,3,3,0,2,3,3,2,3,3,3,1], dayIndex: 2 };
}

export function getKegelSetName(done: number) {
  return `${kegelPreviewConfig.setNames[Math.min(done, kegelPreviewConfig.setNames.length - 1)]} seti`;
}
