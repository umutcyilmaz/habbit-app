# Real Kegel persistence and full Bloom inventory

Date: 2026-10-12. Branch: `feature/product-ui-v1`. No commit or push.

The [HTML implementation roadmap](bloom-html-implementation-plan.md) inventories all
21 reference flows and 88 labeled screen states, plus behavior-only/error/native states.
It distinguishes working V4 functionality, missing UI, visual differences, persistent facts
and external/native/product dependencies. Current tabs and legacy routes remain unchanged;
Library, Profile and paywall are planning only.

## Persisted Kegel feature

`/bloom/kegel` reuses the approved native Kegel screens and the existing canonical provider,
product acknowledged-action facade, persistence coordinator, durable projection, recovery
and navigation guards. It is an explicit route; no Home action or bottom tab was remapped.
The old `/debug/kegel` remains an isolated memory-only design preview. A real-route attempt
inside that memory-only build redirects to the design preview, preventing a false durable-save claim.

Only the full exercise timer, including final relaxation, emits a completed session. Start
captures one identity/timestamp and an immutable configuration snapshot. Completion captures
UTC time, local completion date and timezone offset, repetitions, active exercise seconds,
countdown-inclusive elapsed seconds, pause seconds and pause count. Abandoned/in-progress
sessions are not persisted as completed. Onboarding completion is a separate acknowledged
fact, saved only at the final educational step; trainer attempts are not workout records.

The configuration stays in `kegelConfig.ts`; all existing numeric values are unchanged.
Snapshots preserve the actually used parameters even when the configuration changes later.
No automatic progression, level unlock, daily workout cap, achievement or feedback adaptation
was introduced. Feedback selection is currently screen-local and clearly labeled as such.

Home derives today, all-time repetitions, Monday–Sunday activity and a trailing 28-calendar-day
heat map from **durable** completed facts only. Local completion dates are captured once, so
travel does not retroactively move a record to another day. The descriptive activity streak
counts consecutive local days with at least one saved set; yesterday remains current until
today ends. It is not an eligibility/unlock rule. Calendar/heat intensity uses the editable
visual daily target, never synthetic examples. Empty persisted history is genuinely zero;
unknown/unhydrated storage is not shown as a saved empty history.

## Compatibility and preservation

The existing v7 normalizer drops unknown fields. An in-place Kegel extension would let an
older v7 writer remove sessions. A separate Kegel store would bypass the shared write queue,
generation guards, deletion lifecycle and retry boundary. The implemented choice follows
Bloom's existing versioned architecture: **v8** at `bloom.localState.v8`, with explicit v7
migration and a new validated Kegel slice. The original **`bloom.localState.v7` is retained
byte-for-byte** after successful migration. No v7 rewrite or cleanup occurs in this path.
Older migration semantics remain unchanged. Existing explicit delete-all still owns deletion
of all Bloom keys; it was never invoked on user or Simulator data in this task.

Migration failure retains the original payload and reports an unconfirmed save through the
existing recovery path. Invalid v8 Kegel objects, missing Kegel slices, partial completions,
invalid dates/metrics and duplicate persisted identities reject hydration and use the existing
raw-payload backup, rather than dropping records or fabricating history. Future versions block
fallback and writes. The new tests migrate populated v7 Tracking/Content-Free/Reset/legacy
states and compare every non-Kegel slice exactly before and after Kegel writes/reopen.

v8 is authoritative for this build. An older build sees the retained pre-upgrade v7 snapshot;
cross-version downgrade writes are not merged automatically. A downgrade-write merge/cloud
sync or retention policy requires a separate design. Current migration preserves both copies
rather than risking an inferred merge.

## Honest failures and duplicate protection

The completion UI separates finished exercise from confirmed storage. It displays
`Kaydediliyor…`, `Kaydetme doğrulanmadı`, or `Bu cihaza kaydedildi`. Successful save additionally
requires the exact completed identity in durable state. Accepted-but-unconfirmed writes keep
the same immutable record and existing retry token, block navigation/new work, and never add
to Home's durable counters. A retry does not replay the completion or generate a new ID/date.

Concurrent/repeated callbacks share one operation; repeated successful completion is idempotent.
The transition never replaces an existing identity. A cached receipt cannot resurrect a session
removed by a later deletion/hydration lifecycle. Rejected/unaccepted requests offer an honest
retry or explicit unsaved return; uncertain accepted state follows the existing confirmation guard.
Force-quitting while a save is unconfirmed can lose that in-memory attempt; no successful-save
claim or parallel journal was introduced.

## Verification

Passed:

```text
npm run typecheck
npm run verify:kegel
npm run verify:kegel:persistence
npm run verify:persistence
npm run verify:persistence-acknowledgement
npm run verify:reset-continuity
npm run verify:home-ui
npm run verify:product-onboarding-ui
npm run verify:e2e-runtime
npm run verify:e2e-app-identity
npm run verify:release-debug-guards
npm run verify:guided-flows
npm run verify:journey
npm run verify:protection-reset
git diff --check
```

The existing suite's canonical-envelope fixtures/assertions now target v8, migration ordering
includes v7, route inventory permits the added Kegel route, and exact facade coverage includes
the two Kegel commands (36 total). Prior business assertions remain intact. Separate new tests
exercise actual v7 recovery-byte retention, failed migration, all earlier versions, genuine empty
state, reopen/two records, cancelled/partial rejection, snapshots, concurrent duplicates, failure
before/after writing, retry without replay, lifecycle invalidation, real summaries and DST.
The real timer-hook harness also checks its captured 110-second pause/background metrics.

Native verification passed using the existing E2E client with full default workout durations:
onboarding → pause/resume → first completed save → app close/reopen → second save → duplicate
callback → unfinished cancellation → injected third-write failure → same-record Retry → close/reopen.
A read-only calendar inspection also passed. The durable envelope contains **three unique sessions,
30 repetitions**, onboarding completion, and the first workout's real pause metrics. All completion
dates are 2026-10-12; Home shows three sets, one active day this week, activity streak one, and a
single active heat-map day. No existing normal Bloom or prior E2E keys changed: all original value
fingerprints matched (one normal key and three E2E keys). The QA independent slices also remained
unchanged; populated-slice migration/preservation was verified by unit/regression tests.

An earlier development run was interrupted by Fast Refresh while editing the new screens. The
final full flow was rerun with stable source and a fresh namespace. Earlier test data was preserved,
never reset. The [six state captures and calendar](qa/kegel-persistence/README.md) were inspected.

## Resume verification

On 2026-10-12 the resumed task first inspected `git status`, `git diff`, all persistence changes
and existing deliverables. Implementation and inventory were already complete; no application
code needed replacement or further changes. All verification commands listed above were rerun
and passed, including `git diff --check`.

The same saved QA namespace was reopened twice in the iOS Simulator using a read-only Maestro
flow. Both restarts displayed **three sessions and thirty repetitions**. The saved Kegel envelope
and all original normal/E2E values were byte-identical before/after. No new sessions, resets,
clears or mutations were triggered. The additional [reopened-screen capture](qa/kegel-persistence/07-resume-reopened.png)
was inspected; previous screenshots and QA data were preserved. Documentation and the review
patch were refreshed, and the patch was checked/applied against a clean temporary HEAD copy.

## Reproduce safely

Use a **new** 8–80-character run name for a fresh test. Reuse it across app relaunches; do not
use clearState or reset normal/E2E data. Existing runs remain stored in their own namespaces.

```sh
EXPO_PUBLIC_KEGEL_QA_RUN=qa_your_unique_run_name npm run start:e2e:kegel:persistence
xcrun simctl openurl booted 'tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082'
maestro test .maestro/kegel-persistence.yaml
```

The guard requires DEV, E2E mode, the E2E bundle, explicit persistence-QA flag and a valid run
name. The startup command stops before launching Expo when the run name is missing/invalid, so a misconfigured QA command cannot fall through to canonical E2E data. Ordinary builds use the canonical runtime. No new native dependency or rebuild was needed.

## Remaining decisions / visual limits

The durations, repetition count, daily target, levels, progression and educational claims are
still provisional. Approval is still needed for a finalized workout/progression policy, any
feedback retention/adaptation, reminder timing, session-retention/export policy and target-tab
integration. Streak qualification can be revised as a derived selector without changing saved facts.

The approved native design remains: existing Inter instead of Archivo, soft glow instead of canvas
mist, segmented ring gradient and some raster icon approximations. Real completion/failure copy
and the close control replace preview labels. QA-only controls reduce viewport height in these
captures; production has no QA toolbar. iOS was checked; Android/iPad/Dynamic Type and cloud sync
were not implemented or verified here.

## Changed files

The complete task-specific list follows. The previous untracked review patches were preserved.
The new [text-only review patch](patches/bloom-html-kegel-persistence.patch) excludes binary images,
screenshot galleries and earlier review-patch artifacts.

### Modified

- `package.json`
- `scripts/verify-bloom-behavior-slip.ts`
- `scripts/verify-bloom-content-free-feature.ts`
- `scripts/verify-bloom-content-free.ts`
- `scripts/verify-bloom-current-urge-control.ts`
- `scripts/verify-bloom-home-composition.ts`
- `scripts/verify-bloom-kegel.cjs`
- `scripts/verify-bloom-masturbation-feature.ts`
- `scripts/verify-bloom-masturbation-sessions.ts`
- `scripts/verify-bloom-onboarding-persistence.ts`
- `scripts/verify-bloom-panic-feature.ts`
- `scripts/verify-bloom-persistence.ts`
- `scripts/verify-bloom-plan-acceptance.ts`
- `scripts/verify-bloom-product-actions-runtime.ts`
- `scripts/verify-bloom-product-actions.ts`
- `scripts/verify-bloom-product-flow-actions.ts`
- `scripts/verify-bloom-product-onboarding-ui.ts`
- `scripts/verify-bloom-product-persistence.ts`
- `scripts/verify-bloom-product-policy-integration.ts`
- `scripts/verify-bloom-product-policy.ts`
- `scripts/verify-bloom-product-routes.ts`
- `scripts/verify-bloom-progress.ts`
- `scripts/verify-bloom-reset-baseline.ts`
- `scripts/verify-bloom-reset-completion.ts`
- `scripts/verify-bloom-reset-continuity.ts`
- `scripts/verify-bloom-reset-feature.ts`
- `scripts/verify-bloom-reset-recommendation-acceptance.ts`
- `scripts/verify-bloom-reset-recommendation.ts`
- `scripts/verify-bloom-reset-violation-undo.ts`
- `scripts/verify-bloom-reset-violations.ts`
- `scripts/verify-bloom-session-content-free-corrections.ts`
- `scripts/verify-bloom-session-corrections.ts`
- `scripts/verify-bloom-starting-recommendation-feature.ts`
- `scripts/verify-bloom-urge-control.ts`
- `src/app/providers/AppProviders.tsx`
- `src/app/providers/bloomProductAcknowledgedActions.ts`
- `src/domain/models/index.ts`
- `src/features/kegel/kegelConfig.ts`
- `src/features/kegel/kegelSession.ts`
- `src/features/kegel/screens/KegelCompletionScreen.tsx`
- `src/features/kegel/screens/KegelExerciseScreen.tsx`
- `src/features/kegel/screens/KegelHomeScreen.tsx`
- `src/features/kegel/screens/KegelIntroScreen.tsx`
- `src/features/kegel/useKegelExercise.ts`
- `src/storage/bloomState.ts`
- `src/storage/bloomStatePersistence.ts`
- `src/storage/bloomStateSchema.ts`

### Added

- `.maestro/kegel-persistence.yaml`
- `app/bloom/kegel.tsx`
- `app/debug/kegel-persistence.tsx`
- `docs/bloom-html-implementation-plan.md`
- `docs/kegel-persistence.md`
- `docs/qa/kegel-persistence/00-paused.png`
- `docs/qa/kegel-persistence/01-saved-completion.png`
- `docs/qa/kegel-persistence/02-reopened-one-session.png`
- `docs/qa/kegel-persistence/03-two-sessions-after-cancel.png`
- `docs/qa/kegel-persistence/04-save-failure.png`
- `docs/qa/kegel-persistence/05-reopened-after-retry.png`
- `docs/qa/kegel-persistence/06-real-calendar.png`
- `docs/qa/kegel-persistence/07-resume-reopened.png`
- `docs/qa/kegel-persistence/README.md`
- `scripts/require-kegel-qa-run.cjs`
- `scripts/run-bloom-kegel-persistence-verification.cjs`
- `scripts/verify-bloom-kegel-persistence.ts`
- `src/domain/models/KegelState.ts`
- `src/features/kegel/kegelPersistenceController.ts`
- `src/features/kegel/kegelPersistenceQa.ts`
- `src/features/kegel/kegelSummary.ts`
- `src/features/kegel/screens/KegelFeatureScreen.tsx`
- `src/storage/bloomKegelSchema.ts`
- `src/storage/bloomKegelTransitions.ts`
- `docs/patches/bloom-html-kegel-persistence.patch` — task-specific text-only review artifact.
