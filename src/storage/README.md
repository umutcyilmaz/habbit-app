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
bloom.localState.v2
```

Its JSON value is a versioned envelope:

```ts
type PersistedBloomEnvelopeV2 = {
  version: 2;
  savedAt: string;
  state: unknown;
};
```

Payloads are parsed as `unknown`, validated section by section, and normalized into `BloomLocalState`. Unknown object fields are ignored. Missing supported fields receive current defaults. Important enum, date, array, record, Boolean, and finite-number fields are validated before use.

Bloom date keys must be real Gregorian dates in exact `YYYY-MM-DD` form. Persisted timestamps, including envelope `savedAt`, must exactly match the canonical form produced by `Date.prototype.toISOString()`:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

Timezone offsets, date-only timestamp values, malformed milliseconds, and normalized impossible dates are rejected.

When a valid quiz result exists, `activePlan` is derived from that result during hydration so separately persisted plan data cannot conflict with the result.

Protection uses one canonical persisted status: `off`, `active`, or `paused`.
Legacy `isEnabled: true` normalizes to `active`; `false` normalizes to `off`.
Valid setup timestamps, windows, in-app pause preferences, and supported night
times are preserved. The legacy Boolean is not retained as a second authority.

Reset `startedAt` is canonicalized to a valid date key, including older valid
ISO timestamps. Reset completion dates are filtered to real date keys,
deduplicated, sorted, and capped at ten. A program is terminal only when its
start is valid and ten valid unique dates remain.

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
`/pause/saved` is read-only: an active draft returns to the timer, and no
record returns to the Pause intro.

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
show success only after a successful typed mutation result.

`/exercises/arousal-control/saved` and
`/exercises/arousal-control/progress-preview` only read a valid persisted
completed log. They never create or complete one on mount, and invalid direct
access replaces navigation with the Arousal Control overview.

## Legacy Migration

The loader checks `bloom.localState.v2` first, followed by the legacy key:

```text
bloom.localState.v1
```

A valid legacy payload is normalized and written as a version 2 envelope. The legacy key is removed only after that write succeeds. If the write fails, the legacy payload stays in place and hydration returns the valid in-memory state with a persistence warning so a later write can retry safely.

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

Bloom writes use a serialized queue. A slow earlier write must finish before a later write starts, so the latest mutation remains the final stored envelope. Save failures are surfaced only through non-sensitive status text/warnings.

## Full Local Deletion

All user-facing full resets call one awaited lifecycle operation. The persistence coordinator increments its write generation before deletion, rejects new writes during deletion, waits for any write already inside the storage adapter, and skips older queued generations. A stale write therefore cannot recreate the envelope after deletion.

Deletion enumerates only Bloom-owned keys and removes:

```text
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
explains that data may still remain.

The same operation is used by Debug, Settings/Data Controls, and hydration-error recovery. The recovery `Try again` action only retries hydration; its reset action requires confirmation.

## Focused Verification

The repository verification script uses only fake web storage and explicit memory adapters. It covers web availability/failure behavior, strict dates and timestamps, current and legacy loading, normalization, corrupt/future payload preservation, failed migration, serialized writes, scoped deletion, unrelated-key preservation, concurrent deletion, failed deletion, and write/delete races:

```sh
npm run verify:persistence
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
