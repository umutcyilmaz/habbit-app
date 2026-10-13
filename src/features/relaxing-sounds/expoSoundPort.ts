import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import type { SoundPlaybackPort } from './soundPlaybackController';
// Serialize global AVAudioSession work across rapid route replacement / teardown.
let sessionQueue: Promise<unknown> = Promise.resolve();
let owner: symbol | null = null;
function session(task: () => Promise<void>) {
  const result = sessionQueue.catch(() => {}).then(task);
  sessionQueue = result;
  return result;
}
export function expoSoundPort(source: number, qa = false): SoundPlaybackPort {
  const lease = Symbol('Bloom sound session');
  let revision = 0;
  return {
    create() {
      const player = createAudioPlayer(source, { updateInterval: 250, keepAudioSessionActive: false });
      player.loop = true;
      if (qa) {
        console.info('[BloomSoundQA] create', player.id);
        const sample = player.addListener('audioSampleUpdate', event => {
          const frames = event.channels[0]?.frames ?? [];
          const rms = Math.sqrt(frames.reduce((sum, value) => sum + value * value, 0) / Math.max(1, frames.length));
          if (rms > .00001) {
            console.info('[BloomSoundQA] decodedPCM', JSON.stringify({ id: player.id, frames: frames.length, rms }));
            sample.remove(); player.setAudioSamplingEnabled(false);
          }
        });
        player.setAudioSamplingEnabled(true);
      }
      let previousPosition = 0, previousPhase = '', seeking = false;
      return {
        status: () => {
          const status = player.currentStatus;
          if (qa) {
            const phase = `${status.playing}/${status.isLoaded}/${status.playbackState}`;
            if (phase !== previousPhase) console.info('[BloomSoundQA] engine', JSON.stringify({id:player.id, playing:status.playing, loaded:status.isLoaded, currentTime:status.currentTime, duration:status.duration}));
            if (!seeking && previousPosition > status.duration - 1 && status.currentTime < 1 && status.playing) console.info('[BloomSoundQA] nativeLoop', JSON.stringify({id:player.id, before:previousPosition, after:status.currentTime}));
            previousPosition = status.currentTime; previousPhase = phase;
          }
          return status;
        },
        play: () => player.play(), pause: () => player.pause(),
        seekTo: async seconds => { seeking = true; try { await player.seekTo(seconds, 0, 0); previousPosition = seconds; } finally { seeking = false; } }, volume: value => { player.volume = value; },
        dispose: () => { if (qa) console.info('[BloomSoundQA] release', player.id); player.release(); }
      };
    },
    activate: () => {
      const request = ++revision;
      return session(async () => {
        if (request !== revision) return;
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix', interruptionModeAndroid: 'doNotMix', shouldRouteThroughEarpiece: false });
        if (request !== revision) return;
        owner = lease;
        await setIsAudioActiveAsync(true);
      });
    },
    deactivate: () => {
      revision++;
      return session(async () => {
        // A superseded screen cannot deactivate the new screen's audio session.
        if (owner !== lease) return;
        owner = null;
        await setIsAudioActiveAsync(false);
      });
    },
    every(callback) { const timer = setInterval(callback, 250); return () => clearInterval(timer); },
    now: () => performance.now()
  };
}
