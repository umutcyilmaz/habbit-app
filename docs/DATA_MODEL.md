# Data Model

## Transitional State Boundary

[PRODUCT_SPEC.md](PRODUCT_SPEC.md) defines Bloom's new product direction: Masturbation Tracking, Content-Free, and a 15-Day Reset, with Urge Control as acute support. This document describes the new domain boundary under `src/domain/models/`. These types are independent of React, screens, routing, and storage adapters.

Phase 1A defined the entities. Phase 1B includes them in `BloomLocalState` and version-3 persisted JSON alongside every legacy slice. The provider hydrates and saves the expanded snapshot through its existing lifecycle; no new feature actions, onboarding scoring, navigation, or screens are introduced.

Phase 1C adds a pure onboarding engine and standalone answer/result types under `src/domain/onboarding/`. They are not added to `BloomLocalState` or wired to the legacy onboarding flow.

Phase 1D adds `ProductOnboardingState` to `BloomLocalState` and persistence v4. The complete result is saved independently of plan activation; legacy onboarding and its screens remain in use.

Phase 1E adds an explicit, idempotent acceptance transition and persists its historical marker in v5. It prepares the starting product state without starting the Reset restriction or changing legacy flows.

Phase 1F adds baseline completion/start and pure elapsed-time Reset progress. Persistence v6 removes the mutable active-attempt day counter. That phase added no UI, legacy flow, violation, completion, or post-assessment behavior changes.

Phase 1G adds active Reset violation/restart and linked Content-Free streak changes as one pure transition. It uses existing v6 models and persistence, with no schema or migration change.

Phase 1H adds latest-violation undo, with linked Content-Free restoration in the same transaction. Persistence v7 retains Reset violations as recorded or undone tombstones and supports exact prior-best rollback for new logs.

Phase 1I introduced elapsed completion followed by assessment submission. Phase 1V replaces that sequence with direct completion at 15 full elapsed days and optional historical assessment metadata. Completion preserves Tracking enablement; legacy pending records normalize within v7 without a version bump.

Phase 1J adds the core Masturbation Session lifecycle and atomic session-derived Content-Free effects. Existing v7 shapes, the storage key, and migrations remain unchanged; no UI or legacy flow is connected.

Phase 1K adds standalone Content-Free activation/deactivation, manual violations, latest standalone undo, and timestamp-derived progress. It uses existing v7 shapes without changing models, migrations, UI, or legacy flows.

Phase 1L adds completed-session feedback edits and deletion with atomic session-derived Content-Free reconciliation. These pure corrections use existing v7 shapes without adding session tombstones or editing timing/pause history.

Phase 1M adds the pure Urge Control lifecycle and resume/progress selector using existing v7 event/container shapes. It changes no model, schema, persistence version/key, migration, UI, or legacy flow.

Phase 1N adds manual Tracking controls and shared effective Reset-restriction/Tracking-availability selectors. Relevant existing transitions evaluate Reset policy at event time; models, schema, v7 persistence, migrations, and UI remain unchanged.

Phase 1O adds a pure new-product Home read model that composes those selectors into semantic action priority and tracker order. It changes no persisted model/schema, storage version/key, migration, UI, provider, navigation, or legacy next-action behavior.

The TypeScript files are the field-level source of truth. Lifecycle unions are not proof that stored input is valid. `bloomProductStateSchema.ts` explicitly validates new persisted records through the existing corruption boundary. Future feature actions must also validate their mutation and route inputs.

The models reuse `UUID` and `ISODateString` from the existing `shared.ts`; both are string aliases, not format validators. [`BehaviorEventSource.ts`](../src/domain/models/BehaviorEventSource.ts) supplies a small shared event-origin union: `{ kind: "manual", logActionId }` or `{ kind: "masturbationSession", sessionId }`. The same origin follows an event across affected systems and retries.

## MasturbationSession

Source: [`MasturbationSession.ts`](../src/domain/models/MasturbationSession.ts).

A `MasturbationSession` is one tracked masturbation event. Masturbation Tracking is the system that manages these sessions. Optional pause/arousal-control behavior belongs inside the session, not to a separate top-level program.

| Status | Meaning |
| --- | --- |
| `active` | The session is in progress. |
| `awaiting_feedback` | The session has ended; completion feedback is still being collected. |
| `completed` | The session has ended and required feedback is present. |

A session has a stable `id` and `startedAt`. Ended sessions carry `endedAt` and `durationSeconds`; elapsed session duration includes optional pauses. The `awaiting_feedback` branch has optional top-level `erectionQuality?`, `usedExplicitContent?`, and `endingReason?` fields. These feedback fields are absent from `active` sessions and required at the same top level in `completed` sessions. `erectionQuality` is an integer from 1 through 10.

Ending reasons are `climaxed`, `stoppedBeforeClimax`, `firmnessDecreased`, `feltAnxious`, `stoppedByChoice`, and `other`. These are descriptive reports, not medical interpretations.

`usedExplicitContent` means intentional explicit-content use during the session. Accidental exposure alone is not `true`. Feedback completion can derive a Content-Free violation from this value; it does not create a Reset violation.

`pauses` holds the session's optional pauses. An active pause has `status: "active"` and `startedAt`. A completed pause adds `endedAt` and `durationSeconds`. Ended sessions contain only completed pauses: closing the session closes any active pause. An empty array is valid: a normal session with zero pauses can complete. Pause count is derived from the array rather than maintained as another independent value.

The container in [`MasturbationTrackingState.ts`](../src/domain/models/MasturbationTrackingState.ts) has `enabled`, one `currentSession` (active/awaiting feedback or null), and completed `sessions`. Status aliases use `Extract` without duplicating session fields. Fresh and migrated defaults are `{ enabled: false, currentSession: null, sessions: [] }`. At most one unfinished session is allowed, including after persistence reload. The start transition uses shared effective Reset policy rather than persisting another restriction flag in this container.

### Manual Tracking controls

[`bloomMasturbationTrackingTransitions.ts`](../src/storage/bloomMasturbationTrackingTransitions.ts) defines `enableMasturbationTrackingState(state)` and `disableMasturbationTrackingState(state)`, re-exported from `bloomState.ts`. They change only the existing `enabled` Boolean and preserve `currentSession`, completed sessions, and every other slice. No timestamps, IDs, toggle history, or audit metadata are added. Invalid state and calls that already match the requested value are exact no-ops.

Manual enable explicitly allows Reset `inactive`, `recommended`, and `completed`, while rejecting `baseline_pending` and `active`. An elapsed but still-active Reset retains the existing manual-enable guard until its explicit completion is recorded; completion itself never changes the preference. Future statuses must be handled explicitly. Disable is allowed regardless of Reset lifecycle and never discards unfinished work: `enabled: false` with an active or awaiting-feedback session is intentionally valid. Existing actions can still end that session, complete feedback, or explicitly discard an active physical session; no new session can start while disabled.

### Session transitions

These pure APIs are defined in [`bloomMasturbationTransitions.ts`](../src/storage/bloomMasturbationTransitions.ts) and re-exported from `bloomState.ts`. IDs and canonical timestamps are supplied by the caller; invalid input or lifecycle state returns the original state without partial changes.

| API | Effect and preconditions |
| --- | --- |
| `startMasturbationSessionState(state, { sessionId, startedAt })` | Requires enabled Tracking, null `currentSession`, a valid unique ID/start, and no effective Reset restriction at `startedAt`. Creates an active session with empty pauses and no duration or feedback fields. |
| `startMasturbationPauseState(state, { startedAt })` | Requires an active session with no active pause. Appends an active pause starting at or after the session start and the previous pause's end. |
| `endMasturbationPauseState(state, { endedAt })` | Requires the sole active pause to be last, and end at or after its start. Replaces it with a completed pause and derived whole-second duration. |
| `endMasturbationSessionState(state, { endedAt })` | Requires an active session and end at or after its start and every pause timestamp. Closes an active pause at the same end time and retains the ended session in `currentSession` as `awaiting_feedback`. |
| `completeMasturbationSessionFeedbackState(state, { feedback, recordedAt, contentFreeViolationId? })` | Requires `awaiting_feedback`, full valid feedback, and canonical `recordedAt >= session.endedAt`. Appends the completed session once, clears `currentSession`, and applies any required Content-Free effect atomically. |
| `discardActiveMasturbationSessionState(state)` | Clears only an active session. Creates no history, violation, or tombstone; awaiting feedback and completed records cannot be discarded. |

Active session and pause timers derive from timestamps, with no ticking persisted counter or background mutation. Ending stores `floor((endedAt - startedAt) / 1000)` seconds. Session duration includes all pause time; it is never reduced by pause durations. Zero pauses and zero elapsed seconds are valid. Ending the physical session does not append completed history. Awaiting feedback survives close/reload and blocks another start until feedback is saved.

Tracking permission is `enabled`, with no direct onboarding prerequisite. Effective Reset restriction at the supplied session `startedAt` blocks new starts before 15 elapsed days; exactly at/after the current attempt's boundary, stale persisted `active` status alone does not block them. Disabled Tracking stays disabled until explicitly enabled; Reset completion never changes that preference. Session start never advances Reset. Completing feedback for an existing session does not require Tracking to remain enabled. Session transitions do not fabricate Reset violations or repair inconsistent cross-feature history. Existing completed sessions are preserved in order; separate correction APIs own completed feedback edits and deletion.

### Completed-session corrections

The two pure APIs in [`bloomMasturbationCorrections.ts`](../src/storage/bloomMasturbationCorrections.ts) are re-exported from `bloomState.ts`. IDs and canonical correction times are supplied by callers. Each target must identify exactly one completed entry in `masturbationTracking.sessions`, never `currentSession`. Tracking need not be enabled, and invalid or unsafe input returns the original state.

| API | Effect and preconditions |
| --- | --- |
| `editCompletedMasturbationSessionFeedbackState(state, { sessionId, feedback, editedAt, contentFreeViolationId? })` | Requires full valid replacement feedback and `editedAt >= session.endedAt`. Replaces only `erectionQuality`, `usedExplicitContent`, and `endingReason`, atomically reconciling an affected session-derived Content-Free event. Identical feedback is a no-op. |
| `deleteCompletedMasturbationSessionState(state, { sessionId, deletedAt })` | Requires `deletedAt >= session.endedAt`. Safely reconciles any linked Content-Free effect, then removes exactly the completed session. An absent/already-deleted target is a no-op. |

Edits preserve session ID, `startedAt`, `endedAt`, `durationSeconds`, and the complete `pauses` history. Neither API changes `currentSession`, Tracking `enabled`, other sessions, onboarding, Reset, Urge Control, or legacy state. Deletion adds no persisted session tombstone; callers remain responsible for fresh session IDs. Existing historical durations are neither recomputed nor normalized.

Changing only erection quality or ending reason leaves Content-Free untouched. Before explicit-content changes or deletion, the transition locates the session source `{ kind: "masturbationSession", sessionId }` in Content-Free and Reset history. Multiple conflicting Content-Free links are rejected. Any Reset violation/tombstone with that source blocks those behavioral corrections; quality/reason-only edits remain permitted because they do not change the behavior event. Reset history is never rewritten.

For `usedExplicitContent: false -> true`, an event outside every known Content-Free activation changes feedback only. Activation intervals include their boundaries; an event inside a completed past activation or on an ambiguous shared boundary rejects the whole edit because recalculation is deferred. Within only the current active activation, a new violation requires `session.endedAt >= currentStreakStartedAt` and a valid unused supplied `contentFreeViolationId`. It captures the exact prior `streakBefore`, uses the session source and `occurredAt = session.endedAt`, sets `recordedAt = editedAt` and `status: "recorded"`, updates best with the ended streak's whole seconds, and restarts the current streak at that immutable anchor. Inserting before the current streak, or finding an already-recorded link against false feedback, is a no-op across both slices.

When changing `true -> false` without a linked event, feedback alone may change only when no known activation covered the session end; covered time without a link is ambiguous and rejected. A linked recorded event must be safely undone together with the feedback edit. The same active activation must still have that event as its latest effective streak break, its `occurredAt` must equal the immutable session end and `currentStreakStartedAt`, and correction time must be at or after its `recordedAt`. Current best must agree with the snapshot and ended-streak duration; restoration cannot move the start before a remaining effective event. Success restores both `streakBefore` fields and marks the link undone at `editedAt`. A link already undone allows recovery to false without another Content-Free mutation or rewriting `undoneAt`.

A later false-to-true edit may safely reapply its own undone link, retaining its existing identity, source, `occurredAt`, original `recordedAt`, and `streakBefore`; it changes status back to recorded and removes `undoneAt`. The supplied `editedAt` must be at or after that prior `undoneAt`. The same current active activation and both restored `streakBefore` values must still match, with no later effective record in array order or effective event after the restored streak start. It never creates a second source record or replaces its identity with the optional input ID. If safe reapplication cannot be proven, the whole edit is a no-op.

Deletion without a linked event leaves Content-Free unchanged. An already-undone link remains intact after deletion. A recorded link requires the same latest-event restoration guards and `deletedAt >= recordedAt`; its snapshot is restored and it becomes undone at `deletedAt` in the same returned snapshot that removes the session. A changed/inactive activation, later effective event, or required completed-activation replay blocks the whole deletion. Session-derived events are corrected only through this owning transaction, never through standalone manual undo. All successful results retain existing v7 validation and source-uniqueness rules; no schema, key, or migration change is required.

## TrackingResetRecommendation (derived, Phase 2A)

Source: [`getTrackingResetRecommendation.ts`](../src/domain/reset/getTrackingResetRecommendation.ts). API: `getTrackingResetRecommendation(tracking: MasturbationTrackingState, at: ISODateString): TrackingResetRecommendation | null`. This type is not part of `BloomLocalState`, any persisted entity, or onboarding recommendations.

The result discriminates on `status`:

- `insufficientData`: `eligibleSessionCount` and literal `requiredSessionCount: 6`, with no padded evidence.
- `noCurrentRecommendation` or `recommended`: `eligibleSessionCount`, literal `windowSize: 3`, `evidence`, and all observed `TrackingResetRecommendationSignal` codes.

Evidence contains `previousAverageErectionQuality`, `recentAverageErectionQuality`, `previousFirmnessDecreaseCount`, `recentFirmnessDecreaseCount`, `previousExplicitContentRatio`, `recentExplicitContentRatio`, and `recentAverageIntervalSeconds`. Means and ratios are unrounded arithmetic values; zero remains zero. Recent interval is the sum of the two adjacent recent start-time differences divided by two and then 1000, preserving fractional seconds.

Only historical completed sessions ending at or before the explicit canonical timestamp count. Active/awaiting-feedback work and future ends are excluded before window selection. The selector does not read Tracking enablement or `currentSession`. It sorts copied observations by ascending start time, then by ascending ID using code-unit comparison rather than locale order. The latest six form two windows of three; older eligible observations affect only the total count. Invalid containers, unreadable required observation facts, duplicate eligible IDs, invalid timestamps, or impossible eligible start/end chronology return null rather than partial evidence. Storage continues to own full session-shape validation and integer feedback enforcement.

`erectionQualityDownwardTrend` means a recent mean at least 1.0 below the previous mean. Equal-sized window totals are compared against a difference of 3 to preserve the exact boundary without rounding divided means. `repeatedFirmnessDecrease` requires a recent count of at least two and strictly more than the previous count. `recentExplicitContentPattern` requires at least two recent intentional-content sessions. The recommendation requires either response signal plus the explicit-content signal; signals have the stable order listed here. The previous explicit ratio and recent interval are descriptive only: frequency alone never recommends Reset. This is a product heuristic, not a medical or causal conclusion.

Feedback corrections are reflected on the next read; there is no recommendation history, tombstone, ID, or `recommendedAt`. The selector neither inspects nor mutates Reset, Content-Free, onboarding, or Urge Control, and never modifies Tracking. Persistence remains v7 / `bloom.localState.v7`. Phase 2B consumes this unchanged read in Home and explicit recommendation acceptance as described below.

### Reset recommendation acceptance — Phase 2B

[`acceptResetRecommendationState(state, { resetJourneyId, acceptedAt })`](../src/storage/bloomResetRecommendationTransitions.ts), re-exported from `bloomState.ts`, returns either the exact input state or a successor changing only `resetJourney`. It validates canonical acceptance time and candidate identity, requires no unfinished Masturbation Session or unresolved onboarding starting recommendation, and accepts only inactive or persisted-recommended Reset.

For inactive Reset it reruns `getTrackingResetRecommendation(state.masturbationTracking, acceptedAt)` and requires `recommended`. For persisted `recommended` it requires no derived evidence and reuses the existing journey ID, ignoring the valid unused candidate. Both cases produce only `{ status: "baseline_pending", id, durationDays, bestCompletedDays, pastAttempts, violations }`. Existing history arrays retain their references. No acceptance timestamp, recommendation result, signals, evidence, baseline, attempt, or start time is saved.

All other slices retain identity, including Tracking preference/history/current session, Content-Free, onboarding, Urge Control, and legacy systems. Baseline-pending adds no effective session restriction; the existing four-question baseline transition starts the period later. Baseline-pending, active, and completed Reset reject acceptance; repeat completed journeys are deferred because multiple journey-level baselines are not represented. Existing persisted `recommended` remains schema-compatible, with no migration or version/key change. Closing review does not save dismissal or snooze state.

## ContentFreeState

Source: [`ContentFreeState.ts`](../src/domain/models/ContentFreeState.ts).

Content-Free records whether the system is active, the current streak start, best streak, and intentional-content violation history. Masturbation itself does not break Content-Free. Accidental exposure does not automatically create a violation.

| Fields | Meaning |
| --- | --- |
| `status` | `inactive` or `active`. |
| `bestStreakSeconds` | Historical best from ended/interrupted streaks, retained in either state. Growing current progress is included by the selector. |
| `pastActivations` | Completed activation periods with `id`, `startedAt`, and `endedAt`. |
| `violations` | Recorded and undone intentional-content events. |
| `activationId`, `activatedAt`, `currentStreakStartedAt` | Present only while active; distinguish this activation from its current streak. |

Each `ContentFreeViolation` has `id`, `activationId`, `kind: "intentionalExplicitContent"`, `occurredAt`, `recordedAt`, `source`, and `streakBefore` (the previous streak start and best duration). Its status is either `recorded` or `undone`; undone entries additionally require `undoneAt`.

For a session-derived violation, the source session's stable `id` is the deduplication identity. Retrying completion or processing the same session again must not append another violation or reset the same streak twice. A manual action logging that same known session must reuse its session origin rather than create a second unrelated event. Event IDs alone do not prove source uniqueness.

Phase 1J uses `session.endedAt` as the V1 occurrence anchor when explicit-content feedback affects Content-Free. This identifies the product event; it does not claim that explicit content was first used at that exact instant. The violation uses the supplied feedback `recordedAt`, `{ kind: "masturbationSession", sessionId }`, current activation ID, `kind: "intentionalExplicitContent"`, and `status: "recorded"`.

If `usedExplicitContent` is false, Content-Free is inactive, or the session ended before the current activation began, feedback completes without a Content-Free change. Otherwise a valid unused `contentFreeViolationId` is required, and `session.endedAt >= currentStreakStartedAt`. A duplicate session source in either recorded or undone violations, conflicting ID, contradictory activation state, or unsafe backdated streak event rejects the whole completion; the session remains awaiting feedback.

An applicable completion stores the original streak start and best duration in `streakBefore`, appends one violation, updates best duration with the ended streak's whole elapsed seconds, and sets `currentStreakStartedAt = session.endedAt`. Content-Free stays active with its activation identity/start, past activations, and previous violations preserved. Session completion and Content-Free changes are published as one snapshot. Historical replay remains deferred; session-derived violations cannot be undone through the standalone manual API.

Standalone and Reset undo correct the violation log without editing the source session. Completed-session corrections own changes to a session and its derived event together. Source identity remains when a log is undone so retries cannot silently recreate it; safe explicit session reapplication reuses that same record. Undo is for an accidental logging action, not a rule that intentional content stops counting. Phase 1H restores the original `streakBefore` only for a safely reversible latest event linked to Reset. It never restores a snapshot over later effective violations or another activation. Retained activation boundaries preserve information needed for future historical correction; arbitrary replay remains deferred.

Content-Free can coexist with normal Masturbation Tracking or Reset. It is independent of Protect.

### Standalone Content-Free transitions

The four pure APIs in [`bloomContentFreeTransitions.ts`](../src/storage/bloomContentFreeTransitions.ts) are re-exported from `bloomState.ts`. IDs and canonical timestamps are caller-supplied. Invalid input, conflicting identities, unsafe chronology, and wrong-lifecycle calls return the original state.

| API | Effect and preconditions |
| --- | --- |
| `activateContentFreeState(state, { activationId, activatedAt })` | Requires inactive state and a new activation identity, including current/past activation IDs, violation activation references, and violation record IDs. The start must be at or after the latest past activation end. Starts a new streak without erasing best/history or creating a violation. |
| `deactivateContentFreeState(state, { endedAt })` | Requires active state and end at or after activation and current streak starts. Updates best with the current streak's whole elapsed seconds, appends `{ id: activationId, startedAt: activatedAt, endedAt }`, and becomes inactive with all history retained. |
| `recordManualContentFreeViolationState(state, { violationId, logActionId, occurredAt, recordedAt })` | Requires active Content-Free and no effective Reset restriction at `occurredAt`. Appends an intentional-content violation with source `{ kind: "manual", logActionId }`, preserves `streakBefore`, updates best, and restarts the streak at `occurredAt` while remaining active. |
| `undoManualContentFreeViolationState(state, { violationId, undoneAt })` | Restores `streakBefore` only for a safely reversible latest recorded standalone manual violation in the current active activation. Retains the record/source as an undone tombstone. |

Activation and deactivation preserve Tracking, Reset, onboarding, and all other slices even while Reset is active. Reactivation requires a fresh activation ID and begins a separate period; histories are appended without sorting, merging periods, or deleting earlier facts. Retrying activation while active or deactivation while inactive is a no-op.

Manual occurrence time must be at or after both activation and current effective streak starts, with `recordedAt >= occurredAt`. Backdating within the current streak is allowed: a Wednesday event recorded Friday starts the new streak on Wednesday. Inserting an event before the current streak requires historical replay and is rejected. A valid event captures the original streak start/best, updates best with the ended streak's whole nonnegative seconds, and preserves activation identity/history. IDs and manual source identities cannot duplicate recorded or undone Content-Free violations. Distinct source events on the same date remain distinct.

Standalone manual logging uses shared effective Reset restriction at `occurredAt`, never recording time or an internal clock. Before the current attempt's 15-day boundary, content events must use `recordActiveResetViolationState` so both systems change atomically. At/after that boundary, standalone logging may proceed under its existing Content-Free guards even when Reset remains `active`; it never completes or mutates Reset. The Reset violation transition remains a no-op at/after the boundary. Standalone undo rejects session sources and any manual source linked to a recorded or undone Reset violation; corrections belong to their owning transaction. Completed-session corrections own safely reversible session-derived changes.

Manual undo requires canonical `undoneAt >= recordedAt`, the same active activation, the target as its latest effective recorded streak break, and `currentStreakStartedAt === target.occurredAt`. Current best must equal `max(streakBefore.bestStreakSeconds, endedStreakSeconds)`, and the snapshot cannot restore the streak start before any remaining effective event in that activation. Later effective activity, changed activation, or ambiguous snapshot restoration returns the original state. A successful undo restores both `streakBefore` fields, changes only that violation to `undone` with the supplied time, and preserves unrelated records. Repeated undo retains the first `undoneAt`; the consumed `logActionId` prevents stale logging retries. These standalone actions never mutate Reset or Tracking.

### Content-Free progress

[`getContentFreeProgress(contentFree, now)`](../src/domain/contentFree/getContentFreeProgress.ts) is a pure domain selector, with explicit canonical time and no storage write. Active results contain `{ status: "active", currentStreakSeconds, currentCompletedDays, effectiveBestStreakSeconds, hasEffectiveViolation }`. Current seconds are `max(0, floor((now - currentStreakStartedAt) / 1000))`; completed days are `floor(currentStreakSeconds / 86400)`. Effective best is the maximum of persisted historical best and the growing current streak.

Inactive results contain `{ status: "inactive", effectiveBestStreakSeconds, hasEffectiveViolation }`, retaining historical best and omitting current-streak fields. `hasEffectiveViolation` counts recorded events across all activation history; undone-only history is false. Invalid current time returns null, and a clock before the current streak start clamps to zero. No ticking counter, best update, or derived flag is persisted as time passes. Same-local-day collapse and arbitrary historical replay remain deferred.

## ResetJourney

Source: [`ResetJourney.ts`](../src/domain/models/ResetJourney.ts).

The new Reset is a 15-day journey. It is distinct from the legacy `TenDayResetState`; adding this type does not change the running 10-Day Reset or its constants.

| Status | Meaning |
| --- | --- |
| `inactive` | No Reset is underway or recommended. |
| `recommended` | Reset has been suggested; the user has not begun preparation. |
| `baseline_pending` | A pre-reset baseline still needs to be captured. |
| `active` | An attempt has started; elapsed time determines whether its 15-day period remains underway. Explicit completion persists its end. |
| `completed` | The 15-day period and final completed attempt are recorded; `assessment` is optional historical metadata. |

All journey states have `durationDays: 15`, `bestCompletedDays` (0 through 15), `pastAttempts`, and `violations`. Inactive state has no identity; `id` is required from `recommended` or `baseline_pending` onward. This is the minimal Phase 1B correction needed to avoid inventing a journey ID at installation. Started states additionally contain `startedAt`, the captured `baseline`, and `currentAttempt`. The `completed` state requires `bestCompletedDays: 15` and permits an optional legacy `assessment`; new completions omit it. `assessment_pending` is accepted only at the persistence compatibility boundary and normalizes to `completed`.

An active attempt contains only `{ id, status: "active", startedAt }`. Its progress is derived from elapsed time and is never persisted as a mutable day counter. A restarted attempt retains historical `completedDays` from 0 through 14 with `endedAt` and `restartViolationId`. A completed attempt has `completedDays: 15` and `completedAt`. `pastAttempts` contains prior restarted/completed attempts and excludes `currentAttempt`. Attempt count can be derived from this history; it is not a separate counter. `bestCompletedDays` preserves historical best progress; it is not a cache of the active attempt's live progress.

A restart begins a new attempt at Day 1, with zero completed days, while retaining the journey's baseline and history. Preserve best progress across attempts; it is not a measure of medical improvement.

Each `ResetViolation` has `id`, `attemptId`, `occurredAt`, `recordedAt`, the shared `source`, and a `reason`: `masturbation`, `intentionalExplicitContent`, or `masturbationWithExplicitContent`. The combined reason represents one event affecting both systems without requiring duplicate Reset restarts.

Its lifecycle is `{ status: "recorded" }` or `{ status: "undone", undoneAt }`. Recorded entries forbid `undoneAt`; undone timestamps must be canonical and at or after recording. Optional `bestCompletedDaysBefore` (0–15) preserves the exact prior historical summary. New logs always capture it; migrations leave it absent because old records did not own that fact. Both statuses retain their IDs and source identities for deduplication.

Journey and final attempt `completedAt` identify the end of the 15-day Reset period. Historical assessments retain their separate submission timestamp. Phase 1V changes `15 days → assessment_pending → assessment → completed` to `15 days → completed`; no new assessment is collected. The restriction ends at the same elapsed boundary and completion never changes Tracking enablement.

Phase 1G violation behavior, before the current attempt's 15-day period is complete:

| Event during active Reset | Reset effect | Content-Free effect |
| --- | --- | --- |
| Masturbation without intentional explicit content | Restart at Day 1. | No change. |
| Intentional explicit-content use without masturbation | Restart at Day 1. | Reset an active Content-Free streak. |
| Masturbation with intentional explicit content | Restart at Day 1 once for the event. | Reset an active Content-Free streak once for the event. |
| Accidental exposure alone | No automatic violation. | No automatic violation. |

The session-start restriction and violation reporting serve different purposes: the new session transition checks effective restriction at its supplied start time, while the separate Reset violation transition records behavior that occurred during the current attempt's incomplete period. A violation does not fabricate an in-app session, and session feedback does not create a Reset violation.

### Recording an active Reset violation

[`recordActiveResetViolationState`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, accepts `{ violationId, replacementAttemptId, occurredAt, recordedAt, source, reason, contentFreeViolationId? }`. Time and identities come from the caller. The source is either `{ kind: "manual", logActionId }` or `{ kind: "masturbationSession", sessionId }`; the same source is retained on both records when the event affects both systems.

The source journey must be valid and `active`. Timestamps are canonical, `recordedAt >= occurredAt`, and `occurredAt >= currentAttempt.startedAt`. `getResetProgress(resetJourney, occurredAt)` must report fewer than 15 completed days. At or after the 15-day boundary the entire transition returns the original state, without restarting Reset or changing Content-Free. The event time controls this boundary, rather than when the event is recorded; no completion transition runs.

The old attempt is appended to `pastAttempts` as `restarted`, retaining its ID/start and adding `endedAt: occurredAt`, derived `completedDays` (0–14), and `restartViolationId: violationId`. Exactly one recorded Reset violation references that old attempt and captures `bestCompletedDaysBefore`. The replacement is `{ id: replacementAttemptId, status: "active", startedAt: occurredAt }`, with no persisted live day count. The journey remains active and retains its ID, original `startedAt`, baseline, duration, and history. `bestCompletedDays` becomes the maximum of its previous value and the archived attempt's derived progress.

For `masturbation`, Content-Free retains its original reference. For either content-involved reason, inactive Content-Free is also unchanged. If Content-Free is active, `contentFreeViolationId` is required and `occurredAt >= currentStreakStartedAt`. The new recorded Content-Free violation retains the activation ID and exactly the same source/times as the Reset violation. Its `streakBefore` stores the original current streak start and original best duration before either is updated. The ended streak duration is floored to nonnegative whole seconds; `bestStreakSeconds` becomes the maximum of that duration and the existing best. `currentStreakStartedAt` becomes `occurredAt`. Status stays active; activation identity/start, past activations, and prior violations are preserved.

Invalid or conflicting IDs, malformed source/reason/time, impossible chronology, or a previously applied source identity return the original state without partial effects. Reset and Content-Free source deduplication both include recorded and undone entries. Retries cannot create another attempt even with new supplied record IDs. Distinct source events on the same calendar day remain distinct; calendar-day collapse awaits timezone semantics. Product onboarding, Masturbation Tracking, Urge Control, and every legacy slice retain their references.

### Undoing the latest violation

[`undoActiveResetViolationState(state, { violationId, undoneAt })`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, corrects a mistaken log without generating time or identity. Reset must still be active. The target must be its latest recorded violation, linked to the last historical restarted attempt by violation ID and attempt ID. The archive's end and replacement attempt's start must both equal the target occurrence time. Any missing or ambiguous relationship returns the original state. `undoneAt` must be canonical and at or after the target's recording time.

Undo removes that archive, restores `{ id: archived.id, status: "active", startedAt: archived.startedAt }`, and marks the Reset violation undone. Journey ID, original journey start, baseline, duration, unrelated history, and other product/legacy slices remain unchanged. Progress resumes from the original attempt start. Undo may reveal that the original period has already elapsed; it does not persist completion, recapture baseline, or enable Tracking.

Remaining historical attempts establish the minimum truthful best progress. The existing model also permits a best summary not represented by those attempts, so deriving only their maximum can lose real history. New logs' `bestCompletedDaysBefore` restores that exact value after checking it covers remaining history and agrees with the current post-restart best. For an older record without the field, rollback is provable only when the current best exceeds the archived count, or remaining history already accounts for the current best. An unexplained tie with the archived count is ambiguous and returns no-op rather than guessing.

Masturbation-only undo leaves Content-Free untouched and rejects any unexpectedly linked Content-Free violation. For content-involved events, a link uses the same source and identical occurrence/recording times. It must still be recorded, belong to the current active activation, and be its latest effective recorded event by array order and occurrence time. The current streak must start at that event, and the current best must match the event's snapshot plus ended streak. Later activity, a changed activation, or contradictory snapshots make the entire undo a no-op.

A valid linked undo restores both fields from `streakBefore` and marks the Content-Free violation undone, retaining activation identity, activation history, and unrelated violations. If no link exists, Reset-only undo is allowed only when activation boundaries prove Content-Free was inactive when the log was recorded. A later unrelated activation is preserved. An activation boundary equal to recording time is treated conservatively as ambiguous.

Both restored slices are validated before one snapshot is returned. Sequential backwards undo is allowed after newer effective restarts have been undone. Tombstones stay in history even when an intermediate replacement attempt disappears; they no longer assert an effective attempt interval. Replacement IDs cannot reuse attempt identities retained by those tombstones. An effective restarted attempt may reference only a recorded violation. Repeated undo returns the original state and preserves the first `undoneAt`; stale log retries remain rejected by source identity. Arbitrary history editing and replay are deferred.

### Elapsed progress

[`getResetProgress(resetJourney, now)`](../src/domain/reset/getResetProgress.ts) is pure and requires an explicit canonical ISO timestamp. It returns `{ completedDays, currentDay, isPeriodComplete, remainingDays, remainingSeconds }`, or null for unstarted journeys or invalid timestamps. Active progress uses `currentAttempt.startedAt`, never the original journey start or historical best progress. Days are full 24-hour durations; local midnight, timezone changes, and app-open events do not advance them.

Before 24 hours it reports 0 completed days / Day 1; at 24 hours, 1 / Day 2; at 14 days, 14 / Day 15. At or after 15 full days it reports 15 completed days, Day 15, and `isPeriodComplete: true`. Future start times clamp to zero elapsed progress. `remainingDays` counts full or partial days rounded up; `remainingSeconds` preserves subsecond precision. Finished states report their fixed 15-day completion.

Users do not manually complete days. Calling the selector, validating, loading, or hydrating never finishes an active journey or changes its best progress. Hydration only normalizes already-finished legacy `assessment_pending` records to `completed`. An elapsed period cannot be extended by a stale `active` status. The application must explicitly call the completion transition to persist its end. Session starts and standalone Content-Free logging use shared effective restriction at their supplied event times.

### Product policy read models

[`getResetRestrictionStatus(resetJourney, at)`](../src/domain/productPolicy/getResetRestrictionStatus.ts) returns `{ isRestrictionActive, isElapsedPeriodComplete, needsCompletionTransition, progress }`, or null for an invalid canonical time or progress that cannot safely be determined. For active Reset it reuses `getResetProgress` from the current attempt start, including existing clock clamping; `progress` is that `ResetProgress`. Flags describe the currently active lifecycle, so non-active states return false for all three and `progress: null`, even when the journey is already completed.

| Reset at supplied event time | `isRestrictionActive` | `isElapsedPeriodComplete` | `needsCompletionTransition` |
| --- | --- | --- | --- |
| Status other than `active` | false | false | false |
| Active, fewer than 15 elapsed days | true | false | false |
| Active, exactly 15 elapsed days or later | false | true | true |

`needsCompletionTransition` reports that the elapsed period ended while its lifecycle is still active. It never invokes `completeElapsedResetPeriodState`, writes state, or enables Tracking. Manual enable separately follows persisted Reset lifecycle; behavioral restriction follows elapsed event time.

[`getMasturbationTrackingAvailability(state, at)`](../src/domain/productPolicy/getMasturbationTrackingAvailability.ts) returns `{ enabled, currentSessionStatus, canStartSession, blockReason, resetRestriction }`, with the shared policy result included. `currentSessionStatus` is `none`, `active`, or `awaiting_feedback`. Start-block precedence is `trackingDisabled`, then `activeSession`, then `awaitingFeedback`, then `resetRestriction`, otherwise null. `canStartSession` is true only for the null case: enabled Tracking, no unfinished session, and no effective restriction. Invalid time or policy returns null rather than guessing a capability.

An elapsed active Reset can report `needsCompletionTransition: true` while availability still reports `trackingDisabled`, when Tracking is manually disabled or has never been enabled. These selectors accept plain models/state and produce facts only, with no React, storage, routing, provider, or Home-priority behavior. Reads never persist derived fields or automatically advance a lifecycle.

### Completing the elapsed period

[`completeElapsedResetPeriodState(state, { observedAt })`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, requires a valid active journey and a supplied canonical observation timestamp. `getResetProgress(resetJourney, observedAt)` must report `isPeriodComplete: true` and 15 completed days. Invalid, early, or wrong-lifecycle calls return the original state.

The completion timestamp is derived from `currentAttempt.startedAt + 15 * 24 hours`, never from a late `observedAt` or a calendar-day boundary. The journey becomes `completed` with `bestCompletedDays: 15` and that `completedAt`. Its current attempt retains the same ID/start and becomes `{ status: "completed", completedDays: 15, completedAt }`; it remains `currentAttempt` rather than also entering `pastAttempts`. Original journey identity/start, baseline, previous attempts, and violation tombstones are preserved.

This transition changes only `resetJourney`. It creates no assessment and preserves the entire Tracking slice, including its manual enabled/disabled preference and any unfinished session. Content-Free and all other slices retain their original references. Repeating completion cannot replace the completion time. The new transition writes the exact elapsed boundary; persisted validation retains its existing structural and temporal checks without rewriting older valid completion timestamps.

## ResetBaseline

Source: [`ResetBaseline.ts`](../src/domain/models/ResetBaseline.ts).

A `ResetBaseline` has `id`, canonical `capturedAt`, optional observed Tracking aggregates, and a required `selfReport`. It belongs to the journey and remains fixed through every attempt restart, undo, and completion. Phase 1W separates `CurrentResetBaselineSelfReport` from `LegacyResetBaselineSelfReport`; persisted `ResetBaseline.selfReport` accepts either, while current start and feature APIs accept only the current type.

| Current self-report field | Meaning | Values |
| --- | --- | --- |
| `erectionDecline` | Noticed erection decline | `clear`, `mild`, `none`, `notSure` |
| `needsStrongerOrFasterStimulation` | Need stronger or faster stimulation for the same arousal | `clearly`, `somewhat`, `no` |
| `climaxTakesLonger` | Climax takes longer than before | `clearly`, `somewhat`, `no`, `notSure` |
| `difficultyArousingWithoutExplicitContent` | Difficulty becoming aroused without intentional explicit sexual content | `yes`, `sometimes`, `no`, `notTried` |

The second question intentionally has no `notSure` answer. All four answers are required and start unanswered in the current form. These are descriptive facts only; no score, diagnosis, risk level, eligibility rule, or causal conclusion is derived.

The following exact three-field shape remains historical compatibility only:

| Legacy self-report field | Values |
| --- | --- |
| `urgeIntensity` | `low`, `medium`, `high`, `notSure`, `preferNotToSay` |
| `abilityToPause` | `difficult`, `sometimesPossible`, `manageable`, `notSure`, `preferNotToSay` |
| `spontaneousOrMorningErections` | `often`, `sometimes`, `rarely`, `notSure`, `preferNotToSay` |

`normalizeResetBaseline` structurally distinguishes exact current and exact legacy field sets. It rejects mixed, partial, extra-field, and unsupported-answer shapes. No discriminator is stored, no answer is mapped or fabricated, and valid old baseline JSON remains unchanged. A baseline being legacy does not itself require normalization writeback. Old active/completed journeys and historical `PostResetAssessment.baselineId` references remain valid under the same lifecycle and reference checks. Aggregate range/finite-number validation remains in place. Persistence stays v7 / `bloom.localState.v7`.

### Canonical Tracking snapshot

[`getResetTrackingSnapshot(tracking, capturedAt)`](../src/domain/reset/getResetTrackingSnapshot.ts) is the pure canonical helper. It receives `MasturbationTrackingState` and an explicit canonical capture timestamp, returns optional aggregate fields, and returns null for an invalid capture time. It never reads a wall clock or changes its input.

Eligible observations are all completed history sessions whose `endedAt <= capturedAt`, including equality. Future-ended sessions and the unfinished `currentSession` never contribute. Tracking's enabled/disabled setting does not affect historical eligibility. No rolling window or current-session feedback is inferred.

For `n` eligible sessions, sorted by `startedAt` ascending:

| Aggregate | Formula | Availability |
| --- | --- | --- |
| `averageErectionQuality` | Sum of `erectionQuality` / `n` | Present when `n >= 1` |
| `explicitContentSessionRatio` | Count with `usedExplicitContent === true` / `n` | Present when `n >= 1` |
| `averageIntervalSeconds` | Sum of consecutive start-to-start millisecond differences / `1000` / `(n - 1)` | Present when `n >= 2` |

Useful numeric precision is retained without storage rounding. Input array order does not affect chronological interval calculation. With no eligible sessions all fields are absent; with one, only the interval is absent. Missing means unavailable, not zero: an observed explicit-content ratio of zero remains zero. Short intervals and other observations carry no interpretation or recommendation.

### Starting from current answers

[`startResetFromBaselineState`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, accepts exactly `{ resetBaselineId, capturedAt, selfReport, resetAttemptId, startedAt }`. `selfReport` must be the current four-question shape. Full baselines and caller-calculated aggregate fields are not accepted. The flow's `reset.startFromBaseline(selfReport)` captures one operation Date, generates the baseline/attempt identities, and supplies the same canonical timestamp for `capturedAt` and `startedAt`.

The pure transition requires a valid `baseline_pending` journey, a nonempty new attempt identity, and canonical `startedAt >= capturedAt`; equality is allowed. It invokes the snapshot helper against the current accepted Tracking state using `capturedAt` as the cutoff, constructs and validates the baseline, and copies the self-report. IDs and timestamps remain explicit flow/caller facts. Derivation occurs once in the accepted start; persistence retry writes that accepted snapshot without replaying start or recapturing history.

The transition changes only `resetJourney` to `active`, preserving its ID, 15-day duration, best progress, attempts, and violations. It attaches the new baseline and uses `startedAt` for both journey and current attempt. Historical attempts must remain non-overlapping and end no later than the new attempt. Older journeys retain `baseline.capturedAt <= journey.startedAt <= currentAttempt.startedAt` without timestamp rewrites.

Invalid inputs, partially started source shapes, and every status other than `baseline_pending` return the original state. Repeated/stale starts cannot replace baseline, attempt, or journey identity. Tracking, Content-Free, onboarding acceptance, Urge Control, and every legacy slice retain their original references. Later Tracking changes and Reset restart/undo/completion never recapture the baseline. UI supplies only four semantic answers and performs no aggregate calculation, scoring, identity creation, or mutation-time generation.

## Historical PostResetAssessment

Source: [`PostResetAssessment.ts`](../src/domain/models/PostResetAssessment.ts).

An optional historical `PostResetAssessment` has `id`, `resetJourneyId`, `resetAttemptId`, `baselineId`, and its own `completedAt` submission timestamp. It records the user's comparison with that baseline after Reset:

| Field | Values |
| --- | --- |
| `urgeIntensityChange` | `decreased`, `same`, `increased`, `notSure`, `preferNotToSay` |
| `abilityToPauseChange` | `harder`, `same`, `easier`, `notSure`, `preferNotToSay` |
| `spontaneousErectionChange` | `lessFrequent`, `same`, `moreFrequent`, `notSure`, `preferNotToSay` |
| `overallSexualResponseChange` | `worse`, `same`, `better`, `notSure`, `preferNotToSay` |
| `readinessToRestartTracking` | `ready`, `notReady`, `notSure` |

The historical answers describe perceived change and allow uncertainty. Readiness is a self-report, not an eligibility flag. Phase 1V preserves these values without exposing a submission command or changing Tracking enablement.

### Persistence compatibility

`normalizeResetJourney` accepts valid legacy `assessment_pending` records, applies the existing finished-attempt, timestamp, baseline, best-progress, and history checks, and returns the equivalent `completed` journey without an assessment. Existing v7 validation reports `wasNormalized`, and loading reports `needsPersist`, making the result eligible for the existing writeback mechanism. No current transition produces `assessment_pending`.

Completed journeys may omit `assessment`. When present, it must still have a valid nonempty ID, known enum answers, exact journey/attempt/baseline references, and a canonical submission time at or after period completion. Invalid assessment data is rejected rather than removed. Historical completion times are preserved under the existing structural and temporal checks; hydration does not recalculate them from today's clock or impose new duration arithmetic. Unrelated product and legacy slices remain semantically unchanged. Persistence remains version 7 at `bloom.localState.v7`, with existing older-version migrations intact.

These facts support later descriptive reports; no clinical interpretation is derived. Report generation and post-Reset session comparison remain deferred. The separate Tracking recommendation read does not consume baseline or assessment facts; Phase 2B adds optional Home advice and explicit review/acceptance without a new assessment or repeated completed journey.

## Manual Behavior Slip Coordination

Phase 1X adds a non-persisted semantic alias, [`BehaviorSlipReason`](../src/domain/models/BehaviorSlip.ts), equal to `ResetViolation["reason"]`: `masturbation`, `intentionalExplicitContent`, or `masturbationWithExplicitContent`. These describe intentional behavior only. There is no new generic event history or persisted slice.

[`getBehaviorSlipImpact({ resetJourney, contentFree }, reason, occurredAt)`](../src/domain/productPolicy/getBehaviorSlipImpact.ts) is the canonical pure preview selector. Its result is `{ reset: "restart" | "unchanged", contentFree: "resetStreak" | "unchanged" }`, or null for invalid/indeterminate facts or an occurrence outside a required current attempt/streak boundary. It reads validated domain facts, calls `getResetRestrictionStatus` at the supplied canonical occurrence timestamp, and produces no copy, IDs, clocks, mutations, or navigation.

| Effective restriction at occurrence | Reason | Applicable active Content-Free | Effects |
| --- | --- | --- | --- |
| Active | Masturbation | Either | Reset only |
| Active | Either explicit-content reason | Yes | Reset and Content-Free atomically |
| Active | Either explicit-content reason | Inactive | Reset only |
| Inactive | Masturbation | Either | Neither |
| Inactive | Either explicit-content reason | Yes | Content-Free only |
| Inactive | Either explicit-content reason | Inactive | Neither |

Content-Free applicability requires occurrence within its current activation and at/after its current streak start. An explicit-content event during effective Reset with an active but temporally inapplicable Content-Free streak cannot produce a partial Reset-only preview or mutation. A backdated event before the current Reset attempt also cannot restart that attempt. These unsafe previews return null. Preview describes temporal effects; the mutation additionally validates supplied identities, source freshness, recording time, and persisted record consistency.

[`recordBehaviorSlipState(state, input)`](../src/storage/bloomBehaviorSlipTransitions.ts), re-exported from `bloomState.ts`, receives exactly `{ reason, occurredAt, recordedAt, logActionId, resetViolationId, replacementResetAttemptId, contentFreeViolationId }`. Canonical timestamps require `recordedAt >= occurredAt`; supplied occurrence is never replaced with recording time. Candidate identities are prepared externally. A manual `logActionId` already present in either Reset or Content-Free history, including undone tombstones, is rejected by the coordinator even if a retry changes reason or owner.

One manual behavior event has one application coordinator. Effective Reset restriction owns the event first: the coordinator delegates once to `recordActiveResetViolationState`, which already owns linked Content-Free changes for explicit-content reasons. It never follows that call with a standalone Content-Free write or falls back after rejection. Both existing candidate slices must validate before that transaction publishes one successor; unsafe linkage leaves the exact original state.

Only when Reset restriction is not effective may an applicable active Content-Free streak own an explicit-content slip through `recordManualContentFreeViolationState`. A stored active Reset at or after `currentAttempt.startedAt + 15 * 24 hours` has no restriction, so explicit content can use this standalone path while Reset remains unchanged. Neither evaluating nor recording a slip completes Reset. Masturbation alone never resets Content-Free. If neither tracker is affected, the coordinator returns the exact original state without storing the button press.

Linked records share `{ kind: "manual", logActionId }`, `occurredAt`, and `recordedAt`. Existing transitions retain baseline/history preservation, best calculations, backdating guards, source deduplication, and tombstones. Unused candidate IDs are not persisted. Tracking, Urge Control, product onboarding, and all legacy slices remain unchanged.

The existing direct Reset/Content-Free commands and screens remain intact. Undo ownership also remains intact: Reset undo owns a Reset-linked event and its Content-Free reversal; standalone Content-Free undo owns a standalone event. There is no generic behavior-slip undo. Persistence stays version 7 / `bloom.localState.v7`, using only existing record shapes, with no migration or route change.

## UrgeControlEvent

Source: [`UrgeControlEvent.ts`](../src/domain/models/UrgeControlEvent.ts). `UrgeControlEvent` is a union of `CurrentUrgeControlEvent` and `LegacyUrgeControlEvent`. Urge Control is optional acute support, independent of Tracking, Content-Free, Reset, and onboarding. Outcomes and triggers are descriptive observations; they do not diagnose, score success, or promise urge reduction.

New events use `flowVersion: 2` and follow **interrupt → outcome → optional multi-trigger → complete**. Current active facts are `{ id, flowVersion: 2, status: "active", startedAt, interruptCompletedAt?, outcome?, triggers? }`. Current completed records require `{ id, flowVersion: 2, status: "completed", startedAt, interruptCompletedAt, outcome, triggers, completedAt }`. No current event accepts technique, phone-away, singular `trigger`, or second-line fields.

`triggers` carries lifecycle meaning: absence/undefined means the trigger step has not been finalized; `[]` records an explicit skip; a non-empty array records one or more selected observations in caller order. Completion requires explicit finalization, including an empty array.

| Current concept | Values |
| --- | --- |
| `UrgeControlOutcome` | `reduced`, `stillStrong`, `stronger`, `unchanged` |
| `CurrentUrgeControlTrigger` | `boredom`, `stress`, `loneliness`, `fatigue`, `explicitContentCue`, `habitAutomatic`, `specificSituation`, `other` |

`explicitContentCue` describes encountering a cue. It is not intentional explicit-content behavior and never calls Behavior Slip or changes a tracker. `specificSituation` intentionally stays broad. Current triggers never infer a diagnosis or start/reset any product system.

Legacy events have no persisted `flowVersion`. Their existing active/completed union retains `selectedTechnique`, singular `trigger`, optional `interruptCompletedAt`, `phoneAwayStartedAt`, `phoneAwayEndedAt`, and `secondLineAction`. Legacy completed records require technique, outcome, trigger, and completion time; historically optional intermediate facts stay optional on load.

| Legacy concept | Values |
| --- | --- |
| Technique | `changeEnvironment`, `grounding54321`, `cognitiveTask`, `urgeSurfing`, `personalReminder` |
| `LegacyUrgeControlTrigger` (also exported as the compatibility alias `UrgeControlTrigger`) | `boredom`, `stress`, `loneliness`, `sleeplessnessNighttime`, `sexualDesire`, `habitAutomatic`, `notSure` |
| Optional second-line action | `putPhoneInAnotherRoom`, `doAnotherTask`, `messageSupportPerson` |

Normalization preserves historical accepted shapes, including older partial/unordered facts, without adding a discriminator, creating a triggers array, mapping answers, removing facts, or forcing writeback solely because a record is legacy. Existing chronology and corruption guards remain. Unknown flow versions and mixed current/legacy fields are rejected. Current fields are exact, trigger values must be supported and unique, active records cannot contain `completedAt`, and completed records require every current completion fact.

The container in [`UrgeControlState.ts`](../src/domain/models/UrgeControlState.ts) still holds one `activeEvent` or null and completed `records`. Histories may mix both event versions, with IDs unique across records and the active slot. Fresh and migrated defaults remain `{ activeEvent: null, records: [] }`. App restart never expires, completes, or discards an event. Starting/completing a current event preserves legacy history. Persistence stays version 7 / `bloom.localState.v7`, with no new top-level slice or migration.

### Urge Control transitions

The eleven pure APIs in [`bloomUrgeControlTransitions.ts`](../src/storage/bloomUrgeControlTransitions.ts) are re-exported from `bloomState.ts`. IDs and canonical timestamps are supplied explicitly. Invalid input, wrong version/lifecycle, unsafe chronology, and repeated completed steps return the exact original state. Every successful action changes only `urgeControl`; other slices retain their references.

| API | Effect and preconditions |
| --- | --- |
| `startUrgeControlEventState(state, { eventId, startedAt })` | Requires no active event and an ID absent from completed history. Creates only `{ id, flowVersion: 2, status: "active", startedAt }`. |
| `completeUrgeControlInterruptState(state, { completedAt })` | Both versions: stores interrupt completion once, at or after event start. No minimum duration or timer persistence. |
| `recordUrgeControlOutcomeState(state, { outcome })` | Current: requires interrupt completion. Legacy: retains the ended phone-away prerequisite and removes a prior second-line choice when correcting to `reduced`. Records/corrects one of the four outcomes; an identical answer is a no-op. |
| `recordUrgeControlTriggersState(state, { triggers })` | Current only, after outcome. Accepts an empty, single, or multiple selection; rejects duplicates, unsupported values, and extra input fields. Copies the caller array in order. Identical ordered selections are exact no-ops; a different valid selection replaces the prior finalization while active. |
| `completeUrgeControlEventState(state, { completedAt })` | Current: requires interrupt, outcome, finalized triggers (including `[]`), and completion at/after event start and interrupt completion. Legacy: retains interrupt, technique, phone-away start/end, outcome, singular trigger, ordered-step and time requirements. Atomically appends the completed event and clears the active slot. |
| `discardActiveUrgeControlEventState(state)` | Both versions: removes only the active event, without a record, tombstone, or new ID reservation. |
| `selectUrgeControlTechniqueState(state, { technique })` | Legacy only: requires interrupt completion and no phone-away start. A technique can be replaced before phone-away begins. |
| `startUrgeControlPhoneAwayState(state, { startedAt })` | Legacy only: requires interrupt, technique, no prior phone-away start, and time at/after interrupt completion. |
| `endUrgeControlPhoneAwayState(state, { endedAt })` | Legacy only: requires phone-away start, no prior end, and end at/after start. |
| `recordUrgeControlTriggerState(state, { trigger })` | Legacy only: requires outcome and records/corrects the singular legacy trigger. |
| `selectUrgeControlSecondLineActionState(state, { action })` | Legacy only: requires a non-reduced outcome; records an optional choice with no external side effect. |

Legacy transitions reject current events; current `recordTriggers` rejects legacy events. Legacy ordered-step guards are unchanged: supplying a missing prerequisite may recover an older partial event only when the resulting active facts are ordered. Identical reduced outcomes do not silently clear historical second-line facts; explicit correction retains the existing behavior. Historical completed records are never rewritten.

Current completion requires no technique, phone-away, second-line action, or 60-second wait. Any outcome can complete. The future “Başka bir şey dene” intervention remains deferred. Completed-event editing, deletion, and undo remain deferred for both versions.

### Urge Control progress

[`getUrgeControlProgress(urgeControl, now)`](../src/domain/urgeControl/getUrgeControlProgress.ts) is a pure, version-aware selector with an explicit canonical clock. It returns null without an active event or for invalid time.

| Current first missing fact | Stage |
| --- | --- |
| Interrupt completion | `interrupt` |
| Outcome | `outcome` |
| Finalized `triggers` | `triggers` |
| None, including finalized `[]` | `readyToComplete` |

Legacy stages remain `interrupt`, `technique`, `phoneAwayReady`, `phoneAwayActive`, `outcome`, `trigger`, and `readyToComplete`, following the earliest missing historical fact. Both versions derive `elapsedEventSeconds = max(0, floor((now - startedAt) / 1000))`. Only legacy progress may expose `phoneAwayElapsedSeconds`, from phone-away start to end or caller time; its end freezes the interval. Clock skew safely clamps elapsed values to zero.

No selector persists counters or advances a lifecycle. Home keeps its existing priority and returns `resumeUrgeControl` with either version's exact stage. Phase 1Z makes `/bloom/urge-control/resume` executable for both versions without changing these types, normalization, or transitions. The feature validates the active event ID and reads this selector; route `stage` is only a hint. Panic uses an independent `{ flow: "panic" }` intent with no persisted state. Mutations and retries retain durable acknowledgement before navigation; trigger drafts remain local presentation state.

## Onboarding Domain Boundary

[`OnboardingDimensions.ts`](../src/domain/models/OnboardingDimensions.ts) defines the separate qualitative dimensions used by the new pure engine:

| Dimension | Values |
| --- | --- |
| `contentDysregulation` | `low`, `medium`, `high`, `uncertain` |
| `erectionResponseConcern` | `low`, `medium`, `high`, `uncertain` |
| `stimulationPattern` | `low`, `medium`, `high`, `uncertain` |
| `safetyFlag` | `noneReported`, `reported`, `uncertain` |
| `recommendationConfidence` | `low`, `medium`, `high`, `uncertain` |

Recommendation identifiers are `masturbation_tracking`, `content_free`, `reset`, and `reset_and_content_free`. The candidate rules are defined in [PRODUCT_SPEC.md](PRODUCT_SPEC.md); no routing is implemented. Reset eligibility requires both response concern and stimulation pattern high. Low, medium, or uncertain recommendation confidence returns Masturbation Tracking first so real behavioral data can be collected. Frequency alone must not define a problem.

Phase 1C aligns the three scored dimensions' provisional Phase 1A labels to low/medium/high/uncertain. They had no persisted consumers, so no migration is needed. These concepts remain separate from legacy `PL`, `PP`, `CT`, `FC`, `PatternId`, `QuizResult`, and `RecommendedFirstAction`.

[`BloomOnboardingAnswers` and `BloomOnboardingQuizResult`](../src/domain/onboarding/types.ts) preserve all 12 raw answers, including explicit unknowns and multi-select techniques/safety signals. Results include quiz/scoring versions, dimensions, recommendation, confidence, `resetEligible`, `safetyFlag`, caller-supplied `completedAt`, and internal score/coverage evidence. Duplicated convenience confidence/safety fields are populated from the same computation as the dimensions. The scorer validates complete submissions and copies answer arrays; it never defaults missing answers to zero. Phase 1D persists the complete result in the separate product onboarding slice.

The [domain guide](../src/domain/onboarding/README.md) specifies provisional weights, thresholds, high-support gates, and confidence fallback. Q1 and Q12 are excluded from recommendation scoring and confidence. Safety retains reported context without diagnoses or medical interpretation. No journey routing, provider, legacy quiz, or legacy persisted onboarding change is included.

## ProductOnboardingState

Source: [`ProductOnboardingState.ts`](../src/domain/models/ProductOnboardingState.ts).

```ts
type ProductPlanAcceptance = {
  acceptedAt: ISODateString;
  recommendation: OnboardingRecommendation;
};

type ProductOnboardingState =
  | { status: "notCompleted"; result: null }
  | {
      status: "completed";
      result: BloomOnboardingQuizResult;
      planAcceptance: ProductPlanAcceptance | null;
    };
```

The fresh default is not completed and has no timestamp or ID. Completed state uses only `result.completedAt` for quiz completion. `saveProductOnboardingResultState` validates and copies the full result with `planAcceptance: null`, replacing only this slice. Invalid results return the original state, following existing pure mutation conventions. Saving never activates a plan or changes feature slices. Once accepted, subsequent saves are also no-ops to protect the historical action; retakes require a separate future lifecycle. No provider action is exposed.

The structural validator in [`validation.ts`](../src/domain/onboarding/validation.ts) accepts the known quiz/scoring versions, exact question/field names, valid raw selections, enums, timestamps, and bounded numeric evidence. Counts are integral and consistent with their declared totals; repeated confidence/safety fields must agree. It does not compare raw answers to derived scores, dimensions, eligibility, or recommendations, and does not call the scorer. Valid historical derived values survive unchanged even if today's algorithm would differ. Raw answers retain their key and selection order for explicit future re-scoring. Malformed or unknown-version results reject the load through the existing corruption boundary; fields are not silently dropped or recomputed.

### Explicit acceptance

[`acceptProductOnboardingRecommendationState`](../src/storage/bloomProductOnboardingTransitions.ts), also exported from `bloomState.ts`, accepts `{ acceptedAt, contentFreeActivationId?, resetJourneyId? }`. It uses only the stored recommendation. Caller-supplied recommendation fields are rejected. IDs are required only for the systems being prepared; no time or identity is generated internally. `acceptedAt` must be canonical ISO and at or after quiz completion.

| Stored recommendation | IDs required | Starting state |
| --- | --- | --- |
| `masturbation_tracking` | None | Enable Tracking without creating a session. |
| `content_free` | Content-Free activation ID | Activate Content-Free immediately; Tracking stays disabled. |
| `reset` | Reset journey ID | Reset enters `baseline_pending`; Tracking stays disabled. |
| `reset_and_content_free` | Both IDs | Reset enters `baseline_pending` and Content-Free activates immediately; Tracking stays disabled. |

All paths require a completed, valid result with null acceptance, an inactive Reset journey, and no unfinished masturbation session. Non-tracking recommendations additionally require Tracking already disabled, preventing acceptance from turning off an existing system. Tracking acceptance may retain an already-enabled setting. Content-Free must be inactive only when this action activates it; otherwise its existing state is untouched. New activation IDs cannot repeat a past activation ID, and activation time cannot overlap past activation boundaries. Histories, best streak/progress, and unchanged slice references are preserved.

Reset preparation adds only its journey ID and `baseline_pending` status to the preserved 15-day history. Acceptance creates no `startedAt`, baseline, attempt, completion, or assessment. The period begins through the separate baseline transition; completion preserves Tracking enablement. Content-Free starts its activation and streak at `acceptedAt`, without a violation or masturbation restriction, and continues independently through Reset completion. Urge Control and every legacy slice are unchanged.

The transition returns one atomic snapshot containing the product changes and `{ acceptedAt, recommendation }` acceptance. Invalid inputs or conflicting state return the original state. Repeated acceptance returns the original accepted state before inspecting new inputs, preventing duplicate identities or replacement timestamps. The saved scoring result remains the same historical object and is never rescored.

`bloomOnboardingSchema.ts` requires acceptance to be null or an exact marker with valid time and a recommendation equal to the stored result. Mismatches are rejected, not repaired. Acceptance validation does not require current feature state to still match the initial plan: the marker records a past user action, not a second current-plan authority.

## New Product Home Read Model

[`getBloomHomeReadModel(state, at)`](../src/domain/home/getBloomHomeReadModel.ts) accepts only the structural product slices `masturbationTracking`, `contentFree`, `resetJourney`, `urgeControl`, and `productOnboarding`, plus an explicit canonical timestamp. It returns `{ primaryAction, primaryTracker, secondaryTracker, trackingAvailability, urgeControlProgress, urgeControlAvailable: true }`, or null when required time-based facts cannot safely be determined.

It composes `getMasturbationTrackingAvailability`, `getContentFreeProgress`, and `getUrgeControlProgress`, reusing `trackingAvailability.resetRestriction` instead of calculating parallel Reset policy. Required selector results are read before choosing priority; invalid time or unreadable required progress yields no partial model. `urgeControlProgress` is null when there is no active event. The module reads plain domain state, with no legacy slices, `activePlan`, React, storage, navigation, presentation copy, generated IDs/times, or mutation.

`primaryAction` is a discriminated union using `id`, or null. The first applicable action wins in this order:

| Condition | Action `id` | Payload |
| --- | --- | --- |
| Active current session | `resumeMasturbationSession` | `sessionId` |
| Current session awaiting feedback | `finishMasturbationSessionFeedback` | `sessionId` |
| Active Urge Control event | `resumeUrgeControl` | `eventId`, selector `stage` |
| Active Reset whose period has elapsed | `recordResetElapsedCompletion` | `journeyId`, `attemptId`, existing `progress` |
| Reset baseline pending | `completeResetBaseline` | `journeyId` |
| Active Reset still effectively restricted | `viewActiveReset` | `journeyId`, `attemptId`, existing `progress` |
| Completed product onboarding with null acceptance | `reviewStartingRecommendation` | None; feature reads stored result |
| Reset recommended (persisted compatibility) | `reviewResetRecommendation` | None |
| Primary Tracking tracker can start | `startMasturbationSession` | None |
| Content-Free is the primary tracker | `viewContentFree` | None |

Unfinished session work has priority even over conflicting feature states, with active Urge Control next. Exactly at/after 15 elapsed days, still-active Reset requests explicit completion persistence, not an active-restriction view or session-start action. It never calls `completeElapsedResetPeriodState`. Home never requests a post-reset assessment; legacy pending records normalize before reaching the current model. Baseline pending does not assert Reset has started. The stored onboarding recommendation is never rescored and takes precedence over recommended Reset. Not-completed product onboarding alone generates no action, preserving the migration boundary until later entry/routing integration.

Phase 2B adds `trackingResetRecommendation` containing the canonical derived result. A null selector result fails the whole Home read safely. Its separate `resetRecommendationAction` is `{ id: "reviewResetRecommendation" }` only for recommended Tracking evidence with inactive Reset, no unfinished session, and no unresolved completed onboarding recommendation. It is independent of Tracking enablement, Content-Free, and Urge priority, and never replaces `primaryAction`. Persisted Reset `recommended` retains the existing primary review behavior without requiring evidence. Both review paths map to the same parameter-free route.

Tracker summaries use `kind` as their discriminant: `{ kind: "masturbationTracking", availability, completedSessionCount }` or `{ kind: "contentFree", progress }`, where Content-Free progress is the existing active result. Enabled Tracking is always primary; active Content-Free then becomes secondary. With Tracking disabled, active Content-Free becomes primary and secondary is null. With neither enabled/active, both trackers are null. These roles follow current feature facts, never legacy plan identity or recommendation ownership.

Trackers are composed independently of the highest-priority action, so active Content-Free remains represented during Reset and other unfinished flows. Availability remains the exact shared read model; no contradictory session-start action is offered while its blockers apply. If no priority or tracker action applies, `primaryAction` is null. `urgeControlAvailable: true` exposes optional support without inventing a default start-Urge action. No derived action, tracker role, or progress is persisted. Both engines coexist: [`getNextBloomAction.ts`](../src/domain/journey/getNextBloomAction.ts) and its legacy presentation/Today behavior remain unchanged. Quick-action presentation, navigation mapping, and UI/provider integration are deferred.

## Compatibility With The Running Application

The expanded [`BloomLocalState`](../src/storage/bloomState.ts) remains the persisted runtime authority. All eight legacy slices remain, followed by the four feature slices and product onboarding:

```text
activePlan
onboarding
tenDayReset
debug
protection
checkIns
pause
arousalControl
masturbationTracking
contentFree
resetJourney
urgeControl
productOnboarding
```

[`bloomStateSchema.ts`](../src/storage/bloomStateSchema.ts) now validates version 7. The loader prefers `bloom.localState.v7`, then v6 through v1. V6 preserves all valid state and adds `status: "recorded"` to Reset violations; old schemas could not record undo. Migration does not invent `undoneAt` or prior-best rollback metadata, or import later-looking fields as those facts. V3–v5 violations receive the same correction. V3–v5 active attempts also retain the earlier validated removal of obsolete `completedDays`. All existing start times, historical progress, and onboarding acceptance remain unchanged. Loading, validation, and migration never undo violations or finish active attempts. Phase 1V only normalizes already-finished legacy `assessment_pending` journeys to `completed`, preserving their completion facts.

V4 still adds only `planAcceptance: null` to completed onboarding; not-completed state stays unchanged. Acceptance is never inferred from feature state or imported from a later-looking v4 field. V3 preserves legacy and Phase 1B slices and adds the not-completed onboarding default. V2 and supported raw legacy payloads retain the legacy slices and receive safe product defaults. Each migration writes directly to v7, removing its source key only after the write succeeds. Failed writes preserve the source. Corrupt/future payload preservation and lifecycle guarantees remain intact. Delete-all covers v1–v7 and Bloom corrupt backups.

Fresh Content-Free is inactive with `bestStreakSeconds: 0`, empty `pastActivations`, and empty `violations`. Fresh Reset is inactive with `durationDays: 15`, `bestCompletedDays: 0`, empty attempts/violations, and no ID, baseline, or assessment. No legacy Reset, Pause, Arousal, Protection, or Check-In record seeds any new entity.

[`BloomLocalStateProvider.tsx`](../src/app/providers/BloomLocalStateProvider.tsx) retains accepted state for active interaction and durable state for saved/history/journey claims. Future adoption must preserve exact write acknowledgement, retry causality, generation ownership, safe hydration, and durable deletion; a type declaration is not a save acknowledgement.

Legacy domain exports remain in [`models/index.ts`](../src/domain/models/index.ts), including User, Onboarding, Check-In, LogEntry, standalone Pause/Exercise, Protection, plans, settings, and subscription types. They are compatibility definitions, not new requirements to build user accounts, subscription features, sync, or separate practice programs. No legacy model or working flow is removed.

Known differences requiring later explicit work:

- Onboarding still produces `pornLoop`, `pressurePattern`, and `controlTiming` patterns and legacy recommendations.
- `TenDayResetState` counts up to ten completed date keys; it has no new attempt, baseline, violation, or assessment lifecycle.
- Pause and Arousal Control remain separate legacy state slices and routes; their records are not implicitly converted into Masturbation Sessions.
- The current journey may require Protection and proceeds toward separate Arousal Practice. Protect remains implemented but is deferred for new flows.
- The existing five tabs and `/reset/ten-day`, `/pause`, and `/exercises/arousal-control` routes remain unchanged.

## Starting Recommendation Integration — Phase 2C

The executable `/bloom/starting-recommendation` feature consumes the existing `ProductOnboardingState` without changing its model. Only completed onboarding with null `planAcceptance` offers review, and the stored `result.recommendation` is read exactly as persisted. Structural validation never rescores historical answers. The Home action and flow intent carry only `id: "reviewStartingRecommendation"` and `flow: "startingRecommendation"` respectively; the route has no parameters or serialized result/evidence.

Acceptance uses the unchanged `acceptProductOnboardingRecommendationState` through existing acknowledged flow/application APIs. It persists only the already-supported `ProductPlanAcceptance`, enabled Tracking, active Content-Free, and/or Reset `baseline_pending` shapes. No new recommendation state, dismissal metadata, schema version, or migration is added. The transition still owns all conflicts and atomicity; no React branch directly enables/activates/prepares a system.

The feature retains the exact accepted successor for save recovery, checks all four relevant immutable references before submission, and retries persistence without replaying acceptance. Durable Reset-based acceptance routes to the actual prepared journey's baseline; other plans route to Today. Acceptance never creates a session, baseline answers, or an active Reset attempt. Eleven current routes are ready; legacy onboarding/Today and final V4/tab presentation remain unchanged. Persistence remains v7 / `bloom.localState.v7`.

## Runtime Validation and Deferred Behavior

The v7 storage boundary checks record shapes, discriminated lifecycle fields, canonical timestamps, numeric ranges, identity uniqueness, and local history/reference consistency. Active attempts reject persisted `completedDays`; restarted and completed attempts retain their historical counts. Reset violation status and undo chronology are validated, and undone violations cannot retain an effective restart archive. Their source identities remain unique even when the referenced intermediate attempt has disappeared through sequential undo. Invalid new records reject the load and preserve the source payload and backup; they are not silently filtered or converted into different user facts. Existing legacy normalization remains unchanged. Future feature adoption must maintain these invariants:

- Stable nonempty identities and valid timestamps with consistent chronology.
- Finite, nonnegative durations and intervals; progress within the declared day range, ratios from 0 through 1, average erection quality from 1 through 10, and integer session ratings from 1 through 10.
- Required fields for each lifecycle state and coherent pause intervals within their session.
- Source identity and deduplication for session-derived violations, including undone entries.
- Consistency of attempt history and identity, progress, baseline, completion timestamps, and assessment references.
- Atomic, acknowledged cross-system effects when one event affects both Reset and Content-Free.

Phase 1O adds pure Home priority and tracker composition using existing v7 shapes; none of the derived output is persisted. Disabled Tracking with unfinished work remains valid, and session times, durations, and pause history remain immutable. Phase 2A adds the derived Tracking recommendation; Phase 2B adds optional Home advice and explicit acceptance to the existing baseline flow. Legacy Home/Today cutover, legacy next-action replacement, active/awaiting-session correction, awaiting-feedback deletion, Reset history rewriting, completed Urge Control editing/deletion/undo, same-day calendar collapse, arbitrary historical replay, post-Reset reports/comparisons, repeated completed Reset journeys, and final recommendation visuals remain deferred. There is no new backend, authentication, sync metadata, analytics, or AI dependency.
