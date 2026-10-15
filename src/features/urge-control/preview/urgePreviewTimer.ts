export const urgePreviewMinutes = [5, 10, 15, 20] as const;
export type UrgePreviewPhase = "ready" | "running" | "paused" | "completed";
export type UrgePreviewSnapshot = Readonly<{
  phase: UrgePreviewPhase;
  durationMs: number;
  elapsedMs: number;
  foreground: boolean;
  confirmingExit: boolean;
  pauseReason: "manual" | "background" | "exit" | null;
}>;

/** Ephemeral illustration only. No domain actions, wall clock, storage or scheduler.
 * Time advances from a monotonic anchor, never from the number of tick calls.
 * Background, loss of focus and exit confirmation freeze the exercise. Returning
 * to it always requires explicit Resume; cancelling an exit does not count time.
 */
export function createUrgePreviewTimer(now: () => number, completionFixture = false) {
  const initialDuration = completionFixture ? 2_000 : 10 * 60_000;
  let state: UrgePreviewSnapshot = {
    phase: "ready", durationMs: initialDuration, elapsedMs: 0,
    foreground: true, confirmingExit: false, pauseReason: null
  };
  let live = false, anchor = 0, accumulated = 0, lastNow = 0;
  const listeners = new Set<() => void>();
  const clock = () => {
    const value = now();
    if (Number.isFinite(value)) lastNow = Math.max(lastNow, value);
    return lastNow;
  };
  const publish = (patch: Partial<UrgePreviewSnapshot>) => {
    const next = { ...state, ...patch };
    if ((Object.keys(next) as Array<keyof UrgePreviewSnapshot>).every(key => next[key] === state[key])) return;
    state = next;
    listeners.forEach(listener => listener());
  };
  const elapsed = () => Math.min(state.durationMs, accumulated + Math.max(0, clock() - anchor));
  const tick = () => {
    if (!live || state.phase !== "running") return;
    const elapsedMs = elapsed();
    if (elapsedMs === state.durationMs) {
      accumulated = elapsedMs;
      publish({ elapsedMs, phase: "completed", pauseReason: null });
    } else publish({ elapsedMs });
  };
  const pause = (reason: NonNullable<UrgePreviewSnapshot["pauseReason"]>) => {
    if (!live || state.phase !== "running") return;
    tick();
    if (state.phase !== "running") return;
    accumulated = state.elapsedMs;
    publish({ phase: "paused", pauseReason: reason });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { live = true; },
    // Strict Mode's effect replay may activate again. Freeze before detaching;
    // stale event handlers cannot start or advance an unmounted timer.
    dispose() { pause("background"); live = false; },
    select(minutes: number) {
      if (!live || completionFixture || state.phase !== "ready" || state.confirmingExit ||
          !urgePreviewMinutes.some(value => value === minutes)) return;
      publish({ durationMs: minutes * 60_000 });
    },
    start() {
      if (!live || !state.foreground || state.confirmingExit || state.phase !== "ready") return;
      anchor = clock(); accumulated = 0;
      publish({ phase: "running", elapsedMs: 0 });
    },
    tick,
    pause() { pause("manual"); },
    resume() {
      if (!live || !state.foreground || state.confirmingExit || state.phase !== "paused") return;
      anchor = clock();
      publish({ phase: "running", pauseReason: null });
    },
    setForeground(foreground: boolean) {
      if (!live) return;
      if (!foreground) pause("background");
      publish({ foreground });
    },
    askExit() {
      if (!live || state.confirmingExit) return;
      pause("exit");
      publish({ confirmingExit: true });
    },
    cancelExit() { if (live) publish({ confirmingExit: false }); },
    reset() {
      if (!live || state.phase !== "completed" || state.confirmingExit) return;
      accumulated = 0;
      publish({ phase: "ready", elapsedMs: 0, pauseReason: null });
    }
  };
}

export function formatUrgePreviewTime(remainingMs: number) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Both the cue and the halo use this same active-time phase. */
export function getUrgePreviewBreath(elapsedMs: number) {
  const cycleMs = Math.max(0, elapsedMs) % 14_000;
  const phase = cycleMs < 4_000 ? "inhale" : cycleMs < 8_000 ? "hold" : "exhale";
  const remainingMs = (phase === "inhale" ? 4_000 : phase === "hold" ? 8_000 : 14_000) - cycleMs;
  const expansion = phase === "inhale" ? cycleMs / 4_000 : phase === "hold" ? 1 : 1 - (cycleMs - 8_000) / 6_000;
  return {
    phase, remainingMs, expansion,
    target: phase === "exhale" ? 0 : 1,
    label: phase === "inhale" ? "Nefes al" : phase === "hold" ? "Tut" : "Yavaşça ver"
  };
}
