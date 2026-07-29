# Pause Feature

Owns Pause Now, 90-Second Pause, and After Pause Check-In.

The pause flow creates space before an automatic loop and should always preserve user agency.

An explicit start creates one `pause.activeSession` id. Check-In and timer
updates target that id; completion appends one immutable `pause.records`
entry. Pause Again keeps the same active id and selections while extending
the accumulated timer duration. Add 60 seconds is a canonical state
increment, so rapid actions cannot overwrite one another. Starting over from
the intro replaces an abandoned draft. The Saved route is read-only and never
completes a session on mount.

`timerDurationSeconds` is the configured total for the active Pause session,
while `elapsedDurationSeconds` is the actual accumulated time recorded at a
timer transition. During a running round, the screen owns the live remaining
countdown. Canonical duration updates extend that local countdown without
reconstructing it from stale elapsed state.
