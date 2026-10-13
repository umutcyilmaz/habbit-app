# Bloom — Phase 11.4.2 Relaxing Sounds QA

2026-10-13 · `feature/product-ui-v1` · base/HEAD
`65d65223dd9bd2e83dffefd14765cca6e285bb5b`. No commit or push. Prior untracked
`docs/patches/` artifacts were preserved. Home, Kegel, Profil, Reset, Tracking,
article controllers/content, persistence v8 and migration code are unchanged.

## Implemented

Library now has the source reference's four native sound rows: **Okyanus**, **Cam
üstünde yağmur**, **Şömine**, **Orman gecesi**. Articles/categories/bookmarks and
completion indicators remain intact; only Araştırmalar retains its unavailable
placeholder. Each row opens `/bloom/library/sound?id=…` under the existing guarded
root navigator. Unknown IDs open a safe unavailable view and create no player.

Players use real bundled audio through SDK-compatible `expo-audio 1.1.1`:
play/pause, real ±15-second seeks, elapsed/remaining listening time, 10/20/30-minute
and unlimited choices, a two-second ending fade, automatic stop, explicit reset,
and loading/error/retry states. The session clock follows native decoded playback
position across media loops. Pause, buffering and background time do not consume
it. Changing duration preserves consumed time and expires immediately if a shorter
finite choice has already elapsed. Nothing about playback is persisted.

Native SVG layers derive from the actual reference geometry/gradients. Reanimated
transform/opacity worklets move moonlight/waves, rainfall/window droplets,
flames/sparks, trees/mist/fireflies. Paused/background/off-route states cancel motion;
Library thumbnails remain static. Reduced Motion disables decorative loops. Native
safe areas, scrollable content, scalable text, labeled buttons, selected duration
states and an accessible elapsed/remaining progress value are included. No WebView.

## Native audio / licensing

All four recordings were obtained, licensed and decoded; playback is complete.
[Audio source/licensing documentation](audio-sources.md) records original URLs,
authors, CC0 1.0 dedication, optional credits, modifications and exact hashes.
No attribution is required by CC0; voluntary source credits are retained.
The four processed stereo PCM WAVs total about 12.0 MiB and are packaged offline.
Freesound is not contacted by the app during playback.

The SDK 54 package's iOS implementation uses seek-to-zero looping and automatic
foreground/interruption resumption. A version/context/hash-checked postinstall
patch supplies AVQueuePlayer/AVPlayerLooper and explicit resume policy. A pristine
npm 1.1.1 tarball was patched successfully and matched the recorded native hashes.
[Native design and maintenance notes](qa/relaxing-sounds/native-audio-design.md)
explain these changes and the need for a rebuilt development/standalone binary.
Expo Go does not contain this patch.

AppState pauses on inactive/background, foreground never resumes automatically,
interruptions and old-device-unavailable route notifications pause the real engine,
and blur/unmount releases the player. Async activation/seek work is invalidated on
exit/suspension. Global audio session operations use a serialized ownership lease,
so stale cleanup cannot pause a newer screen. Playback labels follow actual native
status; rapid commands are gated while pending. `doNotMix` gives Bloom exclusive
audio focus during explicit playback and deactivates afterward.

## Verification results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run verify:audio` | Passed |
| `npm run verify:library` | Passed |
| `npm run verify:navigation` | Passed, including existing guard/forward deep-link checks |
| `npm run verify:persistence` | Passed after adding the new route to its exact route inventory |
| `npm run verify:persistence-acknowledgement` | Passed |
| `npm run verify:kegel` / `verify:kegel:persistence` | Passed |
| `npm run verify:reset-continuity` | Passed |
| `npm run verify:home-ui` | Passed |
| `npm run verify:release-debug-guards` | Passed |
| `npx expo install --check` | Local SDK dependency map reports up to date; endpoint unavailable in sandbox |
| CocoaPods + Xcode Simulator Debug build | Passed, including patched Swift and native SVG |
| Production iOS export/packaging | Passed; four real WAV assets resolved, QA gate disabled |
| `git diff --check` | Passed |
| Text-only patch apply/byte comparison at approved base | Passed |

Audio tests exercise real controller and port implementations with controlled engine
ports: loading/activation failures, timeout, buffering, pause/resume, native position
wrap, seeks/clamps, repeated duration changes, finite expiry/fade, unlimited,
interruption/foreground explicit resume, close/reopen/reset, pending play/seek exit
races, duplicate rapid commands and cross-screen ownership. A component harness
checks all four scenes start no animation when paused or Reduced Motion is enabled.
Bundled WAV headers and hashes are verified. These harness tests are distinguished
from the actual native playback checks below.

## Simulator evidence

iPhone 17 Pro · iOS 26.3. New isolated namespace:
`bloom.e2e.kegel.qa_sounds_1142_20261013_f9d42.`; Metro port `8086`.
Existing device/app storage was not cleared. Only Bloom E2E was updated and opened;
the normal Bloom application was not opened. No Simulator reset, erase or uninstall.
The temporary 8086 Metro and 8095 reference servers were stopped after QA; existing
services and all device/app data were left intact.

Native UI was operated with Computer Use. Source HTML was inspected before coding
and its rendered players were reviewed/captured in Chrome from local source-derived
documents. The supplied Maestro flow is a reproducible automation artifact; it was
not executed in this run. Native verification was performed directly in Simulator.

Verified:

1. All four Library entries open their own player; all four start, pause, resume and
   stop real playback. Native audio sampling produced nonzero decoded PCM for each
   recording, with distinct RMS values. This is not a visual-only timer assertion.
2. Ocean changes 10 → 20 → 30 → unlimited while playing; real forward/back seeks
   update media position and session time. Native playback remains functional.
3. The isolated five-second QA timer expires at `0:05`, remaining `0:00`, pauses the
   engine and shows the actual stopped state. Replaying and stop/reset work.
4. Fireplace runs through multiple natural native loops without JS restarts; engine
   positions wrap from about 23.2 seconds to near zero while elapsed session time
   keeps increasing. See decoded PCM / engine logs and the looped screenshot.
5. Leaving an active player by back or forward Home deep link releases it. Reopening
   starts at zero, paused, with default 10-minute selection. Unknown routes create
   no audio resource.
6. Forest background/foreground preserves elapsed time and stays paused until one
   explicit play press. Decorative motion follows that engine state.
7. A debugger-posted **native AVAudioSession interruption-began notification** pauses
   actual Fireplace playback. An interruption-ended notification carrying
   `shouldResume` leaves it paused at the same listening time. One explicit press
   resumes. A native old-device-unavailable route-change notification also pauses
   playback. These are native handler tests, not an actual incoming phone call or
   physical headset disconnection.
8. Safari plays the same verified CC0 recording as another audio app. Returning to
   Bloom leaves Forest paused; explicit Bloom play acquires focus and starts its
   actual engine. The task's Safari fixture was navigated to `about:blank` afterward
   to release its playback. No existing tabs or user data were deleted.
9. Every created player has a matching release at final exit; there is no remaining
   Bloom player in the QA engine audit. Exact counts are in
   [engine audit](qa/relaxing-sounds/engine-audit.json), with
   [native evidence](qa/relaxing-sounds/native-audio-evidence.log).

Rapid native repeated-tap automation encountered stale accessibility IDs / transient
Computer Use `noWindowsAvailable` failures. Routine native pause/resume succeeded;
rapid pending-command behavior is verified by the controller/ownership race tests.
Rebinding the existing Simulator window recovered UI access without resetting data.
The first Metro run had a stale expo-asset path after dependency deduplication; only
this task's server was restarted with a fresh cache. Final bundling/build passed.
Debugger expression attempts were corrected for imported/inlined symbols before the
successful native notifications; unsuccessful attempts did not alter playback state.

A real Kegel onboarding + completed set (10 repetitions), explicit `pe` bookmark and
explicit `pe` completion were created through their existing native flows in the new
namespace, then snapshot before audio testing. The entire stored envelope is equal
after testing. All ten pre-existing E2E storage values match their original SHA-256
hashes. [State audit](qa/relaxing-sounds/state-audit.json) records this evidence.
Audio testing did not add a storage key or mutate those facts.

## Gallery and remaining differences

[HTML/native comparison gallery](qa/relaxing-sounds/index.html) includes all four
players, the final Library section and lifecycle/regression evidence.
HTML is actual Chrome rendering of source CSS/functions at 390×844, cropped from
full-page captures. Native uses real iPhone safe areas and 402×874-point layout.
CSS scene animation phases can differ; screenshots are comparisons, not pixel goldens.

Differences: existing Inter typography replaces Archivo; Ocean uses the requested
short name Okyanus; added engine-status and explicit stop controls occupy vertical
space; QA captures include the isolated five-second button absent from production.
Rain bokeh uses radial SVG gradients rather than CSS blur. Fire omits browser
feTurbulence/displacement/blur, so flames/glow have simpler, sharper edges. Native
layers animate as groups rather than each SVG particle independently. Paused scenes
freeze to save battery. Full VoiceOver, maximum Dynamic Type, Android, iPad,
physical-device calls/Bluetooth routing and hardware acoustic gap measurements were
not run; decoded PCM, native loop status and native notification behavior were run.
Loading/error/retry paths were tested through the controller's engine boundary;
corrupt native files were not injected into the shipped bundle.

**Decision requiring approval:** the reference's locked-screen/background playback
promise is intentionally not enabled. Current UI explains foreground pause behavior.
Background audio requires a separate product choice and iOS audio background mode;
lock-screen controls and persistent playback would also need explicit scope. No
background capability, recording permission, subscription or paywall was added.

## Reproduce safely

Use a **new** run name, not the existing namespace; never clear Simulator data:

```sh
npm ci
APP_VARIANT=e2e npx expo prebuild --platform ios
APP_VARIANT=e2e EXPO_PUBLIC_E2E_MODE=1 EXPO_PUBLIC_KEGEL_PERSISTENCE_QA=1 \
EXPO_PUBLIC_KEGEL_QA_RUN=qa_sounds_new_unique_run EXPO_PUBLIC_RELAXING_SOUNDS_QA=1 \
npx expo run:ios --port 8086
```

The native dependency patch runs in `postinstall`; rebuilding is required. Optional
CLI automation: `maestro test .maestro/relaxing-sounds.yaml` after opening that isolated
development session. For native notification injection, attach to the E2E process
with LLDB, import Foundation/AVFAudio and post the named notifications on
`NSOperationQueue.mainQueue`. Physical interruption/route QA remains separate.

Regenerate source views with `node scripts/extract-sound-reference.cjs`, then
`python3 scripts/prepare-sound-scenes.py /private/tmp/bloom-sounds-reference`.
Processing licensed audio requires the documented verified downloads and temporary
NumPy/imageio-ffmpeg environment, not a network dependency in the app.

[Text-only review patch](patches/phase11-4-2-relaxing-sounds-text-only.patch) excludes
audio and image binaries. Binary WAVs/screenshots are separate working-tree assets.
`python3 scripts/build-sound-review-patch.py` builds and verifies the patch against
the approved base using a temporary archive, without staging, committing or pushing.
