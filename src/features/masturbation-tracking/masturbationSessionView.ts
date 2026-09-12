import type { BloomLocalState } from "../../storage/bloomState";
import type { MasturbationSession } from "../../domain/models/MasturbationSession";

export type MasturbationSessionRouteView =
  | { kind: "missing" | "invalid" | "mismatch" }
  | {
      kind: "active";
      session: Extract<MasturbationSession, { status: "active" }>;
      paused: boolean;
      elapsedSeconds: number | null;
    }
  | { kind: "awaitingFeedback"; session: Extract<MasturbationSession, { status: "awaiting_feedback" }> }
  | { kind: "completed"; session: Extract<MasturbationSession, { status: "completed" }> };

export function getMasturbationSessionRouteView(
  state: BloomLocalState,
  routeSessionId: unknown,
  nowMilliseconds: number
): MasturbationSessionRouteView {
  if (routeSessionId === undefined || routeSessionId === null) return { kind: "missing" };
  if (typeof routeSessionId !== "string" || routeSessionId.trim().length === 0) return { kind: "invalid" };
  const session = state.masturbationTracking.currentSession;
  if (session?.id === routeSessionId) {
    if (session.status === "awaiting_feedback") return { kind: "awaitingFeedback", session };
    const elapsed = nowMilliseconds - Date.parse(session.startedAt);
    return {
      kind: "active",
      session,
      paused: session.pauses.some((pause) => pause.status === "active"),
      elapsedSeconds: Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 1000)) : null
    };
  }
  const completed = state.masturbationTracking.sessions.find((entry) => entry.id === routeSessionId);
  return completed === undefined ? { kind: "mismatch" } : { kind: "completed", session: completed };
}

export function formatMasturbationElapsedSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes.toString().padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}
