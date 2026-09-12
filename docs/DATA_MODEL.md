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

Phase 1I adds explicit elapsed completion and assessment submission using existing v7 shapes. The restriction ends at 15 full elapsed days; onboarding Tracking is enabled by assessment submission, independently of the readiness answer. No model or migration change is required.

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

Manual enable explicitly allows Reset `inactive`, `recommended`, and `completed`, while rejecting `baseline_pending`, `active`, and `assessment_pending`. An elapsed but still-active Reset remains blocked for manual enable so the toggle cannot bypass the assessment lifecycle. Future statuses must be handled explicitly. Disable is allowed regardless of Reset lifecycle and never discards unfinished work: `enabled: false` with an active or awaiting-feedback session is intentionally valid. Existing actions can still end that session, complete feedback, or explicitly discard an active physical session; no new session can start while disabled.

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

Tracking permission is `enabled`, with no direct onboarding prerequisite. Effective Reset restriction at the supplied session `startedAt` blocks new starts before 15 elapsed days; exactly at/after the current attempt's boundary, stale persisted `active` status alone does not block them. Onboarding Tracking still remains disabled until assessment submission. Session start never advances Reset. Completing feedback for an existing session does not require Tracking to remain enabled. Session transitions do not fabricate Reset violations or repair inconsistent cross-feature history. Existing completed sessions are preserved in order; separate correction APIs own completed feedback edits and deletion.

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
| `assessment_pending` | The 15-day attempt has ended and `completedAt` is present; assessment is outstanding and onboarding Tracking remains disabled. |
| `completed` | The post-reset assessment has been recorded; successful submission enables Tracking. |

All journey states have `durationDays: 15`, `bestCompletedDays` (0 through 15), `pastAttempts`, and `violations`. Inactive state has no identity; `id` is required from `recommended` or `baseline_pending` onward. This is the minimal Phase 1B correction needed to avoid inventing a journey ID at installation. Started states additionally contain `startedAt`, the captured `baseline`, and `currentAttempt`. Both `assessment_pending` and `completed` require `bestCompletedDays: 15`. The `completed` state adds `assessment`.

An active attempt contains only `{ id, status: "active", startedAt }`. Its progress is derived from elapsed time and is never persisted as a mutable day counter. A restarted attempt retains historical `completedDays` from 0 through 14 with `endedAt` and `restartViolationId`. A completed attempt has `completedDays: 15` and `completedAt`. `pastAttempts` contains prior restarted/completed attempts and excludes `currentAttempt`. Attempt count can be derived from this history; it is not a separate counter. `bestCompletedDays` preserves historical best progress; it is not a cache of the active attempt's live progress.

A restart begins a new attempt at Day 1, with zero completed days, while retaining the journey's baseline and history. Preserve best progress across attempts; it is not a measure of medical improvement.

Each `ResetViolation` has `id`, `attemptId`, `occurredAt`, `recordedAt`, the shared `source`, and a `reason`: `masturbation`, `intentionalExplicitContent`, or `masturbationWithExplicitContent`. The combined reason represents one event affecting both systems without requiring duplicate Reset restarts.

Its lifecycle is `{ status: "recorded" }` or `{ status: "undone", undoneAt }`. Recorded entries forbid `undoneAt`; undone timestamps must be canonical and at or after recording. Optional `bestCompletedDaysBefore` (0–15) preserves the exact prior historical summary. New logs always capture it; migrations leave it absent because old records did not own that fact. Both statuses retain their IDs and source identities for deduplication.

Journey and final attempt `completedAt` identify the end of the 15-day Reset period. The assessment has its own submission timestamp. `assessment_pending` does not extend the behavioral restriction. In the onboarding Reset flow, Tracking remains disabled until assessment submission; all valid readiness answers then enable it.

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

The source journey must be valid and `active`. Timestamps are canonical, `recordedAt >= occurredAt`, and `occurredAt >= currentAttempt.startedAt`. `getResetProgress(resetJourney, occurredAt)` must report fewer than 15 completed days. At or after the 15-day boundary the entire transition returns the original state, without restarting Reset or changing Content-Free. The event time controls this boundary, rather than when the event is recorded; no completion or assessment transition runs.

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

Users do not manually complete days. Calling the selector, validating, loading, or hydrating never changes status, historical best progress, or any stored fact. An elapsed period cannot be extended by a stale `active` status or an unanswered assessment. The application must explicitly call the completion transition to persist its end. Session starts and standalone Content-Free logging use shared effective restriction at their supplied event times.

### Product policy read models

[`getResetRestrictionStatus(resetJourney, at)`](../src/domain/productPolicy/getResetRestrictionStatus.ts) returns `{ isRestrictionActive, isElapsedPeriodComplete, needsCompletionTransition, progress }`, or null for an invalid canonical time or progress that cannot safely be determined. For active Reset it reuses `getResetProgress` from the current attempt start, including existing clock clamping; `progress` is that `ResetProgress`. Flags describe the currently active lifecycle, so non-active states return false for all three and `progress: null`, even when the journey is already completed.

| Reset at supplied event time | `isRestrictionActive` | `isElapsedPeriodComplete` | `needsCompletionTransition` |
| --- | --- | --- | --- |
| Status other than `active` | false | false | false |
| Active, fewer than 15 elapsed days | true | false | false |
| Active, exactly 15 elapsed days or later | false | true | true |

`needsCompletionTransition` reports that the elapsed period ended while its lifecycle is still active. It never invokes `completeElapsedResetPeriodState`, writes state, or enables Tracking. Manual enable separately follows persisted Reset lifecycle; behavioral restriction follows elapsed event time.

[`getMasturbationTrackingAvailability(state, at)`](../src/domain/productPolicy/getMasturbationTrackingAvailability.ts) returns `{ enabled, currentSessionStatus, canStartSession, blockReason, resetRestriction }`, with the shared policy result included. `currentSessionStatus` is `none`, `active`, or `awaiting_feedback`. Start-block precedence is `trackingDisabled`, then `activeSession`, then `awaitingFeedback`, then `resetRestriction`, otherwise null. `canStartSession` is true only for the null case: enabled Tracking, no unfinished session, and no effective restriction. Invalid time or policy returns null rather than guessing a capability.

An elapsed active Reset can report `needsCompletionTransition: true` while availability still reports `trackingDisabled`, as in the normal onboarding assessment path. These selectors accept plain models/state and produce facts only, with no React, storage, routing, provider, or Home-priority behavior. Reads never persist derived fields or automatically advance a lifecycle.

### Completing the elapsed period

[`completeElapsedResetPeriodState(state, { observedAt })`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, requires a valid active journey and a supplied canonical observation timestamp. `getResetProgress(resetJourney, observedAt)` must report `isPeriodComplete: true` and 15 completed days. Invalid, early, or wrong-lifecycle calls return the original state.

The completion timestamp is derived from `currentAttempt.startedAt + 15 * 24 hours`, never from a late `observedAt` or a calendar-day boundary. The journey becomes `assessment_pending` with `bestCompletedDays: 15` and that `completedAt`. Its current attempt retains the same ID/start and becomes `{ status: "completed", completedDays: 15, completedAt }`; it remains `currentAttempt` rather than also entering `pastAttempts`. Original journey identity/start, baseline, previous attempts, and violation tombstones are preserved.

This transition changes only `resetJourney`. It creates no assessment and does not enable Tracking, so the onboarding path remains disabled while assessment is pending. Content-Free and all other slices retain their original references. Repeating completion cannot replace the completion time. The new transition writes the exact elapsed boundary; persisted validation retains its existing structural and temporal checks without rewriting older valid completion timestamps.

## ResetBaseline

Source: [`ResetBaseline.ts`](../src/domain/models/ResetBaseline.ts).

A `ResetBaseline` has `id`, `capturedAt`, optional observed aggregates, and a required `selfReport` object. It is captured before Reset and preserves the starting context rather than reading changing tracking aggregates later.

Optional observed aggregates are:

- `averageIntervalSeconds`: average interval between tracked masturbation sessions, when known.
- `averageErectionQuality`: average of available session reports, when known.
- `explicitContentSessionRatio`: the fraction of applicable sessions reporting intentional explicit-content use, when known.

Unknown or unavailable aggregates remain absent. Missing data is not zero; a known ratio of zero is meaningful and differs from having no observations. An average erection-quality value may be fractional even though a completed session's rating is an integer from 1 through 10.

| Self-report field | Values |
| --- | --- |
| `urgeIntensity` | `low`, `medium`, `high`, `notSure`, `preferNotToSay` |
| `abilityToPause` | `difficult`, `sometimesPossible`, `manageable`, `notSure`, `preferNotToSay` |
| `spontaneousOrMorningErections` | `often`, `sometimes`, `rarely`, `notSure`, `preferNotToSay` |

These are subjective observations without diagnostic labels, medical thresholds, or claims of recovery. Aggregation windows, minimum sample sizes, and calculation rules are deferred.

### Starting from a baseline

[`startResetFromBaselineState`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, accepts `{ resetBaseline, resetAttemptId, startedAt }`. It requires a valid `baseline_pending` journey, a nonempty attempt ID not already in history, and canonical timestamps with `startedAt >= resetBaseline.capturedAt`; equality is allowed. It validates and copies the supplied baseline. Unknown aggregates remain absent, and no session-history aggregates are calculated.

The transition changes only `resetJourney` to `active`, preserving its ID, 15-day duration, best progress, attempts, and violations. It attaches the baseline and sets both journey and new active attempt `startedAt` to the single supplied time. Historical attempts may precede this new journey start; their periods must still be non-overlapping and end no later than the new attempt. Older migrated journeys can retain an earlier journey start from before a restart; validation preserves `baseline.capturedAt <= journey.startedAt <= currentAttempt.startedAt` without rewriting timestamps.

Invalid inputs, partially started source shapes, and every status other than `baseline_pending` return the original state. Repeating a start cannot replace the baseline, attempt, or journey identity. Onboarding acceptance, Tracking, Content-Free, Urge Control, and every legacy slice retain their original references. Starting Reset neither enables Tracking nor changes a Content-Free activation already underway.

## PostResetAssessment

Source: [`PostResetAssessment.ts`](../src/domain/models/PostResetAssessment.ts).

A `PostResetAssessment` has `id`, `resetJourneyId`, `resetAttemptId`, `baselineId`, and its own `completedAt` submission timestamp. It records the user's comparison with that baseline after Reset:

| Field | Values |
| --- | --- |
| `urgeIntensityChange` | `decreased`, `same`, `increased`, `notSure`, `preferNotToSay` |
| `abilityToPauseChange` | `harder`, `same`, `easier`, `notSure`, `preferNotToSay` |
| `spontaneousErectionChange` | `lessFrequent`, `same`, `moreFrequent`, `notSure`, `preferNotToSay` |
| `overallSexualResponseChange` | `worse`, `same`, `better`, `notSure`, `preferNotToSay` |
| `readinessToRestartTracking` | `ready`, `notReady`, `notSure` |

The answers describe perceived change and allow uncertainty. Readiness is a self-report, not an eligibility flag. Assessment submission enables onboarding Tracking for `ready`, `notReady`, and `notSure`; an unanswered assessment leaves that setting disabled without extending the Reset period. Submission cannot alter its completion timestamp.

### Submitting the assessment

[`completePostResetAssessmentState(state, assessment)`](../src/storage/bloomResetTransitions.ts), also exported from `bloomState.ts`, accepts only a valid `assessment_pending` journey. The assessment must have a valid nonempty ID, valid existing enum answers, and exact references to the journey ID, current completed attempt ID, and baseline ID. Its canonical `completedAt` must be at or after the journey's period completion time; equality is allowed. Mismatches are rejected rather than corrected.

The transition validates and copies the assessment, moves Reset to `completed`, and sets `masturbationTracking.enabled = true` for every readiness answer. It requires `currentSession === null`; an unexpected unfinished session or any other invalid input leaves the entire state unchanged. It preserves session history, the final completed attempt, both Reset completion timestamps, baseline, best progress, prior attempts, and all violations/tombstones. Content-Free, onboarding, Urge Control, and every legacy slice are unchanged. No session is created, and a repeated submission cannot replace the stored assessment or its timestamp.

These facts support later descriptive reports; no clinical interpretation is derived. Report generation, post-Reset session comparison, and tracking-based Reset recommendations remain outside this phase.

## UrgeControlEvent

Source: [`UrgeControlEvent.ts`](../src/domain/models/UrgeControlEvent.ts).

Urge Control is optional acute support for a brief choice moment, independent of Tracking, Content-Free, Reset, and onboarding. It does not diagnose, promise urge reduction, or assign success/failure. Its event follows this progression:

1. Urge begins.
2. A short interrupt.
3. A coping technique.
4. A phone-away period.
5. An outcome report.
6. A trigger report.
7. An optional second-line action.

An event has a stable `id` and `startedAt`. Its lifecycle union distinguishes `active` from `completed`. `selectedTechnique`, `outcome`, and `trigger` are optional during an active event and required on a completed event alongside `completedAt`. Optional `interruptCompletedAt`, `phoneAwayStartedAt`, and `phoneAwayEndedAt` represent intermediate progress without prescribing timer lengths. `secondLineAction` remains optional.

| Concept | Values |
| --- | --- |
| Technique | `changeEnvironment`, `grounding54321`, `cognitiveTask`, `urgeSurfing`, `personalReminder` |
| Outcome | `reduced`, `stillStrong`, `stronger`, `unchanged` |
| Trigger | `boredom`, `stress`, `loneliness`, `sleeplessnessNighttime`, `sexualDesire`, `habitAutomatic`, `notSure` |
| Optional second-line action | `putPhoneInAnotherRoom`, `doAnotherTask`, `messageSupportPerson` |

A selected second-line action is only a recorded choice; it does not send a message, control the phone, schedule anything, or execute a technique. It is allowed after `stillStrong`, `stronger`, or `unchanged`; completion never requires it. Changing an active outcome to `reduced` clears a prior choice. No external action or UI is implemented here.

The container in [`UrgeControlState.ts`](../src/domain/models/UrgeControlState.ts) holds one active event or null and completed `records`, using `Extract` aliases. Fresh and migrated defaults are `{ activeEvent: null, records: [] }`. The active event survives app close/reload without automatic expiry, completion, or cancellation. Completed records are append-only in this phase; editing, deletion, and undo remain deferred.

### Urge Control transitions

The ten pure APIs in [`bloomUrgeControlTransitions.ts`](../src/storage/bloomUrgeControlTransitions.ts) are re-exported from `bloomState.ts`. Every identity and canonical timestamp is caller-supplied. Invalid input, wrong lifecycle, unsafe chronology, and repeated completed steps return the original state without partial changes. All actions preserve every slice except `urgeControl`, including during active Reset or a Masturbation Session.

| API | Effect and preconditions |
| --- | --- |
| `startUrgeControlEventState(state, { eventId, startedAt })` | Requires no active event, a valid event ID absent from completed records, and canonical start. Creates only `{ id, status: "active", startedAt }`; other features and onboarding impose no prerequisite. |
| `completeUrgeControlInterruptState(state, { completedAt })` | Requires an active event with no completed interrupt and `completedAt >= event.startedAt`. Stores the actual interrupt completion time once. |
| `selectUrgeControlTechniqueState(state, { technique })` | Requires a completed interrupt and no phone-away start. Records or replaces a valid technique; selecting the current choice is a no-op. |
| `startUrgeControlPhoneAwayState(state, { startedAt })` | Requires completed interrupt, technique, no prior phone-away start, and `startedAt >= interruptCompletedAt`. Stores only that start fact. |
| `endUrgeControlPhoneAwayState(state, { endedAt })` | Requires phone-away start, no prior end, and `endedAt >= phoneAwayStartedAt`. Retains the actual end rather than a target-duration timestamp. |
| `recordUrgeControlOutcomeState(state, { outcome })` | Requires the completed phone-away step. Sets or corrects a valid descriptive outcome before completion, clearing `secondLineAction` when changing to `reduced`. |
| `recordUrgeControlTriggerState(state, { trigger })` | Requires outcome. Sets or corrects a valid supplied trigger; no trigger is inferred. |
| `selectUrgeControlSecondLineActionState(state, { action })` | Requires a non-reduced outcome. Records an optional valid choice with no external side effect. |
| `completeUrgeControlEventState(state, { completedAt })` | Requires interrupt, technique, phone-away start/end, outcome, and trigger, with `completedAt >= phoneAwayEndedAt` and event start. Appends the completed event once with all retained facts and clears `activeEvent`. |
| `discardActiveUrgeControlEventState(state)` | Clears only an existing active event. Creates no completed record or tombstone and leaves completed history untouched. |

Technique becomes immutable once phone-away starts. Outcome and trigger remain correctable while active; identical valid choices are no-ops. New transitions require the full ordered prerequisites for the resulting stage, including all earlier guided steps. Neither interrupt nor phone-away has an exact enforced duration, and later/earlier returns never fabricate timestamps. Completion retains identity, actual times, answers, and optional second-line choice; a non-reduced outcome may complete without escalation.

Existing persistence validation remains compatible with older valid active/completed records whose optional intermediate fields lack the new guided ordering. It still rejects malformed chronology and duplicate IDs. New transitions do not silently repair those historical facts or invent missing times; an explicitly supplied missing step may proceed only when the resulting event has valid ordered prerequisites. No background mutation, session, pause, violation, Tracking permission change, or Reset progress change is derived from an Urge Control event.

### Urge Control progress

[`getUrgeControlProgress(urgeControl, now)`](../src/domain/urgeControl/getUrgeControlProgress.ts) is a pure domain selector with an explicit canonical clock. It returns null without an active event or for invalid time, and otherwise derives `{ stage, elapsedEventSeconds, phoneAwayElapsedSeconds? }` from existing facts:

| First missing fact | Stage |
| --- | --- |
| Interrupt completion | `interrupt` |
| Technique | `technique` |
| Phone-away start | `phoneAwayReady` |
| Phone-away end | `phoneAwayActive` |
| Outcome | `outcome` |
| Trigger | `trigger` |
| No required fact is missing | `readyToComplete` |

Elapsed event seconds are `max(0, floor((now - event.startedAt) / 1000))`. Phone-away seconds are absent until its start, then use `max(0, floor(((phoneAwayEndedAt ?? now) - phoneAwayStartedAt) / 1000))`; ending freezes that interval. A clock before the relevant start clamps display duration to zero. Reading progress never persists ticking counters, changes stages in storage, or automatically completes/discards an event.

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

Reset preparation adds only its journey ID and `baseline_pending` status to the preserved 15-day history. Acceptance creates no `startedAt`, baseline, attempt, completion, or assessment. The period begins through the separate baseline transition; Tracking is enabled after post-reset assessment submission. Content-Free starts its activation and streak at `acceptedAt`, without a violation or masturbation restriction, and continues independently through both completion transitions. Urge Control and every legacy slice are unchanged.

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
| Reset assessment pending | `completeResetAssessment` | `journeyId`, `attemptId` |
| Reset baseline pending | `completeResetBaseline` | `journeyId` |
| Active Reset still effectively restricted | `viewActiveReset` | `journeyId`, `attemptId`, existing `progress` |
| Completed product onboarding with null acceptance | `reviewStartingRecommendation` | Stored `recommendation` |
| Reset recommended | `reviewResetRecommendation` | `journeyId` |
| Primary Tracking tracker can start | `startMasturbationSession` | None |
| Content-Free is the primary tracker | `viewContentFree` | None |

Unfinished session work has priority even over conflicting feature states, with active Urge Control next. Exactly at/after 15 elapsed days, still-active Reset requests explicit completion persistence, not an active-restriction view or session-start action. It never calls `completeElapsedResetPeriodState`. An assessment action does not assert continued restriction; baseline pending does not assert Reset has started. The stored onboarding recommendation is never rescored and takes precedence over recommended Reset. Not-completed product onboarding alone generates no action, preserving the migration boundary until later entry/routing integration.

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

[`bloomStateSchema.ts`](../src/storage/bloomStateSchema.ts) now validates version 7. The loader prefers `bloom.localState.v7`, then v6 through v1. V6 preserves all valid state and adds `status: "recorded"` to Reset violations; old schemas could not record undo. Migration does not invent `undoneAt` or prior-best rollback metadata, or import later-looking fields as those facts. V3–v5 violations receive the same correction. V3–v5 active attempts also retain the earlier validated removal of obsolete `completedDays`. All existing start times, historical progress, and onboarding acceptance remain unchanged. Loading, validation, and migration never automatically undo or complete anything.

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

## Runtime Validation and Deferred Behavior

The v7 storage boundary checks record shapes, discriminated lifecycle fields, canonical timestamps, numeric ranges, identity uniqueness, and local history/reference consistency. Active attempts reject persisted `completedDays`; restarted and completed attempts retain their historical counts. Reset violation status and undo chronology are validated, and undone violations cannot retain an effective restart archive. Their source identities remain unique even when the referenced intermediate attempt has disappeared through sequential undo. Invalid new records reject the load and preserve the source payload and backup; they are not silently filtered or converted into different user facts. Existing legacy normalization remains unchanged. Future feature adoption must maintain these invariants:

- Stable nonempty identities and valid timestamps with consistent chronology.
- Finite, nonnegative durations and intervals; progress within the declared day range, ratios from 0 through 1, average erection quality from 1 through 10, and integer session ratings from 1 through 10.
- Required fields for each lifecycle state and coherent pause intervals within their session.
- Source identity and deduplication for session-derived violations, including undone entries.
- Consistency of attempt history and identity, progress, baseline, completion timestamps, and assessment references.
- Atomic, acknowledged cross-system effects when one event affects both Reset and Content-Free.

Phase 1O adds pure Home priority and tracker composition using existing v7 shapes; none of the derived output is persisted. Disabled Tracking with unfinished work remains valid, and session times, durations, and pause history remain immutable. Home/Today integration, legacy next-action replacement, provider/UI wiring, active/awaiting-session correction, awaiting-feedback deletion, Reset history rewriting, completed Urge Control editing/deletion/undo, same-day calendar collapse, arbitrary historical replay, post-Reset reports/comparisons, and tracking-based Reset recommendations remain deferred. There is no new backend, authentication, sync metadata, analytics, or AI dependency.
