import type { ISODateString, UUID } from "./shared";

export type ErectionQuality = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type MasturbationEndingReason =
  | "climaxed"
  | "stoppedBeforeClimax"
  | "firmnessDecreased"
  | "feltAnxious"
  | "stoppedByChoice"
  | "other";

export type CompletedMasturbationPause = {
  status: "completed";
  startedAt: ISODateString;
  endedAt: ISODateString;
  durationSeconds: number;
};

export type MasturbationPause =
  | { status: "active"; startedAt: ISODateString }
  | CompletedMasturbationPause;

export type MasturbationSessionFeedback = {
  erectionQuality: ErectionQuality;
  // Intentional use only; accidental exposure does not set this to true.
  usedExplicitContent: boolean;
  endingReason: MasturbationEndingReason;
};

type MasturbationSessionIdentity = {
  id: UUID;
  startedAt: ISODateString;
};

type EndedMasturbationSession = MasturbationSessionIdentity & {
  endedAt: ISODateString;
  // Elapsed session duration includes optional pauses.
  durationSeconds: number;
  pauses: CompletedMasturbationPause[];
};

// Empty pauses is a normal session. Closing a session closes any active pause;
// feedback completion is separate from the physical event's endedAt.
export type MasturbationSession =
  | (MasturbationSessionIdentity & {
      status: "active";
      pauses: MasturbationPause[];
    })
  | (EndedMasturbationSession &
      Partial<MasturbationSessionFeedback> & {
        status: "awaiting_feedback";
      })
  | (EndedMasturbationSession &
      MasturbationSessionFeedback & {
        status: "completed";
      });
