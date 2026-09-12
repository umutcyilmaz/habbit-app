import type { BehaviorEventSource } from "./BehaviorEventSource";
import type { PostResetAssessment } from "./PostResetAssessment";
import type { ResetBaseline } from "./ResetBaseline";
import type { ISODateString, UUID } from "./shared";

export type IncompleteResetDays = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type ResetCompletedDays = IncompleteResetDays | 15;

type ResetViolationRecord = {
  id: UUID;
  attemptId: UUID;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  source: BehaviorEventSource;
  // A combined event restarts Reset once; its source also identifies the
  // Content-Free violation if Content-Free is active.
  reason: "masturbation" | "intentionalExplicitContent" | "masturbationWithExplicitContent";
  // Prior best may include a historical summary not represented by attempts.
  // New logs capture it exactly; older migrated records leave it unknown.
  bestCompletedDaysBefore?: ResetCompletedDays;
};

export type ResetViolation = ResetViolationRecord &
  (
    | { status: "recorded" }
    | { status: "undone"; undoneAt: ISODateString }
  );

type ResetAttemptIdentity = {
  id: UUID;
  startedAt: ISODateString;
};

export type ActiveResetAttempt = ResetAttemptIdentity & {
  status: "active";
  // Live progress is derived from startedAt and an explicit current time.
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
  // New baseline starts match currentAttempt.startedAt. Historical restarted
  // journeys may retain their earlier start; live progress uses the attempt.
  startedAt: ISODateString;
  baseline: ResetBaseline;
};

type FinishedResetJourney = StartedResetJourney & {
  bestCompletedDays: 15;
  completedAt: ISODateString;
  currentAttempt: CompletedResetAttempt;
};

// The active period lasts 15 elapsed days from the current attempt's start.
// A later action records assessment_pending; a stale active status or pending
// assessment cannot extend the period. New session starts use effective Reset
// restriction at their supplied start time, based on the current attempt.
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
