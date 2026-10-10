# Phase 11.1 — Failed-save recovery across navigation

Date: 2026-10-10 (Europe/Istanbul). Branch: `feature/product-ui-v1`.
Scope: **F01 only** from `phase11-product-audit.md`. No commit or push.

Follow-up review corrected the obsolete, nonretryable-receipt edge case. The current policy and
verification are in [phase11-1-obsolete-receipt-review.md](phase11-1-obsolete-receipt-review.md).
The implementation/results below record the initial Phase 11.1 patch; the follow-up supersedes
its blanket blocking of every accepted failure.

## Root cause

The acknowledged mutation runtime owns exact-revision retry tokens for accepted writes. The
Content-Free, Reset and session screens expose those receipts through screen-local controllers.
Their removal guards covered only `operation.busy`. Once storage returned a failure, busy became
false and Close/back could unmount the controller. On re-entry, accepted state remained different
from durable state, but the fresh controller had no failure result/token. Retry disappeared and
controller-local action locks were reset. Failed session start could also be absent from durable
Home recovery.

Inspected the runtime retry/lifecycle behavior, provider accepted/durable projections and stable
flow dependencies, shared navigation guard, three controllers/hooks, affected screens and routes.

## Recovery strategy

Keep the existing controller mounted while an operation is busy **or has an accepted, unconfirmed
result**. Apply the existing `usePersistenceNavigationGuard` to that condition, disable all Close
buttons (including the completed-session card), and recheck the live controller snapshot in Close
handlers. Those event-time checks also reject callbacks retained before a failed save.

This is the smallest consistent option: the controllers already retain the exact successor,
original failure and retry token, lock conflicting commands and navigate only after acknowledgement.
No receipt registry, provider ownership transfer, new schema or domain refactor is needed. Ordinary
product routes expose no other unlocked exit during these operations. The shared guard prevents
route removal, disables gestures and consumes native hardware back while blocked.

All three screens show recovery guidance: the screen stays open until confirmation, retry checks
the save, and fully closing the app can lose the unconfirmed change. The runtime's timeout message
no longer promises that leaving is safe.

## Behavior

- Content-Free activation/deactivation and existing record/undo operations keep their retry owner
  until the exact save succeeds. Panic and competing commands stay locked.
- Reset baseline start, restart/undo, elapsed completion and either continuation decision keep
  their recovery UI even when the accepted successor no longer matches the old attempt URL.
  Successful retry still navigates using the captured canonical successor; no transition repeats.
- Session start, pause/resume, end and feedback retain the same receipt and session ID. Failed
  start cannot escape to a Home that lacks a durable session; failed end/feedback cannot close
  merely because accepted domain state moved to the next stage or completed history.
- Close, back/removal and edge gestures stay blocked after a settled save failure/timeout.
  Retry is the existing persistence-only exact-token path. On confirmation, normal navigation
  resumes; acknowledged screen re-entry needs no recovery token and creates no new mutation.
- A late storage receipt can make state durable while a controller still has its timeout result.
  Retry then observes that exact receipt without another write and releases the guard.

Persistence remains v7. No storage key, serialized schema, migration, domain rule, ID/timestamp
factory or provider mutation behavior changed. Normal Bloom data was not read/copied/reseeded by
native QA; only the existing private `bloom.e2e.phase10.*` namespace was used. Device time was not
changed. The pre-existing untracked Phase 11 audit was left intact.

## Changed files

| Files | Change |
| --- | --- |
| `src/features/content-free/useContentFreeFeature.ts` | Guard settled accepted failures; expose navigation lock; live Close check. |
| `src/features/content-free/screens/ContentFreeScreen.tsx` | Disable Close and show recovery/process-termination guidance. |
| `src/features/reset/useResetFeature.ts` | Same navigation/recovery policy across Reset operations. |
| `src/features/reset/screens/ResetProductScreen.tsx` | Disable Close and show guidance. |
| `src/features/masturbation-tracking/useMasturbationSessionFeature.ts` | Same policy for session operations, including terminal saves. |
| `src/features/masturbation-tracking/screens/MasturbationSessionScreen.tsx` | Disable header and completed-card Close; show guidance. |
| `src/app/providers/bloomLocalStateMutationRuntime.ts` | Correct timeout message only; runtime semantics unchanged. |
| `scripts/verify-bloom-content-free-feature.ts` | Failed activate/deactivate Close/guard regression, timeout/late receipt, actual shared guard harness. |
| `scripts/verify-bloom-reset-feature.ts` | Failed baseline/restart/completion/both continuation decisions cannot close or release guard. |
| `scripts/verify-bloom-masturbation-feature.ts` | Failed start/end/feedback, retained Close callbacks, exact successor retry and durable-only navigation. |
| `.maestro/phase11-save-recovery.yaml` | Real isolated screen failures, blocked Close/edge swipe, retry, re-entry and saved-session relaunch. |
| `.maestro/subflows/phase11-arm-save-failure.yaml` | Reuse existing isolated QA failure injector. |
| `.maestro/subflows/phase11-retry-with-navigation-guard.yaml` | Shared native failure/navigation/retry assertions and screenshots. |
| `.maestro/README.md` | Commands, isolation and coverage boundaries. |
| `docs/phase11-1-failed-save-recovery.md` | This implementation and verification report. |

## Automated verification

All final automated runs passed with exit 0:

- `npm run typecheck`
- `npm run verify:persistence` (includes the expanded controlled hook/guard regressions)
- `npm run verify:persistence-acknowledgement`
- `npm run verify:reset-continuity` (all 15 regression groups)
- `npm run verify:home-ui`
- `npm run verify:product-onboarding-ui`
- `npm run verify:e2e-runtime`
- `npm run verify:e2e-app-identity`
- `npm run verify:release-debug-guards`

The new failed-start Close/guard regression was first run against the original code and failed,
then passed after the fix. Retry assertions check the identical accepted snapshot and unchanged
mutation/clock/ID counts. The shared guard harness executes the actual hook for route removal,
gesture options, hardware back, a one-use success allowance and expiry. Controlled harness tests
are not claims of a mounted native renderer or native Android verification.

Logs: `/tmp/bloom-phase11-1/check-*.log`, `regression-before.log`, `persistence-final.log`.

## Simulator verification

Simulator: iPhone 17 Pro, iOS 26.3. App: `com.umutcyilmaz.bloom.e2e`, `tms-e2e` scheme,
existing isolated Phase 10 Metro/runtime on port 8082; no native rebuild or new test framework.

Original reproduction passed as a **bug assertion** before implementation: failed activation →
Close → actual `/bloom/content-free` re-entry → unconfirmed state with Retry absent.
Artifacts: `/tmp/bloom-phase11-1/original-corrected/2026-10-10_130521`. The initial attempt used the wrong re-entry route and was corrected.

`maestro test .maestro/phase11-save-recovery.yaml` **passed, exit 0**. All ten injected failed
saves kept Close disabled and the recovery screen/Retry available after attempted Close and an
actual iOS edge-back swipe. Real Retry then recovered activation/deactivation, Reset restart/undo,
completion, acceptance/decline continuation, and session start/end/feedback. Confirmed Content-Free
and active-session close/re-entry passed; completed feedback survived terminate/relaunch with
Home showing `7/10` and no unfinished-session attention action.

Artifacts: `/tmp/bloom-phase11-1/recovery-corrected/2026-10-10_131052`. Screenshots for each failed
operation and the saved-session relaunch are in the flow's `takeScreenshot` directory. Visually
inspected actual Content-Free activation, Reset successor-recovery and session-feedback failure
screens: disabled Close, legible error and termination guidance, visible Retry and no premature
Continue. Other native operations were exercised by Maestro; that is not blanket layout or
accessibility certification.

`maestro test .maestro/phase10-continuation.yaml` **passed, exit 0**. Existing failed completion
with no premature offer, exact retry, 15 earned days after acceptance/relaunch, decline/relaunch,
and failed acceptance followed by its real retry remain correct.
Artifacts: `/tmp/bloom-phase11-1/continuity/2026-10-10_131441`.

`git diff --check` passed; new files were also checked with `git diff --no-index --check`.
The original E2E Phase 10 Metro was reused and remains running; synthetic records remain only in
the E2E QA sandbox. No commit/push, normal Bloom storage changes or device clock changes.
The first recovery attempt passed activation/deactivation but stopped at the collapsed Reset
manual-record section. The maintained flow now expands that section before choosing a violation.
Artifacts for that test-step failure remain in `/tmp/bloom-phase11-1/recovery/2026-10-10_130837`.

## Remaining risks and verification limits

- An app kill/OS termination can discard an in-memory unacknowledged change. Reopening uses durable
  storage; this change makes no promise of recovering unsaved memory after termination.
- Persistent storage failure deliberately keeps the affected route open with Retry available.
  There is no new discard/rollback operation or journal. Timeout confirmation checks the same
  save and never creates a replacement domain mutation.
- Forced provider/app remounts, development hot reload, external lifecycle invalidation and
  arbitrary external deep links are not ordinary Close/back navigation and are not made into
  cross-process receipt recovery by this patch. Existing runtime invalidation semantics remain.
- Native baseline start, session pause/resume failure, Android/web navigation, physical devices,
  VoiceOver and signed release behavior were not separately exercised in this iOS native flow.
  Existing domain/controller tests cover baseline/pause transitions; baseline failure/navigation
  is covered by the expanded actual-hook harness. Hardware back is tested in the shared-hook
  harness, while iOS native checks use the edge-back gesture.
- Other Phase 11 findings remain intentionally untouched.
