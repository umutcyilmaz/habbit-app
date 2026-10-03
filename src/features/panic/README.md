# Panic entry

`/bloom/panic` offers two independent branches when there is no active Urge event.
“Şu an tetiklendim” calls only `urgeControl.start()`. An existing current or legacy
event instead exposes Continue to its actual ID and canonical progress stage.
“Seriyi bozdum” previews the canonical `getBehaviorSlipImpact` result and confirms
only through `behaviorSlip.record(reason)`. Unavailable and unchanged previews
cannot submit. The screen never selects Reset/Content-Free mutation ownership.

`panicView` is a pure read model. `panicController` checks rendered slice references,
coordinates one in-flight command, and retains accepted persistence receipts.
`usePanicFeature` supplies display clocks, lifecycle guards, and navigation;
`PanicScreen` maintains only local branch/reason selection.

Accepted failed saves retain recovery controls and block conflicting commands and
navigation. Retry uses the existing persistence token and never replays start or
slip. Successful start replaces to Urge resume; a saved slip replaces to existing
Today. Navigation verifies current accepted facts, and stale/unmounted controller
callbacks cannot navigate. Persistence remains v7. V4 presentation, post-save undo
UI, and a second intervention remain deferred.
