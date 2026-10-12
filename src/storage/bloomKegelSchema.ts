import type { CompletedKegelSession, KegelState } from "../domain/models/KegelState";
import { isValidBloomDateKey, isValidBloomIsoTimestamp } from "./bloomValueValidation";

const record = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Kegel object");
  return value as Record<string, unknown>;
};
const number = (value: unknown, integer = false, positive = false): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 ||
      (positive && value === 0) || (integer && !Number.isSafeInteger(value))) throw new Error("Invalid Kegel number");
  return value;
};
const timestamp = (value: unknown): string => {
  if (!isValidBloomIsoTimestamp(value)) throw new Error("Invalid Kegel timestamp");
  return value as string;
};
const id = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error("Invalid Kegel identity");
  return value;
};

export function normalizeCompletedKegelSession(value: unknown): CompletedKegelSession {
  const v = record(value), p = record(v.program), m = record(v.metrics);
  if (v.status !== "completed" || p.provisional !== true || !isValidBloomDateKey(v.completionDate)) throw new Error("Invalid completed Kegel session");
  const program = {
    configurationId: id(p.configurationId), provisional: true as const,
    repetitions: number(p.repetitions, true, true), contractionSeconds: number(p.contractionSeconds, false, true),
    relaxationSeconds: number(p.relaxationSeconds, false, true), countdownSeconds: number(p.countdownSeconds),
    dailyTarget: number(p.dailyTarget, true, true)
  };
  const startedAt = timestamp(v.startedAt), completedAt = timestamp(v.completedAt);
  const offset = v.completionUtcOffsetMinutes;
  if (typeof offset !== "number" || !Number.isInteger(offset) || Math.abs(offset) > 1440) throw new Error("Invalid Kegel timezone offset");
  const local = new Date(Date.parse(completedAt) - offset * 60000).toISOString().slice(0, 10);
  const completedRepetitions = number(v.completedRepetitions, true, true);
  const metrics = {
    activeExerciseSeconds: number(m.activeExerciseSeconds), elapsedSeconds: number(m.elapsedSeconds),
    pausedSeconds: number(m.pausedSeconds), pauseCount: number(m.pauseCount, true)
  };
  const expected = program.repetitions * (program.contractionSeconds + program.relaxationSeconds);
  const wallSeconds=(Date.parse(completedAt)-Date.parse(startedAt))/1000;
  if (completedRepetitions !== program.repetitions || wallSeconds < expected+program.countdownSeconds ||
      metrics.elapsedSeconds > wallSeconds+.25 ||
      local !== v.completionDate || Math.abs(metrics.activeExerciseSeconds - expected) > .001 ||
      metrics.elapsedSeconds < expected + program.countdownSeconds ||
      Math.abs(metrics.elapsedSeconds - expected - program.countdownSeconds - metrics.pausedSeconds) > .001) {
    throw new Error("Incomplete or inconsistent Kegel session");
  }
  return { id: id(v.id), status: "completed", startedAt, completedAt, completionDate: v.completionDate as string,
    completionUtcOffsetMinutes: offset, program, completedRepetitions, metrics };
}

export function normalizeKegelState(value: unknown): KegelState {
  const v = record(value);
  const onboardingCompletedAt = v.onboardingCompletedAt === null ? null : timestamp(v.onboardingCompletedAt);
  if (!Array.isArray(v.sessions)) throw new Error("Invalid Kegel sessions");
  const seen = new Set<string>();
  const sessions = v.sessions.map(normalizeCompletedKegelSession);
  for (const session of sessions) {
    if (seen.has(session.id)) throw new Error("Duplicate persisted Kegel identity");
    seen.add(session.id);
  }
  // Invalid data rejects hydration and invokes the existing raw-payload backup;
  // never silently drop a user's completed sessions or fabricate replacements.
  return { onboardingCompletedAt, sessions };
}
