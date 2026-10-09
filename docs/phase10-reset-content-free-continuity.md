# Phase 10 — Reset & Content-Free continuity

Implemented on `feature/product-ui-v1`; no commit or push.

## Representation and compatibility

- `ContentFreeState` and archived activations optionally contain `resetCredit`:
  source Reset journey ID, earned interval start/end, and historical best before
  importing credit. Activation and current-streak timestamps remain within the
  actual activation boundary.
- Completed Reset optionally contains `contentFreeContinuation` with an
  accepted/declined decision and the actual decision time.
- Persistence remains v7 (`bloom.localState.v7`) with explicit additive backward
  compatibility. Absent fields mean no imported credit/no recorded decision.
  Hydration never invents credit or activates a tracker. Existing v7 state
  round-trips without losing history. Malformed new fields follow existing
  rejection and exact-byte corruption backup handling.
- Credits validate positive, canonical intervals ending no later than actual
  activation. Independent activation periods remain disjoint. Verified Reset
  evidence may span earlier activation periods; their durations are never added
  to the imported interval. Full-state validation checks available effective
  history and preserves valid conservative credit subsets from earlier v7
  records without rewriting them. Accepted decisions require the credited
  activation in active or archived history.

## Earned time

The selector walks backward from the current Reset attempt through connected,
recorded restart links. It does not trust an earlier journey start with missing
attempt evidence. Intentional explicit-content or combined violations cut
continuity; masturbation-only restarts do not. Undone records do not cut it.
Manual Content-Free deactivation is a tracking choice, not evidence of explicit
content use, so it does not truncate independently verified Reset time. Actual
activation timestamps and archived history remain intact; best streak uses a
maximum rather than summing archived streaks and credit.

Credit ends at the earlier of observation and the current attempt's actual
15-day end. A completed Reset also caps it at persisted completion. Active
Content-Free progress adds credited milliseconds to independent elapsed
milliseconds and floors once. Credit contributes only to the first streak;
intentional-content violations start a fresh zero-credit streak. Accidental
exposure has no effect.

Ordinary activation during Reset imports eligible credit. After completed
Reset, only explicit acceptance of the continuation offer imports saved
credit. While that decision is pending, ordinary activation is an exact no-op;
Home routes to the decision, and direct Content-Free entry shows continuation
guidance instead of the ordinary activation form. After a declined decision,
ordinary activation remains a fresh independent start. Completion
itself never changes an active tracker or double-counts its Reset period.
Late acceptance at Day 20 imports the earned 15 days and begins independent
elapsed tracking at Day 20, excluding the unobserved five-day gap.

Reset undo re-evaluates the originally credited window, including archived
credits and affected ended best/snapshot facts. Restoring an older attempt can
shorten the verified end or remove credit entirely. Equal-time violations and
sequential undo preserve first-streak credit exactly once.

## Persistence and UI

The requested Turkish offer appears in V4 components only after completion is
durable. Accept persists the activation and decision atomically. Decline keeps
the entire Content-Free slice unchanged. Repeated taps share one in-flight
operation; retries save its exact accepted successor without regenerating
identities or replaying the transition. Home resumes saved undecided offers.
Already-active trackers retain their actual continuity and all history.
Offer text and the acceptance label use completed days from the canonical credit
selector. A shorter verified interval displays its actual completed days; a
sub-day interval uses “Kazandığım süreyle devam et”. No shorter interval claims
“15 günlük serimle devam et”.

## Development helper and verification

`npm run verify:reset-continuity` runs an isolated fixture and injected clock.
`observeDays(15)` reaches the exact elapsed boundary without device time changes,
production storage, production fake timestamps, or legacy ten-day offsets.
The fixture is under `scripts/fixtures` and is unreachable from app code.

Regression coverage includes all 15 requested groups plus fractional duration,
real Day-10 display semantics, activation-boundary violations, multiple attempts,
sequential/equal-time undo, credit retraction, manual deactivation/reactivation,
canonical source validation, corrupt payload preservation, and actual controlled
hook acceptance/decline failures and retries.
Review regressions also cover pending-offer ordinary activation at transition,
controller, and acknowledged-flow boundaries; Home and direct-screen guidance;
manual deactivation with preserved history and no summed streaks; canonical
short-credit labels rendered by the actual screens; restart and exact retry.

All final checks passed:

- `npm run typecheck`
- `npm run verify:reset-continuity`
- `npm run verify:persistence` (includes all feature suites and new regressions)
- `npm run verify:persistence-acknowledgement`
- `npm run verify:protection-reset`
- `npm run verify:guided-flows`
- `npm run verify:home-ui`
- `npm run verify:release-debug-guards`
- `git diff --check`

Earlier failures were corrected without weakening assertions: the corruption
backup test now checks the existing backup envelope's exact `rawPayload`, command
coverage includes the new decision, and completed-route/hook fixtures exercise
the new saved offer while retaining the existing active-user behavior.

## Remaining limits

Historical gaps or noncanonical historical completion boundaries do not create
unsupported continuation credit. Existing historical records remain intact.
Manual deactivation preserves activation boundaries and verified Reset credit.
A full device-rendered visual/E2E pass is not part of
the deterministic Node/hook verification, so physical-device layout remains
unverified.

## Changed files

- `docs/phase10-reset-content-free-continuity.md`
- `package.json`
- `scripts/fixtures/resetContinuity.ts`
- `scripts/run-bloom-reset-continuity-verification.cjs`
- `scripts/verify-bloom-content-free-feature.ts`
- `scripts/verify-bloom-content-free.ts`
- `scripts/verify-bloom-continuation-ui.ts`
- `scripts/verify-bloom-home-flow-intents.ts`
- `scripts/verify-bloom-home-ui.ts`
- `scripts/verify-bloom-persistence.ts`
- `scripts/verify-bloom-product-actions.ts`
- `scripts/verify-bloom-product-flow-actions.ts`
- `scripts/verify-bloom-reset-continuity-runner.ts`
- `scripts/verify-bloom-reset-continuity.ts`
- `scripts/verify-bloom-reset-feature.ts`
- `src/app/flows/bloomProductFlowActions.ts`
- `src/app/flows/getBloomContentFreeEntryIntent.ts`
- `src/app/flows/mapBloomHomeActionToFlowIntent.ts`
- `src/app/providers/bloomProductAcknowledgedActions.ts`
- `src/domain/contentFree/getContentFreeProgress.ts`
- `src/domain/contentFree/getContentFreeStreakSeconds.ts`
- `src/domain/contentFree/getResetContentFreeCredit.ts`
- `src/domain/home/getBloomHomeReadModel.ts`
- `src/domain/models/ContentFreeState.ts`
- `src/domain/models/ResetJourney.ts`
- `src/features/content-free/contentFreeController.ts`
- `src/features/content-free/screens/ContentFreeScreen.tsx`
- `src/features/content-free/useContentFreeFeature.ts`
- `src/features/home/screens/BloomHomeScreen.tsx`
- `src/features/home/useBloomHomeFeature.ts`
- `src/features/reset/README.md`
- `src/features/reset/resetController.ts`
- `src/features/reset/resetView.ts`
- `src/features/reset/screens/ResetProductScreen.tsx`
- `src/features/reset/useResetFeature.ts`
- `src/storage/README.md`
- `src/storage/bloomContentFreeTransitions.ts`
- `src/storage/bloomMasturbationCorrections.ts`
- `src/storage/bloomMasturbationTransitions.ts`
- `src/storage/bloomProductStateSchema.ts`
- `src/storage/bloomResetContentFreeContinuity.ts`
- `src/storage/bloomResetTransitions.ts`
- `src/storage/bloomState.ts`
- `src/storage/bloomStateSchema.ts`
