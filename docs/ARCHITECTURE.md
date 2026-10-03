# Architecture

## Goals

The app should be built as a production-minded mobile app, not a quick prototype. The architecture should keep product logic testable, privacy decisions explicit, and future backend sync possible without requiring a backend in the MVP.

## Proposed Stack

- React Native
- Expo
- TypeScript
- Expo Router
- Local-first storage
- Feature-based source organization
- Runtime validation at storage and route boundaries

## Proposed Folder Structure

```txt
src/
  app/
    (tabs)/
      today/
      log/
      exercises/
      progress/
      protect/
    onboarding/
    settings/
    subscription/
    _layout.tsx
  features/
    onboarding/
      components/
      domain/
      hooks/
      screens/
      storage/
      types.ts
    today/
    log/
    pause/
    exercises/
    progress/
    protect/
    settings/
    subscription/
  shared/
    components/
    design-system/
    hooks/
    utils/
    types/
    storage/
    domain/
    constants/
```

If Expo Router's default `app/` directory must live at the repository root, route files can stay in `app/` while feature modules live in `src/features/`. The important boundary is that route files should compose feature screens rather than contain domain logic.

## Implemented Phase 1 Structure

The current scaffold uses Expo Router at the repository root and feature code under `src/`:

```txt
app/
  _layout.tsx
  index.tsx
  (tabs)/
    _layout.tsx
    today.tsx
    log.tsx
    exercises.tsx
    progress.tsx
    protect.tsx
  settings/
    index.tsx

src/
  app/
    config/
      appConfig.json
      appConfig.ts
    flows/
      bloomProductFlowActions.ts
      mapBloomHomeActionToFlowIntent.ts
      useBloomProductFlowActions.ts
    navigation/
      bloomProductRoutes.ts
      mapBloomProductFlowIntentToRouteDestination.ts
    providers/
      AppProviders.tsx
      BloomLocalStateProvider.tsx
      bloomLocalStateAcknowledgedActions.ts
      bloomProductAcknowledgedActions.ts
  constants/
    copy.ts
    navigation.ts
  domain/
    models/
  features/
    onboarding/
    today/
    log/
    pause/
    exercises/
    progress/
    protect/
    settings/
    subscription/
  shared/
    components/
    design-system/
    hooks/
    types/
    utils/
  storage/
```

Visible app naming is centralized in `src/app/config/appConfig.json`, with a typed wrapper in `src/app/config/appConfig.ts`. This keeps the current working title easy to replace when the final brand name is chosen.

## Feature-Based Architecture

Each feature should own its UI composition, domain functions, hooks, storage adapter, and feature-specific types.

Feature modules should expose a small public surface, such as:

```txt
features/pause/
  components/
  domain/
  hooks/
  screens/
  storage/
  index.ts
  types.ts
```

Cross-feature communication should happen through shared domain types, repositories, or explicit feature APIs. Avoid importing deep internals from another feature.

## UI, Domain, And Storage Separation

UI:

- Screens and components render state and call hooks.
- UI should not directly write to SQLite, SecureStore, MMKV, or AsyncStorage.
- Copy should follow `docs/COPY_GUIDELINES.md`.

Domain:

- Domain functions create plans, evaluate sensitive windows, summarize patterns, and validate allowed transitions.
- Domain logic should be pure where possible and easy to unit test.
- Domain functions should not depend on React.

Storage:

- Storage adapters should sit behind repository interfaces.
- Repositories should return typed models and handle persistence details.
- Deletion should be implemented as a first-class storage capability, not a later utility.

## New Product Application Actions

Phase 1P exposes `useBloomLocalState().productActions` as the application command API for the new product. [`createBloomProductAcknowledgedActions({ applyAcknowledgedMutation })`](../src/app/providers/bloomProductAcknowledgedActions.ts) wraps existing pure transitions without adding business prevalidation, scoring, reconciliation, timers, or navigation. The exported `BloomProductAcknowledgedActions` type is `ReturnType<typeof createBloomProductAcknowledgedActions>` and is used by the provider context rather than duplicating nested signatures.

[`BloomLocalStateProvider`](../src/app/providers/BloomLocalStateProvider.tsx) constructs the grouped object with `useMemo`, keyed by its acknowledged mutation dependency, and includes it in the memoized context. Its object identity remains stable while that dependency is stable. Each command calls the transition inside `applyAcknowledgedMutation(currentState => ...)`, so rapid commands use the latest accepted runtime state rather than a captured React state snapshot. Inputs, including IDs and timestamps, pass through unchanged; the Phase 1Q flow layer prepares mechanical facts before invoking these commands.

| Group under `productActions` | Commands |
| --- | --- |
| `onboarding` | `saveProductOnboardingResult`, `acceptRecommendation` |
| `reset` | `startFromBaseline`, `recordViolation`, `undoViolation`, `completeElapsed` |
| `behaviorSlip` | `record` |
| `tracking` | `enable`, `disable` |
| `tracking.session` | `start`, `startPause`, `endPause`, `end`, `completeFeedback`, `discardActive` |
| `tracking.corrections` | `editFeedback`, `deleteSession` |
| `contentFree` | `activate`, `deactivate`, `recordManualViolation`, `undoManualViolation` |
| `urgeControl` | `start`, `completeInterrupt`, `selectTechnique`, `startPhoneAway`, `endPhoneAway`, `recordOutcome`, `recordTriggers`, `recordTrigger`, `selectSecondLineAction`, `complete`, `discardActive` |

Every command returns `Promise<BloomPersistedMutationResult>` through the existing acknowledged mutation runtime. Pure transitions remain the authority for allowed state changes. The runtime accepts a changed snapshot immediately and reports successful persistence only after its exact write succeeds; it retains existing retry, hydration, deletion, and accepted/durable projection behavior. A transition returning the original state retains the runtime's `invalidSession` rejection without a forced write or invented success. The factory has no direct storage access. [Storage documentation](../src/storage/README.md#product-application-actions) details this boundary.

Commands and queries stay separate. The provider continues exposing `state`, `durableState`, and the existing persistence retry API; pure Home, availability, restriction, and progress selectors remain outside `productActions`. No Home read model or ticking clock is installed in the provider. Future consumers can call product commands and compose state with selectors separately. The new factory coexists with `createBloomLocalStateAcknowledgedActions` and all legacy provider methods; no legacy onboarding, Pause, Arousal Control, Protection, Reset, or Check-In behavior is replaced. UI, Today, navigation, and route mapping remain unchanged. This is application wiring only, with no v7 persisted model, schema, key, or migration change.

## Product Flow Integration

Phase 1Q adds [`createBloomProductFlowActions({ productActions, now?, createId? })`](../src/app/flows/bloomProductFlowActions.ts) above the acknowledged command facade. Its exported `BloomProductFlowActions` type is derived with `ReturnType`. Groups and command names mirror `productActions`; helpers prepare missing infrastructure facts, while commands needing no preparation are exposed as direct references. Every mutation still returns the existing `Promise<BloomPersistedMutationResult>` unchanged.

Each prepared invocation captures one operation `Date` through `now` and uses its canonical timestamp wherever the same moment is intended. The injectable `createId(prefix, operationTime)` receives that same Date. Default IDs follow the existing prefix/timestamp/random-nonce convention without changing the legacy ID helper. New identities and current timestamps are generated before calling `productActions`, never inside the command facade, pure transitions, or persistence runtime. Existing target/reference IDs, onboarding results, self-reports, feedback, and Urge choices remain caller inputs. For example, `tracking.session.start()` prepares its ID/start, while `tracking.session.completeFeedback(feedback)` retains the supplied answers. `contentFree.recordManualViolation(occurredAt?: ISODateString)` accepts the occurrence directly; Reset violation input retains its optional `occurredAt` field. Only omission/undefined defaults occurrence to the operation time, with no historical replay logic.

Phase 1W narrows Reset start to `CurrentResetBaselineSelfReport`. Its transition input is `{ resetBaselineId, capturedAt, selfReport, resetAttemptId, startedAt }`; UI and flow never supply aggregates or a complete baseline. [`getResetTrackingSnapshot`](../src/domain/reset/getResetTrackingSnapshot.ts) owns the descriptive means/ratio from all completed sessions ended by capture time. The transition alone invokes it, once for the accepted baseline; save retries and attempt restarts never recapture the snapshot. Persisted baselines may retain the exact legacy three-question shape without synthetic fields; current APIs accept only the four-question shape.

Phase 1Y adds `productActions.urgeControl.recordTriggers({ triggers })` and `flowActions.urgeControl.recordTriggers(triggers)`. The flow wraps the semantic array without mutating it or generating facts; the transition copies it into accepted state. The current path is `start()` → `completeInterrupt()` → `recordOutcome({ outcome })` → `recordTriggers([...])` → `complete()`, with `discardActive()` at any active stage. Start captures its ID/time once; interrupt and completion each capture one supplied time. Save retry persists the accepted snapshot without replaying commands or generating new IDs/timestamps.

New events use per-event `flowVersion: 2`; their interrupt → outcome → optional multi-trigger lifecycle omits legacy technique/phone-away/second-line facts. Undefined triggers mean unfinished; `[]` means explicitly skipped. Triggers are observations only, including `explicitContentCue`, which never invokes Behavior Slip or changes a tracker. Legacy operations remain exposed for historical events with no discriminator; normalization retains their shapes without forced writeback. Current and legacy records coexist in the existing v7 slice. Home reads version-aware progress at its unchanged priority. Phase 1Z makes the shared current/legacy resume route executable, as described below; the Phase 1Y domain and persistence contracts remain unchanged.

The flow layer preallocates possible cross-feature IDs without reading state or duplicating policy: acceptance receives Reset/Content-Free identities, Reset violation receives violation/replacement-attempt/linked-Content-Free identities, and session feedback/correction receives a possible linked Content-Free identity. `reset.recordViolation` requires an explicit caller source: `{ kind: "manual" }` gets a generated `logActionId`, while a session source retains its supplied `sessionId`. Existing transitions decide which facts apply. Flow helpers do no business prevalidation, reconciliation, scoring, selector evaluation, storage access, or React orchestration. Invalid, stale, or disallowed semantic inputs retain existing transition/runtime rejection behavior. Persistence retry uses the provider's `retryPersistedMutation(retryToken)` on the already-accepted snapshot; it does not invoke a flow again or regenerate its facts.

[`mapBloomHomeActionToFlowIntent(action)`](../src/app/flows/mapBloomHomeActionToFlowIntent.ts) is a separate pure mapping from `BloomHomeAction` to exported `BloomProductFlowIntent`. Its `flow` discriminant describes an application intent; payload types come from the corresponding Home action. The switch is exhaustive at compile time, preserving all IDs, stage, progress, and recommendation values:

| Home action | Flow intent | Preserved payload |
| --- | --- | --- |
| `resumeMasturbationSession` | `masturbationSession`, `mode: "resume"` | `sessionId` |
| `finishMasturbationSessionFeedback` | `masturbationSessionFeedback` | `sessionId` |
| `resumeUrgeControl` | `urgeControl`, `mode: "resume"` | `eventId`, `stage` |
| `recordResetElapsedCompletion` | `resetCompletion` | `journeyId`, `attemptId`, `progress` |
| `completeResetBaseline` | `resetBaseline` | `journeyId` |
| `viewActiveReset` | `resetProgress` | `journeyId`, `attemptId`, `progress` |
| `reviewStartingRecommendation` | `startingRecommendation` | `recommendation` |
| `reviewResetRecommendation` | `resetRecommendation` | `journeyId` |
| `startMasturbationSession` | `masturbationSession`, `mode: "start"` | None |
| `viewContentFree` | `contentFree` | None |

Mapping an intent does not execute a command, advance Reset, or navigate. The separation remains domain Home selector → semantic action → application intent → future route integration. The flow factory and mapping have no React, provider state capture, route paths, or navigation dependency. Provider, command facade, pure transitions, runtime, legacy APIs/`getNextBloomAction`, and v7 persistence remain unchanged. Screens, Home wiring, routes, presentation, and legacy cutover are outside Phase 1Q.

## Behavior Slip Application Boundary

Phase 1X adds `productActions.behaviorSlip.record(input)` through the existing acknowledged mutation factory and `flowActions.behaviorSlip.record(reason, occurredAt?)` through the existing flow factory. `BehaviorSlipReason` aliases the existing Reset reasons. The flow reads no state: it captures one operation Date, generates one `log-action` ID and candidate `reset-violation`, `reset-attempt`, and `content-free-violation` IDs, and dispatches one acknowledged command. `recordedAt` uses that Date; only omitted/undefined `occurredAt` defaults to the same timestamp. Supplied occurrence passes through unchanged.

The pure [`getBehaviorSlipImpact`](../src/domain/productPolicy/getBehaviorSlipImpact.ts) selector owns the semantic preview, while [`recordBehaviorSlipState`](../src/storage/bloomBehaviorSlipTransitions.ts) chooses the single existing mutation owner from current accepted facts. Effective Reset restriction at occurrence owns the event first, including atomic linked Content-Free for explicit-content reasons. Only without restriction can standalone Content-Free own an applicable explicit-content event. Masturbation alone never affects Content-Free. Rejection never triggers a second owner or partial fallback. Stored active Reset after its exact current-attempt 15-day boundary stays unchanged while Content-Free may accept the event.

One accepted command yields one immutable successor snapshot. Runtime acknowledgement advances durable state only after that exact snapshot writes. Failure retains the accepted snapshot, and `retryPersistedMutation(retryToken)` retries persistence without calling `behaviorSlip.record`, regenerating facts, or reevaluating policy. Neither-affected and invalid commands retain the existing exact no-op/runtime rejection behavior.

The direct `reset.recordViolation` and `contentFree.recordManualViolation` APIs remain available to their unchanged executable screens. Existing Reset-owned and standalone Content-Free undo paths remain separate; no generic undo command is added. Phase 1Z exposes this unchanged coordinator through the Panic feature below. It adds no generic undo or post-save result screen and changes no provider responsibility, persistence shape/version, Urge lifecycle, or Home priority.

## React Flow Adapter and Product Routes

Phase 1R adds [`useBloomProductFlowActions()`](../src/app/flows/useBloomProductFlowActions.ts) as a thin React adapter. It obtains only `productActions` from `useBloomLocalState()` and memoizes `createBloomProductFlowActions({ productActions })` with that object as its sole dependency. Stable product commands therefore retain a stable grouped flow-actions object. The hook reads no product state, runs no selectors or navigation, and creates no IDs/timestamps outside the Phase 1Q factory. It preserves `Promise<BloomPersistedMutationResult>` and does not expand provider context or responsibilities.

[`bloomProductRoutes.ts`](../src/app/navigation/bloomProductRoutes.ts) exports `bloomProductRoutePaths` and typed targets in the separate `/bloom/...` namespace. Targets discriminate on `pathname` and carry only the corresponding `params`, omitted for session start, Content-Free, and Panic. [`mapBloomProductFlowIntentToRouteDestination(intent)`](../src/app/navigation/mapBloomProductFlowIntentToRouteDestination.ts) resolves every `BloomProductFlowIntent` explicitly and exhaustively to `BloomProductRouteDestination`. Phase 1S made the three Masturbation Session destinations `ready`; Phase 1T added Content-Free. Phase 1U added the Reset routes and Phase 1V removed post-reset assessment. Phase 1Z adds Panic and makes Urge Control resume ready, for nine executable destinations: three Masturbation Session routes, Content-Free, three Reset routes, Panic, and Urge resume. Reset recommendation and starting recommendation remain `featurePending`. The discriminated union correlates each status with its allowed target paths.

| Flow intent | Path | Parameters | Status |
| --- | --- | --- | --- |
| `masturbationSession`, `mode: "start"` | `/bloom/masturbation-session/start` | None | `ready` |
| `masturbationSession`, `mode: "resume"` | `/bloom/masturbation-session/resume` | `sessionId` | `ready` |
| `masturbationSessionFeedback` | `/bloom/masturbation-session/feedback` | `sessionId` | `ready` |
| `panic` | `/bloom/panic` | None | `ready` |
| `urgeControl`, `mode: "resume"` | `/bloom/urge-control/resume` | `eventId`, `stage` | `ready` |
| `resetCompletion` | `/bloom/reset/completion` | `journeyId`, `attemptId` | `ready` |
| `resetBaseline` | `/bloom/reset/baseline` | `journeyId` | `ready` |
| `resetProgress` | `/bloom/reset/progress` | `journeyId`, `attemptId` | `ready` |
| `startingRecommendation` | `/bloom/starting-recommendation` | `recommendation` | `featurePending` |
| `resetRecommendation` | `/bloom/reset/recommendation` | `journeyId` | `featurePending` |
| `contentFree` | `/bloom/content-free` | None | `ready` |

Stable identity fields are preserved. Derived Reset `progress` is intentionally omitted from route parameters; Reset screens derive current progress from canonical state. Urge stage and recommendation parameters are hints, not authority to override canonical records or policy. The mapper reads no state or selectors, mutates nothing, and performs no navigation. It stays separate from the Phase 1Q Home-action-to-flow-intent mapper.

Business commands use the React flow hook → flow factory → `productActions` → existing transition/runtime boundary. Navigation preparation follows Home action → semantic flow intent → typed destination. The thin [`navigateBloomProductFlow(router, intent, method = "push")`](../src/app/navigation/navigateBloomProductFlow.ts) adapter maps an intent and calls `router.push` or `router.replace` only for `ready` destinations, returning whether it executed navigation. It evaluates no selectors and performs no mutation. Home remains unwired; the adapter supports explicit session and Reset transitions, Content-Free entry, Panic entry, and current/legacy Urge resume. `{ flow: "panic" }` is an independent semantic entry intent, with no added Home priority action or tab wiring. Deferred destinations have no route entry or placeholder screen.

The focused `verify-bloom-product-react-flows.ts` and `verify-bloom-product-routes.ts` suites run through `verify:persistence`, covering hook delegation/memoization, exhaustive mapping, retained identity/hint fields, deliberate omission of derived progress, readiness, execution refusal for pending routes, and thin route entries. Flow factory, domain, persistence version 7 / `bloom.localState.v7`, and legacy routes/`getNextBloomAction` remain unchanged. No Home/Today wiring, root-entry change, state-driven automatic redirect, or legacy cutover is added.

## First Executable Product Slice: Masturbation Session

Phase 1S implements [`src/features/masturbation-tracking/`](../src/features/masturbation-tracking/README.md) behind three thin Expo Router entries. Start requires an explicit button press, so mounting, rerendering, Strict Mode, and route refocus do not create sessions. Existing unfinished work is offered first; the existing availability selector and product transitions retain Tracking enablement and elapsed Reset restriction policy.

The active route displays total elapsed time, including optional pauses, and exposes pause, resume, and end. End advances to feedback after durable acknowledgement. Feedback collects the existing integer 1–10 rating, intentional explicit-content boolean, and ending reason; durable completion returns to the existing Today route. All writes use `useBloomProductFlowActions()`. The feature never generates persisted IDs/timestamps, calculates persisted duration, or reconciles Content-Free itself.

The pure route view helper rejects missing, repeated, blank, and mismatched `sessionId` parameters. Before every session command, the local controller rechecks the exact route ID and expected current status against the runtime's canonical accepted state. The provider exposes a stable read-only `getAcceptedState()` accessor so event handlers see accepted changes even before the next React render. A matching completed record can be displayed but cannot receive active-session or feedback commands.

The controller coordinates only in-flight operations and retains the existing `BloomPersistedMutationResult`. It deduplicates repeated presses, advances routes only after `ok` durable receipts, and retries accepted failures with `retryPersistedMutation(retryToken)` rather than replaying a flow. The shared navigation guard blocks removal while saving. Accepted-but-unsaved state is shown with save feedback and retry; it is never labeled durably complete. The display clock and feedback choices remain local UI state. `verify-bloom-masturbation-feature.ts`, included in `verify:persistence`, covers lifecycle, restart recovery, stale identities, acknowledgement, retry, and feature wiring.

## Second Executable Product Slice: Content-Free

Phase 1T adds the thin [`app/bloom/content-free.tsx`](../app/bloom/content-free.tsx) route and [`src/features/content-free/`](../src/features/content-free/README.md) feature. Explicit activation, intentional-use logging, manual undo, and deactivation all use `useBloomProductFlowActions()`. They stay on the same route, including after durable deactivation; only the user's Close action returns to the existing Today route. There is no automatic navigation effect or Home wiring.

The small pure feature view delegates current/best streak calculations to `getContentFreeProgress(contentFree, now)`. A local display clock never persists ticks. History preserves canonical IDs, sources, and undone tombstones. It offers the latest recorded manual entry in the current activation as an undo candidate; a later recorded session-derived event blocks that offer. This is a selection for the UI, not a promise of reversibility. The existing transition still decides Reset ownership, ordering, and safe streak restoration, and rejected actions receive neutral unavailable feedback.

Before dispatch, the local controller compares the displayed immutable Content-Free slice with `getAcceptedState().contentFree`. Undo also rechecks the exact target ID against the current recorded manual candidate. Stale history handlers cannot retarget another event or undo a tombstone/session-derived record. A local confirmation is consumed before manual logging, so a duplicate press cannot reuse it to create another event. Commands share in-flight receipts, accepted failures lock further writes, and retry calls only `retryPersistedMutation(retryToken)`. UI save status distinguishes accepted state from durable state throughout activation, logging, undo, and deactivation.

The feature creates no IDs or mutation timestamps, invokes no pure transitions directly, and infers no Reset restriction policy. Session feedback continues to own its Content-Free reconciliation atomically. `verify-bloom-content-free-feature.ts` joins `verify:persistence` for lifecycle, progress, history identity, duplicate-operation, acknowledgement/retry, and wiring checks. Persistence remains v7 / `bloom.localState.v7`; the provider, domain, storage, legacy features, and Masturbation Session behavior are unchanged. The core Reset slice is described below. Phase 1Z adds Panic and Urge resume; recommendation screens remain deferred.

## Third Executable Product Slice: 15-Day Reset

Phase 1U introduced [`src/features/reset/PRODUCT_RESET.md`](../src/features/reset/PRODUCT_RESET.md); Phase 1V retains three thin `/bloom/reset/` routes for baseline, progress, and completion. Its new product modules coexist with the untouched legacy Ten-Day Reset screens/routes. Phase 1W baseline submits only the four current semantic answers through `reset.startFromBaseline(selfReport)`. The flow prepares baseline/attempt IDs and a single capture/start timestamp; the pure Reset start transition constructs the baseline using the canonical Tracking snapshot helper on current accepted state. Durable success replaces the route with the newly accepted attempt's progress route.

`getResetProgress` and `getResetRestrictionStatus` own all elapsed-period and restriction calculations. The period is exactly 15 elapsed 24-hour periods from `currentAttempt.startedAt`, independently of the journey's earlier start or a stale active lifecycle status. The view combines the stored best with selector-derived current completed days for display, without updating stored counters. A display tick never performs a transition. At the boundary, progress states that restriction has ended and offers an explicit Continue to completion. The completion screen explicitly calls `reset.completeElapsed`; the domain records the exact actual period end, and durable acknowledgement returns to the existing Today location (`/(tabs)/today`).

Violation logging requires a consumed confirmation and submits one `reset.recordViolation({ reason, source: { kind: "manual" } })` command. The transition archives the previous attempt, preserves best progress, and creates the replacement attempt. Intentional-content reasons also affect active Content-Free atomically in that same transaction. History retains its canonical attempt, reason, source, occurrence/recording times, and status. The latest recorded Reset violation is only an undo candidate; exact-ID `reset.undoViolation` remains responsible for source/linkage checks, restoration of the previous attempt and best, Content-Free reversal, and tombstones. Either manual or session-derived Reset candidates may be delegated without changing their source identity.

The controller requires exact scalar route identities, expected lifecycle status, and the same displayed immutable Reset snapshot from a fresh `getAcceptedState()` read before every command. Phase 1V changes `baseline_pending → active → 15 days → assessment_pending → assessment → completed` to `baseline_pending → active → 15 days → completed`. No assessment is collected or synthesized. Completion changes only Reset and preserves Tracking enablement, including manual disablement. Historical assessments remain optional, validated metadata; valid persisted `assessment_pending` records normalize to `completed` through existing v7 normalization/writeback. Active journeys are never completed by hydration.

Restart and undo change the current attempt before the old URL changes. The controller retains the exact accepted successor alongside its receipt, keeping save/retry recovery visible during that mismatch. Only durable success can replace the route with the new or restored canonical attempt. Retry uses only `retryPersistedMutation(retryToken)` and never replays a Reset command. Stale route/controller/snapshot handlers cannot mutate or navigate another attempt. `verify-bloom-reset-feature.ts`, included in `verify:persistence`, covers this lifecycle, atomic relationships, boundary behavior, forms, and acknowledgement recovery. Phase 1V removes the assessment command, form, Home action, semantic intent, and route; persistence stays v7 / `bloom.localState.v7`. Home/Today and root routing remain unwired to new-product actions; Reset recommendation and starting recommendation stay pending. Phase 1Z adds the separate Panic and Urge resume features below.

## Routing Approach

Use Expo Router.

Recommended route groups:

- `(tabs)` for Today, Log, Exercises, Progress, and Protect.
- `onboarding` for Welcome, Safety Note, Privacy / Trust, Goal Selection, Adaptive Questions, Starting Profile, and Starting Plan.
- `settings` for Account & Settings, Privacy Overview, Data Controls, Notification Preferences, and App Lock.
- `subscription` for Plus or premium experiments when payment exploration begins.

Today should be the post-onboarding home route.

Current routing implementation:

- `app/index.tsx` redirects to `/(tabs)/today`.
- `app/(tabs)/_layout.tsx` defines exactly five bottom tabs: Today, Log, Exercises, Progress, and Protect.
- `app/settings/index.tsx` is outside the bottom tab group.
- Route files compose feature screens and do not contain domain logic.
- `app.config.ts` sets `extra.router.root` to `app` so `src/app/config` and `src/app/providers` remain infrastructure folders, not route folders.

## State Management Suggestion

Use lightweight local state first.

Recommended split:

- React state for screen-only state.
- Zustand or a similar small store for app-level ephemeral state.
- Repository hooks for persisted local data.
- TanStack Query may be introduced later if backend sync is added.

Avoid global stores for every form field. Sensitive form data should stay close to the screen until saved.

## Storage Suggestion

For the MVP, use a local structured store with repository boundaries.

Recommended direction:

- Expo SQLite for structured records.
- A typed query layer such as Drizzle can be considered once schema complexity grows.
- Expo SecureStore for app-lock secrets, biometric preferences, or future encryption material.
- Avoid storing sensitive values in analytics or crash metadata.

Do not add backend storage in the foundation phase.

Current storage implementation:

- `src/storage/storageClient.ts` defines the `StorageClient` boundary, with React Native AsyncStorage, guarded web storage, and explicit memory adapters.
- Validated state uses the `bloom.localState.v7` envelope. The existing mutation runtime and serialized persistence coordinator own acknowledged writes, retries, hydration, and deletion.
- `src/storage/README.md` documents the current persistence lifecycle and privacy constraints; product commands reuse it without a second storage path.

## Validation Approach

- Define TypeScript interfaces for developer ergonomics.
- Use runtime validation for persisted records, onboarding answers, settings, and route params.
- Zod is a reasonable default if the project has no existing validation standard.
- Keep validation schemas close to feature types or shared domain models.

## Testing Approach

Phase 1 should add test tooling with the scaffold.

Recommended coverage:

- Unit tests for domain functions.
- Repository tests for local storage adapters.
- Component tests for critical flows and empty/error states.
- End-to-end smoke tests for onboarding, Today, Pause, Log, and Data Controls after screens exist.

Privacy-specific test cases:

- Data deletion removes all local MVP records.
- Notification copy remains discreet.
- Sensitive notes are not emitted through analytics hooks.
- Settings and privacy controls remain accessible without subscription.

## Technical Constraints

- No backend in the foundation phase.
- No AI integration in the foundation phase.
- No authentication unless a future feature requires it.
- No payment integration in the foundation phase.
- Do not implement full screens during Phase 0.

## Implementation Principles

- Favor clear feature boundaries over premature abstraction.
- Keep user-created sensitive data local by default.
- Make deletion behavior explicit and testable.
- Use neutral copy and avoid shame-based mechanics.
- Design for future sync without building it early.

## Executable Panic and Urge Control

Phase 1Z adds thin Expo Router entries at `/bloom/panic` and `/bloom/urge-control/resume`, backed by [`PanicScreen`](../src/features/panic/screens/PanicScreen.tsx) and [`UrgeControlResumeScreen`](../src/features/urge-control/screens/UrgeControlResumeScreen.tsx). Presentation uses existing simple shared components, without V4 visuals or bottom-tab changes. The [Panic](../src/features/panic/README.md) and [Urge Control](../src/features/urge-control/README.md) feature documents describe their local boundaries.

Panic has two independent branches. “Şu an tetiklendim” calls only `flowActions.urgeControl.start()` when there is no active event. An existing current or legacy active event offers Continue instead of another start. A successful start replaces the route using the actual accepted active event ID and `getUrgeControlProgress` stage, only after durable acknowledgement and a latest-accepted-state check.

“Seriyi bozdum” selects an existing `BehaviorSlipReason` and previews `getBehaviorSlipImpact` at a read-only display time. Null impact is unavailable; two unchanged effects cannot dispatch. Confirmation checks the rendered Reset/Content-Free references against `getAcceptedState()` and invokes only `flowActions.behaviorSlip.record(reason)`, omitting occurrence time. The coordinator retains press-time ownership, IDs, time, and atomicity. The React feature never dispatches direct Reset or Content-Free violations and never creates an Urge event for this branch. Durable success returns to existing Today, without a post-save result or generic undo screen.

The Urge feature's pure `getUrgeControlRouteView` validates the exact route `eventId` and delegates stage/timing to `getUrgeControlProgress`. Missing, repeated, malformed, stale, or completed-only identity is unavailable. URL `stage` is a navigation hint only: the same route advances through canonical accepted stages without replacing it at each step. Current events expose interrupt completion, one of four outcomes, local multi-trigger selection or explicit `[]` skip, then completion. Local trigger toggles never persist until submitted. `explicitContentCue` remains an observation without tracker or Behavior Slip effects.

Legacy active records use the same route and their original interrupt, technique, phone-away start/end, outcome, singular trigger, and completion operations. Compatibility UI exposes the five historical techniques and seven historical trigger values without adding a flow version or current trigger array. Optional historical second-line facts remain preserved; no dedicated second-line UI is needed. Neither flow enforces a waiting period or advances automatically from a timer. Historically accepted out-of-order drafts can still be refused by the unchanged domain chronology/prerequisite guards. Those drafts retain their facts, show an unavailable message, and offer explicit discard; the feature does not invent past timestamps or repair history.

Each feature has a local controller for in-flight coordination, stale-handler protection, operation snapshots, sanitized messages, and persistence receipts/retry. Its hook owns React lifecycle, read-only clock, accepted/durable presentation, and navigation. Screens own rendering and local selections. All mutations use `useBloomProductFlowActions`; these features create no persisted IDs/timestamps and import no mutation transitions.

Accepted-but-undurable changes keep recovery visible and lock conflicting commands. `usePersistenceNavigationGuard` protects in-flight and unconfirmed recovery. Retry calls only `retryPersistedMutation(retryToken)` to persist the accepted snapshot. Completion/discard preserve their accepted terminal snapshot while the active slot is already empty; successful acknowledgement returns to Today only if that accepted truth is still current. A later cumulative write can durably contain the same Urge slice while superseding its earlier receipt: active work can then continue, and terminal recovery offers an explicit Continue; the failed receipt itself never navigates. Unmounted/replaced controller callbacks cannot dispatch or navigate. Explicit discard is a persisted action; unmounting never discards.

Focused Panic and Urge feature suites run through `verify:persistence`, alongside route tests for nine ready destinations and two pending recommendations. Domain models, transition rules, v7 normalization/key/schema, Behavior Slip coordination, Home priority, and legacy screens are unchanged. Final V4 visuals, “Başka bir şey dene”, post-save insights/undo presentation, and Home/tab cutover remain deferred.
