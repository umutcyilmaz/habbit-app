# Data Model

## Phase 1A Boundary

[PRODUCT_SPEC.md](PRODUCT_SPEC.md) defines Bloom's new product direction: Masturbation Tracking, Content-Free, and a 15-Day Reset, with Urge Control as acute support. This document describes the new domain boundary under `src/domain/models/`. These types are independent of React, screens, routing, and storage adapters.

Phase 1A adds types and documentation only. The new entities are not yet part of `BloomLocalState`, persisted JSON, provider actions, onboarding scoring, or navigation. The existing application continues to run its legacy flows.

The TypeScript files are the field-level source of truth. Lifecycle unions describe which fields belong to each state; they are not runtime validation or proof that stored input is valid. Future adoption must add validation at mutation, storage, and route boundaries before using external values as these types.

The models reuse `UUID` and `ISODateString` from the existing `shared.ts`; both are string aliases, not format validators. [`BehaviorEventSource.ts`](../src/domain/models/BehaviorEventSource.ts) supplies a small shared event-origin union: `{ kind: "manual", logActionId }` or `{ kind: "masturbationSession", sessionId }`. The same origin follows an event across affected systems and retries.

## MasturbationSession

Source: [`MasturbationSession.ts`](../src/domain/models/MasturbationSession.ts).

A `MasturbationSession` is one tracked masturbation event. Masturbation Tracking is the system that manages these sessions. Optional pause/arousal-control behavior belongs inside the session, not to a separate top-level program.

| Status | Meaning |
| --- | --- |
| `active` | The session is in progress. |
| `awaiting_feedback` | The session has ended; completion feedback is still being collected. |
| `completed` | The session has ended and required feedback is present. |

A session has a stable `id` and `startedAt`. Ended sessions carry `endedAt` and `durationSeconds`; elapsed session duration includes optional pauses. The `awaiting_feedback` branch has optional top-level `erectionQuality?`, `usedExplicitContent?`, and `endingReason?` fields. These feedback fields are absent from `active` sessions and required at the same top level in `completed` sessions. `erectionQuality` is an integer from 1 through 10.

Ending reasons are `climaxed`, `stoppedBeforeClimax`, `firmnessDecreased`, `feltAnxious`, `stoppedByChoice`, and `other`. These are descriptive reports, not medical interpretations.

`usedExplicitContent` means intentional explicit-content use during the session. Accidental exposure alone is not `true`. This distinction must be preserved when future session completion derives a Content-Free or Reset violation.

`pauses` holds the session's optional pauses. An active pause has `status: "active"` and `startedAt`. A completed pause adds `endedAt` and `durationSeconds`. Ended sessions contain only completed pauses: closing the session closes any active pause. An empty array is valid: a normal session with zero pauses can complete. Pause count is derived from the array rather than maintained as another independent value.

## ContentFreeState

Source: [`ContentFreeState.ts`](../src/domain/models/ContentFreeState.ts).

Content-Free records whether the system is active, the current streak start, best streak, and intentional-content violation history. Masturbation itself does not break Content-Free. Accidental exposure does not automatically create a violation.

| Fields | Meaning |
| --- | --- |
| `status` | `inactive` or `active`. |
| `bestStreakSeconds` | Best known streak duration, retained in either state. |
| `pastActivations` | Completed activation periods with `id`, `startedAt`, and `endedAt`. |
| `violations` | Recorded and undone intentional-content events. |
| `activationId`, `activatedAt`, `currentStreakStartedAt` | Present only while active; distinguish this activation from its current streak. |

Each `ContentFreeViolation` has `id`, `activationId`, `kind: "intentionalExplicitContent"`, `occurredAt`, `recordedAt`, `source`, and `streakBefore` (the previous streak start and best duration). Its status is either `recorded` or `undone`; undone entries additionally require `undoneAt`.

For a session-derived violation, the source session's stable `id` is the deduplication identity. Retrying completion or processing the same session again must not append another violation or reset the same streak twice. A manual action logging that same known session must reuse its session origin rather than create a second unrelated event. Event IDs alone do not prove source uniqueness.

Undo corrects the violation log; it does not delete or edit the source session. Keep source identity when a log is undone so replay cannot silently recreate it. Undo is for an accidental logging action, not a rule that intentional content stops counting. Future mutation logic must reconcile streak state with the corrected history. It must not restore an old `streakBefore` over later violations or a later activation. Retained activation boundaries allow historical best-streak recomputation without joining periods when Content-Free was inactive. Deduplication, undo transitions, and streak calculations are not implemented in Phase 1A.

Content-Free can coexist with normal Masturbation Tracking or Reset. It is independent of Protect.

## ResetJourney

Source: [`ResetJourney.ts`](../src/domain/models/ResetJourney.ts).

The new Reset is a 15-day journey. It is distinct from the legacy `TenDayResetState`; adding this type does not change the running 10-Day Reset or its constants.

| Status | Meaning |
| --- | --- |
| `inactive` | No Reset is underway or recommended. |
| `recommended` | Reset has been suggested; the user has not begun preparation. |
| `baseline_pending` | A pre-reset baseline still needs to be captured. |
| `active` | The current 15-day attempt is underway; starting a Masturbation Session is blocked. |
| `assessment_pending` | The 15-day attempt has ended and `completedAt` is present; assessment is still outstanding. |
| `completed` | The post-reset assessment has been recorded. |

All journey states have `id`, `durationDays: 15`, `bestCompletedDays` (0 through 15), `pastAttempts`, and `violations`. Started states additionally contain `startedAt`, the captured `baseline`, and `currentAttempt`. Both `assessment_pending` and `completed` require `bestCompletedDays: 15`. The `completed` state adds `assessment`.

An attempt has its own stable `id` and `startedAt`. An active attempt carries `completedDays` from 0 through 14. A restarted attempt retains that progress with `endedAt` and `restartViolationId`. A completed attempt has `completedDays: 15` and `completedAt`. `pastAttempts` contains prior restarted/completed attempts and excludes `currentAttempt`. Attempt count can be derived from this history; it is not a separate counter.

A restart begins a new attempt at Day 1, with zero completed days, while retaining the journey's baseline and history. Preserve best progress across attempts; it is not a measure of medical improvement.

Each `ResetViolation` has `id`, `attemptId`, `occurredAt`, `recordedAt`, the shared `source`, and a `reason`: `masturbation`, `intentionalExplicitContent`, or `masturbationWithExplicitContent`. The combined reason represents one event affecting both systems without requiring duplicate Reset restarts.

`completedAt` means the 15-day Reset ended, not the assessment submission time. The assessment has its own timestamp. `assessment_pending` must not extend the Reset restriction: tracking becomes available after the 15 days even if the assessment remains unanswered or readiness is negative.

Future violation behavior:

| Event during active Reset | Reset effect | Content-Free effect |
| --- | --- | --- |
| Masturbation without intentional explicit content | Restart at Day 1. | No change. |
| Intentional explicit-content use without masturbation | Restart at Day 1. | Reset an active Content-Free streak. |
| Masturbation with intentional explicit content | Restart at Day 1 once for the event. | Reset an active Content-Free streak once for the event. |
| Accidental exposure alone | No automatic violation. | No automatic violation. |

The session-start restriction and violation reporting serve different purposes: the future app blocks starting a session while Reset is active but still needs to record behavior that occurred. A violation does not need to fabricate an in-app session.

This phase does not implement expiry, attempts, restarts, progress calculations, cross-system updates, or access guards. Calendar-day versus elapsed-day arithmetic, timezone handling, and day-boundary behavior remain decisions for that implementation phase. No type establishes that 15 real days have passed.

## ResetBaseline

Source: [`ResetBaseline.ts`](../src/domain/models/ResetBaseline.ts).

A `ResetBaseline` has `id`, `capturedAt`, optional observed aggregates, and a required `selfReport` object. It is captured before Reset and preserves the starting context rather than reading changing tracking aggregates later.

Optional observed aggregates are:

- `averageIntervalSeconds`: average interval between tracked masturbation sessions, when known.
- `averageErectionQuality`: average of available session reports, when known.
- `explicitContentSessionRatio`: the fraction of applicable sessions reporting intentional explicit-content use, when known.

Unknown or unavailable aggregates remain absent. Missing data is not zero; a known ratio of zero is meaningful and differs from having no observations. An average erection-quality value may be fractional even though a completed session's rating is an integer from 1 through 10.

| Self-report field | Values |
| --- | --- |
| `urgeIntensity` | `low`, `medium`, `high`, `notSure`, `preferNotToSay` |
| `abilityToPause` | `difficult`, `sometimesPossible`, `manageable`, `notSure`, `preferNotToSay` |
| `spontaneousOrMorningErections` | `often`, `sometimes`, `rarely`, `notSure`, `preferNotToSay` |

These are subjective observations without diagnostic labels, medical thresholds, or claims of recovery. Aggregation windows, minimum sample sizes, and calculation rules are deferred.

## PostResetAssessment

Source: [`PostResetAssessment.ts`](../src/domain/models/PostResetAssessment.ts).

A `PostResetAssessment` has `id`, `resetJourneyId`, `resetAttemptId`, `baselineId`, and its own `completedAt` submission timestamp. It records the user's comparison with that baseline after Reset:

| Field | Values |
| --- | --- |
| `urgeIntensityChange` | `decreased`, `same`, `increased`, `notSure`, `preferNotToSay` |
| `abilityToPauseChange` | `harder`, `same`, `easier`, `notSure`, `preferNotToSay` |
| `spontaneousErectionChange` | `lessFrequent`, `same`, `moreFrequent`, `notSure`, `preferNotToSay` |
| `overallSexualResponseChange` | `worse`, `same`, `better`, `notSure`, `preferNotToSay` |
| `readinessToRestartTracking` | `ready`, `notReady`, `notSure` |

The answers describe perceived change and allow uncertainty. Readiness is a self-report, not an eligibility flag. Neither an unanswered assessment nor a negative readiness answer may keep the user out of Masturbation Tracking after Reset ends. Submission records reflection; it cannot alter or extend the Reset completion timestamp.

## UrgeControlEvent

Source: [`UrgeControlEvent.ts`](../src/domain/models/UrgeControlEvent.ts).

Urge Control is acute support, independent of a tracked masturbation session. Its event can represent this progression:

1. Urge begins.
2. A short interrupt.
3. A coping technique.
4. A phone-away period.
5. An outcome report.
6. A trigger report.
7. An optional second-line action.

An event has a stable `id` and `startedAt`. Its lifecycle union distinguishes `active` from `completed`. `selectedTechnique`, `outcome`, and `trigger` are optional during an active event and required on a completed event alongside `completedAt`. Optional `interruptCompletedAt`, `phoneAwayStartedAt`, and `phoneAwayEndedAt` represent intermediate progress without prescribing timer lengths. `secondLineAction` remains optional.

| Concept | Values |
| --- | --- |
| Technique | `changeEnvironment`, `grounding54321`, `cognitiveTask`, `urgeSurfing`, `personalReminder` |
| Outcome | `reduced`, `stillStrong`, `stronger`, `unchanged` |
| Trigger | `boredom`, `stress`, `loneliness`, `sleeplessnessNighttime`, `sexualDesire`, `habitAutomatic`, `notSure` |
| Optional second-line action | `putPhoneInAnotherRoom`, `doAnotherTask`, `messageSupportPerson` |

A selected support-person action is only a recorded choice; the model does not send a message or require a messaging integration. No durations, timers, technique execution, or UI are implemented here.

## Future Onboarding Boundary

[`OnboardingDimensions.ts`](../src/domain/models/OnboardingDimensions.ts) defines a separate qualitative type for the future onboarding result:

| Dimension | Values |
| --- | --- |
| `contentDysregulation` | `low`, `moderate`, `high`, `uncertain` |
| `erectionResponseConcern` | `low`, `significant`, `uncertain` |
| `stimulationPattern` | `flexible`, `specificStimulationReliance`, `uncertain` |
| `safetyFlag` | `noneReported`, `reported`, `uncertain` |
| `recommendationConfidence` | `low`, `medium`, `high`, `uncertain` |

Future recommendation identifiers are `masturbation_tracking`, `content_free`, `reset`, and `reset_and_content_free`. The routing interpretation is defined in [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Low, medium, or uncertain recommendation confidence should prefer Masturbation Tracking first so real behavioral data can be collected. Frequency alone must not define a problem.

These concepts are not aliases for legacy `PL`, `PP`, `CT`, `FC`, `PatternId`, or `RecommendedFirstAction`. Their qualitative labels are product vocabulary, not calibrated measurements or medical categories. This phase does not choose score thresholds, define medical interpretations, replace `QuizResult`, implement a new scoring engine, or change journey routing.

## Compatibility With The Running Application

The existing [`BloomLocalState`](../src/storage/bloomState.ts) remains the persisted runtime authority with these slices:

```text
activePlan
onboarding
tenDayReset
debug
protection
checkIns
pause
arousalControl
```

[`bloomStateSchema.ts`](../src/storage/bloomStateSchema.ts) remains version 2 and validates/normalizes those existing slices. New entity fields must not simply be added to serialized state: current normalization reconstructs the old shape. No schema version, key, migration, adapter, or deletion behavior changes in Phase 1A.

[`BloomLocalStateProvider.tsx`](../src/app/providers/BloomLocalStateProvider.tsx) retains accepted state for active interaction and durable state for saved/history/journey claims. Future adoption must preserve exact write acknowledgement, retry causality, generation ownership, safe hydration, and durable deletion; a type declaration is not a save acknowledgement.

Legacy domain exports remain in [`models/index.ts`](../src/domain/models/index.ts), including User, Onboarding, Check-In, LogEntry, standalone Pause/Exercise, Protection, plans, settings, and subscription types. They are compatibility definitions, not new requirements to build user accounts, subscription features, sync, or separate practice programs. No legacy model or working flow is removed.

Known differences requiring later explicit work:

- Onboarding still produces `pornLoop`, `pressurePattern`, and `controlTiming` patterns and legacy recommendations.
- `TenDayResetState` counts up to ten completed date keys; it has no new attempt, baseline, violation, or assessment lifecycle.
- Pause and Arousal Control remain separate legacy state slices and routes; their records are not implicitly converted into Masturbation Sessions.
- The current journey may require Protection and proceeds toward separate Arousal Practice. Protect remains implemented but is deferred for new flows.
- The existing five tabs and `/reset/ten-day`, `/pause`, and `/exercises/arousal-control` routes remain unchanged.

## Future Runtime Validation

Before these types are accepted from forms, imported data, persisted JSON, or route parameters, future boundary validation must establish:

- Stable nonempty identities and valid timestamps with consistent chronology.
- Finite, nonnegative durations and intervals; progress within the declared day range, ratios from 0 through 1, average erection quality from 1 through 10, and integer session ratings from 1 through 10.
- Required fields for each lifecycle state and coherent pause intervals within their session.
- Source identity and deduplication for session-derived violations, including undone entries.
- Consistency of attempt history and identity, progress, baseline, completion timestamps, and assessment references.
- Atomic, acknowledged cross-system effects when one event affects both Reset and Content-Free.

No validators or transition functions for the new entities are added in Phase 1A. The established local-first persistence and runtime-validation approach remains in place. There is no new backend, authentication, sync metadata, analytics, or AI dependency.
