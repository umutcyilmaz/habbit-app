// Ephemeral session only. Clock advances from decoded engine position, including
// native loop wraps; buffering/background time never consumes listening time.
export type EngineStatus = {
  currentTime: number; duration: number; playing: boolean; isLoaded: boolean;
  isBuffering: boolean; playbackState: string;
};
export type SoundEngine = {
  status(): EngineStatus; play(): void; pause(): void; seekTo(seconds: number): Promise<void>;
  volume(value: number): void; dispose(): void;
};
export type SoundPlaybackPort = {
  create(): SoundEngine; activate(): Promise<void>; deactivate(): Promise<void>;
  every(callback: () => void): () => void; now(): number;
};
export type SoundPlaybackSnapshot = {
  phase: 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
  playing: boolean; elapsed: number; duration: number; remaining: number | null;
  busy: boolean; message: string | null;
};
export function createSoundPlaybackController(port: SoundPlaybackPort) {
  let engine: SoundEngine | null = null, cancelTick: (() => void) | null = null;
  let elapsed = 0, duration = 600, previousPosition = 0, previousPlaying = false;
  let wanted = false, active = true, generation = 0, loadingAt = 0;
  let snapshot: SoundPlaybackSnapshot = { phase: 'loading', playing: false, elapsed: 0, duration, remaining: duration, busy: false, message: null };
  const listeners = new Set<() => void>();
  function publish(patch: Partial<SoundPlaybackSnapshot> = {}) {
    const next = { ...snapshot, ...patch, elapsed, duration, remaining: duration ? Math.max(0, duration - elapsed) : null };
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next; listeners.forEach(fn => fn());
  }
  function deactivate() { void port.deactivate().catch(() => { /* Player has already paused/released. */ }); }
  function fail() {
    wanted = false; previousPlaying = false;
    try { engine?.pause(); } catch { /* A failed native player may no longer be callable. */ }
    deactivate();
    publish({ phase: 'error', playing: false, busy: false, message: 'Ses yüklenemedi veya oynatılamadı. Yeniden dene.' });
  }
  function expire() {
    elapsed = duration; wanted = false; previousPlaying = false;
    engine?.pause(); engine?.volume(1); deactivate();
    publish({ phase: 'ended', playing: false, message: 'Süre doldu. Ses durduruldu.' });
  }
  function sample() {
    if (!engine || snapshot.phase === 'error') return;
    if (snapshot.phase === 'ended' && duration && elapsed >= duration) return;
    try {
      const status = engine.status();
      if (/error|failed/i.test(status.playbackState) || (!status.isLoaded && port.now() - loadingAt > 12000)) return fail();
      if (!status.isLoaded) return publish({ phase: 'loading', playing: false });
      // Ignore position deltas while a controlled seek is in flight.
      if (!snapshot.busy && Number.isFinite(status.currentTime)) {
        let delta = status.currentTime - previousPosition;
        if (delta < -0.5 && status.duration > 0) delta += status.duration;
        if ((previousPlaying || status.playing) && delta > 0) elapsed += delta;
        previousPosition = status.currentTime;
      }
      if (previousPlaying && !status.playing && !status.isBuffering && wanted) {
        wanted = false; deactivate();
        publish({ message: 'Ses duraklatıldı. Devam etmek için oynat.' });
      }
      previousPlaying = status.playing;
      if (duration && elapsed >= duration) return expire();
      if (status.playing && (!wanted || !active)) { engine.pause(); previousPlaying = false; return; }
      // Linear two-second ending fade, updated only from real playback progress.
      engine.volume(duration ? Math.min(1, Math.max(0, (duration - elapsed) / 2)) : 1);
      publish({ playing: status.playing, phase: status.playing ? 'playing' : status.isBuffering && wanted ? 'buffering' : elapsed ? 'paused' : 'ready' });
    } catch { fail(); }
  }
  function close() {
    generation++; wanted = false; previousPlaying = false;
    cancelTick?.(); cancelTick = null;
    const released = engine; engine = null;
    if (released) {
      try { released.pause(); } catch { /* Still release a failed engine. */ }
      try { released.dispose(); } catch { /* Teardown of a failed native object must not block navigation. */ } finally { deactivate(); }
    }
  }
  function open() {
    close(); elapsed = 0; duration = 600; previousPosition = 0; active = true; loadingAt = port.now();
    publish({ phase: 'loading', playing: false, busy: false, message: null });
    try { engine = port.create(); cancelTick = port.every(sample); sample(); } catch { fail(); }
  }
  function pause(message: string | null = null) {
    sample(); wanted = false; generation++;
    try { engine?.pause(); previousPlaying = false; deactivate(); publish({ playing: false, busy: false, phase: ['ended', 'error', 'loading'].includes(snapshot.phase) ? snapshot.phase : 'paused', message }); } catch { fail(); }
  }
  async function seekBy(seconds: number) {
    if (!engine || snapshot.busy || !engine.status().isLoaded || snapshot.phase === 'error') return;
    sample();
    const target = Math.max(0, duration ? Math.min(duration, elapsed + seconds) : elapsed + seconds);
    if (duration && target >= duration) { expire(); return; }
    const token = generation, player = engine;
    const keepPlaying = snapshot.playing;
    publish({ busy: true });
    try {
      // Native seek uses the loop's media position; session timeline stays separate.
      player.pause(); previousPlaying = false;
      await player.seekTo(target % player.status().duration);
      if (generation !== token || engine !== player) return;
      elapsed = target; previousPosition = player.status().currentTime;
      publish({ busy: false, message: null });
      if (keepPlaying && active && wanted) player.play();
      sample();
    } catch { if (generation === token) fail(); }
  }
  async function toggle() {
    if (!engine || snapshot.busy || snapshot.phase === 'loading' || snapshot.phase === 'error') return;
    sample();
    if (snapshot.playing || wanted) { pause(); return; }
    const token = generation, player = engine;
    publish({ busy: true, message: null });
    try {
      if (snapshot.phase === 'ended') {
        await player.seekTo(0);
        if (generation !== token || engine !== player) return;
        elapsed = 0; previousPosition = 0;
      }
      await port.activate();
      if (generation !== token || engine !== player || !active) return;
      wanted = true; player.volume(1); player.play(); publish({ busy: false }); sample();
    } catch { if (generation === token) fail(); }
  }
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getSnapshot: () => snapshot, open, close, toggle, seekBy,
    stop() { pause('Ses durduruldu.'); elapsed = 0; previousPosition = 0; publish();
      // A stopped session has a fresh engine and no retained audio resource.
      close(); open(); },
    setDuration(seconds: number) {
      if (![600, 1200, 1800, 0].includes(seconds) || snapshot.busy) return;
      sample(); duration = seconds;
      try { if (duration && elapsed >= duration) expire(); else { publish({ message: null, phase: snapshot.phase === 'ended' ? 'paused' : snapshot.phase }); sample(); } } catch { fail(); }
    },
    suspend() { active = false; pause(snapshot.playing || elapsed > 0 ? 'Ses duraklatıldı. Devam etmek için oynat.' : null); },
    foreground() { active = true; },
    // Explicit development QA boundary; screen exposes only in isolated E2E builds.
    setQaDuration(seconds: number) { if (seconds === 5) { sample(); duration = 5; elapsed = 0; publish(); } }
  };
}
