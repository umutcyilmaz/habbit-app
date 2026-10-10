# Phase 11.1 follow-up — obsolete acknowledgement recovery

Date: 2026-10-10 (Europe/Istanbul). Branch: `feature/product-ui-v1`. F01 only; no commit or push.
The existing patch, staged files and user-created `phase-11-1.patch` were preserved.

## Finding and runtime semantics

The initial guard treated every `accepted=true` failure as a usable pending retry. That is false:
`persistenceSuperseded` and `persistenceInvalidated` can be accepted but nonretryable. They describe
an obsolete acknowledgement, not permission to overwrite current truth with the old successor.
The controller can then have neither Retry nor a usable Close.

Inspected all three controllers/hooks/screens and the provider/runtime revision, generation,
retry-map, late receipt, hydration and deletion paths. Supersession can leave a newer authoritative
accepted revision unconfirmed; completed deletion can instead replace both accepted and durable
state with fresh state. An invalidated persistence receipt can also leave the same accepted state
unconfirmed. Therefore neither the reason code nor equality of one feature slice authorizes exit.

## Smallest safe resolution

A shared pure policy compares **the full accepted snapshot with the full durable snapshot**.
Busy operations and retryable receipts retain their previous navigation guard. For an obsolete
nonretryable receipt, Close/back is allowed only when full current state is durable. The old domain
controller remains locked; the user exits/reopens against current truth instead of replaying it.
Live provider getters enforce the same policy for callbacks retained before state changed.
Reset also preserves its ordinary stale-identity Close check, with a deliberate exception for
obsolete receipts and explicit current-state confirmation after durable equality is established.

If accepted state remains authoritative but unconfirmed, the screen exposes **Güncel durumu kaydet**
(Save current state). The new small runtime method `confirmCurrentPersistence` delegates to the
existing exact-revision retry machinery. It reuses a current token when available; otherwise it
allocates a persistence acknowledgement bound to the current revision/generation. That new receipt
belongs to the explicit current-state save, not to the obsolete domain command. It does not commit
a new state revision, generate domain IDs/timestamps, replay any transition, restore discarded
state, or acknowledge the obsolete operation as successful. A covering in-flight write is awaited
rather than duplicated. Supersession/deletion during recovery invalidate that recovery normally.

Controllers distinguish `confirmCurrentSave` from the original operation. Current confirmation
never invokes the original success navigation; the user closes explicitly. A failed recovery
retains its exact receipt and ordinary Retry. A newly obsolete recovery again offers current-save
recovery if needed. Domain commands stay locked on that controller until exit, including retained
handlers. No serialized schema, persistence v7 contract or domain rule changed. This is a small
reuse of existing persistence semantics, not a receipt registry or runtime redesign.

Error messages no longer instruct the user to Close/reopen while Close is unsafe. Guidance reflects
busy, exact retry, current-state save, and safe durable exit. Content-Free/Reset save labels now
use full snapshot durability so a pending change in another slice cannot be labeled saved while
its recovery is blocked.

## Persistent storage failure reviewed separately

Repeated storage failure remains retryable. Deterministic regressions reject multiple saves,
verify that the identical authoritative snapshot is retained, that Close/back stay blocked, and
that exact Retry remains available. No automatic discard or rollback was added. An app kill may
lose unconfirmed memory; the visible guidance remains explicit about this limitation.

An explicit **return to last saved state** recovery option is warranted as follow-up UX for
prolonged failure. It must clearly disclose the changes being abandoned and require an intentional
choice. A safe implementation must first invalidate or drain outstanding writes, coordinate
runtime/provider revisions and generations, and only then restore authoritative durable state.
A plain Close, reload, or assignment could lose accepted user data or allow a late write to undo
the rollback. That lifecycle operation is outside this focused obsolete-receipt fix; this patch
preserves data and keeps an actionable retry instead of silently discarding it.

## Files changed in this follow-up

- `src/app/providers/bloomLocalStateMutationRuntime.ts`: persistence-only current revision confirmation.
- `src/app/providers/BloomLocalStateProvider.tsx`: stable current-confirmation and live durable-state accessors.
- `src/shared/navigation/bloomPersistenceRecovery.ts`: shared full-state exit/recovery policy and guidance.
- `src/features/content-free/{contentFreeController.ts,useContentFreeFeature.ts,screens/ContentFreeScreen.tsx}`.
- `src/features/reset/{resetController.ts,useResetFeature.ts,screens/ResetProductScreen.tsx}`.
- `src/features/masturbation-tracking/{masturbationSessionController.ts,useMasturbationSessionFeature.ts,screens/MasturbationSessionScreen.tsx}`.
- `scripts/verify-bloom-nonretryable-recovery.ts`: twelve actual-hook/runtime cases and runtime lifecycle races.
- `scripts/verify-bloom-persistence.ts`: run the new regression group within the existing framework.
- `scripts/verify-bloom-{content-free,reset,masturbation}-feature.ts`: existing hook dependency mocks updated.
- `src/features/debug/phase10/{phase10QaSession.ts,Phase10QaScreen.tsx}`: isolated one-shot invalidated-receipt injector.
- `scripts/verify-bloom-phase10-qa.ts`: verify injector, exact recovery and normal-data isolation.
- `.maestro/phase11-obsolete-save-recovery.yaml`.
- `.maestro/subflows/{phase11-arm-invalidated-save.yaml,phase11-confirm-obsolete-save.yaml}`.
- `.maestro/README.md` and both Phase 11.1 reports.

## Deterministic verification

All final automated checks passed with exit 0:

- `npm run typecheck`
- `npm run verify:persistence`
- `npm run verify:persistence-acknowledgement`
- `npm run verify:reset-continuity` (all fifteen regression groups)
- `npm run verify:home-ui`
- `npm run verify:product-onboarding-ui`
- `npm run verify:e2e-runtime`
- `npm run verify:e2e-app-identity`
- `npm run verify:release-debug-guards`

The twelve new cases execute actual feature hooks/controllers with the real runtime, across all
three flows: superseded/durable, superseded/unconfirmed (another slice), invalidated/unconfirmed,
and completed deletion followed by an obsolete Retry. They assert `accepted=true, retryable=false`,
durable-only exit, visible actionable recovery, unchanged domain fact counts and state revision,
no obsolete success navigation, and repeated recovery failure followed by exact retry. Additional
runtime checks supersede and delete during current recovery and verify no deleted-state resurrection.
Existing retryable failure, timeout/late acknowledgement, stale handlers and Phase 10 groups pass.
Controlled hook tests do not claim a mounted native renderer.

Logs: `/tmp/bloom-phase11-1-review/persistence-final.log` and `check-*.log`.

## Simulator verification

Simulator: iPhone 17 Pro, iOS 26.3. App: `com.umutcyilmaz.bloom.e2e`, existing guarded Phase 10
private storage/runtime on localhost port 8082. No native rebuild, normal Bloom data changes or
device clock changes. Native source stayed stable during each final flow.

`maestro test .maestro/phase11-obsolete-save-recovery.yaml` passed with exit 0. It invalidates real
save receipts for Content-Free activation, Reset completion and session start, then verifies:
ordinary Retry absent; current-save button present; Close disabled; attempted Close/edge-back swipe
retains the actual screen; current confirmation enables Close without obsolete auto-navigation;
explicit Close works. The recovered session reopens through Home with its canonical active state.
Artifacts: `/tmp/bloom-phase11-1-review/obsolete-native/2026-10-10_133616`.
Visually inspected the session's actual obsolete-receipt screen: clear error, current-save button,
disabled Close and continued-session action, and honest termination guidance. The other two screens
were exercised by Maestro; no broad layout/accessibility certification is implied.

The final combined rerun of `.maestro/phase11-save-recovery.yaml` and
`.maestro/phase10-continuation.yaml` passed: **2/2 flows, exit 0**. The first covers ten original
retryable failures across activation/deactivation, Reset restart/undo/completion/both continuation
decisions, and session start/end/feedback, including navigation guards and confirmed session
rehydration after relaunch. Phase 10 verifies failed completion without a premature continuation
offer, accepted fifteen-day continuation and declined continuation after relaunch, and exact retry
after failed acceptance. Artifacts:
`/tmp/bloom-phase11-1-review/retryable-continuity-native/2026-10-10_133829`.

Final `git diff --check` and whitespace checks for the new untracked source/test/flow/report files
passed. No commit or push was made. The existing Metro process remains running.

## Remaining risks

- Persistent storage unavailability can still keep a route open indefinitely, with Retry available.
  A deliberate discard/rollback option needs the lifecycle work described above; none was silently added.
- Process termination cannot preserve unconfirmed memory. Only acknowledged durable data is promised.
- Native supersession/deletion races and repeated OS storage faults are deterministic-test coverage,
  not device-fault reproductions. The native injector intentionally synthesizes one invalidated receipt.
- Android/web, physical-device, accessibility and signed-release checks remain outside this iOS pass.
- Other Phase 11 findings remain untouched.
