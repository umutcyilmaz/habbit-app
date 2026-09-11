import type { BehaviorEventSource } from "./BehaviorEventSource";
import type { ISODateString, UUID } from "./shared";

export type ContentFreeStreakSnapshot = {
  currentStreakStartedAt: ISODateString;
  bestStreakSeconds: number;
};

export type CompletedContentFreeActivation = {
  id: UUID;
  startedAt: ISODateString;
  endedAt: ISODateString;
};

type ContentFreeViolationRecord = {
  id: UUID;
  activationId: UUID;
  kind: "intentionalExplicitContent";
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  source: BehaviorEventSource;
  streakBefore: ContentFreeStreakSnapshot;
};

// Undo corrects a log action, never the source session. Recompute the affected
// activation using effective violations; do not restore an old snapshot over
// newer violations or a later activation. Keep the source identity for dedup.
export type ContentFreeViolation = ContentFreeViolationRecord &
  (
    | { status: "recorded" }
    | { status: "undone"; undoneAt: ISODateString }
  );

type ContentFreeHistory = {
  bestStreakSeconds: number;
  // Activation boundaries allow an undo to recompute historical best streaks
  // without joining streaks across periods when Content-Free was inactive.
  pastActivations: CompletedContentFreeActivation[];
  violations: ContentFreeViolation[];
};

// Only intentional explicit-content use breaks a streak. Masturbation alone
// and accidental exposure do not create Content-Free violations.
export type ContentFreeState = ContentFreeHistory &
  (
    | { status: "inactive" }
    | {
        status: "active";
        activationId: UUID;
        activatedAt: ISODateString;
        currentStreakStartedAt: ISODateString;
      }
  );
