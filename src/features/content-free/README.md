# Content-Free

Phase 1T is the second executable new-product slice, reached through `/bloom/content-free`. Its route entry only renders `screens/ContentFreeScreen.tsx`. Home/Today remains unwired; explicit route testing or `navigateBloomProductFlow(router, { flow: "contentFree" })` can enter it. The three Masturbation Session routes remain ready. Reset, Urge Control, and recommendation routes remain deferred.

The route stays open through inactive → active → inactive and later reactivation. Each change uses the existing flow API:

- Activate calls `flowActions.contentFree.activate()`.
- Record intentional use opens a small confirmation. Confirm consumes that local intent and calls `recordManualViolation()` with no timestamp argument, meaning happened now. Another event requires another explicit confirmation.
- Undo targets the selected exact ID through `undoManualViolation({ violationId })`.
- Deactivate calls `deactivate()` and leaves the route on its inactive view.

Content-Free is independent of Masturbation Tracking. This screen logs intentional explicit-content use only; it has no masturbation or accidental-exposure logging action. Existing transitions own Reset event policy and all streak changes. An `invalidSession` outcome receives neutral unavailable feedback, without trying to infer policy in React. A recorded event resets the streak while leaving Content-Free active.

`contentFreeView.ts` delegates current/best progress to `getContentFreeProgress`, formats display values, and sorts a copy of history. It preserves recorded and undone entries with their original source identities. The latest recorded entry in the current activation is an undo candidate only when it is manual. Older entries, session-derived entries, and tombstones do not get manual Undo controls. The candidate is not a reversibility guarantee: Reset ownership and full restoration checks remain in the transition. Session-derived reconciliation stays with Masturbation Session feedback/correction.

`contentFreeController.ts` coordinates operations and their `Promise<BloomPersistedMutationResult>` receipts. Every command checks the displayed immutable Content-Free slice against a fresh `getAcceptedState()` read before dispatch. Undo also validates the exact target identity/source/status through the current candidate. A stale handler never switches to a newer history row. Repeated in-flight presses share one operation; a changed accepted slice invalidates callbacks from the earlier render.

`useContentFreeFeature.ts` supplies canonical reads, `useBloomProductFlowActions()`, display time, and the existing navigation guard. It starts no mutation on mount, render, refocus, or display ticks. It labels the slice saved only when its accepted reference matches durable state after hydration. Accepted-but-unsaved failures remain visible, lock further writes, and expose Retry through `retryPersistedMutation(retryToken)`, without replaying commands or generating new IDs/timestamps. Close is explicit and disabled while saving; no status change redirects the user.

The feature has no direct storage calls, new provider accessors, business transitions, persisted counters, or schema changes. Persistence remains version 7 at `bloom.localState.v7`. Focused lifecycle, acknowledgement/retry, progress, history identity, and UI wiring verification runs through `npm run verify:persistence`.
