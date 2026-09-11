# Bloom Local Storage

Bloom persists its current local state through a small asynchronous `StorageClient` interface.

## Platform Adapters

- React Native uses `@react-native-async-storage/async-storage`.
- Web uses guarded `window.localStorage` access.
- If a browser exists but its `localStorage` property or methods throw, the adapter throws a structured `storage-unavailable` error. It does not fall back to memory, classify the state as empty, or save defaults.
- Memory storage is available only when explicitly constructed for tests or selected as the fallback for a genuine non-browser environment. It is not the React Native persistence path or a browser-error fallback.

AsyncStorage is durable local storage. It does not provide application-level encryption, and Bloom does not claim that this state is encrypted.

## Current Format

The canonical key is:

```text
bloom.localState.v7
```

Its JSON value is a versioned envelope:

```ts
type PersistedBloomEnvelopeV7 = {
  version: 7;
  savedAt: string;
  state: unknown;
};
```

Payloads are parsed as `unknown`, validated section by section, and normalized into `BloomLocalState`. Existing slices retain their normalization/default and unknown-field rules. Current v7 payloads must include the four Phase 1B feature slices plus `productOnboarding`; completed product onboarding requires `planAcceptance`, either null or a valid historical action. Active Reset attempts have no persisted day counter. Reset violations require recorded/undone status, with a canonical `undoneAt >= recordedAt` only for undone records. Optional `bestCompletedDaysBefore` is an integer 0–15. Malformed new records reject the load without silently removing user facts. Product onboarding uses a closed versioned schema and rejects unknown fields. Important enum, date, array, record, Boolean, and finite-number fields are validated before use.

Bloom date keys must be real Gregorian dates in exact `YYYY-MM-DD` form. Persisted timestamps, including envelope `savedAt`, must exactly match the canonical form produced by `Date.prototype.toISOString()`:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

Timezone offsets, date-only timestamp values, malformed milliseconds, and normalized impossible dates are rejected.

When a valid legacy quiz result exists in `onboarding`, `activePlan` is derived from that legacy result during hydration so separately persisted plan data cannot conflict with it. A new `productOnboarding` result never changes `activePlan` or activates a recommendation.

Protection uses one canonical persisted status: `off`, `active`, or `paused`.
Legacy `isEnabled: true` normalizes to `active`; `false` normalizes to `off`.
Valid setup timestamps, windows, in-app pause preferences, and supported night
times are preserved. The legacy Boolean is not retained as a second authority.

Legacy 10-Day Reset `startedAt` is canonicalized to a valid date key, including older valid
ISO timestamps. Reset completion dates are filtered to real date keys,
deduplicated, sorted, and capped at ten. A program is terminal only when its
start is valid and ten valid unique dates remain.

## Transitional Product State

`masturbationTracking`, `contentFree`, `resetJourney`, and `urgeControl` are persisted alongside all legacy state. Tracking defaults to disabled with no current session/history; Content-Free is inactive with zero best streak and no history; Reset is inactive for 15 days with zero progress, no identity, attempts, violations, baseline, or assessment; Urge Control has no active event or records. Explicit onboarding acceptance prepares the starting state, baseline completion starts Reset, and active Reset violations restart an attempt with atomic Content-Free effects when applicable. Other feature mutations and UI remain deferred.

`bloomProductStateSchema.ts` validates the new unions, canonical timestamps, finite numeric ranges, explicit enums/Booleans, source identities, and record/history relationships. The entire payload is preserved as corrupt if a new record is malformed. It does not recompute streaks, infer medical facts, prove elapsed Reset days, or implement feature transitions.

`productOnboarding` defaults to `{ status: "notCompleted", result: null }`. Completed state contains the full versioned result and a null-or-recorded `planAcceptance`. The result retains raw answers, derived dimensions/recommendation/confidence/eligibility/safety, completion timestamp, and internal evidence. The separate acceptance action owns only `acceptedAt` and the accepted recommendation. The pure save mutation records a result with null acceptance, changes no feature or legacy state, and refuses invalid input or overwriting an accepted result.

`acceptProductOnboardingRecommendationState` is a separate pure transition using supplied time and only the IDs required by the stored recommendation. It records acceptance and atomically enables Tracking, activates Content-Free, prepares Reset in `baseline_pending`, or prepares Reset plus activates Content-Free. Reset has no start time, baseline, or attempt yet; Tracking remains disabled for non-tracking recommendations. Conflicts are exact no-ops; histories, best values, and unrelated systems are preserved. Retries cannot replace the original marker or identities. [DATA_MODEL.md](../../docs/DATA_MODEL.md#explicit-acceptance) defines the initial-state preconditions. The transition itself performs no storage write; its returned snapshot uses the existing persistence coordinator when saved.

`startResetFromBaselineState` accepts `{ resetBaseline, resetAttemptId, startedAt }` and changes only a valid `baseline_pending` Reset to `active`. It retains the journey ID/history/best progress, copies the validated baseline, and assigns the supplied time to both journey and attempt. Start must be at or after baseline capture; equality is valid. IDs are nonempty, the attempt ID must be new, and prior attempts must end no later than this start. Invalid or repeated starts are exact no-ops. Optional baseline aggregates remain absent when unknown; no session-history calculation or medical interpretation is added. Tracking, Content-Free, onboarding acceptance, Urge Control, and all legacy state stay untouched.

`getResetProgress(resetJourney, now)` derives active progress from `currentAttempt.startedAt` and supplied time, using full 24-hour durations clamped to 0–15 days. Users do not manually complete days. `isPeriodComplete` becomes true at 15 days even if persisted status remains `active`; neither this selector nor loading, validation, or hydration writes completion or best progress. A later explicit lifecycle action will persist the period's end. Historical attempts retain their ended progress, while active attempts reject `completedDays`. [DATA_MODEL.md](../../docs/DATA_MODEL.md#elapsed-progress) details selector output and clock behavior.

`recordActiveResetViolationState(state, { violationId, replacementAttemptId, occurredAt, recordedAt, source, reason, contentFreeViolationId? })` is a pure transition in `bloomResetTransitions.ts`, re-exported from `bloomState.ts`. A valid active journey archives its current attempt with the elapsed completed-day count at `occurredAt`, appends one linked Reset violation, and starts the replacement attempt at that time. The journey keeps its original start, identity, baseline, duration, and existing histories; best completed progress can increase but never decrease. At or after 15 full days at the event time, the entire action is an exact no-op. It does not complete Reset.

Masturbation alone leaves Content-Free unchanged. Intentional-content or combined reasons also leave inactive Content-Free unchanged. When Content-Free is active, a supplied Content-Free violation ID is required: one recorded violation shares the Reset source/times, preserves the original streak start and best duration in `streakBefore`, and restarts the current streak at `occurredAt`. Best streak duration is updated using the ended streak's whole seconds. Content-Free stays active with the same activation identity/start and retained history.

Both effects are built and validated before one snapshot is returned. Canonical event/recording times must satisfy `recordedAt >= occurredAt >= currentAttempt.startedAt`, and an affected Content-Free streak must start no later than the event. Invalid inputs, conflicting IDs, and previously applied source identities are exact no-ops across both slices. New Reset violations have `status: "recorded"` and capture `bestCompletedDaysBefore`. Stable manual `logActionId` or session `sessionId` identities prevent replay across recorded and undone violations in both systems. Other product and legacy slices are untouched. No session is created. Standalone Content-Free logging, arbitrary replay, and same-day calendar collapse remain deferred; timezone semantics must precede calendar collapse.

`undoActiveResetViolationState(state, { violationId, undoneAt })` corrects only a safely reversible latest restart in an active journey. It requires canonical undo time at or after recording, the last effective violation, the last linked restart archive, and a current attempt beginning at that event. It restores the old active attempt, removes the false archive, and retains the Reset violation as an undone tombstone. Prior best comes from the new log's exact snapshot, checked against remaining history and current best; legacy records without one permit undo only when the earlier summary is mathematically provable. Ambiguity is a no-op.

Linked Content-Free undo requires matching source/timestamps, the same active activation, the latest effective violation, an unchanged post-log streak start, and a compatible post-log best. It restores the original `streakBefore` and tombstones the linked event atomically with Reset. No linked record permits Reset-only undo only where activation history proves Content-Free was inactive at recording time; a later unrelated activation is preserved. Masturbation-only undo rejects any unexpected link. [DATA_MODEL.md](../../docs/DATA_MODEL.md#undoing-the-latest-violation) documents exact guards. Both candidate slices validate before publication; no baseline, session, onboarding, or legacy changes occur.

Sequential backwards undo retains all tombstones, even when their intermediate attempt IDs no longer appear in effective history. Effective restarted attempts must reference recorded violations; undone violations cannot retain such an archive. Source uniqueness still covers both statuses. Repeated undo keeps the original `undoneAt`, and stale logging retries cannot recreate the event. Loading, migration, and validation never automatically undo or complete anything.

Phase 1H persists these facts in v7. Like the other pure transitions, undo and violation recording perform no storage write; their complete returned snapshots use the existing coordinator. Queue, acknowledgement, hydration, and deletion guarantees remain unchanged.

Acceptance validation requires an exact marker, canonical `acceptedAt` at or after quiz completion, and an accepted recommendation equal to the stored result. It rejects mismatches without rescoring or rewriting them. Current feature state is not used to infer or invalidate a historical acceptance.

`bloomOnboardingSchema.ts` delegates result validation to the pure onboarding structural validator. Known versions, exact fields/question IDs, answer selections, enums, canonical timestamps, and finite score/count ranges are checked without invoking the scorer. Historical derived results are retained as stored facts, including results that differ from today's scoring. Raw answer key/selection order is retained for explicit future re-scoring. Unknown result versions or malformed records follow the corruption strategy instead of being silently repaired. No provider action or screen integration is added.

## Canonical Guided-Flow Records

Bloom state is the persistent authority for three guided-flow record families:

- `checkIns.records` stores a stable id, canonical creation timestamp, the
  selected mood and moment ids, and optional event context/note.
- `pause.activeSession` stores the current 90-Second Pause draft;
  `pause.records` stores completed sessions with the actual elapsed duration
  and only the check-in/after-pause choices the user made.
- `arousalControl.draft` stores one active Arousal Control session;
  `arousalControl.logs` stores completed sessions, including practice mode,
  before/pause/after values, ending, reflection, optional note, and neutral
  duration context.

Record arrays are deduplicated by stable id and sorted newest first. During
hydration, an invalid list item is rejected individually where possible, while
other valid records in that section remain available. Genuine legacy Arousal
completions receive an additive `legacyCompleted` status only when their former
reflection and duration fields provide sufficient terminal evidence. Partial
legacy records remain readable after safe normalization but do not become
valid completed practices or unlock progress.

Completed Pause and Arousal records are immutable. The only supported
post-completion Arousal edit is the existing explicit private-note action,
which targets the same completed log id.

## Guided-Flow Lifecycles

Pause uses explicit `start`, id-targeted `update`, `complete`, and `discard`
operations. Starting from the Pause intro replaces an abandoned draft with a
new id. Pause Again extends the current session without replacing its
check-in selections, and timer-duration increments use the latest canonical
state. The timer records elapsed seconds before the after-pause check-in.
`/pause/saved` is read-only. Completion navigation carries the completed
record's existing id and shows “Pause saved” only when that exact record is in
the durable projection. A missing or accepted-only completion shows an
unconfirmed recovery state and never falls back to an older record. A
no-parameter entry is an explicitly historical view of the latest durable
record; an active draft returns to the timer, and no record returns to the
Pause intro.

For Pause timers, `timerDurationSeconds` is the configured total across the
active session and `elapsedDurationSeconds` is actual accumulated elapsed time
captured at a timer transition. The running screen keeps live remaining time;
an Add 60 mutation increases both canonical configured duration and live
remaining time by exactly 60 without restoring already elapsed seconds.

Arousal Control starts a new session when the user confirms a practice mode.
Every subsequent update and the single completion at Duration target that
session id. Starting another mode explicitly replaces an abandoned draft, so
old values cannot leak into a new session. A completed session must include
the current mode, before-practice choices, ending, completed reflection, and
duration preference before it is eligible for Saved, Progress Preview, or
journey completion.

All guided-flow private notes share `MAX_BLOOM_NOTE_LENGTH`. UI inputs enforce
the limit, domain helpers reject oversized programmatic values, and callers
show persistence-sensitive success only after an acknowledged adapter write.

`/exercises/arousal-control/saved` is read-only. Completion navigation carries
the completed log's existing id and shows “Practice saved” only when that exact
valid log is in the durable projection. A missing or accepted-only completion
shows an unconfirmed recovery state and never falls back to an older log. A
no-parameter entry is an explicitly historical view of the latest valid durable
log. `/exercises/arousal-control/progress-preview` likewise reads only the latest
valid durable log. Neither route creates or completes a log on mount; missing
history redirects to the Arousal Control overview.

## Legacy Migration

The loader checks `bloom.localState.v7` first, followed by these migration sources in order:

```text
bloom.localState.v6
bloom.localState.v5
bloom.localState.v4
bloom.localState.v3
bloom.localState.v2
bloom.localState.v1
```

Valid v6 envelopes preserve existing state and add only `status: "recorded"` to Reset violations. V3–v5 violations receive the same truthful status. These schemas could not record undo or prior-best rollback snapshots, so migration neither invents those facts nor imports later-looking properties as them. V3–v5 active attempts still retain `startedAt` and drop their obsolete `completedDays` after old range and best-progress validation. Historical attempts, best summaries, distinct journey/attempt start times, and onboarding acceptance remain preserved. Migration never undoes an event, invents a baseline, derives progress, or completes an elapsed period.

Valid v4 envelopes still add `planAcceptance: null` to completed onboarding; not-completed state stays unchanged. No acceptance is inferred from enabled Tracking, active Content-Free, or Reset state. Only a later-looking `planAcceptance` property is ignored when validating the old v4 lifecycle; other malformed fields still fail. Valid v3 envelopes preserve all twelve existing slices and add the safe product onboarding default. V2 envelopes and previously supported raw legacy payloads retain legacy normalization and receive safe product defaults. No older feature or quiz data is reinterpreted. Migration dispatch follows the envelope version rather than its key location.

Every migration writes directly to v7 without intermediate historical writes. The source key is removed only after that write succeeds. If the write fails, the source payload stays in place and hydration returns usable validated state with a persistence warning and `needsPersist: true`. Existing serialization, acknowledgement, and generation protections remain in force.

## Corrupt and Future Payloads

Invalid JSON, invalid nested state, and unsupported future versions are not treated as a fresh install. The active source key remains untouched. The raw value is copied to a stable quarantine key under:

```text
bloom.localState.corrupt.*
```

The quarantine record contains the source key, detection time, non-sensitive reason, and original raw payload. The provider enters an explicit hydration error state and disables autosave, preventing defaults from overwriting the active payload. Raw payload content is never written to console or user-facing error text.

## Hydration and Writes

The provider exposes `loading`, `ready`, and `error` hydration states while retaining the existing `isLoading` API. `AppProviders` keeps the Expo Router tree behind one application-level hydration boundary, so direct routes and their mount effects do not run against default state. Loading shows a minimal Bloom surface. An error shows recovery actions without mounting normal routes or redirecting to onboarding.

`retryHydration()` reuses an in-flight request instead of starting an overlapping load. Each load has an attempt identifier, so stale completions after an unmount or reset are ignored. Retry reads storage again; it does not clear storage or save defaults.

Mutations requested during loading are queued and applied to the validated state after hydration. Mutations are ignored after a hydration error. Initial defaults are not autosaved, and canonical loaded state is not rewritten unless normalization or a real mutation requires it.

Bloom loads, migrations, quarantine backups, writes, and full deletion share one serialized lifecycle coordinator per storage adapter. A slow earlier operation must finish before a later operation starts, so the latest mutation remains the final stored envelope. Every accepted provider mutation captures an immutable state snapshot and queues it once through this same coordinator; there is no separate React autosave effect or feature persistence path.

User-triggered mutations that lead to Saved copy or terminal navigation receive a monotonic acknowledgement sequence. Their promise resolves successfully only when the receipt for that exact queued snapshot is `persisted`. Validation, hydration/deletion blocking, unavailable web storage, generic adapter failure, and deletion invalidation remain distinct sanitized results. Draft and system mutations that do not lead directly to Saved feedback use the same commit-and-persist path without waiting in their callers. Onboarding completion and the debug “Start as this profile” result path await an exact acknowledgement. The developer-only “Set only” action uses the acknowledged mutation path but intentionally does not present Saved feedback or navigate.

The provider exposes two centralized projections. `state` is accepted
current-session state and is used for active forms and drafts;
`durableState` is the last snapshot whose exact storage write succeeded and is
used for Saved, history, counts, Progress, and journey decisions. A pending or
failed write can therefore preserve the user’s active input without appearing
in durable product truth.

If an acknowledged write fails, accepted memory remains unchanged and the
result carries an opaque retry token rather than state or storage error data.
Bloom uses explicit supersession (causality model C): accepting any newer state
mutation invalidates older unresolved tokens. A retry can reuse an
already-running write only for the token’s exact revision; it never treats an
arbitrary later revision as proof and never writes an older whole-state
snapshot over newer accepted state. Full deletion increments the
acknowledgement generation, permanently invalidates pre-delete tokens only
after deletion succeeds, and prevents retry from resurrecting an old snapshot.
Provider-level and feature-level error copy does not expose raw state,
serialized payloads, or adapter errors.

Action acknowledgements, hydration, and full-deletion UI waits use a 10-second
watchdog. A timeout reports that durability is still unknown; it does not
cancel or duplicate the underlying adapter operation. Retrying while that
exact operation is unresolved observes the same operation. A late success may
advance the durable projection, but the timed-out action callback cannot later
claim Saved or navigate. Hydration and deletion separately observe their
eventual settlement so late completion can safely finish lifecycle state. A
current hydration watchdog timeout always transitions the provider out of
`loading`, including while an unresolved deletion keeps writes blocked; retry
and reset recovery controls therefore remain bounded and reachable.

Affected stack flows disable duplicate actions and route removal only while an
acknowledgement or retry is actively awaited. After a failed or unknown result,
safe close/back actions are available and the opaque token remains available
for an explicit retry. Their own Saved navigation runs only from a persisted
result while the initiating screen is still current.

## Full Local Deletion

All user-facing full resets call one awaited lifecycle operation. The persistence coordinator increments its generation before deletion, rejects new writes during deletion, invalidates older loads, waits for any load-side migration or quarantine write already inside the storage adapter, and skips older queued writes. Loads requested by remounts during deletion stay serialized behind it: they read only post-delete storage after success and reject without reading partial storage after failure. Stale hydration, migration, quarantine, and save work therefore cannot recreate the envelope or reinstall pre-delete state after deletion.

A late deletion success invalidates hydration work queued while deletion was
unresolved before installing defaults. Even if that queued load settles after
reset navigation unblocks and a new mutation is accepted, it cannot replace the
post-reset accepted state.

Deletion enumerates only Bloom-owned keys and removes:

```text
bloom.localState.v7
bloom.localState.v6
bloom.localState.v5
bloom.localState.v4
bloom.localState.v3
bloom.localState.v2
bloom.localState.v1
bloom.localState.corrupt.*
```

Unrelated storage keys are preserved; global `AsyncStorage.clear()` is not used. Quarantine and legacy keys are removed before the active current key so a mid-operation failure preserves active data where possible. After durable deletion succeeds, the provider installs a genuine default Bloom state without immediately autosaving it. Bloom mutations stay blocked until the router confirms `/onboarding`, preventing an old deep-link screen’s mount effect from recreating state during the reset transition. The first real onboarding mutation may create a new envelope.

The app-level lifecycle also resets the remaining transient Settings toggles
owned by `DemoAppStateProvider` and replaces navigation with `/onboarding`.
Log, Pause, Protection, Reset, and Arousal Control data are already removed
with the canonical Bloom envelope. `DemoAppStateProvider` has no runtime
authority for those features. If storage deletion fails, current in-memory
state is retained, the app does not claim success, and a non-sensitive error
explains that data may still remain. Failed deletion uses recovery model A:
when validated canonical state had been hydrated, the runtime automatically
queues that exact accepted snapshot again without rerunning domain
transformations or regenerating IDs, dates, or completed records. Existing
retry metadata remains available until the deletion actually succeeds. If
deletion interrupts an acknowledged write before its first result, that action
also receives an exact retry token: successful deletion permanently
invalidates it, while failed deletion retargets it to the automatic recovery
write and preserves an explicit retry path if recovery fails or remains
unknown. A deletion attempted from a hydration error never writes default
state over the preserved corrupt or future payload. After successful deletion,
Bloom replaces the old route with a mutation-free transition boundary and
keeps writes blocked until the router confirms onboarding. A synchronous
navigation failure or missing route confirmation exposes an onboarding retry;
restarting the app also hydrates the already-cleared storage into the fresh
journey.

The same operation is used by Debug, Settings/Data Controls, and hydration-error recovery. The recovery `Try again` action only retries hydration; its reset action requires confirmation.

## Focused Verification

The repository persistence verification script uses only fake web storage and explicit memory adapters. It covers web availability/failure behavior, strict dates and timestamps, current and legacy loading, normalization, corrupt/future payload preservation, failed migration, serialized writes, scoped deletion, unrelated-key preservation, concurrent deletion, failed deletion, and write/delete races:

```sh
npm run verify:persistence
```

This command also runs the focused product-state, onboarding, plan-acceptance, Reset-baseline, Reset-violation, and Reset-violation-undo suites. Reset coverage includes supplied baseline validation, history preservation, repeated-start no-ops, 24-hour progress boundaries, clock skew, older-schema migration, and no automatic completion. Violation coverage checks all reasons, atomic Content-Free effects, source/ID deduplication, and the 15-day boundary. Undo coverage includes sequential restoration, tombstones, stale retries, rollback metadata, ambiguous-history rejection, atomic snapshot safety, migration durability, and v7 round trips.

The acknowledgement verifier uses the production mutation runtime, persistence coordinator, domain transforms, envelope reader, and web adapter with delayed/failing synthetic storage clients. It covers exact-write timing, independent rapid-write outcomes, retry without domain replay, Check-In/Reset/Pause/Arousal/Protection idempotency, hydration/deletion blocking and late-success stale-hydration invalidation, storage unavailability, error clearing, stale-token invalidation, and continued unacknowledged system persistence:

```sh
npm run verify:persistence-acknowledgement
```

Protection transitions, legacy Protection conversion, Reset idempotency and
terminal capping, Saved-route eligibility, and cross-feature journey
consistency are covered separately:

```sh
npm run verify:protection-reset
```

Canonical Check-In identity, Pause and Arousal session lifecycles, atomic
timer increments, explicit duration modes, note boundaries, duplicate
completion guards, terminal-route decisions, abandoned drafts, exact
persistence round trips, conservative legacy completion migration, journey
eligibility, full deletion, and Demo consumer scans are covered by:

```sh
npm run verify:guided-flows
```

## Adding a Future Version

1. Add a new envelope type and increment the canonical version/key deliberately.
2. Teach `readPersistedEnvelope` to recognize the version without trusting its state.
3. Add a pure, idempotent migration into the latest `BloomLocalState` shape.
4. Validate and normalize the migrated result.
5. Write the new envelope successfully before removing any older key.
6. Extend `scripts/verify-bloom-persistence.ts` with current, legacy, corrupt, future-version, and failed-write fixtures.

Do not overwrite or delete an unsupported payload merely because the running app cannot understand it.

## Privacy Boundary

Private notes and sensitive reflection details must not be sent through analytics or crash metadata. If cloud sync, analytics, encryption, or app lock is added later, each requires a separate explicit data and threat-model decision.
