# Masturbation Tracking Session

Phase 1S is the first executable new-product slice. Its three route entries are thin delegates to `screens/MasturbationSessionScreen.tsx`:

- `/bloom/masturbation-session/start` — explicit Start button, or Continue for existing unfinished work.
- `/bloom/masturbation-session/resume?sessionId=...` — canonical active session, optional pause/resume, and End.
- `/bloom/masturbation-session/feedback?sessionId=...` — matching awaiting-feedback session; all three feedback answers required.

Start → durable save → Active → End → durable save → Feedback → durable save → existing Today route. Pause and resume remain on Active. Opening/refocusing a route performs no mutation. Home/Today does not link into this feature yet, and opening Start never enables Tracking. Test entry through an explicit route; the existing availability selector and transitions decide whether starting is allowed, including Reset's elapsed 15-day policy.

`useMasturbationSessionFeature.ts` connects canonical provider reads, `useBloomProductFlowActions()`, the display clock, and explicit navigation. `masturbationSessionView.ts` derives the small presentation union and formats elapsed time. The display clock includes pauses and never writes state; existing transitions calculate persisted duration.

`masturbationSessionController.ts` coordinates in-flight commands and their existing `Promise<BloomPersistedMutationResult>` receipts. It reads `getAcceptedState()` immediately before dispatch and requires an exact scalar route ID plus the expected current status. Missing, repeated, blank, stale, or mismatched IDs cannot act on another session. Completed records may be shown as saved only when present in durable state and expose no session mutation.

Repeated presses share the pending operation. An accepted Start is retained for that controller instance, while rejected/no-op requests can be tried again. No mount effect starts work. Failed accepted writes lock further session commands and expose the existing retry token; Retry calls only `retryPersistedMutation`, preserving the accepted ID, timestamp, and payload. Navigation waits for a durable `ok` receipt or an explicit Continue on an already durable session. The existing navigation guard blocks leaving during an in-flight save; a failed save remains visible with retry feedback.

The UI uses shared components and design tokens, with no medical interpretation of feedback. Erection quality choices are integers 1–10, explicit-content use is intentional use only, and ending reasons match the existing domain enum. Feedback delegates atomically through the flow API; Content-Free reconciliation stays in existing transitions. Correction of completed feedback remains supported by the underlying product model/API, with correction UI deferred.

`navigateBloomProductFlow(router, intent, method = "push")` is the thin execution boundary. It returns `false` without navigation for `featurePending` destinations. This slice's three destinations are `ready`; Phase 1T also makes [Content-Free](../content-free/README.md) ready. Urge Control, Reset, and recommendation destinations remain deferred. There is no automatic navigation effect based on product state.

`scripts/verify-bloom-masturbation-feature.ts` runs through `npm run verify:persistence`, alongside route and React-flow verification. Persistence remains version 7 at `bloom.localState.v7`, with no model/schema/migration changes or legacy cutover.
