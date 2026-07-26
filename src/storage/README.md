# Bloom Local Storage

Bloom persists its current local state through a small asynchronous `StorageClient` interface.

## Platform Adapters

- React Native uses `@react-native-async-storage/async-storage`.
- Web uses guarded `window.localStorage` access.
- An explicitly named memory adapter is available only for tests and web environments where `window.localStorage` is unavailable. It is not the React Native persistence path.

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

When a valid quiz result exists, `activePlan` is derived from that result during hydration so separately persisted plan data cannot conflict with the result.

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

The provider exposes `loading`, `ready`, and `error` hydration states while retaining the existing `isLoading` API. Mutations requested during loading are queued and applied to the validated state after hydration. Mutations are ignored after a hydration error. Initial defaults are not autosaved, and canonical loaded state is not rewritten unless normalization or a real mutation requires it.

Bloom writes use a serialized queue. A slow earlier write must finish before a later write starts, so the latest mutation remains the final stored envelope. Save failures are surfaced only through non-sensitive status text/warnings.

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
