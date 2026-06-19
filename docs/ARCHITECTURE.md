# Architecture

## Goals

Bloom should be built as a production-minded mobile app, not a quick prototype. The architecture should keep product logic testable, privacy decisions explicit, and future backend sync possible without requiring a backend in the MVP.

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

## Routing Approach

Use Expo Router.

Recommended route groups:

- `(tabs)` for Today, Log, Exercises, Progress, and Protect.
- `onboarding` for Welcome, Safety Note, Privacy / Trust, Goal Selection, Adaptive Questions, Starting Profile, and Starting Plan.
- `settings` for Account & Settings, Privacy Overview, Data Controls, Notification Preferences, and App Lock.
- `subscription` for Bloom Plus when payment exploration begins.

Today should be the post-onboarding home route.

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
