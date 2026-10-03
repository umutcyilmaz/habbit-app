# Reset recommendation — Phase 2B

`/bloom/reset/recommendation` takes no parameters. Its pure view reads current accepted Reset, Tracking, and onboarding facts and calls the Phase 2A recommendation selector with an explicit display time. Tracking advice remains optional and derived; it does not replace normal Tracking as the primary Home action. Evidence, signals, dismissal, and recommendation status are not persisted. An existing persisted `recommended` Reset is supported without fabricating Tracking evidence.

The controller checks the rendered references before invoking only `flowActions.reset.acceptRecommendation()`. The canonical transition revalidates Tracking advice at the operation's `acceptedAt`. Explicit acceptance creates only the existing `baseline_pending` shape. It neither starts a period nor completes the four baseline questions. Tracking preference, Content-Free, Urge, onboarding, and legacy slices remain unchanged.

The hook owns read-only evidence time, hydration, persistence navigation guards, and routing. It retains the actual accepted baseline successor even when the ordinary view becomes unavailable. Failed saves lock duplicate acceptance; Retry uses only the existing persistence token. A successful acknowledgement replaces to the existing baseline route with the actual accepted journey ID, including the reused ID for persisted recommendations. Superseded receipts never automatically navigate: if a later cumulative save durably contains the same Reset, explicit Continue can recover. Replaced or unmounted callbacks cannot navigate. Close returns to Today without a mutation.

The screen uses shared components and observational copy. Session interval is descriptive context with no effect on recommendation status. Final V4 presentation, Starting Recommendation, persistent dismissal/snooze, and repeated journeys after completed Reset remain deferred. Persistence remains version 7 and `bloom.localState.v7`.

`scripts/verify-bloom-reset-recommendation-feature.ts` exercises the real acknowledged runtime and flow/controller integration plus controlled hook/screen execution. No new test framework or simulator dependency is introduced.
