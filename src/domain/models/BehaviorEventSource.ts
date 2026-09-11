import type { UUID } from "./shared";

// Reuse this identity across affected systems and retries. A session-derived
// event is identified by its session, not by a second manual log action.
export type BehaviorEventSource =
  | { kind: "manual"; logActionId: UUID }
  | { kind: "masturbationSession"; sessionId: UUID };
