# Phase 10 — Simulator visual QA

Use the existing **Bloom E2E** development client (`com.umutcyilmaz.bloom.e2e`,
`tms-e2e` scheme), existing Expo/Router setup, production V4 screens, production
flow/actions/controllers, and v7 persistence coordinator. No commit or push.

## Open the QA menu

If Bloom E2E is not installed, build it with the existing command:

```sh
cd ~/Desktop/tms
EXPO_PUBLIC_PHASE10_QA=1 npm run ios:e2e
```

If it is already installed, stop any existing Metro server on 8082 and run:

```sh
npm run start:e2e:phase10
```

Open the development client and then the menu on the booted Simulator:

```sh
xcrun simctl openurl booted 'tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082'
xcrun simctl openurl booted 'tms-e2e:///debug/phase10'
```

Dismiss an iOS “Open” prompt if shown. The existing `/debug/bloom-state` inspector
also has **Open Phase 10 QA** in this mode. Scroll the QA menu for its controls.
Each scenario button replaces only the dedicated Phase 10 QA save; then tap
**Open real Reset screen**, **Open real Content-Free screen**, or **Open real Home**.
Return to the menu with the second deep-link command above whenever needed.

| Scenario button | What to open and inspect |
| --- | --- |
| 1 · Day 10 / Content-Free inactive | Reset: current day 10, nine completed days, six remaining. Content-Free: inactive, ordinary activation available. Tap “Sayacı başlat” to exercise real earned-credit activation. |
| 2 · Day 10 / earned credit active | Reset still shows Day 10. Content-Free and Home show an active nine-day streak imported from Reset. Day 10 is nine *completed* days, not ten earned days. |
| 3 · Completed / decision pending | Reset completion shows the saved 15-day continuation offer and both buttons. Direct Content-Free shows continuation guidance; Home resumes the same decision. |
| 4 · Accepted / 15 earned days | Content-Free/Home: active, 15 completed days. Reset completion: no repeated offer. This shortcut uses the acknowledged production acceptance action. To test the actual button, load scenario 3 and tap “15 günlük serimle devam et”. |
| 5 · Declined / inactive | Content-Free/Home: inactive; Reset completion has no repeated offer. To test the actual button, load scenario 3 and tap “Şimdilik değil”. A subsequent ordinary activation starts independently at zero. |
| 6 · Completed / existing streak | Content-Free/Home preserve the existing 20-day streak, with activation five days before Reset. Reset completion has no duplicate offer and no imported credit. |

To exercise the actual completion button, choose **3 · Prepare before completion
button**, then **Open real Reset screen → Sonucu gör → Reset’i tamamla**. This
uses the same Scenario 3 fixture at the exact 15-day boundary but leaves Reset
active until the real acknowledged completion command saves. The six existing
shortcuts keep their behavior. The continuation offer appears only after that
save is confirmed. A full E2E process relaunch is needed after editing the QA
session code because Fast Refresh can retain an older session closure.

## Persistence and retry

After an on-screen activation/decision, return to the menu and tap **Reload saved
QA state (no reseed)**. The summary and real screens must retain the saved result.
You can also terminate/relaunch **Bloom E2E**, then open `/debug/phase10` without
selecting another scenario. Both the QA clock and v7 state are restored; loading
never automatically selects a fixture.

To exercise failure/retry, load scenario 3, tap **Fail next QA save once**, open
Reset, and tap its acceptance button. The actual storage adapter rejects the
next write: the real screen shows an unconfirmed save and its existing retry
button. Tap **Kaydetmeyi tekrar dene**; the existing acknowledgement runtime
persists the exact accepted successor and only then navigates. No synthetic
success message or alternate persistence implementation is used.

The same failure control can precede **Reset’i tamamla** or **Şimdilik değil**.
Failed completion must not expose an offer; retrying completion unlocks it.
Failed decline must keep continuation unconfirmed until retry and then preserve
the inactive tracker on relaunch.

## Existing Maestro harness

The parameterized visual flow does not clear app data. Pass all four parameters
(the flow deliberately has no YAML defaults that override CLI/runFlow values):

```sh
maestro test -e SCENARIO=day10-inactive -e TARGET=reset \
  -e SCREEN_ID=bloom.reset.progress -e EXPECTED_TEXT='Tamamlanan: 9 gün' \
  .maestro/phase10-visual.yaml --test-output-dir /tmp/bloom-phase10-maestro
```

Other visual combinations:

| SCENARIO | TARGET | SCREEN_ID | EXPECTED_TEXT |
| --- | --- | --- | --- |
| day10-credit | content-free | bloom.content-free | AKTİF SERİ |
| completed-pending | reset | bloom.reset.completion | 15 günlük serimle devam et |
| continuation-accepted | content-free | bloom.content-free | AKTİF SERİ |
| continuation-declined | content-free | bloom.content-free | HENÜZ BAŞLAMADI |
| completed-existing | content-free | bloom.content-free | AKTİF SERİ |
| before-completion | reset | bloom.reset.progress | 15 gün tamamlandı |

The actual completion/acceptance/decline buttons, process relaunch, and failed
completion/acceptance save retry:

```sh
maestro test .maestro/phase10-continuation.yaml \
  --test-output-dir /tmp/bloom-phase10-maestro
```

Artifacts contain only synthetic QA facts. Keep them outside the repository.

## Isolation and scope

The mode requires `__DEV__`, the existing `EXPO_PUBLIC_E2E_MODE=1`, the explicit
`EXPO_PUBLIC_PHASE10_QA=1`, and the E2E Expo bundle identity. The route redirects
without mounting controls when any condition fails. The provider independently
checks the same boundary.

Every storage key is prefixed with `bloom.e2e.phase10.`, including migration reads,
corruption backups and deletion enumeration. The mode never copies, reads or
replaces canonical Bloom/E2E state. This namespace also protects existing data
if a development client is accidentally connected to the wrong manifest.
Normal builds use the original persistence functions and system clock.

Only the scoped clock supplied to V4 Reset/Content-Free/Home observations and
production product-flow facts is simulated; neither `Date` nor device/system
time is patched. The clock is frozen so screenshots and earned credit are
stable. Legacy ten-day/date-offset simulation is not used. Other legacy timers
are outside this QA clock's scope. The schema/version stays v7.

The shared continuity fixture supplies baseline facts; activation, completion,
and continuation decisions use production acknowledged actions. The screens are
unchanged. The existing hydration boundary keeps navigation mounted only in
this isolated mode while fixtures reload; feature hooks still lock commands
until hydration is ready.

Physical-device layout, other device sizes, accessibility text scaling, and
long-running wall-clock behavior are outside this Simulator pass.

## Verification and visual observations

Passed deterministic checks: `typecheck`, `verify:reset-continuity`, `verify:persistence`,
`verify:persistence-acknowledgement`, `verify:home-ui`, `verify:guided-flows`,
`verify:protection-reset`, `verify:e2e-runtime`, `verify:e2e-app-identity`,
`verify:release-debug-guards`, and `git diff --check`.

Simulator: iPhone 17 Pro, iOS 26.3. Real V4 progress/credit/offer screens, actual
acceptance/decline, E2E app relaunch, existing-streak preservation, suppressed
duplicate offer, pending Home guidance, and actual write failure/retry passed
with Maestro. All six menu scenarios were exercised. Screenshots/logs are under
`/tmp/bloom-phase10-maestro`. The six scenario fixture states also pass real v7
round trips in the existing E2E runtime verifier.

The inspected content and offer buttons fit the phone screen. During the direct
Computer Use follow-up, two presentation defects were reproduced and fixed:
the global dark status-bar style hid icons on dark V4 screens, and the retryable
write-failure sentence was English among Turkish labels. Mounted product routes
now select light icons; legacy light routes and hydration fallbacks retain dark
icons. Reset and Content-Free use Turkish copy for that actual write failure.
Other pre-existing receipt error branches and dates still use English copy;
this pass does not provide complete application localization.

Follow-up pass on 2026-10-10: Computer Use directly inspected all six scenarios,
Day 10's real earned-credit activation, the real completion button, acceptance
and decline, pending Content-Free navigation, existing-streak/no-offer behavior,
and both dark Home and light Log status bars. Actual acceptance and decline
survived process termination/relaunch. Failed decline → real retry → process
relaunch also retained the inactive tracker and declined decision. No functional
continuity or v7 persistence defect was found in these paths.

The expanded existing `.maestro/phase10-continuation.yaml` passed: real elapsed
completion with a rejected write, no premature offer, exact-successor retry,
15-day acceptance with process relaunch, decline with process relaunch, and
failed acceptance with the Turkish error and real retry. Current artifacts are
under `/tmp/bloom-phase10-qa-current/.maestro/tests/2026-10-10_000744`; the direct
decline/retry/relaunch screenshot is
`/tmp/bloom-phase10-qa-current/phase10-declined-retry-relaunch.png`.
All deterministic checks listed above were rerun successfully after the fixes.

Files changed specifically in this follow-up (the full working-tree list
including the earlier QA implementation follows):

```text
.maestro/phase10-continuation.yaml
docs/phase10-simulator-visual-qa.md
scripts/verify-bloom-phase10-qa.ts
src/app/providers/AppProviders.tsx
src/features/content-free/contentFreeController.ts
src/features/debug/phase10/Phase10QaScreen.tsx
src/features/debug/phase10/phase10QaSession.ts
src/features/reset/resetController.ts
```

## Changed files

```text
.maestro/phase10-continuation.yaml
.maestro/phase10-visual.yaml
app/debug/phase10.tsx
docs/phase10-reset-content-free-continuity.md
docs/phase10-simulator-visual-qa.md
package.json
scripts/fixtures/resetContinuity.ts
scripts/verify-bloom-e2e-runtime.ts
scripts/verify-bloom-home-ui.ts
scripts/verify-bloom-phase10-qa.ts
scripts/verify-bloom-product-react-flows.ts
scripts/verify-bloom-release-debug-guards.cjs
src/app/flows/useBloomProductFlowActions.ts
src/app/providers/AppProviders.tsx
src/app/providers/BloomHydrationBoundary.tsx
src/app/providers/BloomLocalStateProvider.tsx
src/features/content-free/useContentFreeFeature.ts
src/features/content-free/contentFreeController.ts
src/features/debug/phase10/Phase10QaProvider.tsx
src/features/debug/phase10/Phase10QaScreen.tsx
src/features/debug/phase10/phase10QaMode.ts
src/features/debug/phase10/phase10QaSession.ts
src/features/debug/phase10/resetContinuityFixture.ts
src/features/debug/screens/BloomStateDebugScreen.tsx
src/features/home/useBloomHomeFeature.ts
src/features/reset/useResetFeature.ts
src/features/reset/resetController.ts
```
