# Phase 11 — Bloom product audit and gap analysis

Audit date: **2026-10-10 (Europe/Istanbul)**. Repository: `~/Desktop/tms`; branch: `feature/product-ui-v1`; inspected HEAD: `085421e`.

## Release assessment

**Bloom has a working V4 core, but the current application is not ready for release.** The main problems are failed-save recovery across navigation, conflicting legacy entry points, misleading preferences, and incomplete access to saved product records. These are user-facing gaps despite the substantial passing domain/persistence verification suite.

No P0 issue was confirmed. P1 means a release-significant functional problem, important missing journey, or explicitly identified release-verification gap; P2 means an improvement that can normally wait. A risk or missing decision is not presented as a reproduced bug.

This was an audit-only phase. Application code, tests, package/configuration files and existing Maestro flows were not edited. No commit or push was made. Only this report is added to the repository. Synthetic data in **Bloom E2E**, and disposable logs, bundles and audit flow files under `/tmp/bloom-phase11`, were used. Normal Bloom user data and device/system time were not modified.

## Evidence boundary and method

- Read actual Expo Router entries, mounted providers, V4 screens/hooks/controllers, legacy screens, pure transitions/selectors, v7 persistence and the existing verification runners. Documentation was context, not proof of access.
- Ran all existing `verify:*` package commands and typecheck listed below. Many product UI checks use controlled hook/screen harnesses, not a mounted native renderer; passing them does not prove native navigation or layout.
- Reused the installed **`com.umutcyilmaz.bloom.e2e`**, `tms-e2e` scheme, localhost Metro on port 8082, existing Phase 10 namespace/clock/failure injector and Maestro. Simulator: **iPhone 17 Pro, iOS 26.3**. No native rebuild or new QA framework was needed.
- The existing onboarding Maestro flow targets obsolete selectors. Two small disposable V4 journey files, with follow-up steps, were therefore placed in `/tmp`, using the same Maestro runtime and real screen actions. They are audit execution aids, not installed product/test infrastructure.
- Used direct Computer Use to inspect actual onboarding, recommendation, Home, Content-Free failure/re-entry, Progress, Exercises and Data Controls. Maestro also interacted with actual V4 session, Reset and Panic/Urge screens. Inspected captured Reset save-failure/continuation/credited-counter, scrolled Home Panic, Urge review and undone-history images; other screen interactions are not represented as a full visual review.
- Initially attempted first-run onboarding with Phase 10 mode still enabled. Submission timestamps use the system clock (`src/features/product-onboarding/productOnboardingSubmission.ts:40`), while acceptance uses the injected QA clock (`src/app/flows/bloomProductFlowActions.ts:48`). The frozen October 1 clock made acceptance earlier than completion, correctly rejected by `src/storage/bloomProductOnboardingTransitions.ts:35`. This is a **QA-mode limitation**, not a confirmed normal-runtime onboarding defect. Restarted Metro with `npm run start:e2e` without `EXPO_PUBLIC_PHASE10_QA` and verified normal-clock onboarding successfully.

## 1. Current product implementation inventory

| Area | Actually implemented and reachable | Incomplete, legacy or planned |
| --- | --- | --- |
| Startup / hydration | Font loading and splash gate in `app/_layout.tsx:10`; v7 provider hydration; global loading/error/retry/delete-data boundary. `/` uses durable `productOnboarding` to route to intro, unaccepted recommendation or Home (`app/index.tsx:15`, `src/features/product-onboarding/productOnboardingRoute.ts:3`). | Hydration error presentation is the older English/light UI. Signed offline startup and physical-device launch were not tested. Legacy onboarding completion is not converted into product onboarding acceptance. |
| Onboarding | Mounted intro and **12-question Turkish V4 quiz**; single/multiple choices, exclusive answers, back/next validation, scoring, acknowledged submission, saved historical result and recommendation. Native first-run Tracking recommendation, acceptance and relaunch passed. | In-progress answers/index exist only in component state (`src/features/product-onboarding/ProductOnboardingQuizScreen.tsx:20`); quitting before submission restarts the quiz. There is no retake/plan-change UI. Old 13-question screen implementations still exist but are not mounted by `/onboarding/*`. |
| Recommendation acceptance | Four existing outcomes: Tracking enables Tracking; Content-Free activates its counter; Reset prepares baseline; combined plan activates Content-Free and prepares baseline atomically. Reset starts only after its four baseline answers and explicit submission (`src/storage/bloomProductOnboardingTransitions.ts:69`, `src/features/starting-recommendation/useStartingRecommendationFeature.ts:40`). | Four outcomes passed code/harness checks; only Tracking acceptance was exercised as a fresh native onboarding journey here. Closing an unaccepted recommendation permits conflicting manual feature activation (F05). |
| Home | Mounted V4 Home; durable metrics, active/inactive Tracking and Content-Free cards, Reset priority, pending recommendations/completion/continuation, unfinished session/Urge recovery and Panic. `src/domain/home/getBloomHomeReadModel.ts:116` prioritizes session, feedback, Urge, Reset, pending recommendation and ordinary tracking actions. | No Settings or product-history entry in its header. Settings remains reachable via legacy tab headers. Reset's independent view button is conditional on Reset being the primary action (`src/features/home/screens/BloomHomeScreen.tsx:104`); unfinished work temporarily removes that secondary entry. |
| Masturbation Tracking | Explicit enable; start; optional pause/resume; end; three feedback questions; durable completion; Home metrics; active/feedback recovery by canonical session ID. Domain guards prevent V4 starts during Reset. Actual native start/pause/relaunch/resume/end/feedback passed. | Disable, discard, completed-session correction and deletion exist in flow/domain APIs but have no user-facing controls. No list/detail route for completed sessions. Successful feedback navigates straight Home, so the implemented completed-summary component is not the ordinary success destination (`src/features/masturbation-tracking/useMasturbationSessionFeature.ts:60`). |
| Content-Free | Home entry; independent activation/deactivation, completed-day and best streak, confirmed intentional-content violation, linked session/Reset effects, manual undo and violation history. Real native activation/violation/undo was exercised. | History is a **violation history**, not a full activation/streak timeline. Only an eligible latest manual event has a direct undo control; session-origin corrections need the currently absent session editor. Failed-save re-entry loses retry (F01). |
| 15-Day Reset | Recommendation → four-question baseline → explicit start; elapsed-time progress; active restriction; violations with atomic linked Content-Free updates; undo/history; explicit elapsed completion; persisted acceptance/decline continuation and earned credit. Existing native continuation flow passed. | No mandatory post-Reset assessment in current flow; old assessment metadata is compatibility only. No ordinary independent start/change/abandon action. Completed Reset summary/history is not linked from Home/Progress after continuation is settled. Before-start behavioral explanation is incomplete (F09). |
| Panic / Urge Control | Home, active Reset and Content-Free lead to V4 Panic. Triggered branch starts/resumes current Urge: interrupt → outcome → optional triggers/skip → completion. Slip branch previews and atomically updates affected Reset/Content-Free state; no-op when no active tracker is affected. Old Urge events can resume their legacy stages. | No user-accessible completed Urge record history. Current interrupt is untimed; breath/notice selections are local UI cues, not a separate persisted technique program. Native coverage is recorded in the verification section. |
| Log | Accessible tab with real acknowledged Check-In saves, optional context/note and recent Check-In records using canonical/durable legacy data. | English/light legacy UI; does not list V4 Tracking sessions, Content-Free violations or Urge events. A Check-In is a different record, not a V4 session/violation log. |
| Exercises / Pause / Arousal | Accessible legacy tab; legacy timed Pause and Arousal drafts/completion/records have real persistence and existing verification. Some quick tools only display short advice. | Featured Arousal Practice is a separate legacy masturbation workflow, bypassing V4 Reset policy and Tracking history (F03). It is not a shortcut into V4 Tracking. |
| Progress / old Reset / guide | Accessible Progress reads old onboarding/active plan, `tenDayReset`, and legacy Arousal logs. Old 10-Day Reset routes remain executable. | Progress ignores V4 product progress (F02). The guide's normal entry is in `src/features/today/screens/TodayScreen.tsx:88`, which current Today route no longer mounts; `/guidance/what-should-i-use` is effectively an orphan/deep-link entry and recommends old tools/10-Day Reset. |
| Protect | Accessible legacy tab and real acknowledged configuration/pause/resume/off actions. UI describes stored **in-app pause preferences** (`src/features/protect/screens/ProtectScreen.tsx:225`). | No OS/browser blocking, automatic interception or external enforcement integration found. Do not equate saved Protection preferences with device content blocking. |
| Settings / data / privacy | Reachable from Log/Exercises/Progress/Protect headers. Delete-all uses the active storage adapter, removes current/legacy/quarantine Bloom keys, blocks stale writes and returns to onboarding after acknowledgement. | Personalization and notification controls are transient demo values with no functional consumer. Privacy copy refers to the old quiz and does not explicitly inventory new records. App Lock and Subscription are clearly disclosed placeholders, not functioning security/billing. |
| Persistence / release isolation | AsyncStorage on native; localStorage on web; version **7**, `bloom.localState.v7`; serialized write coordinator, accepted/durable projections, exact-revision retry, lifecycle guards, legacy migration and corruption preservation. Debug/E2E guards and separate E2E identity checks passed. | Pending operation receipts in several feature controllers do not survive screen unmount (F01). No application-level encryption, cloud backup/recovery/export, or retention bounds. Signed release, platform backups and device accessibility remain unverified. |

**Legacy distinction:** `app/(tabs)/today.tsx:3` mounts `BloomHomeScreen`, while the other four tab files still mount legacy feature screens. `src/features/today/screens/TodayScreen.tsx` and `src/features/onboarding/screens/*` are retained source, not the normal Home/onboarding experience. Legacy Pause/Arousal/Protection are executable features, not merely mockups; their data and policies are separate from V4.

## 2. End-to-end journey assessment

| Requested journey | Assessment | Evidence and remaining limit |
| --- | --- | --- |
| 1. First open | Works in E2E native runtime. | Existing bootstrap reached V4 intro after clearing **only E2E**; startup/hydration inspected in code. |
| 2. Complete onboarding | Works for completed answers; partial draft continuity is absent. | All 12 low-signal questions answered through actual native controls. Back/validation/multiple-choice semantics also have existing code checks. |
| 3. Receive recommendation | Works. | Native Tracking result and historical result save observed; other three results verified in existing tests, not fresh native quiz runs here. |
| 4. Accept recommended path | Direct route works; optional detours can conflict. | Normal-clock native Tracking acceptance passed. Four atomic outcomes/historical acceptance pass existing checks. See F05 for recommendation → close → manual activation. |
| 5. Correct Home | Works in the direct tested path. | Tracking enabled, empty metrics truthful, first-session CTA present; acceptance survives terminate/relaunch. Reset/continuation Home is covered by Phase 10 flow. |
| 6. Use recommendation | Core Tracking and continuation functions work. | Native session lifecycle, Content-Free activation/manual correction and real Reset completion/offer actions exercised. Fresh native Reset baseline and every recommendation outcome were not tested here. |
| 7. Navigate other features | Partially coherent. | Native Progress, Exercises and Settings navigation observed; legacy data/policy split is confirmed. Settings reachable through a different tab, not Home. |
| 8. Close/reopen without loss | Acknowledged paths work; drafts/failed writes have limits. | Onboarding acceptance, paused session and Reset decisions survive relaunch. Quiz/feedback selections before submission are transient. Failed writes should never be interpreted as saved. |
| 9. Recover from errors | Good while remaining on the original screen; incomplete after leaving. | Real rejected completion and acceptance writes retry successfully. Reproduced Content-Free failure → close → reopen removes retry and unlocks unrelated actions (F01). Hydration/corruption/deletion faults are verified in tests, not native failure injection in this pass. |
| 10. Reset → Content-Free | Core continuation works. | Existing Maestro: actual completion with rejected write → no premature offer → retry → 15-day acceptance → relaunch; decline → relaunch; failed acceptance → retry. This is real V4 UI with synthetic elapsed time, not 15 wall-clock days. |

## 3. Confirmed functional problems and implementation gaps

### F01 — P1: failed-save recovery disappears after closing and reopening

**Type:** confirmed native bug in Content-Free; equivalent exposure confirmed by code in Reset/session controllers.

**Current:** seed isolated `continuation-declined`; arm “Fail next QA save once”; activate Content-Free. The real screen shows an unconfirmed write, failure sentence and retry. **Kapat remains enabled**. Close to Home and reopen Content-Free: it still says “Kaydetme henüz doğrulanmadı”, but retry and explanatory failure text disappear; Panic, record and stop controls are enabled again. Home meanwhile still uses the older durable inactive counter.

**Cause/evidence:** `src/features/content-free/useContentFreeFeature.ts:24` constructs a screen-local controller; navigation guard at `:29` blocks only `operation.busy`; close at `:99` permits settled failures. `canRetry` at `:49` depends on the now-lost controller result, whereas save-state at `:53` still detects accepted/durable mismatch. Reset has the same local-controller/only-busy guard and close pattern (`src/features/reset/useResetFeature.ts:43`, `:153`); sessions also allow close on a settled failure (`src/features/masturbation-tracking/useMasturbationSessionFeature.ts:41`, `:51`). A failed new-session start is particularly vulnerable: Home sees no durable current session, while reopened start sees an accepted session whose continue requires a durable match (`:89`). That session variant was not separately reproduced in Simulator.

**Expected:** an accepted, unconfirmed mutation retains its exact-revision recovery action until resolved, across any permitted navigation. Pending truth must not lose its retry ownership or silently unlock new commands. Killing the process cannot be claimed to preserve an unacknowledged write.

**Next action:** first implement the smallest consistent navigation/recovery policy: retain receipts beyond route lifetime or prevent leaving until acknowledgement with a deliberate recovery/exit choice. Cover close, back/gesture, re-entry and terminal session/Reset operations with native regressions. Preserve current exact-successor retry; do not replay domain commands.

**Native artifact:** `/tmp/bloom-phase11/manual/content-free-reentry-no-retry.png`.

### F02 — P1: Progress tells an onboarded V4 user to complete onboarding

**Type:** confirmed native bug / broken product connection.

**Current:** complete all V4 questions, accept Tracking, relaunch and tap Progress. It shows “Starting plan”, “Complete onboarding to personalize your plan”, a current “Complete onboarding” roadmap and onboarding buttons. Those buttons open the V4 intro, whose completed-user button returns to Home; they cannot satisfy the old Progress condition. Tracking sessions/Content-Free/15-Day Reset are not included.

**Evidence:** `src/features/progress/screens/ProgressScreen.tsx:55` reads `state.onboarding.quizResult`, `:57` reads `state.tenDayReset`; `:92` and `:98` branch on old `state.onboarding.completed`. `getNextBloomAction` is the old journey selector. Current onboarding populates `productOnboarding`, not those fields. Screenshot: `/tmp/bloom-phase11/manual/progress-after-v4-onboarding.png`.

**Expected:** the visible Progress experience reflects the accepted V4 plan and available V4 records; a completed user is not sent into a redundant onboarding loop.

**Next action:** provide a small V4 summary/record entry using existing product facts, or remove the misleading legacy entry from the release navigation until it is connected. Preserve historic data; replacing the visible destination need not delete legacy models.

### F03 — P1: Exercises exposes a second masturbation workflow outside V4 policy

**Type:** confirmed code-level policy/navigation gap; native Exercises entry inspected, active-Reset bypass not reproduced natively here.

**Current:** Exercises “Start Practice” opens `/exercises/arousal-control`, not `/bloom/masturbation-session/start`. `src/features/arousal-control/screens/PracticeModeSelectionScreen.tsx:49` starts a legacy draft; `src/storage/bloomState.ts:1146` only validates that draft and writes `arousalControl`. It does not check `resetJourney`, Tracking permission/current session or V4 restrictions. Completion remains a legacy Arousal record, not a Tracking session. Thus a user whose Home says new sessions are blocked during Reset still has another accessible guided masturbation entry. Legacy 10-Day Reset also coexists independently (`src/features/reset/screens/TenDayResetScreen.tsx:77`; Progress legacy route choices at `:512`).

**Expected:** visible tools obey one understood product policy and store the records promised by that journey. A legacy tool cannot be presented as the same feature while bypassing its restrictions.

**Next action:** decide which legacy tools are intentionally supported in the initial release. Route equivalent practice entry to the V4 flow or gate/explain legacy entry appropriately. Do not run two Reset programs in the release navigation. Retain compatibility data/routes only where explicitly needed. Do not attempt to fabricate V4 sessions from old practice records.

### F04 — P1: privacy/preferences controls have no effect and reset on relaunch

**Type:** confirmed functional/trust bug; personalization relaunch reproduced natively, notification behavior confirmed in code.

**Current:** Data Controls says personalization is on/off and offers a toggle (`src/features/settings/screens/DataControlsScreen.tsx:57`). Turning it off only dispatches to `DemoAppStateProvider`; it returns to **on** after E2E terminate/relaunch. The three demo preference fields have no runtime consumer outside their settings labels/reducer. Notifications similarly offers pause/discreet toggles (`src/features/settings/screens/NotificationSettingsScreen.tsx:18`, `:37`) with no scheduling/permission integration or persistence.

**Evidence:** `src/app/providers/DemoAppStateProvider.tsx:24` is a transient reducer initialized from demo defaults. Repository searches for `personalizationEnabled`, `notificationsPaused` and `useDiscreetNotifications` found no recommendation/scheduling consumer.

**Expected:** a privacy choice changes the claimed behavior and survives relaunch, or the app makes clear that it is unavailable.

**Next action:** remove/clearly disable these false controls for the first release. Implementing a new personalization policy or notification subsystem is not required to resolve this release blocker. App Lock is already honestly labeled planned (`src/features/settings/screens/AppLockSettingsScreen.tsx:28`); absence of biometrics by itself is a separate product decision, not this bug.

### F05 — P1: closing a recommendation allows activation that makes it impossible to accept later

**Type:** confirmed code/test-level composite journey gap; this exact detour was not run natively.

**Current:** recommendation Close replaces Home (`src/features/starting-recommendation/useStartingRecommendationFeature.ts:91`). Home still offers manual Tracking/Content-Free activation. If a Content-Free/Reset/combined recommendation remains unaccepted and the user enables Tracking, acceptance is an authoritative no-op: `src/storage/bloomProductOnboardingTransitions.ts:45` rejects enabled Tracking for non-Tracking plans. Independently activating Content-Free before accepting a plan that activates it is also rejected at `:52`. There is no Tracking disable UI or plan dismissal action. Presentation continues to offer the saved recommendation (`src/features/starting-recommendation/startingRecommendationView.ts:20`), then reports it unavailable after the no-op. Startup continues to route to this pending recommendation.

**Verification:** source composition above; existing `scripts/verify-bloom-starting-recommendation-feature.ts:123` explicitly verifies that conflicted recommendations remain presented and acceptance is a no-op. That is safe at the mutation boundary but does not resolve the reachable user journey.

**Expected:** taking an allowed optional route does not strand initial plan acceptance. The user can intentionally keep an independently activated feature, accept a compatible recommendation, or dismiss/change the starting choice.

**Next action:** decide a narrow pending-recommendation policy. Gate conflicting manual activation while the decision is pending, or reconcile already-active compatible features and provide a deliberate dismissal/alternative. Do not silently disable Tracking or replace a streak to make acceptance succeed.

### F06 — P1: saved Tracking records cannot be reviewed or corrected through ordinary navigation

**Type:** confirmed missing product journey, not missing domain implementation.

**Current:** successful feedback closes to Home (`src/features/masturbation-tracking/useMasturbationSessionFeature.ts:60`). Home presents aggregate quality/interval; no ordinary completed-session list/detail navigation exists. `CompletedSessionCard` contains an actual summary (`src/features/masturbation-tracking/screens/MasturbationSessionScreen.tsx:149`), but users are not sent to it on successful submission. Edit/delete/disable/discard API capabilities exist (`src/app/flows/bloomProductFlowActions.ts:119`, `:148`, `:150`) without mounted controls. Log and Progress read legacy records. A mistaken session answer can change the Content-Free streak with no accessible session correction, even though atomic correction transitions are implemented and tested.

**Expected:** a user can inspect the record they just saved and correct a consequential wrong answer without deleting every app record. The release should state whether Tracking can be stopped and an accidentally started session discarded.

**Next action:** implement the smallest saved receipt/recent-session detail and correction entry backed by the existing APIs. Prioritize explicit-content corrections and safe deletion over charts. Add disable/discard only with approved semantics; this is a UI connection task, not a new persistence architecture. Completed Urge and settled Reset history visibility can follow in Phase 12 if not promised at release.

### F07 — P1: existing onboarding E2E command is obsolete

**Type:** confirmed verification defect.

**Current/result:** `maestro test .maestro/onboarding-general.yaml --test-output-dir /tmp/bloom-phase11/onboarding-existing` exits **1**, after the real intro/start succeeds, because `bloom.quiz.answer.never` is absent. `.maestro/subflows/answer-never.yaml:5` expects the old quiz; `.maestro/onboarding-general.yaml:27` expects “QUESTION 13 OF 13” and old result/Quick Check-In actions. Current V4 uses question-qualified `bloom.onboarding.answer.*` selectors and 12 questions.

**Expected:** documented release-critical E2E commands exercise the currently mounted product journey. Passing old domain tests does not substitute for this.

**Next action:** update the existing maintained flows incrementally for V4 onboarding and four recommendation destinations. Add F01/F05 native regressions within the same infrastructure. Preserve E2E bundle/namespace isolation. The audit's disposable low-signal V4 flow passed; it does not make the checked-in command pass.

## 4. Release risks and decisions still needed

### F08 — P1: privacy/storage release claims need a defined, verified scope

**Type:** confirmed implementation limitations plus unverified platform risk; no data exfiltration was observed.

**Current/evidence:** native adapter is ordinary AsyncStorage (`src/storage/storageClient.ts:11`); the full state is plain serialized JSON (`src/storage/bloomStatePersistence.ts:145`), without Bloom application-level encryption or app lock. No backend, analytics client, authentication, remote AI, export/share path or network request was found in inspected app runtime code/dependencies. This does not establish all native dependency/platform behavior. Raw sensitive onboarding, sessions and histories remain stored without a bounded retention policy. Corrupt values are preserved at source and copied under a fingerprinted backup key (`:473`); the same payload is deduplicated, but different corrupt payloads can accumulate. Full deletion enumerates backups/current/legacy keys (`:283`), with tested acknowledgement/lifecycle protection.

Privacy Overview still claims an optional trigger question (`src/features/settings/screens/PrivacyOverviewScreen.tsx:15`), which is the old quiz. Data Controls' storage inventory (`src/features/settings/screens/DataControlsScreen.tsx:48`) omits explicit descriptions of new Tracking feedback, Content-Free violations and Urge records. Generated E2E `ios/BloomE2E/PrivacyInfo.xcprivacy` exists; it is not evidence of a signed normal-release manifest review.

**Expected:** disclosure matches actual fields, local-storage protection, retention, deletion boundary and chosen supported platforms. No assertion of encrypted storage, secure erasure or excluded OS backups without verification.

**Next action:** update accurate inventory/disclosure and remove ineffective privacy choices (F04). Approve the intended shared-device/backup/retention model, then verify it on the actual release artifact. App lock/encryption should only enter implementation scope if the approved product promise requires them. Do not add a backend or authentication merely to resolve a local-data disclosure gap.

### F09 — P2: Reset setup does not clearly state the behavior being tracked

**Type:** confirmed copy gap in code; native baseline presentation not inspected in this audit.

**Current:** baseline confirmation calls the period optional/observational and explains when it starts (`src/features/reset/screens/ResetProductScreen.tsx:293`), but does not plainly summarize which behaviors restart an attempt. Active UI says new Tracking sessions are suspended; violation/Panic forms reveal restart consequences only later. The clear old “No porn / No masturbation / No checking” rules belong to the separate old program, and must not automatically be imported as current V4 policy.

**Expected/next action:** put a brief explanation before explicit start and on progress: existing V4 violation semantics, intentional versus accidental content, elapsed-day definition and restart/undo behavior. Decide any additional rule before promising it. No new rule engine is needed.

### F10 — P2: mixed language, design and icon presentation

**Type:** confirmed native/code UX inconsistency.

**Current:** dark Turkish V4 Home switches to light English Progress/Exercises/Settings with a dark tab bar. Content-Free native dates show English month names (`src/features/content-free/contentFreeView.ts:34` uses device locale); several error branches remain English (`src/features/masturbation-tracking/masturbationSessionController.ts:118`, `src/features/reset/useResetFeature.ts:68`). A settings gear renders as a missing-glyph box in inspected Progress/Exercises; `src/shared/components/AppHeader.tsx:35` draws `⚙` using the shared text font. The button remains accessible by “Open settings” and opens Settings. Home has no immediate Settings entry.

**Expected/next action:** choose the release language and align visible navigation/error/date copy. Replace the unsupported icon glyph with an existing supported icon representation. Add a simple Settings entry if Home is the intended product hub. These are focused UI fixes, not a full legacy visual rewrite.

### F11 — P1 release-verification gap: development Simulator success is not signed-release readiness

**Type:** missing evidence/product scope, not a confirmed build failure.

**Current:** normal iOS JavaScript export succeeded (1,292 modules, 3.53 MB Hermes bundle). Debug guards pass. There is no tracked release build/profile/store configuration evidence in this repository; generated native projects are ignored (`.gitignore:12`). Current generated iOS project is **Bloom E2E**. `app.config.ts:37` declares tablet support, but this pass used one phone. Normal Android package is not explicitly defined (`:45` only assigns E2E package); version is `0.1.0`, brand status/support address are placeholders (`src/app/config/appConfig.json:5`).

**Expected/next action:** choose initial release platform/device scope and produce/test the actual normal release build. Verify cold/offline launch without Metro, debug/deep-link guards, upgrade/rehydration, native privacy/backup configuration, actual icon/branding/support metadata and supported-device layout. Resolve normal Android identity if Android is in scope. No particular cloud build service or enterprise pipeline is required.

Accessibility is a release test gate: common V4 controls have roles, checked/disabled states and live error regions; no blanket accessibility failure is claimed. VoiceOver, focus recovery, largest text sizes, reduced motion, tablet/other phone layouts and physical-device behavior were **not tested** and cannot be declared compliant.

### F12 — P2: retention, corruption recovery and legacy cleanup limits

**Type:** confirmed behavior with potential long-term data/privacy impact; no capacity failure reproduced.

**Current/evidence:** each write serializes the entire state; product histories are append-oriented and Content-Free history renders the whole selected list (`src/features/content-free/screens/ContentFreeScreen.tsx:455`). No cap/expiry/pagination policy was found. A malformed current product record can reject whole-state hydration; preserved corruption gets retry/delete controls, not a record repair/restore UI. A failed legacy-key removal is swallowed (`src/storage/bloomStatePersistence.ts:405`), and subsequent loads prefer current v7 (`:99`), so the old sensitive copy can remain until full deletion. Existing verification proves corruption preservation and safe deletion, not automatic restoration.

**Expected/next action:** disclose recovery limits, approve bounded retention/quarantine/legacy cleanup policy, and use realistic synthetic long-history data to assess actual startup/write cost. Defer schema/migration work until that decision is approved. Do not infer a current performance incident from array size alone.

### F13 — P2: deferred and orphan surfaces should be made explicit

**Type:** confirmed scope/navigation gap.

App Lock/Subscription are honest future placeholders; Pelvic Relaxation is marked coming soon in the old guide; several exercise tiles show only advice (`src/features/exercises/screens/ExercisesScreen.tsx:36`, `:54`). The guide is linked from the unmounted legacy Today screen, while completed V4 Reset/Urge histories have no hub. `src/features/reset/PRODUCT_RESET.md` still says Home is unwired, although the current Home is wired. Earlier privacy audit findings about missing debug guards/save acknowledgement have since been fixed and must not be treated as current defects.

**Expected/next action:** define the initial supported feature menu, hide/de-emphasize unused placeholders, and mark legacy documents as historical. Connect a guide/history only if approved for release; no obligation to implement every named future feature.

## 5. Actual verification results

All commands below were run against this audit's current tree on 2026-10-10; **passed with exit 0**:

| Command | Actual result/scope |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` passed. |
| `npm run verify:reset-continuity` | All 15 regression groups, boundary/fractional credit, restarts/undo, saved offers/retry and v7 preservation passed. |
| `npm run verify:persistence` | Passed; includes product schema/migrations, four-plan acceptance, Reset baseline/violations/undo/completion, sessions/corrections, Content-Free, current/legacy Urge, Home priorities, product actions/routes and controlled feature harnesses. Reported 98 malformed product states and 164 malformed product-onboarding cases preserved/rejected. |
| `npm run verify:persistence-acknowledgement` | Exact-save acknowledgement/retry/lifecycle checks passed. |
| `npm run verify:quiz` | Existing quiz verification passed; not proof that old native quiz is mounted. |
| `npm run verify:onboarding` | Existing onboarding verification passed. |
| `npm run verify:product-onboarding-ui` | V4 UI/starting recommendation controlled checks passed. |
| `npm run verify:journey` | Existing legacy journey verification passed. |
| `npm run verify:protection-reset` | Existing Protection/legacy Reset verification passed. |
| `npm run verify:guided-flows` | Existing guided-flow verification passed. |
| `npm run verify:home-ui` | V4 Home activation/retry, presentation/order/hydration/durable wiring passed. |
| `npm run verify:e2e-runtime` | E2E runtime and Phase 10 QA verifiers passed. |
| `npm run verify:e2e-app-identity` | Normal/E2E app isolation checks passed. |
| `npm run verify:release-debug-guards` | Static/release guard verification passed. |
| `npx --no-install expo export --platform ios --output-dir /tmp/bloom-phase11/export-ios` | Production JS bundle/export passed. This is not a native signed-build test. |

### Simulator execution and visual coverage

| Execution | Actual result |
| --- | --- |
| Existing `.maestro/phase10-continuation.yaml` | **Passed, exit 0.** Actual completion rejected write/no premature offer/retry; 15-day acceptance + terminate/relaunch; decline + relaunch; failed acceptance + real retry. Artifacts: `/tmp/bloom-phase11/continuation/2026-10-10_123502`. |
| Existing `.maestro/onboarding-general.yaml` | **Failed, exit 1** at obsolete `bloom.quiz.answer.never`, after bootstrap/intro/start. Artifacts: `/tmp/bloom-phase11/onboarding-existing/2026-10-10_123643`. |
| Disposable `/tmp/bloom-phase11/v4-onboarding-audit.yaml` | **Passed, exit 0**, normal-clock E2E: 12 questions → Tracking recommendation → actual acceptance → Home → terminate/relaunch with Tracking CTA. Artifacts: `/tmp/bloom-phase11/onboarding-v4/2026-10-10_124234`. |
| Disposable V4 feature steps | Actual start/pause/close/terminate/relaunch/resume/end/three-question feedback/Home `7/10` passed. Content-Free activation/manual violation/undo passed. The first flow exited **1** on a history assertion below the viewport; subsequent scroll exposed the real undone history, so this was an audit assertion issue, not a confirmed undo bug. Artifacts: `/tmp/bloom-phase11/features-v4/2026-10-10_124453`. |
| Follow-up feature steps | Undone-history assertion passed after scrolling. A later offscreen Home Panic tap landed on Exercises and exited **1**; the first Panic follow-up also exited **1**. Explicit Home-tab selection, a Home wait and a center-screen swipe resolved the audit's entry/timing problem. These failures are retained as evidence, not classified as an app Panic bug. Artifacts: `/tmp/bloom-phase11/features-v4-resume/2026-10-10_124629` and `/tmp/bloom-phase11/panic-v4/2026-10-10_124812`. |
| Disposable `/tmp/bloom-phase11/v4-panic-audit.yaml`, final version | **Passed, exit 0.** Actual visible Home Panic → triggered → breathe/complete interrupt → reduced outcome → stress trigger → review → completion → Home → terminate/relaunch. Home kept `7/10`, had no unfinished-event attention button; Content-Free remained active and undone manual history survived. Artifacts: `/tmp/bloom-phase11/panic-v4-followup/2026-10-10_125512`. |
| Direct Computer Use | Confirmed F01 re-entry failure, F02 wrong Progress, F04 preference reset; inspected real V4 quiz/recommendation/Home and Content-Free, and legacy Exercises/Data Controls. No unobserved screen is claimed as visually checked. |

**Visual observations from inspected artifacts:** continuation is withheld during failed completion save; retry/error text is legible; acknowledged completion offers the actual 15-day continuation; the accepted counter displays 15 credited days. Undone-history status and Urge outcome/trigger review are legible on this device. Home Panic is below the initial viewport but becomes visible and works after a real scroll. No general layout/accessibility certification follows from these samples.

**Untested in Simulator here:** all four fresh recommendation profiles; fresh Reset baseline submission; Reset manual violation/undo buttons; session-feedback intentional-content yes/correction UI (the latter absent); Panic slip reasons/failure retry; every hydration/corruption/deletion timeout; web/Android/tablet/physical-device/large-text/VoiceOver/signed release. Existing code tests cover many of those domain/failure cases; that distinction remains explicit. Existing legacy Maestro suites were not exhaustively rerun: several seed old profiles and would provide misleading confidence about V4 recommendation/Home integration.

## 6. Release blockers and proposed incremental implementation scope

No implementation is authorized by this report. The following is a reviewable proposal, ordered by user impact.

| Release disposition | Findings |
| --- | --- |
| Resolve before calling the current core release-ready | F01 recovery; F02/F03 visible legacy/V4 conflicts; F04 ineffective controls; F05 stranded recommendation; F06 consequential record review/correction; F07 maintained native onboarding coverage. |
| Define scope and obtain evidence before distribution | F08 truthful privacy/storage disclosure and platform review; F11 normal release build, supported-device/platform and accessibility validation. These are not claims of an observed leak or build failure. |
| Focused polish or later work according to release promises | F09 Reset rule explanation; F10 language/icons/navigation; F12 retention/recovery policy; F13 placeholders/orphans. A misleading promise can raise the priority of the associated P2 item. |

### Proposed Phase 11 implementation, after review

1. **Failed-save navigation/recovery (F01).** Preserve one exact pending successor and recovery action across allowed exits, or deliberately guard the exit. Native checks must cover Content-Free activate, Reset restart/completion/continuation, and session start/end/feedback failures after close/back/re-entry. Do not change domain semantics/schema to solve a receipt-lifetime problem.
2. **Make visible navigation use one product truth (F02/F03).** Replace/hide the legacy Progress onboarding loop; stop ordinary Exercises/old Reset paths bypassing V4 policy. Keep data compatibility. A minimal current-plan/summary experience is enough; no dashboard redesign is required.
3. **Resolve pending recommendation detours (F05).** Approve either gated conflicting activation or compatible reconciliation/dismissal. Test recommendation → close → manual activation → reopen/accept, including relaunch, without overwriting a streak or disabling a preference silently.
4. **Make privacy/preferences truthful (F04/F08).** Remove/disable ineffective demo toggles; update stored-data/quiz/local-storage/deletion wording and supported-platform claims. Keep honest planned App Lock/billing out of the core release promise. Do not introduce notifications, auth or encryption without a separate approved requirement.
5. **Connect minimum saved-record review/correction (F06).** Use existing session summary/correction APIs for a recent-record entry and consequential explicit-content correction. Define minimal discard/disable behavior. Defer graphs and comprehensive history analytics.
6. **Repair maintained E2E coverage (F07).** Update existing onboarding selectors/outcomes and add the composite failure/detour regressions above. Keep Phase 10 continuity flow and E2E-only app/data identity intact. Test changes should accompany each implementation slice rather than wait until the end.
7. **Focused release UI pass (F09/F10).** Explain current Reset rules before start; align selected release language, dates/errors, supported settings icon and navigation labels. Verify actual phone/large-text layouts. Avoid an unnecessary full visual rewrite.

Acceptance gate: the direct onboarding→plan→Home→feature journey and permitted detours must work; failed writes must remain recoverable without domain replay; saved records must be reviewable where consequential; release-visible screens must reflect V4 state and truthful controls. Existing deterministic checks and the updated relevant native flows must pass. Each slice can be reviewed independently.

### Suggested Phase 12 / later, only where justified

- **Phase 12 release validation (F11):** normal signed/native release build, offline/cold start, release guards/deep links, upgrade/persistence/delete checks, platform privacy/backup review, actual device/large-text/VoiceOver checks and store metadata. This is a prerequisite to distribution, even if it runs alongside the approved Phase 11 fixes. Select iOS-first scope if appropriate; Android/tablet release remains conditional on explicitly supporting them.
- **Phase 12 product follow-through:** accessible completed Reset/Urge history, optional onboarding/feedback draft resume, independent feature management/Reset exit only after the intended product policy is settled. Prioritize actual usage evidence; a mandatory post-Reset assessment is not justified by this audit.
- **Later storage work (F12):** approved retention/minimization and orphan/quarantine cleanup, realistic-history performance measurement, then bounded UI/history or versioned changes if warranted. Do not implement destructive retention migrations from an audit inference.
- **Later optional features:** notifications, App Lock, premium billing, rich charts, export/cloud sync, Pelvic Relaxation and additional technique programs. None is needed merely to make the current core truthful and navigable; some may become requirements if explicitly promised for release.

**Final repository check:** `git diff --check` passed. `git status --short` shows only the new `docs/phase11-product-audit.md`; no tracked application, test, configuration or existing flow changes. No commit/push was performed. Temporary Maestro flows/artifacts remain under `/tmp/bloom-phase11` for inspection. The normal-clock audit Metro was stopped and the original isolated `npm run start:e2e:phase10` mode restored on port 8082; synthetic E2E audit records remain in the E2E sandbox.

## Turkish executive summary

Bloom'un V4 çekirdeği, normal onboarding, oturum takibi ve Reset → Content-Free devamlılığı çalışıyor; kapsamlı otomatik kontroller geçiyor. Ancak yayın öncesinde ilk olarak **başarısız kayıt sonrası ekranı kapatınca retry'nin kaybolması**, **Progress/Exercises ile V4 arasındaki veri ve kural kopukluğu**, **işlevsiz gizlilik tercihleri** ve **bekleyen öneriyi kilitleyen alternatif aktivasyonlar** çözülmeli. Kaydedilmiş oturumları görme/düzeltme yolu da bağlanmalı. Ardından güncel Maestro senaryoları ve gerçek release build/erişilebilirlik/gizlilik doğrulaması tamamlanmalı. Yeni büyük özelliklere geçmeden bu küçük, öncelikli dilimler gözden geçirilip onaylanmalı.
