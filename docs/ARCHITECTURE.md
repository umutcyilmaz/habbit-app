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
| `reset` | `startFromBaseline`, `recordViolation`, `undoViolation`, `completeElapsed`, `completeAssessment` |
| `tracking` | `enable`, `disable` |
| `tracking.session` | `start`, `startPause`, `endPause`, `end`, `completeFeedback`, `discardActive` |
| `tracking.corrections` | `editFeedback`, `deleteSession` |
| `contentFree` | `activate`, `deactivate`, `recordManualViolation`, `undoManualViolation` |
| `urgeControl` | `start`, `completeInterrupt`, `selectTechnique`, `startPhoneAway`, `endPhoneAway`, `recordOutcome`, `recordTrigger`, `selectSecondLineAction`, `complete`, `discardActive` |

Every command returns `Promise<BloomPersistedMutationResult>` through the existing acknowledged mutation runtime. Pure transitions remain the authority for allowed state changes. The runtime accepts a changed snapshot immediately and reports successful persistence only after its exact write succeeds; it retains existing retry, hydration, deletion, and accepted/durable projection behavior. A transition returning the original state retains the runtime's `invalidSession` rejection without a forced write or invented success. The factory has no direct storage access. [Storage documentation](../src/storage/README.md#product-application-actions) details this boundary.

Commands and queries stay separate. The provider continues exposing `state`, `durableState`, and the existing persistence retry API; pure Home, availability, restriction, and progress selectors remain outside `productActions`. No Home read model or ticking clock is installed in the provider. Future consumers can call product commands and compose state with selectors separately. The new factory coexists with `createBloomLocalStateAcknowledgedActions` and all legacy provider methods; no legacy onboarding, Pause, Arousal Control, Protection, Reset, or Check-In behavior is replaced. UI, Today, navigation, and route mapping remain unchanged. This is application wiring only, with no v7 persisted model, schema, key, or migration change.

## Product Flow Integration

Phase 1Q adds [`createBloomProductFlowActions({ productActions, now?, createId? })`](../src/app/flows/bloomProductFlowActions.ts) above the acknowledged command facade. Its exported `BloomProductFlowActions` type is derived with `ReturnType`. Groups and command names mirror `productActions`; helpers prepare missing infrastructure facts, while commands needing no preparation are exposed as direct references. Every mutation still returns the existing `Promise<BloomPersistedMutationResult>` unchanged.

Each prepared invocation captures one operation `Date` through `now` and uses its canonical timestamp wherever the same moment is intended. The injectable `createId(prefix, operationTime)` receives that same Date. Default IDs follow the existing prefix/timestamp/random-nonce convention without changing the legacy ID helper. New identities and current timestamps are generated before calling `productActions`, never inside the command facade, pure transitions, or persistence runtime. Existing target/reference IDs, onboarding results, self-reports, assessment answers, feedback, and Urge choices remain caller inputs. For example, `tracking.session.start()` prepares its ID/start, while `tracking.session.completeFeedback(feedback)` retains the supplied answers. `contentFree.recordManualViolation(occurredAt?: ISODateString)` accepts the occurrence directly; Reset violation input retains its optional `occurredAt` field. Only omission/undefined defaults occurrence to the operation time, with no historical replay logic.

The flow layer preallocates possible cross-feature IDs without reading state or duplicating policy: acceptance receives Reset/Content-Free identities, Reset violation receives violation/replacement-attempt/linked-Content-Free identities, and session feedback/correction receives a possible linked Content-Free identity. `reset.recordViolation` requires an explicit caller source: `{ kind: "manual" }` gets a generated `logActionId`, while a session source retains its supplied `sessionId`. Existing transitions decide which facts apply. Flow helpers do no business prevalidation, reconciliation, scoring, selector evaluation, storage access, or React orchestration. Invalid, stale, or disallowed semantic inputs retain existing transition/runtime rejection behavior. Persistence retry uses the provider's `retryPersistedMutation(retryToken)` on the already-accepted snapshot; it does not invoke a flow again or regenerate its facts.

[`mapBloomHomeActionToFlowIntent(action)`](../src/app/flows/mapBloomHomeActionToFlowIntent.ts) is a separate pure mapping from `BloomHomeAction` to exported `BloomProductFlowIntent`. Its `flow` discriminant describes an application intent; payload types come from the corresponding Home action. The switch is exhaustive at compile time, preserving all IDs, stage, progress, and recommendation values:

| Home action | Flow intent | Preserved payload |
| --- | --- | --- |
| `resumeMasturbationSession` | `masturbationSession`, `mode: "resume"` | `sessionId` |
| `finishMasturbationSessionFeedback` | `masturbationSessionFeedback` | `sessionId` |
| `resumeUrgeControl` | `urgeControl`, `mode: "resume"` | `eventId`, `stage` |
| `recordResetElapsedCompletion` | `resetCompletion` | `journeyId`, `attemptId`, `progress` |
| `completeResetAssessment` | `resetAssessment` | `journeyId`, `attemptId` |
| `completeResetBaseline` | `resetBaseline` | `journeyId` |
| `viewActiveReset` | `resetProgress` | `journeyId`, `attemptId`, `progress` |
| `reviewStartingRecommendation` | `startingRecommendation` | `recommendation` |
| `reviewResetRecommendation` | `resetRecommendation` | `journeyId` |
| `startMasturbationSession` | `masturbationSession`, `mode: "start"` | None |
| `viewContentFree` | `contentFree` | None |

Mapping an intent does not execute a command, advance Reset, or navigate. The separation remains domain Home selector → semantic action → application intent → future route integration. The flow factory and mapping have no React, provider state capture, route paths, or navigation dependency. Provider, command facade, pure transitions, runtime, legacy APIs/`getNextBloomAction`, and v7 persistence remain unchanged. Screens, Home wiring, routes, presentation, and legacy cutover are outside Phase 1Q.

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
