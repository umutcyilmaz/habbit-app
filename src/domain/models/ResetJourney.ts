import type { BehaviorEventSource } from "./BehaviorEventSource";
import type { PostResetAssessment } from "./PostResetAssessment";
import type { ResetBaseline } from "./ResetBaseline";
import type { ISODateString, UUID } from "./shared";

export type IncompleteResetDays = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type ResetCompletedDays = IncompleteResetDays | 15;

export type ResetViolation = {
  id: UUID;
  attemptId: UUID;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  source: BehaviorEventSource;
  // A combined event restarts Reset once; its source also identifies the
  // Content-Free violation if Content-Free is active.
  reason: "masturbation" | "intentionalExplicitContent" | "masturbationWithExplicitContent";
};

type ResetAttemptIdentity = {
  id: UUID;
  startedAt: ISODateString;
};

export type ActiveResetAttempt = ResetAttemptIdentity & {
  status: "active";
  completedDays: IncompleteResetDays;
};

export type RestartedResetAttempt = ResetAttemptIdentity & {
  status: "restarted";
  endedAt: ISODateString;
  completedDays: IncompleteResetDays;
  restartViolationId: UUID;
};

export type CompletedResetAttempt = ResetAttemptIdentity & {
  status: "completed";
  completedAt: ISODateString;
  completedDays: 15;
};

export type ResetAttempt = ActiveResetAttempt | RestartedResetAttempt | CompletedResetAttempt;

type ResetJourneyHistory = {
  durationDays: 15;
  bestCompletedDays: ResetCompletedDays;
  // The current attempt is separate; restarting archives it without losing progress.
  pastAttempts: Array<RestartedResetAttempt | CompletedResetAttempt>;
  violations: ResetViolation[];
};

type StartedResetJourney = {
  id: UUID;
  startedAt: ISODateString;
  baseline: ResetBaseline;
};

type FinishedResetJourney = StartedResetJourney & {
  bestCompletedDays: 15;
  completedAt: ISODateString;
  currentAttempt: CompletedResetAttempt;
};

// Only active restricts starting a session. At 15 days, assessment_pending
// records the restriction's end; unfinished assessment cannot extend it.
export type ResetJourney = ResetJourneyHistory &
  (
    | { status: "inactive" }
    | { status: "recommended"; id: UUID }
    | { status: "baseline_pending"; id: UUID }
    | (StartedResetJourney & {
        status: "active";
        currentAttempt: ActiveResetAttempt;
      })
    | (FinishedResetJourney & { status: "assessment_pending" })
    | (FinishedResetJourney & {
        status: "completed";
        assessment: PostResetAssessment;
      })
  );
