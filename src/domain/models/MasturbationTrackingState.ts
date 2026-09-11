import type { MasturbationSession } from "./MasturbationSession";

export type ActiveMasturbationSession = Extract<MasturbationSession, { status: "active" }>;
export type AwaitingFeedbackMasturbationSession = Extract<
  MasturbationSession,
  { status: "awaiting_feedback" }
>;
export type CompletedMasturbationSession = Extract<MasturbationSession, { status: "completed" }>;

export type MasturbationTrackingState = {
  enabled: boolean;
  currentSession: ActiveMasturbationSession | AwaitingFeedbackMasturbationSession | null;
  sessions: CompletedMasturbationSession[];
};
