# Bloom Sol Ultra MVP Audit

Audit date: 2026-07-22  
Branch audited: `chore/sol-ultra-repo-audit`  
Scope: repository-wide, audit only  
Application-code changes: none

## Audit Method and Limits

This audit inspected the application structure, all Expo Router routes, state and persistence code, quiz/scoring implementation, guided journeys, privacy surfaces, Expo/iOS configuration, shared UI, TypeScript settings, dependencies, and existing documentation. Six read-only review tracks were run in parallel and then reconciled; duplicate observations were collapsed into the findings below.

Safe checks performed:

- `git status --short --branch`
- `rg --files app src docs`
- `npm run`
- `npm run typecheck`
- `npm ls --depth=0`
- `./node_modules/.bin/expo config --type public`
- route-target, test-file, secret, environment, asset, TypeScript-suppression, and product-copy scans with `rg`/`git ls-files`
- `git diff --check`
- a short offline Expo web start on port `8082`, stopped after inspection

`npm run typecheck` passed. No lint or test scripts exist, so neither could be run without inventing tooling. `npm ls --depth=0` passed, but the current `node_modules` contains undeclared extraneous AsyncStorage-related packages; a clean install will not retain them. Dependency advisory status was not established because registry access was unavailable.

The Expo server reached Metro on port `8082`, but the available in-app browser runtime had no browser session. The 390px UI review is therefore source-based rather than screenshot-certified. Device-only behaviors such as keyboard avoidance, Dynamic Type, VoiceOver, background timers, app-switcher privacy, and physical safe areas remain manual test obligations.

## 1. Executive Summary

Bloom has a credible product shell and a coherent visual direction, but it is not yet a reliable phone MVP. The route graph is complete, strict TypeScript passes, the onboarding scoring implementation is centralized, and the major flows are present. The core blocker is below the UI: native state is held only in process memory. Force-quitting the app can erase onboarding, plan, Protection, Reset, and practice history.

The next-largest risks are state truthfulness and release containment. Corrupt or partial stored data can be replaced by defaults, two state providers disagree about live behavior, several success screens describe values that were not stored, the Reset never reaches a terminal state, a zero-signal quiz produces a Porn Loop plan, and sensitive debug tools are available without a production guard.

### Verdicts

| Target | Verdict | Reason |
|---|---|---|
| Owner-only iPhone MVP testing | **Not ready** | Native state is not durable, cold-restart acceptance cannot pass, and SDK 54 needs a validated current-device runtime path. UI exploration within one live session is **Ready with conditions**, but it is not meaningful persistence testing. |
| Internal testing | **Not ready** | Debug surfaces, false save/activation claims, deletion gaps, and critical state transitions remain unresolved. |
| TestFlight | **Not ready** | Native persistence, production debug exclusion, tests, bundle/build configuration, identity, assets, and privacy controls are incomplete. |
| Public release | **Not ready** | TestFlight blockers remain, plus privacy policy/disclosures, retention/deletion guarantees, accessibility validation, and broader release QA are missing. |

### Strongest Areas

- All 38 navigation constants resolve to real route files; the root-only onboarding gate avoids globally blocking direct routes.
- `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are enabled, and typecheck passes without `any`, `@ts-ignore`, or broad suppression patterns.
- Quiz preview and final submission use the same scoring function; score maxima are derived, normalized values are capped, and Firmness Concern is excluded from primary ranking.
- Reset dates and Arousal logs use `Set`/`Map`-style deduplication helpers, so same-ID/date writes are idempotent in the modeled happy path.
- No application network requests, analytics, telemetry, crash reporting, clipboard use, export/share path, secrets, or API credentials were found.
- Route files are thin, feature screens are grouped coherently, and safe-area/tab foundations are centralized.

### Largest Risks

1. Native persistence is absent, making cold-restart data loss inevitable.
2. Hydration accepts unvalidated nested data and can overwrite an unreadable payload with defaults.
3. Guided-flow screens and state stores frequently disagree about what was selected, saved, enabled, or completed.
4. Quiz low-signal and tie behavior can assign an unsupported sensitive profile.
5. The repository lacks production debug containment, automated tests, and reproducible iOS build configuration.

Finding count: **2 P0**, **11 P1**, **7 P2**, **2 P3**.

## 2. Repository Map

The inspected `app`, `src`, and `docs` trees contain 204 files. The runtime structure is:

| Area | Location | Responsibility |
|---|---|---|
| Root shell | `app/_layout.tsx`, `src/app/providers/AppProviders.tsx` | Expo Router stack and global providers |
| Entry gate | `app/index.tsx` | Waits for Bloom hydration, then redirects to onboarding or Today |
| Bottom tabs | `app/(tabs)/*`, `app/(tabs)/_layout.tsx` | Today, Log, Exercises, Progress, Protect; exactly five tabs |
| Onboarding | `app/onboarding/*`, `src/features/onboarding/*` | Intro, 13-step quiz, scoring, result |
| Pause | `app/pause/*`, `src/features/pause/*` | Intro, check-in, 90-second timer, saved result |
| Protection | `app/protect/*`, `src/features/protect/*` | Setup, active state, night setup, intercept |
| Reset | `app/reset/ten-day/*`, `src/features/reset/*` | Overview, two-minute daily practice, saved day |
| Arousal Control | `app/exercises/arousal-control/*`, `src/features/arousal-control/*` | Intro through progress preview across 11 route screens |
| Settings | `app/settings/*`, `src/features/settings/*` | Privacy, data controls, notifications, app lock, subscription |
| Guidance/debug | `app/guidance/*`, `app/debug/*` | Tool chooser and Bloom state debug console |
| Route contract | `src/constants/navigation.ts` | Typed route constants for 38 non-root targets |
| Persistent model | `src/storage/bloomState.ts` | Bloom state shape, defaults, transforms, score/result normalization |
| Storage adapter | `src/storage/storageClient.ts` | Web `localStorage`; module-memory fallback elsewhere |
| Bloom provider | `src/app/providers/BloomLocalStateProvider.tsx` | Hydration, mutation API, automatic writes |
| Legacy/demo state | `src/app/providers/DemoAppStateProvider.tsx`, `src/state/*` | Separate transient Log/Pause/Protection state |
| Shared UI | `src/shared/components/*`, `src/shared/design-system/*`, `src/shared/layout/*` | Screens, text, cards, buttons, tokens, tab spacing |
| Configuration | `app.config.ts`, `src/app/config/appConfig.json`, `tsconfig.json`, `package.json` | Expo, identity, compiler, SDK and scripts |
| Documentation | `docs/*`, feature/storage READMEs | Product, architecture, flows, copy, models |
| Tests | none | No unit, integration, component, route, E2E, lint, or CI configuration found |

### Route Inventory

- Root: `/`
- Tabs: `/(tabs)/today`, `/(tabs)/log`, `/(tabs)/exercises`, `/(tabs)/progress`, `/(tabs)/protect`
- Onboarding: `/onboarding`, `/onboarding/quiz`, `/onboarding/result`
- Pause: `/pause`, `/pause/check-in`, `/pause/timer`, `/pause/saved`
- Protection: `/protect/setup`, `/protect/active`, `/protect/night-setup`, `/protect/intercept`
- Reset: `/reset/ten-day`, `/reset/ten-day/practice`, `/reset/ten-day/saved`
- Arousal Control: `/exercises/arousal-control`, `/mode`, `/check-in`, `/practice`, `/pause`, `/after-pause`, `/finish`, `/reflection`, `/duration`, `/saved`, `/progress-preview`
- Settings: `/settings`, `/settings/privacy`, `/settings/data-controls`, `/settings/notifications`, `/settings/app-lock`, `/settings/subscription`
- Other: `/guidance/what-should-i-use`, `/debug/bloom-state`

No route constant points to a missing file. The failures found are behavioral and semantic, not missing filesystem routes.

## 3. Architecture Assessment

### Current Shape

Expo Router route files generally re-export feature screens. This keeps navigation registration separate from feature presentation and is a good base for additional practices. The root layout composes Safe Area, Demo state, and Bloom local state providers. Bloom's state module contains both storage-domain transformations and some cross-feature journey facts; Today, Progress, Result, and Debug then independently translate those facts into next actions.

The architecture can support more guided programs after the state boundary is made trustworthy. It is not ready for backend synchronization or AI-derived insights yet: there is no validated/versioned local schema, no repository boundary for merging records, no deletion contract, and no single journey selector. Adding a backend now would synchronize contradictions rather than resolve them.

### Strengths and Structural Risks

| Strength | Structural risk |
|---|---|
| Thin route wrappers and feature-based screens | Two global stores split ownership of Protection, Log, and Pause |
| Strict TypeScript and typed state helpers | Runtime persistence data is untyped `unknown` cast/merge |
| Central quiz scoring function | Product decision thresholds and tie behavior lack tests |
| Central route constants | CTA meaning is duplicated and sometimes inconsistent despite valid paths |
| Functional state updates | Hydration, writes, and reset have no transaction/durability boundary |
| Shared design system and AppScreen | Keyboard, Dynamic Type, and tab/focused-screen spacing are not differentiated |
| Small current datasets | Whole-state subscriptions/writes will become costly only after logs grow |

The most valuable missing abstraction is a pure journey selector, not a new framework. `getNextBloomAction(state, todayKey)` is warranted because four screens already implement variants of it and have diverged. Conversely, introducing a broad service layer or AI architecture now would be premature.

### Navigation and Flow Audit

| Reference | Evidence | Assessment / smallest correction |
|---|---|---|
| Root onboarding gate | `app/index.tsx:9-25` | Correctly waits for hydration and redirects only from `/`; direct debug and feature routes are not globally blocked. |
| Onboarding close | `OnboardingIntroScreen.tsx:28-30`, `OnboardingQuizScreen.tsx:93-95` | Can enter Today while onboarding remains incomplete, then returns to onboarding on a later root launch. Confirm before exit or keep the user in onboarding. |
| Quick Check-In | `TodayScreen.tsx:55-68`, `ExercisesScreen.tsx:26-30` | Same label opens Pause Check-In from Today but Log from Exercises. Rename or standardize the destination. |
| Pause selected action | `PauseCheckInScreen.tsx:50-60,96-111` | Selection does not change the fixed timer route. Consume the choice or remove the choice UI. |
| Night Protection | `PauseSavedScreen.tsx:209-214` | Label suggests setup but opens the Protect tab. Route to night setup or change the label. |
| Guidance combination | `WhatShouldIUseScreen.tsx:34-42,126-130` | “Protection or 90-Second Pause” exposes only a Protection action. Split the choices or make the copy singular. |
| Message support | `ProtectionInterceptScreen.tsx:43-45,58-64` | Returns to Today; no support action occurs. Remove/disable it or label the actual action. |
| Reset saved deep link | `TenDayResetSavedScreen.tsx:21-38,88-109` | Always displays a completed day. Guard on today's completion. |
| Arousal saved deep link | `PracticeSavedScreen.tsx:19-41` | Can auto-complete a draft or display success without a valid latest record. Make terminal routes read-only and guarded. |
| Progress Preview Back | `ProgressPreviewScreen.tsx:24-27` | Opens Saved even when no valid saved record exists. Use route history or guard the target. |
| Practice Saved Back | `PracticeSavedScreen.tsx:53-59` | Returns to Duration and permits a second completion. Exit to Exercises/history or edit the existing log by ID. |
| Settings Back | e.g. `PrivacyOverviewScreen.tsx:48-50` | Uses `push`, which can duplicate Settings stack entries. Prefer `back()` with a safe replacement fallback. |

### End-to-End Flow Status

| Flow | Reachability and exits | Data/action truth |
|---|---|---|
| Onboarding | Intro -> quiz -> result routes exist; result can exit | Gate is sound, but close bypasses completion and zero-signal scoring is wrong |
| Protection | Setup, active, night setup, intercept, Today/Progress exits exist | Level/options/paused state are split or discarded; active language overstates capability |
| Pause | Complete route chain and exits exist | Selected inputs are local; saved metrics are hardcoded; Demo-only record disappears |
| 10-Day Reset | Overview, timer, manual completion, saved, next-day simulation exist | Saved checklist overclaims behavior and there is no terminal transition after day 10 |
| Arousal Control | All 11 route screens exist and focused flow can exit | Several inputs are dropped; saved/back/direct-link paths can create or show invalid logs |
| Today/Progress | CTAs resolve to valid files | Duplicated journey decisions diverge at reset completion and some profile-specific content stays generic |
| Debug/Guidance | Available tools work; Coming Soon is disabled | Debug ships exposed; presets bypass real scoring; some card labels do not match their only action |

## 4. Findings by Priority

Effort scale: **XS** under 1 hour, **S** 1-3 hours, **M** half to one day, **L** one to three days, **XL** larger project.

### P0 - Critical

#### AUD-001 - Native Bloom state is process-memory only

- **Priority / confidence:** P0 / High
- **Affected files:** `src/storage/storageClient.ts:10-35,56-59`; `src/app/providers/BloomLocalStateProvider.tsx:66-100`; `package.json:13-27`
- **Evidence:** The adapter uses browser `localStorage` when present and a module-level `Map` otherwise. React Native has no browser `localStorage`. No native storage package is declared or imported; the AsyncStorage package currently visible to `npm ls` is extraneous and unused.
- **User impact:** On a physical iPhone, force-quitting or OS process reclamation can erase onboarding completion, profile, Protection, Reset dates, debug date offset, Arousal drafts, and logs. This completely invalidates cold-restart MVP testing.
- **Reproduction:** On iPhone, complete onboarding and one reset/practice, force-quit Expo Go or the development app, then relaunch `/`. The app hydrates defaults and returns to onboarding.
- **Smallest recommended fix:** Put a supported native adapter behind `StorageClient` while retaining a web adapter. Introduce the versioned/validated envelope in AUD-002 before migrating `bloom.localState.v1`. AsyncStorage is sufficient to solve durability but not sensitive-data encryption by itself.
- **Estimated effort:** M

#### AUD-002 - Malformed persisted data can be lost during hydration

- **Priority / confidence:** P0 / High
- **Affected files:** `src/storage/storageClient.ts:13-22`; `src/storage/bloomState.ts:376-406,436-471`; `src/app/providers/BloomLocalStateProvider.tsx:73-100`
- **Evidence:** JSON is cast directly; load validates only that the top level is an object. Nested quiz normalization dereferences required scores/flags. The provider has no load rejection/corruption state, always leaves loading in `finally`, and its save effect can write the default state afterward. Parse failure is also converted to `null`, indistinguishable from first launch.
- **User impact:** A partial old schema, interrupted write, or corrupted payload can crash normalization and then be silently replaced by defaults. For a privacy-first wellness app, silent loss of history is a critical trust failure.
- **Reproduction:** In web storage, place `{"onboarding":{"quizResult":{}}}` under `bloom.localState.v1`, then reload. This is a source-confirmed code path; the audit did not mutate a real user's local data to execute it.
- **Smallest recommended fix:** Read as `unknown`; validate a versioned envelope and each nested record; run explicit idempotent migrations; preserve/quarantine the original payload on failure; show a recoverable load state; suppress autosave until hydration succeeds.
- **Estimated effort:** M

### P1 - Must Fix Before External Testing

#### AUD-003 - Persistence has no canonical version, hydration, write, or reset boundary

- **Priority / confidence:** P1 / High
- **Affected files:** `src/storage/bloomState.ts:3,376-406`; `src/app/providers/BloomLocalStateProvider.tsx:66-105`; `src/storage/storageClient.ts:44-48`
- **Evidence:** `v1` exists only in the key name. `activePlan`, onboarding, and quiz result are merged independently. Provider children render before hydration; only the root route waits. Stateful direct routes can mutate defaults before load resolves. Every mutation launches an unsequenced fire-and-forget save, while `resetBloomState` changes React state and never calls the existing `clearUserData` operation.
- **User impact:** Valid but old states can produce a result/profile that disagrees with Today; direct-link actions can be overwritten by late hydration; a future async native adapter can finish stale writes last or resurrect data after reset.
- **Reproduction:** Delay `getUserData`, deep-link to `/reset/ten-day/practice`, and observe mount-time `startTenDayReset` race the loaded snapshot. Separately persist a Control/Timing quiz result with a Porn Loop `activePlan` and compare Result, Today, and Progress.
- **Smallest recommended fix:** Add a versioned migration pipeline, derive `activePlan` from validated `quizResult`, render/mutate stateful routes only after successful hydration, serialize writes, and make deletion an awaited storage clear followed by in-memory reset.
- **Estimated effort:** M

#### AUD-004 - Sensitive debug surfaces are enabled in release code

- **Priority / confidence:** P1 / High
- **Affected files:** `src/features/onboarding/screens/OnboardingQuizScreen.tsx:28-30,127-133`; `app/debug/bloom-state.tsx:1-5`; `src/features/debug/screens/BloomStateDebugScreen.tsx:82-260`; `src/features/progress/screens/ProgressScreen.tsx:21`
- **Evidence:** `SHOW_QUIZ_SCORING_PREVIEW` is hardcoded `true`. The debug route has no `__DEV__`/channel guard and reveals scores, flags, dates, Protection/Reset state, and Arousal metrics while exposing destructive/profile-mutating controls. Only its Progress entry button is development-gated; a direct URL remains available.
- **User impact:** A production deep link can expose sensitive wellness inferences and let a user or reviewer reset/replace app state. Internal scoring mechanics also appear in the consumer quiz.
- **Reproduction:** Open `/onboarding/quiz` and `/debug/bloom-state` in a non-development-style route session; both screens render without a production check.
- **Smallest recommended fix:** Define one build-channel debug flag that includes `__DEV__`; hide the preview and have the debug route redirect or render unavailable in preview/production builds. Verify the release bundle, not only entry-point visibility.
- **Estimated effort:** S

#### AUD-005 - Zero-signal quiz answers produce an unsupported Porn Loop profile

- **Priority / confidence:** P1 / High
- **Affected files:** `src/features/onboarding/quiz.ts:468-484,471-478,635-646,778-804`
- **Evidence:** With every frequency answer `Never`, all four normalized scores are zero. Stable ranking chooses PL first; the secondary gap rule accepts PP because `0 <= 0.18`. The generated result claims a Porn Loop/Pressure pattern and recommends Protection despite no affirmative signal.
- **User impact:** A user explicitly denying every behavior receives a sensitive, personalized claim unsupported by their answers. This is a product-trust and wellness-safety issue, not cosmetic scoring variance.
- **Reproduction:** Answer all 12 frequency questions `Never`; choose no triggers or `Not sure`; submit. Expected neutral/insufficient signal, actual Porn Loop with Pressure secondary and `setupProtection`.
- **Smallest recommended fix:** Add a tested minimum-signal/insufficient-information branch before ranking; define explicit exact-tie and secondary eligibility rules; use neutral copy/action for that branch.
- **Estimated effort:** S

#### AUD-006 - Protection has split state authority and overstates its capability

- **Priority / confidence:** P1 / High
- **Affected files:** `src/storage/bloomState.ts:71-77,267-290`; `src/app/providers/DemoAppStateProvider.tsx:21-43`; `src/features/protect/screens/ProtectionSetupScreen.tsx:63-75,134`; `ProtectScreen.tsx:57-111`; `NightProtectionSetupScreen.tsx:20-34`; `ProtectionActiveScreen.tsx:61-70`; `ProtectionInterceptScreen.tsx:43-64`
- **Evidence:** Bloom persists only an enabled Boolean/window and an adult-content pause Boolean. Level/status also live in transient Demo state; night options are component-local. Pausing sets Bloom `isEnabled=false` but can leave `adultContentPauseEnabled=true`. “Always on” maps to `custom`, and “Message support” only returns to Today. Active copy says support is running even though no native interception exists.
- **User impact:** Reloads lose setup choices, paused/off states contradict each other, and users may believe external content intervention or support contact is active when only an in-app preference was set.
- **Reproduction:** Configure level/night options, reload, then pause Protection. Compare the tab status, active rows, and Demo status; open intercept and tap Message support.
- **Smallest recommended fix:** Use one persisted Protection model with `off | active | paused`, level, schedule, and options. Make MVP copy explicitly describe an in-app pause plan. Remove/disable the support action until real. Native interception is a separate XL scope and should not be implied.
- **Estimated effort:** M for truthful state model; XL only if native blocking is later chosen

#### AUD-007 - The 10-Day Reset has no terminal state and can fabricate completion

- **Priority / confidence:** P1 / High
- **Affected files:** `src/storage/bloomState.ts:168-177,205-216`; `src/features/today/screens/TodayScreen.tsx:94-110`; `src/features/progress/screens/ProgressScreen.tsx:189-213,269,287-307`; `TenDayResetSavedScreen.tsx:14-38,88-109,156-175`
- **Evidence:** Day calculation clamps forever at 10 and Today/Progress prioritize any `startedAt` without first handling ten completed dates. The roadmap knows practice should unlock, creating contradictory status. Saved always checks off avoidance behaviors that were never collected and can be opened directly without a completion guard.
- **User impact:** Day-10 users are told to repeat Day 10 instead of advancing to Arousal Control. Manual completion is presented as proof of multiple behaviors, and a deep link can display a false success state.
- **Reproduction:** Seed ten unique completion dates, advance one simulated day, and open Today, Progress, and `/reset/ten-day/saved`. Today/current action repeat Reset while the roadmap advances.
- **Smallest recommended fix:** Derive an explicit terminal `resetComplete`, stop accepting dates after ten valid days, prioritize the transition to Arousal Control, guard Saved on today's record, and claim only “today's reset marked complete” unless behaviors are actually collected.
- **Estimated effort:** M

#### AUD-008 - Guided-flow selections and saved summaries do not represent stored user input

- **Priority / confidence:** P1 / High
- **Affected files:** `src/features/pause/screens/PauseCheckInScreen.tsx:50-60,96-111`; `PauseSavedScreen.tsx:72-85,180-214`; `src/features/arousal-control/screens/PracticeModeSelectionScreen.tsx:41-48`; `BeforePracticeCheckInScreen.tsx:47-55`; `MainPracticeScreen.tsx:147-155`; `FinishPracticeScreen.tsx:31-44`; `src/features/log/screens/LogScreen.tsx:20-52`; `RecentMomentsCard.tsx:7-23`
- **Evidence:** Pause selections remain component-local and Saved hardcodes `8/10`, Nighttime, and 90 seconds. Arousal mode and before-practice answers are discarded; quick notes/ending choices are local. Log/Pause records go only to Demo state, Recent Moments is fixed sample data, and note actions say saved without a persisted note field.
- **User impact:** Users can make intimate selections and see a success/history screen that contradicts them or loses them after navigation. This directly undermines the app's calm, private, trustworthy positioning.
- **Reproduction:** Choose non-default Pause inputs, finish, and compare Saved. Add a private note, navigate away/reload, and return. Save a Log entry and remount the app; sample moments remain unchanged.
- **Smallest recommended fix:** Introduce explicit, typed session drafts/logs in the Bloom repository for only the fields the UI promises to retain; derive summaries from saved records. Until then, remove “saved” and measured-summary claims rather than simulating them.
- **Estimated effort:** L

#### AUD-009 - Arousal draft/completion lifecycle can create partial or duplicate logs

- **Priority / confidence:** P1 / High
- **Affected files:** `src/storage/bloomState.ts:307-350`; `src/app/providers/BloomLocalStateProvider.tsx:153-178`; `src/features/arousal-control/screens/BeforePracticeCheckInScreen.tsx:54-55`; `OptionalDurationScreen.tsx:66-75`; `PracticeSavedScreen.tsx:31-41,53-59`
- **Evidence:** Beginning applies an empty patch and reuses any existing draft. Saved auto-completes every non-null draft. After completion, Back routes to Duration; submitting there creates a new draft when none exists and completes it, yielding another mostly empty log.
- **User impact:** Abandoned-session values can leak into a later practice, direct links can convert partial drafts into records, and a normal Back/Save path can duplicate practice history.
- **Reproduction:** Complete a practice, tap Back from Saved, save duration again, then inspect debug log count. Separately abandon a draft with distinctive values and open Saved directly.
- **Smallest recommended fix:** Add explicit `startSession`, `resumeSession`, `discardSession`, `completeSession(id)`, and `editCompletedSession(id)` semantics. Terminal Saved must be read-only and never create a log on mount.
- **Estimated effort:** M

#### AUD-010 - The privacy contract does not match deletion, skipping, or retention behavior

- **Priority / confidence:** P1 / High
- **Affected files:** `src/features/settings/screens/PrivacyOverviewScreen.tsx:12-20`; `SettingsHomeScreen.tsx:21-26`; `DataControlsScreen.tsx:59-66`; `src/features/onboarding/screens/OnboardingQuizScreen.tsx:48-55,109-113,549-555`; `src/storage/bloomState.ts:224-237`; `src/storage/storageClient.ts:44-48`
- **Evidence:** Privacy says sensitive questions can be skipped and history reviewed/deleted. Frequency steps require an answer; only the trigger step has Skip. Data Controls says deletion is planned and removes nothing. Full raw quiz answers are retained even though repository search found no later consumer. The storage clear method is unused.
- **User impact:** Users receive privacy assurances the product cannot currently honor and retain more sensitive data than the current experience needs.
- **Reproduction:** Try to continue a frequency question without answering; try to delete history from Data Controls; inspect persisted onboarding state after quiz completion.
- **Smallest recommended fix:** Add a genuine unscored “prefer not to answer” path or correct the copy; persist only the derived quiz result unless raw answers have a documented purpose; implement confirmed, awaited deletion across Bloom and Demo namespaces with truthful feedback.
- **Estimated effort:** M

#### AUD-011 - Two live global stores fragment ownership and persistence

- **Priority / confidence:** P1 / High
- **Affected files:** `src/app/providers/AppProviders.tsx:8-14`; `DemoAppStateProvider.tsx:21-50`; `BloomLocalStateProvider.tsx:66-190`; `src/features/log/screens/LogScreen.tsx:20-36`; `src/features/pause/screens/PauseSavedScreen.tsx:72-85`; `src/features/protect/screens/ProtectionSetupScreen.tsx:63-75`
- **Evidence:** Demo and Bloom providers mount together. Log/Pause and part of Protection mutate volatile Demo state; Today/Progress and persisted areas read Bloom. There is no synchronization contract between them.
- **User impact:** A screen can report a saved action that never reaches Progress, reloads lose Demo history, and debug reset clears Bloom without necessarily resetting the parallel store.
- **Reproduction:** Save a Log or Pause event, inspect Bloom debug/Progress, then remount the provider. The event is absent or lost while UI success was shown.
- **Smallest recommended fix:** Define Bloom state/repositories as the single source for current MVP journeys, migrate one feature at a time, and retire Demo provider after all consumers move. Avoid a simultaneous large rewrite.
- **Estimated effort:** L

#### AUD-012 - A reproducible current iPhone and TestFlight build path is missing

- **Priority / confidence:** P1 / High
- **Affected files:** `package.json:6-27`; `app.config.ts:5-16`; `src/app/config/appConfig.json:2-9`; missing `eas.json` and asset configuration
- **Evidence:** The project uses Expo SDK 54 with no `expo-dev-client`, bundle identifier, build number, EAS project/build profiles, icon, or splash. Slug/scheme remain `tms`; brand status is temporary and support email is `support@example.com`. Expo documents that current iOS Expo Go supports one SDK version, while this project is on SDK 54 and current Expo documentation is SDK 57; older physical-iOS Expo Go projects require a supported runtime path. [Expo development-build introduction](https://docs.expo.dev/develop/development-builds/introduction/), [SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/), [current SDK reference](https://docs.expo.dev/versions/v57.0.0/sdk/expo/)
- **User impact:** A clean owner-device setup is not reproducible, current App Store Expo Go compatibility should not be assumed, and TestFlight cannot be configured from the repository.
- **Reproduction:** Resolve public Expo config and inspect dependencies/files; required identifiers/profiles/assets are absent. Attempting current physical-iOS Expo Go with an older SDK is expected to show incompatibility under Expo's stated support model.
- **Smallest recommended fix:** First choose either a validated SDK upgrade or an Expo development build; then finalize bundle ID/scheme, add `expo-dev-client` through Expo tooling if using a dev build, link EAS, define development/preview/production profiles, and add final identity/assets. Follow the [EAS build setup](https://docs.expo.dev/build/setup/).
- **Estimated effort:** M, excluding Apple account review time

#### AUD-013 - Critical domain and release behavior has no automated regression coverage

- **Priority / confidence:** P1 / High
- **Affected files:** `package.json:6-12`; repository-wide absence of test/lint/CI files; `docs/ARCHITECTURE.md:211-224`
- **Evidence:** The only verification script is `typecheck`. No unit, component, route, integration, E2E, lint, visual-regression, or CI configuration exists, despite complex scoring, migration, date, and idempotency rules.
- **User impact:** The currently confirmed zero-signal, day-10, draft, and hydration defects can recur undetected. TypeScript cannot validate runtime data or behavioral transitions.
- **Reproduction:** Run `npm run`; only start/platform/typecheck scripts are listed. Test-file scans return no matches.
- **Smallest recommended fix:** Select a testing approach in a separate implementation task and start with pure table-driven tests for scoring, migration/validation, date/reset idempotency, and next-action priority, followed by route/provider smoke tests.
- **Estimated effort:** M for the minimum critical suite

### P2 - Important MVP Improvements

#### AUD-014 - Journey decisions are duplicated and already disagree

- **Priority / confidence:** P2 / High
- **Affected files:** `src/features/today/screens/TodayScreen.tsx:79-150`; `src/features/progress/screens/ProgressScreen.tsx:158-213,281-360`; `src/features/onboarding/screens/OnboardingResultScreen.tsx:131-152`; `src/features/debug/screens/BloomStateDebugScreen.tsx:284-293`
- **Evidence:** Four screens independently map profile, Protection, Reset, and practice state to routes/copy. Result always shows the original first action; Today/Progress apply later-state rules; Progress can mark two roadmap steps Current and diverges at reset completion. Some Control/Timing and Pressure profiles still receive porn/evening-oriented Today timeline content (`TodayScreen.tsx:20-34,302-334`).
- **User impact:** The same user can see different “next” steps and profile-irrelevant rationale across Result, Today, Progress, and Debug.
- **Reproduction:** Enable Protection for a Porn profile, start/complete Reset, and compare all four surfaces; repeat after ten Reset dates.
- **Smallest recommended fix:** Add a pure, tested `getNextBloomAction` selector described in Section 6. Keep screen-specific prose outside it and migrate consumers incrementally.
- **Estimated effort:** M

#### AUD-015 - Debug presets and partial previews are not faithful scoring tests

- **Priority / confidence:** P2 / High
- **Affected files:** `src/features/onboarding/quiz.ts:241-340,494-506,747-804`; `src/features/debug/screens/BloomStateDebugScreen.tsx:42-54`; `src/storage/bloomState.ts:241-255`; `OnboardingQuizScreen.tsx:417-426`
- **Evidence:** Presets return hardcoded `QuizResult` objects rather than answer fixtures passed through the real scorer; each stored normalized vector disagrees with current raw-score maxima. “Start as this profile” preserves old Arousal logs, creating a supposedly fresh profile with old progress. Missing preview answers score as zero, so a trigger-only 1/13 preview already asserts Porn Loop.
- **User impact:** Debug QA can validate impossible states and miss real scoring regressions; early preview may overstate confidence.
- **Reproduction:** Compare each preset's raw/max-derived normalized values; save an Arousal log, start as a fresh profile, then inspect Progress; select triggers before frequency answers and inspect preview.
- **Smallest recommended fix:** Build presets from complete answer fixtures through `scoreOnboardingQuiz`, clear all journey data for “fresh,” retain “Set only” for preservation, and label/suppress profile prediction until a tested answer threshold is met.
- **Estimated effort:** M

#### AUD-016 - Timer and calendar logic is not lifecycle-safe

- **Priority / confidence:** P2 / High
- **Affected files:** `src/features/reset/screens/TenDayResetPracticeScreen.tsx:49-67`; `src/features/pause/screens/PauseTimerScreen.tsx:42-56`; `src/features/arousal-control/screens/PauseScreen.tsx:21-31`; `src/storage/bloomState.ts:168-177`; `BloomLocalStateProvider.tsx:69-71`
- **Evidence:** Timers decrement once per callback instead of deriving remaining time from a deadline. Background suspension delays callbacks. Reset day divides local-midnight millisecond differences by fixed 24-hour periods; spring DST days can be 23 hours. `todayKey` changes only when the provider rerenders, with no AppState/midnight refresh.
- **User impact:** Phone backgrounding can freeze/extend timers, and Reset may show the wrong day after a DST change or crossing midnight while the app remains open.
- **Reproduction:** Start a timer, background longer than its duration, then resume. For date math, compare local midnight across a spring-forward transition such as `America/New_York` 2026-03-08 to 2026-03-09.
- **Smallest recommended fix:** Share a deadline-based timer with AppState reconciliation; compare UTC calendar ordinals/local date keys rather than elapsed 24-hour blocks; refresh today on foreground and midnight.
- **Estimated effort:** M

#### AUD-017 - Several valid routes have ambiguous action semantics

- **Priority / confidence:** P2 / High
- **Affected files:** `TodayScreen.tsx:55-68`; `ExercisesScreen.tsx:26-30`; `PauseSavedScreen.tsx:209-214`; `WhatShouldIUseScreen.tsx:34-42,126-130`; `ProtectionInterceptScreen.tsx:43-64`; settings detail screens such as `PrivacyOverviewScreen.tsx:48-50`
- **Evidence:** “Quick Check-In” has two destinations, a night-setup label opens the tab, a combined guidance option offers one action, “Message support” returns home, and some Back controls use `push`. No target file is missing; labels and behavior disagree.
- **User impact:** Users cannot predict where a repeated action goes and can accumulate odd stack history.
- **Reproduction:** Follow each CTA from the screens listed and compare the visible label with the route/action.
- **Smallest recommended fix:** Establish one semantic action per label, reuse the route constant for that semantic action, and use history-aware `back()`/`replace()` for Back and terminal exits.
- **Estimated effort:** S

#### AUD-018 - Mobile accessibility and keyboard behavior need device validation and fixes

- **Priority / confidence:** P2 / Medium for layout, High for static semantics
- **Affected files:** `src/shared/components/AppScreen.tsx:13-48`; `app/(tabs)/_layout.tsx:13-20,102-112`; `src/shared/layout/tabSpacing.ts:1-8`; `SelectableChipGroup.tsx:63-77`; `PrivateReflectionCard.tsx:29-52`; `TenDayResetScreen.tsx:172-193`; `PauseCircleTimer.tsx:18-39`; `OptionalContextCard.tsx:38-63`
- **Evidence:** `AppScreen` is a plain ScrollView without keyboard inset/tap handling. Several chip/text actions appear below 44pt. Reset progress is an unlabeled image-like element; timers lack live/value semantics. Fixed tab height can clip large text. The custom web focus treatment replaces the browser outline with a low-contrast border, and one lavender secondary-text pairing measures about 4.38:1. Static sizing found no obvious 390px horizontal overflow, but no screenshot/device pass was possible.
- **User impact:** Keyboard users may lose inputs/actions, VoiceOver users receive weak progress/timer context, and large Dynamic Type can clip or crowd controls.
- **Reproduction:** Manual: iPhone 390px-class viewport, note/duration keyboard open, VoiceOver timer/progress navigation, 200% text, high-contrast/web keyboard focus.
- **Smallest recommended fix:** Add keyboard-aware screen behavior, 44pt targets/hitSlop, accessible values/live announcements, Dynamic Type-safe tab sizing, and token-compliant focus/contrast. Validate on device before changing visual structure.
- **Estimated effort:** M

#### AUD-019 - Sensitive-data defense in depth and retention policy are undefined

- **Priority / confidence:** P2 / High for current web behavior; Medium for device threat choices
- **Affected files:** `src/storage/storageClient.ts:26-35`; `src/storage/bloomState.ts:79-116,224-237`; `src/features/settings/screens/AppLockSettingsScreen.tsx:23-30`
- **Evidence:** Web stores the complete state, including raw quiz answers and practice logs, as one plaintext JSON record. Native currently stores nothing durably, so encryption cannot be claimed. App lock explicitly is not connected; no screen-capture or app-switcher obscuring behavior exists.
- **User impact:** On web, same-origin script access exposes the full record and retention cannot be scoped by data class. Once native persistence is added, choosing an unencrypted adapter without a threat model may expose highly sensitive local records on a compromised/unlocked device.
- **Reproduction:** Inspect `bloom.localState.v1` in browser storage. Review the native fallback and app-lock screen.
- **Smallest recommended fix:** Define data classes and retention, minimize raw answers, separate sensitive records, document the threat model, and decide whether application-layer encryption/app lock/app-switcher obscuring are required before public release. Do not market encryption until verified.
- **Estimated effort:** M for policy/storage design; L if encrypted records and app lock are implemented

#### AUD-020 - Onboarding exit and wellness-boundary behavior is incomplete

- **Priority / confidence:** P2 / High
- **Affected files:** `src/features/onboarding/screens/OnboardingIntroScreen.tsx:28-43`; `OnboardingQuizScreen.tsx:93-113`; `src/storage/bloomState.ts:122-146`; `docs/USER_FLOWS.md:14-24`
- **Evidence:** Close opens Today while onboarding remains incomplete, exposing a default Porn Loop plan; the next root launch returns to onboarding. Documentation describes a wellness/not-medical boundary that is absent from the current intro. Frequency questions also lack a skip path as covered by AUD-010.
- **User impact:** An incomplete user can receive profile-specific guidance they never earned, and the product boundary is not presented where a new user first evaluates the app.
- **Reproduction:** Reset state, close intro/quiz, inspect Today, then reopen `/`.
- **Smallest recommended fix:** Give close a clear exit/confirmation that does not expose a default personalized plan; show concise adult/wellness and urgent-help boundaries without diagnostic language.
- **Estimated effort:** S

### P3 - Later Improvements

#### AUD-021 - Whole-state subscriptions and writes will scale poorly with history

- **Priority / confidence:** P3 / High
- **Affected files:** `src/app/providers/BloomLocalStateProvider.tsx:93-100,185-190`; `src/storage/bloomState.ts:366-374`
- **Evidence:** Every Bloom mutation rerenders every context consumer and serializes the entire state. Latest-log lookup copies and sorts all logs. Current datasets are small, so this is not a present phone-performance blocker.
- **User impact:** As logs grow, timer-adjacent or frequent updates could produce unnecessary rendering and larger writes.
- **Reproduction:** Seed a large log history and profile context renders/storage payload size; no current production-scale data exists, so impact is projected rather than observed.
- **Smallest recommended fix:** After correctness work, expose memoized selectors/sliced contexts, maintain newest-first or indexed logs, and batch/sequence storage writes.
- **Estimated effort:** M

#### AUD-022 - Legacy/demo artifacts and documentation obscure the actual product state

- **Priority / confidence:** P3 / High
- **Affected files:** `src/app/providers/DemoAppStateProvider.tsx`; `src/state/*`; `src/shared/components/ModulePlaceholderScreen.tsx:26-74`; `src/features/onboarding/types.ts:7-17`; `src/features/onboarding/README.md:3-25`; `README.md:73-82`; `docs/ARCHITECTURE.md:151-224`
- **Evidence:** Unreferenced placeholder/component trees and legacy goal types remain. READMEs describe placeholders/no persistence or goal selection that no longer match runtime behavior.
- **User impact:** Maintainers can make decisions from stale documentation or accidentally reuse obsolete state/types. There is no direct current-user defect.
- **Reproduction:** Compare runtime route/screens and quiz question list with the referenced docs/types.
- **Smallest recommended fix:** After AUD-011 migration, use reference scans to remove proven dead artifacts and update architecture/flow docs to describe the actual ownership and test boundaries.
- **Estimated effort:** S

## 5. Quiz and Scoring Verification

### Model Reconstruction

The runtime quiz contains exactly **12 frequency questions plus one trigger multi-select** and no goal-selection question (`src/features/onboarding/quiz.ts:108-191`). Frequency values are `Never=0`, `Sometimes=1`, `Often=2`, and `Very often=3` (`quiz.ts:86-92`). Each frequency weight is multiplied by that value. Trigger options add fixed bonuses.

| Question ID | PL | PP | CT | FC | Maximum contribution across axes |
|---|---:|---:|---:|---:|---:|
| `porn_empty_moments` | 1 | 0 | 0 | 0 | 3 |
| `porn_without_desire` | 1 | 0 | 0 | 0 | 3 |
| `porn_to_masturbation` | 1 | 0.5 | 0 | 0 | 4.5 |
| `automatic_phone_loop` | 1 | 0 | 0 | 0 | 3 |
| `pressure_speed_friction` | 0 | 1 | 0 | 0 | 3 |
| `force_arousal` | 0 | 1 | 0 | 0.5 | 4.5 |
| `mechanical_get_it_done` | 0 | 1 | 0 | 0 | 3 |
| `specific_pressure_dependency` | 0 | 1 | 0 | 0 | 3 |
| `arousal_rises_fast` | 0 | 0 | 1 | 0 | 3 |
| `notice_too_late` | 0 | 0 | 1 | 0 | 3 |
| `too_late_to_slow` | 0 | 0.5 | 1 | 0 | 4.5 |
| `checking_firmness` | 0 | 0.5 | 0 | 1 | 4.5 |
| `loop_triggers` multi-select | <=2.5 bonus | <=0.5 bonus | 0 | 0 | 3 total bonus |

Question/weight evidence: `quiz.ts:108-191`. Trigger maxima and option logic: `quiz.ts:439-465,846-879`.

Maximum raw scores are **PL 14.5, PP 17, CT 9, FC 4.5**. These maxima are derived from the question configuration rather than duplicated constants. Normalization divides by the axis maximum, caps at 1, and rounds to four decimals (`quiz.ts:747-776`). FC is correctly excluded from primary ranking and becomes `firmnessConcern` at normalized FC >= 0.5 (`quiz.ts:468-470`). Both FC-bearing questions also add PP, so Firmness Concern can indirectly raise Pressure.

Final submission and the preview share `scoreOnboardingQuiz` (`OnboardingQuizScreen.tsx:48-55`; `quiz.ts:494-506`). `Not sure` is exclusive in the UI and neutral in scoring; malformed persisted data containing `notSure` plus other triggers causes all trigger contributions to be ignored (`OnboardingQuizScreen.tsx:265-281`; `quiz.ts:850-858`). Normalized scores cannot exceed 1 under current code.

### Ten Source-Backed Simulations

Score order is `PL / PP / CT / FC`. Flags: EW evening window, EM empty moments, BO boredom, AL alone, ST stress, PH phone habit, FC firmness concern. “Surprising” means the implementation is deterministic but the product result needs a rule decision.

| # | Answer profile | Raw | Normalized | Primary / secondary | Flags | Result title | First action | Assessment |
|---:|---|---|---|---|---|---|---|---|
| 1 | High PL + high PP | `14.5/17/3/4.5` | `1/1/.3333/1` | Porn Loop / Pressure | EW EM BO AL ST PH FC | Porn loop + pressure pattern | `setupProtection` | Expected mixed result |
| 2 | High PL only | `14.5/1.5/0/0` | `1/.0882/0/0` | Porn Loop / none | EW EM BO PH | Porn loop pattern | `setupProtection` | Expected |
| 3 | High PP only | `0/12.5/0/1.5` | `0/.7353/0/.3333` | Pressure / none | ST | Pressure pattern | `startReset` | Expected |
| 4 | High CT only | `0/1.5/9/0` | `0/.0882/1/0` | Control/Timing / none | none | Control and timing practice | `startArousalPractice` | Expected |
| 5 | All Never | `0/0/0/0` | `0/0/0/0` | Porn Loop / Pressure | none | Porn loop pattern | `setupProtection` | **Incorrect: no evidence supports a profile** |
| 6 | All Very often | `14.5/17/9/4.5` | `1/1/1/1` | Porn Loop / Pressure | EW EM BO AL ST PH FC | Porn loop + pressure pattern | `setupProtection` | Stable but CT is hidden by tie order |
| 7 | Nearly tied PL/PP | `4/4.5/0/.5` | `.2759/.2647/0/.1111` | Porn Loop / Pressure | none | Porn loop pattern | `setupProtection` | Secondary is admitted at low signal; policy needed |
| 8 | FC high, primaries low | `0/4.5/0/4.5` | `0/.2647/0/1` | Pressure / none | FC | Pressure pattern | `startReset` | FC stays modifier, but its questions drive PP |
| 9 | Trigger-only incomplete preview | `2.5/.5/0/0` | `.1724/.0294/0/0` | Porn Loop / Pressure | EW EM BO AL ST PH | Porn loop pattern | `setupProtection` | **Surprising at only 1/13 answered** |
| 10 | `Not sure` trigger; all frequencies Sometimes | `4/5.5/3/1.5` | `.2759/.3235/.3333/.3333` | Control/Timing / Pressure | none | Control and timing practice | `startArousalPractice` | Neutral trigger works; close three-way ranking needs tests |

### Scoring Verdict

- **Verified correct:** question count; 0-3 values; fractional weights; dynamically derived maxima; normalization/cap; FC exclusion from primary; shared preview/final scorer; neutral `Not sure` behavior.
- **Must change:** zero/insufficient-signal handling before profile ranking.
- **Needs explicit product policy and tests:** exact ties, minimum secondary score, partial-preview threshold, and whether three equally strong axes can be represented without hiding CT.
- **Debug mismatch:** presets bypass the scorer. Their stored normalized vectors do not equal raw/max calculations. For example, the Porn Loop preset stores `.85/.25/.15/.20`, while its raw `10/3/1/1` computes to `.6897/.1765/.1111/.2222`. Use answer fixtures, not handcrafted result objects.

## 6. Journey Consistency Matrix

The initial recommendation mapping is sound for clear high-signal profiles. Divergence begins after the user takes an action because Result remains static, Today and Progress duplicate progression rules, Protection is split across stores, and Reset lacks terminal completion.

| Profile | Current state | Onboarding Result CTA | Today CTA | Progress CTA | Expected route / verdict |
|---|---|---|---|---|---|
| Any | Onboarding incomplete | N/A | Can be reached via Close with default plan | N/A | `/onboarding`; current close bypass is inconsistent |
| Porn Loop / mixed | Protection off | Set up Protection | Set up Protection | Set up Protection | `/protect/setup`; consistent |
| Porn Loop / mixed | Protection enabled, Reset not started | Still Set up Protection | Start Reset | Start Reset | `/reset/ten-day`; Result becomes stale |
| Pressure | Reset not started | Start Reset | Start Reset | Start Reset | `/reset/ten-day`; consistent |
| Control/Timing | No practice log | Start Arousal Practice | Start Arousal Practice | Start Arousal Practice | `/exercises/arousal-control`; consistent |
| Any with Reset | Active, today incomplete, fewer than 10 dates | Original profile CTA | Today's Reset | Today's Reset | `/reset/ten-day/practice`; Today/Progress consistent |
| Any with Reset | Active, today complete, fewer than 10 dates | Original profile CTA | View saved Reset | View saved Reset | `/reset/ten-day/saved`; active priority works |
| Any with Reset | Ten unique days complete | Original profile CTA | View saved Reset / Day 10 | Current action repeats Reset; roadmap advances | `/exercises/arousal-control`; **broken terminal transition** |
| Porn Loop / mixed | Protection “paused” in Demo | Set up Protection | Protect renders Off | State-dependent mismatch | A single paused state and manage/resume route; **broken authority** |
| Control/Timing | Latest Arousal log exists | Original first action | May still start practice | Progress may show preview/current simultaneously | `/exercises/arousal-control/progress-preview` or optional new practice; clarify policy |
| Debug profile | “Start as fresh” after old logs | Preset first action | New profile action | Old log can mark roadmap progress | Clear journey history or use “Set only”; **impossible combination** |

### Recommended `getNextBloomAction`

A centralized deterministic helper would materially reduce existing inconsistency.

**Inputs**

```ts
type NextBloomActionInput = {
  state: Pick<
    BloomLocalState,
    "onboarding" | "activePlan" | "protection" | "tenDayReset" | "arousalControl"
  >;
  todayKey: string;
};
```

`todayKey` should be explicit so the helper is pure and date cases are testable. Internally derive onboarding completion, canonical profile action, Protection state, valid Reset completion count/today status, terminal Reset status, and latest valid practice log.

**Output**

```ts
type NextBloomAction = {
  id:
    | "completeOnboarding"
    | "setupProtection"
    | "startReset"
    | "completeTodayReset"
    | "viewTodayReset"
    | "startArousalPractice"
    | "viewPracticeProgress";
  phase: "onboarding" | "protection" | "reset" | "practice" | "review";
  route: AppRoute;
  reason: string;
};
```

**Decision order**

1. Incomplete onboarding.
2. Reset terminal (10 valid days): advance to Arousal Control/review.
3. Active Reset and today incomplete.
4. Active Reset and today complete.
5. Profile progression: Porn/mixed requires truthful Protection setup before Reset; Pressure starts Reset; Control/Timing starts practice.
6. Valid latest practice log may offer Progress Preview without preventing an optional new practice.

**Consumers**

- Today hero action and supporting state
- Progress current action and roadmap status derivation
- Onboarding Result when revisited after progression
- Reset Saved terminal CTA
- Debug recommended-action summary

**Incremental migration**

1. Write table-driven tests for the matrix above.
2. Add the pure helper without changing UI copy.
3. Move Today, then Progress/current roadmap status.
4. Move Reset terminal handling.
5. Move revisited Result and Debug. Keep profile presentation copy in screens/config, not in the selector.

## 7. Privacy and Release Readiness

### Current Data and Security Facts

- Bloom currently makes no application network requests and includes no analytics, telemetry, crash reporting, remote logging, cloud sync, AI integration, clipboard, export, or share path.
- No hardcoded API keys, credentials, `EXPO_PUBLIC_*` variables, committed environment files, Apple credentials, or accidental personal identifiers were found.
- The only application console output found is a persistence failure warning and does not include state (`BloomLocalStateProvider.tsx:96-99`).
- Web persistence is plaintext `localStorage`; React Native persistence is only process memory. No encryption exists and none should be claimed.
- The full onboarding answer map and derived result are stored, although no post-onboarding consumer of raw answers was found.
- User-facing deletion, app lock, app-switcher obscuring, and screen-capture handling are not implemented.
- No protected iOS resource APIs are used, so camera/location/microphone usage descriptions are not current blockers. A generated release archive still needs privacy-manifest verification.

### Owner-Only Development Build - Not Ready

Required before meaningful owner iPhone acceptance:

1. Durable native persistence with a validated migration from the current key.
2. Cold-launch, force-quit, deletion, and corrupt-state recovery tests.
3. A supported physical-device runtime path: validated SDK upgrade or Expo development build.
4. Bundle identifier, EAS project/profile configuration, and a real development build install path.
5. Truthful Protection/save/completion states so the owner is testing real behavior, not UI simulation.

Expo recommends development builds for production-oriented projects and documents the current physical-iOS Expo Go SDK limitation: [development builds](https://docs.expo.dev/develop/development-builds/introduction/) and [creating a development build](https://docs.expo.dev/develop/development-builds/create-a-build/).

### Internal Testing - Not Ready

In addition to owner-build requirements:

- production-like builds must exclude the scoring panel and debug route;
- user deletion must clear every current state namespace and produce confirmed feedback;
- Pause, Log, Protection, Reset, and Arousal success screens must derive from real records;
- low-signal scoring and journey priority must have deterministic tests;
- a privacy/retention note must explain what remains on-device and for how long;
- support contact and wellness boundary must be real and reviewable.

### TestFlight - Not Ready

In addition to internal requirements:

- final app name, bundle ID, scheme, version/build numbers, support email, icon, splash, EAS project, and preview/production profiles;
- clean-install and upgrade-migration builds from a reproducible dependency tree;
- release-bundle verification that no debug route/panel is reachable;
- VoiceOver, Dynamic Type, keyboard, safe-area, background/foreground timer, and iPhone size-matrix QA;
- a reachable privacy policy and accurate App Store privacy answers;
- generated archive inspection for effective privacy manifests and entitlements.

Expo's EAS setup flow is documented at [EAS Build setup](https://docs.expo.dev/build/setup/). Apple requires a privacy-policy link in App Store metadata and within the app under its review rules: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

### Public App Store Release - Not Ready

In addition to all TestFlight requirements:

- validate the complete deletion and retention contract against the final storage implementation;
- decide and disclose app lock, app-switcher, and screenshot behavior for sensitive screens;
- finalize concise adult eligibility, wellness-not-medical, and urgent-help boundaries without diagnostic language;
- verify migration and recovery across at least one shipped schema upgrade;
- complete broad device/locale/accessibility testing and dependency advisory review;
- document support and incident handling.

### Future Cloud or AI Risks - Not Current Blockers

No data leaves the device today. Before adding cloud sync or AI insights, require contextual consent, minimize payloads, exclude raw quiz answers/notes by default, name processors, prohibit vendor training on user content, define retention, encrypt transport/server storage, separate identity from wellness records, and support local plus remote deletion. App Store privacy disclosures must be updated when off-device collection begins: [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## 8. Test Coverage Matrix

Current automated coverage is **none**. “Current” below means static audit/manual-only unless stated otherwise. The audit does not prescribe a framework; it identifies the minimum behavior contracts an implementation task should cover.

| Critical behavior | Current coverage | Minimum proposed coverage | Required by |
|---|---|---|---|
| Question count, weights, axis maxima, normalized cap | Source inspection only | Pure unit table asserting 12+1 config and calculated maxima | Owner testing |
| Ten canonical scoring profiles | Source-backed calculations only | Table-driven tests matching Section 5 | Owner testing |
| Zero signal, exact ties, secondary threshold, partial preview | None | Product-rule fixtures including all Never and trigger-only | Owner testing |
| Trigger flags and exclusive `Not sure` | None | Option-by-option and malformed persisted-answer tests | Owner testing |
| Profile/result/first-action mapping | None | Pure mapping tests for PL, mixed, PP, CT, FC modifier | Owner testing |
| `getNextBloomAction` priority | None | Matrix tests for Protection, Reset today state, day 10, latest log | Owner testing |
| Reset date count/idempotency/day 1/10/11 | Manual debug only | Pure date tests including duplicates and terminal transition | Owner testing |
| DST, timezone, midnight/foreground refresh | None | Deterministic clock/timezone tests | TestFlight |
| Native persistence cold restart | Impossible with current adapter | Adapter integration test plus real-device force-quit smoke | Owner testing |
| Old/partial/corrupt state migration | None | Fixture migrations, validation failure, payload preservation, recovery | Owner testing |
| Hydration race, write ordering, write failure | None | Delayed/failing adapter integration tests | TestFlight |
| Deletion across Bloom and legacy stores | Debug reset only | Integration test proving storage keys and in-memory state clear | Owner testing |
| Onboarding root gate and direct-route access | Manual/source only | Router/provider smoke tests for incomplete/complete/loading states | TestFlight |
| Terminal Saved route guards | None | Direct-link tests with no record, draft, and valid record | TestFlight |
| Debug panel/route excluded in release | None | Build-flag unit plus preview/release route smoke | TestFlight |
| Protection state transitions | Manual only | Off/active/paused/reload/settings truth table | Internal testing |
| Pause/Log/Arousal selection retention | None | Flow-level provider/component tests using real summaries | Internal testing |
| Timer background/foreground and cleanup | Cleanup inspected only | Fake-clock unit tests plus physical AppState smoke | TestFlight |
| Route constants resolve to files | Audit script only | Lightweight route manifest/static check in CI | TestFlight |
| Keyboard, safe areas, 390px overflow | Static review only | Manual device checklist and focused screenshot regression later | TestFlight |
| VoiceOver, 200% Dynamic Type, targets, contrast | Static spot review only | Manual accessibility matrix; component assertions where practical | TestFlight |
| Migration across a shipped app version | None | Installed-old-build -> upgrade -> verify data/delete | Public release |
| Large history/render/storage behavior | None | Profiling fixture at agreed retention limit | Later |
| Cloud sync/AI consent/deletion | Not applicable | Add only if those features are introduced | Later |

## 9. Recommended Execution Plan

### Phase 1 - Before iPhone Owner Testing

1. **Build the trustable storage boundary:** versioned envelope, runtime validation/migrations, native adapter, corrupt-payload preservation, and cold-restart checks (AUD-001, AUD-002).
2. **Make lifecycle operations durable:** hydration boundary, serialized writes, awaited all-store deletion/reset, and canonical `activePlan` derivation (AUD-003).
3. **Define and test scoring edge rules:** insufficient signal, ties, secondary threshold, partial preview, ten canonical fixtures; fix All Never (AUD-005, AUD-015).
4. **Converge the critical journey:** tested `getNextBloomAction`, Reset terminal state/guards, and one truthful persisted Protection status model (AUD-006, AUD-007, AUD-014).
5. **Create a reproducible owner build path:** choose validated SDK upgrade or development build, configure bundle/EAS development identity, install on iPhone, and pass cold-restart plus core-route smoke tests (AUD-012).

### Phase 2 - Before TestFlight

1. Gate the quiz diagnostics and debug route out of preview/production builds (AUD-004).
2. Migrate Log, Pause, and remaining Protection/Arousal behavior from Demo to Bloom; make every summary/note reflect a real stored record and guard terminal routes (AUD-008, AUD-009, AUD-011).
3. Complete privacy behavior: real skip choice, minimized quiz retention, all-store deletion, accurate in-app copy, and support contact (AUD-010, AUD-019, AUD-020).
4. Add the minimum automated suite and CI/static route checks from Section 8 (AUD-013).
5. Replace callback-count timers and fixed-24-hour date math; test foreground/midnight/DST behavior (AUD-016).
6. Run keyboard, VoiceOver, Dynamic Type, target-size, focus, contrast, safe-area, and iPhone size-matrix remediation (AUD-018).
7. Finalize iOS/TestFlight identity, icon/splash, build/version profiles, privacy link, clean install, upgrade migration, and release-bundle debug verification (AUD-012).

### Phase 3 - Before Public Release

1. Publish and verify the final privacy policy, retention/deletion wording, App Store privacy answers, and in-app access.
2. Complete a sensitive-data threat model and decide encryption, app lock, app-switcher, and screen-capture behavior; implement only the controls the policy requires.
3. Test an actual shipped-schema upgrade, corrupt-state recovery, low-storage/write-failure handling, and deletion after migration.
4. Complete public device, OS, locale, accessibility, backgrounding, and offline acceptance matrices.
5. Finalize adult eligibility, wellness-not-medical, urgent-help, support, and incident-response language without prohibited diagnostic/shame framing.
6. Run dependency advisory/license review and establish an Expo/React Native upgrade cadence.
7. Profile the agreed maximum local history and enforce retention before optimizing context/render behavior (AUD-021).

## 10. Recommended Branches

Use small, ordered branches rather than one state rewrite:

1. `fix/native-persistence-migrations`
2. `fix/hydration-reset-deletion`
3. `test/quiz-scoring-edge-cases`
4. `refactor/centralize-journey-decision`
5. `fix/reset-protection-state-truth`
6. `fix/guided-flow-record-truth`
7. `chore/disable-release-debug-tools`
8. `fix/mobile-lifecycle-accessibility`
9. `chore/ios-development-build`

Each branch should begin from the integrated result of the preceding dependency, carry its own focused tests, and avoid mixing visual redesign with state-contract work.

## 11. Top 10 Findings

1. **AUD-001:** Native state is only process memory; force-quit loses the core MVP.
2. **AUD-002:** Invalid/partial stored state can be silently replaced with defaults.
3. **AUD-003:** Hydration, migration, writes, reset, and plan synchronization lack one safe boundary.
4. **AUD-005:** All-Never answers incorrectly produce a Porn Loop/Pressure profile.
5. **AUD-010:** Privacy promises for deletion/skipping do not match behavior, and raw answers are over-retained.
6. **AUD-004:** Sensitive scoring and state debug surfaces are available without a production guard.
7. **AUD-007:** The Reset never terminates after ten days and Saved can claim unrecorded completion.
8. **AUD-006:** Protection has contradictory sources of truth and implies unsupported capability.
9. **AUD-008:** Guided-flow choices, notes, and summaries often do not reflect persisted user input.
10. **AUD-012:** There is no reproducible, current owner-iPhone/TestFlight build configuration.

The immediate sequence is: establish durable validated persistence, define/test scoring and journey rules, then make every visible saved/active/completed state truthful before widening distribution.
