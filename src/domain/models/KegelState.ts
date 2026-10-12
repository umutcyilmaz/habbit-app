export type KegelProgramSnapshot = {
  configurationId: string;
  provisional: true;
  repetitions: number;
  contractionSeconds: number;
  relaxationSeconds: number;
  countdownSeconds: number;
  dailyTarget: number;
};

export type KegelSessionMetrics = {
  activeExerciseSeconds: number;
  elapsedSeconds: number;
  pausedSeconds: number;
  pauseCount: number;
};

export type CompletedKegelSession = {
  id: string;
  status: "completed";
  startedAt: string;
  completedAt: string;
  completionDate: string;
  completionUtcOffsetMinutes: number;
  program: KegelProgramSnapshot;
  completedRepetitions: number;
  metrics: KegelSessionMetrics;
};

export type KegelState = {
  onboardingCompletedAt: string | null;
  sessions: CompletedKegelSession[];
};
