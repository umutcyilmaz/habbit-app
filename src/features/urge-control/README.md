# Executable Urge Control resume

`getUrgeControlRouteView(urgeControl, eventId, at)` validates route identity and delegates progress to `getUrgeControlProgress`. Missing, duplicate, malformed, stale, and completed-record identities cannot target active work. The URL stage is only a navigation hint and is ignored.

`urgeControlController` calls only existing Urge flow actions, checks the latest accepted slice against the displayed slice, coordinates one pending operation, and retains its accepted snapshot/receipt for persistence retry. Current steps are interrupt → outcome → optional multi-trigger → completion. The local trigger draft changes no persisted facts until Save or explicit Skip (`[]`). An `explicitContentCue` observation never records Behavior Slip or changes a tracker.

The hook protects in-flight and accepted-undurable recovery with `usePersistenceNavigationGuard`, including terminal completion/discard snapshots. Retry calls `retryPersistedMutation` without replaying commands. Only successful persistence of the same accepted terminal slice permits replacement with existing Today. Stale callbacks from unmounted or replaced controllers cannot mutate or navigate. Display clocks perform read-only progress updates.

A later cumulative save can supersede an operation receipt while durably preserving the identical Urge slice. Once that latest accepted slice is durable, active controls may resume and terminal receipts offer explicit Continue. A failed/superseded receipt never automatically navigates; another undurable successor stays protected.

Legacy events remain executable through the existing technique, phone-away, outcome, and singular-trigger commands. No flow version or current trigger array is added. Older unordered records resume when a canonical operation can safely fill the missing prerequisite. Some historical shapes cannot be advanced with a present-time command under their existing chronology/ordering guards; these remain unchanged with an unavailable message and an explicit discard option. The feature does not rewrite history or synthesize prerequisite times to bypass domain guards.

The screen uses existing shared components and semantic `bloom.urge.*` test IDs. No V4 redesign, second intervention, domain/schema change, timer persistence, automatic completion/discard, or new global persistence version is included. Persistence remains v7 / `bloom.localState.v7`.
