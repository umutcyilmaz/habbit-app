# Native audio implementation review

SDK 54 recommends [expo-audio ~1.1.1](https://docs.expo.dev/versions/v54.0.0/sdk/audio/).
Installed using `npx expo install expo-audio`, then pinned to 1.1.1 for the native
patch. `expo-asset ~12.0.13` is installed explicitly using Expo's version workflow:
npm initially resolved the unconstrained audio peer to SDK 57, so that incompatible
peer was replaced before final packaging/QA. Native SVG is `react-native-svg 15.12.1`.
The dynamic app config explicitly disables microphone permission, Android recording
permission and background recording. Generated iOS Info.plist has no audio
background mode or microphone purpose string.

## Why a small native patch is necessary

Inspecting the installed 1.1.1 iOS source showed `AVPlayerItemDidPlayToEndTime`
performing `seek(to: .zero)` followed by `play()` for loops. JS-driven restarting or
this seek loop cannot guarantee uninterrupted audio. The app's version-checked
postinstall script changes the native player to AVQueuePlayer, retains an
[AVPlayerLooper](https://developer.apple.com/documentation/avfoundation/avplayerlooper)
when loop is enabled and the media is ready, bypasses end-notification restarts,
and disables/releases the looper and removes queued items during release.
`replaceCurrentSource` disables its previous looper before replacing the item.

The original package also automatically resumes players on foregrounding and on
interruption end with `.shouldResume`. Bloom requires an explicit user resume.
The patch suppresses these two implicit resumptions, keeps interruption-end audio
sessions inactive, and removes a manually paused player from the interrupted set.
Existing native interruption-began and headphone/device-disconnect handlers still
pause playback. No custom lock-screen information or media controls are registered.

The patch is limited to this application's installed audio dependency. It does not
modify React Native or OS behavior. It aborts on an expo-audio version mismatch,
missing source context or patched-source hash mismatch. Dependency upgrades must
review these changes before repinning; installing with `--ignore-scripts` omits the
patch and must be followed by `node scripts/patch-expo-audio-ios.cjs` and a native
rebuild. Expo Go does not contain this patch; use a rebuilt development/standalone
binary. Android uses the package's own native loop engine; Android QA is outstanding.

## Runtime ownership and timer semantics

`createAudioPlayer` is paired with `release()` on blur/unmount. A focused screen owns
one engine; inactive stack screens render no session. Unknown routes create no
engine. Local files load before play is enabled. Creation, loading timeout, engine
failure and activation/seek exceptions produce a retry state, never a playing label.
UI `playing` comes from native `currentStatus.playing`, sampled four times per second.
The timer sums real media-position changes and source-duration wrap boundaries.
Pause, buffering and background time do not count. Elapsed session time and media
position are separate; ±15 second controls perform a real native seek, clamped to
zero and the selected finite duration. Finite duration changes preserve elapsed
listening time; reducing below consumed time stops immediately. Unlimited has no
remaining countdown. Final two seconds fade volume from the real playback clock,
then expiry pauses and deactivates audio. Replaying an expired timer seeks to zero.
Stop/reset releases its engine and creates a fresh paused 10-minute session.

AppState inactive/background pauses and invalidates pending play/seek work. Returning
to foreground never resumes automatically. Navigation focus loss cancels the sampler,
pauses, releases the player and deactivates its audio session. Async commands use a
generation token; rapid taps are gated while activation or seek is pending. Global
audio session operations are serialized and each port holds a lease, so cleanup from
an old route cannot deactivate a newer player's session. `doNotMix` requests exclusive
audio focus; other audio may be interrupted while Bloom plays and can resume after
Bloom deactivates. Mixing/ducking is a future preference decision.

Decorative native Reanimated transform/opacity loops run on the UI thread only while
real audio is playing. Reduced Motion and paused/loading/ended/background/off-route
states cancel them. Library thumbnails remain static. No WebView, JS frame loop,
recording session, persistence write or entitlement/paywall path is introduced.

## Background product decision

The reference promises playback with a locked screen. Shipping that promise would
require `UIBackgroundModes: audio`, `shouldPlayInBackground: true`, and a product
policy for route exit, interruptions, prolonged sessions and battery usage. The
current foreground-only behavior is explicit in the UI. Approval is needed before
adding background capabilities or lock-screen controls in a separate change.
