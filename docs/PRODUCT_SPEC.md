# Product Spec

## Authority and Phase 1A Scope

This document is the source of truth for Bloom's new product model. It supersedes older descriptions of Protection, 10-Day Reset, and standalone Arousal Control as the primary product path. [DATA_MODEL.md](DATA_MODEL.md) defines the corresponding domain boundary.

Phase 1A updates product documentation and introduces independent TypeScript models only. The running app still implements the older model. Existing routes, screens, shared components, onboarding scoring, `BloomLocalState`, storage validation, durable persistence acknowledgements, and verification tooling remain in place. New types are not persisted or wired into those flows yet.

The Expo Router architecture and local-first approach remain technical constraints. Older inventories in [ARCHITECTURE.md](ARCHITECTURE.md) and product references in [DECISIONS.md](DECISIONS.md) describe earlier stages; they do not require a new flow to depend on Protect. Existing navigation remains unchanged in this phase.

## Product Summary

Bloom is a private sexual-wellness and habit-awareness app for adults. It supports intentional choices about masturbation and explicit content through three primary systems:

1. **Masturbation Tracking:** observe actual masturbation sessions and personal patterns.
2. **Content-Free:** choose a period without intentional explicit-content use.
3. **15-Day Reset:** take a time-limited break, retain a baseline, and reflect afterward.

**Urge Control** is an acute support tool available alongside these systems. **Protect** is deferred; its existing code remains intact, but it is not a required dependency for any new flow.

Arousal Control is no longer a separate top-level program in the target model. Optional pause/arousal-control behavior belongs inside a normal Masturbation Session. Existing standalone Arousal Control and Pause flows remain working during this transition.

## Principles and Tone

- Masturbation is not inherently a problem. Frequency alone must not define a problem or determine a recommendation.
- Users can choose tracking without choosing abstinence from masturbation or explicit content.
- Content-Free streaks and Reset progress describe a chosen commitment, not a person's worth, health, or performance.
- A restart is a neutral record of behavior, not punishment or a shame-based failure state.
- Reflection and safety information must avoid diagnosis, treatment claims, promised recovery, or medical interpretation of self-reports.
- Language should be calm, private, mature, clear, and non-judgmental. Avoid alarmist labels, competitive scores, surveillance framing, and claims of cure.
- Keep sensitive records local by default. Privacy, deletion, and discreet notifications remain core trust boundaries. Do not introduce analytics or transmit sensitive data in this phase.

## Masturbation Tracking

Masturbation Tracking is the system; a **Masturbation Session** is one tracked masturbation event.

A session moves from `active` to `awaiting_feedback` after the activity ends, then to `completed` after feedback is recorded. It records identity, start/end timestamps, duration, erection quality, intentional explicit-content use, ending reason, and any pauses. Completed erection quality uses a self-reported integer from 1 to 10, without interpreting that value medically.

Ending reasons can include climax, stopping before climax, decreased firmness, anxiety, choosing to stop, or another reason. Completion of a record does not require climax.

Pause is optional. A session with no pauses is valid. Each pause can retain its own timing; pause count comes from the pauses rather than a second independent counter. Pause/arousal-control is a tool inside the session, not a prerequisite or a separate program to complete first.

`usedExplicitContent` means intentional use during the session. Accidental exposure alone does not set it to true. A completed session with intentional explicit-content use can be the source of a Content-Free violation, but the same session must not generate duplicate violations when it is saved, retried, or revisited.

## Content-Free

Content-Free is independent of Masturbation Tracking and Reset. It can coexist with either.

Its state records whether it is active, the current streak start, best streak, and intentional explicit-content violations. Event history must support undoing an accidental violation-log action and restoring the correct streak information.

- Intentional explicit-content use breaks an active Content-Free streak.
- Masturbation without intentional explicit content does not break Content-Free.
- Accidental exposure does not automatically count as a violation.
- Undo corrects a mistaken log. It does not erase a Masturbation Session or create an event claiming the opposite behavior.
- A violation originating from a Masturbation Session retains that session's identity so future mutation logic can deduplicate it. Standalone logs retain their own stable identity.

Streak calculations, logging actions, undo operations, and durable cross-entity updates are future implementation work. Phase 1A only provides the data boundary needed to implement them safely.

## 15-Day Reset

The target Reset lasts **15 days**, replacing the old conceptual 10-Day Reset. Its lifecycle is:

| State | Meaning |
| --- | --- |
| `inactive` | No Reset is underway or being prepared. |
| `recommended` | Reset has been suggested but has not started. |
| `baseline_pending` | A pre-reset baseline is being prepared; Reset has not started. |
| `active` | The current 15-day attempt is underway. Starting a Masturbation Session is blocked. |
| `assessment_pending` | The 15-day Reset period has ended; the post-reset assessment has not been submitted. |
| `completed` | The Reset period has ended and its post-reset assessment is recorded. |

A journey retains its start, current attempt, best completed progress, violations, pre-reset baseline snapshot, and completion timestamp. Restarting changes the attempt rather than rewriting the original baseline or forgetting prior violations.

The intended end-of-reset flow offers the assessment, then returns to Masturbation Tracking. **The restriction ends after 15 days.** An unanswered assessment or a readiness answer must not extend it. Tracking is therefore available in `assessment_pending` as well as `completed`. This is the Phase 1A interpretation of assessment timing; readiness is feedback, not an access flag.

### Restart Rules

| Behavior | Active Reset | Active Content-Free |
| --- | --- | --- |
| Masturbation without intentional explicit content | Restart from Day 1. | Unaffected. |
| Intentional explicit-content use without masturbation | Restart from Day 1. | Restart the streak. |
| Masturbation with intentional explicit-content use | Restart from Day 1 once for the event. | Restart the streak once for the event. |
| Accidental explicit-content exposure alone | Does not automatically restart. | Does not automatically restart. |

Blocking the in-app start action does not imply masturbation outside the app cannot happen. The future model must still allow reporting that behavior and applying the appropriate restart rule. A combined behavior event must not create two Reset restarts or duplicate Content-Free violations.

This phase does not implement day arithmetic, start guards, restarts, or tracking access changes. Whether day boundaries use elapsed time or local calendar days, including timezone/DST behavior, must be resolved with future calculation and validation work rather than implied by these types.

## Reset Baseline and Post-Reset Assessment

**ResetBaseline** is a snapshot of available pre-reset information. It can retain average interval between sessions, average self-reported erection quality, and the proportion of sessions with intentional explicit content. Unknown aggregates remain absent; no observations is not equivalent to a measured zero.

The baseline also supports self-reports about urge intensity, ability to pause or delay acting, and perceived spontaneous or morning erections. Unknown or declined responses must not be interpreted as the absence of a concern.

**PostResetAssessment** records perceived changes in urge intensity, ability to pause, spontaneous erections, and overall sexual response, plus readiness to restart tracking. These are subjective answers, not clinical outcomes or evidence that Reset caused a change. Readiness never gates tracking access.

No numeric score thresholds, diagnosis, guaranteed benefit, or medical interpretation is defined here.

## Urge Control

Urge Control provides acute support:

Urge starts → short interrupt → coping technique → phone-away period → outcome → trigger → optional second-line action.

An **UrgeControlEvent** records its identity, start/completion, technique, outcome, trigger, and optional second-line action. Its data can represent progress before completion. Exact durations and screen sequencing are future flow work.

Techniques:

- `changeEnvironment`
- `grounding54321`
- `cognitiveTask`
- `urgeSurfing`
- `personalReminder`

Outcomes include reduced, still strong, unchanged, or stronger urges. A completed event means the interaction was recorded; it does not require the urge to have decreased.

Triggers include boredom, stress, loneliness, sleeplessness/nighttime, sexual desire, automatic habit, and not being sure. Sexual desire by itself is not a diagnosis or failure.

Optional second-line actions are putting the phone in another room, doing another task, or messaging a support person. This is a record of a user's choice, not authorization for the app to contact someone automatically.

## Future Onboarding Model

Onboarding should conceptually describe five dimensions:

- `contentDysregulation`
- `erectionResponseConcern`
- `stimulationPattern`
- `safetyFlag`
- `recommendationConfidence`

These are target dimensions, not aliases for existing PL/PP/CT/FC scores. The current scoring engine, quiz questions, results, and persisted onboarding data remain unchanged in Phase 1A. No conversion or new scoring algorithm is introduced.

The future recommendation identifiers are `masturbation_tracking`, `content_free`, `reset`, and `reset_and_content_free`. Low, medium, or uncertain recommendation confidence should prefer Masturbation Tracking first so real behavioral data can be collected.

| Content dysregulation | Erection/stimulation concern | Conceptual recommendation |
| --- | --- | --- |
| Low | Low | `masturbation_tracking` |
| High | Low | `content_free` |
| Low | Significant | `reset` |
| High | Significant | `reset_and_content_free` |
| Any | Any | Prefer `masturbation_tracking` when recommendation confidence is low, medium, or uncertain; collect real behavioral data first. |

This table is a direction for future work, not executable routing or a validated assessment. Meanings and thresholds of low, high, and significant remain to be specified. Frequency alone must not define a problem. Safety flags carry reported context without inventing diagnoses or a new safety-routing policy.

## Compatibility Gaps Intentionally Retained

| Existing implementation | Target model / later work |
| --- | --- |
| `pornLoop`, `pressurePattern`, `controlTiming`, and legacy quiz recommendations | New dimensions, confidence, and four recommendation identifiers; scoring replacement is deferred. |
| `TenDayResetState`, 10 completed dates, and daily completion actions | 15-day journey with attempts, violations, baseline, and assessment; calculation and migration are deferred. |
| Protection-dependent journey decisions | Protect is deferred and is not required by new flows. Existing decisions still run until routing is deliberately changed. |
| Separate Pause and Arousal Control drafts/logs | Normal Masturbation Sessions with optional timed pauses, plus the separate acute Urge Control tool. No automatic reinterpretation of legacy records. |
| Existing Arousal flow can start without a Reset restriction | The future Masturbation Session start guard applies during active Reset. No existing start action changes in Phase 1A. |
| No Content-Free state or violation relationship | Add independent Content-Free behavior and deduplication in a later phase. |
| Legacy `BloomLocalState` and version-2 normalization | New models remain outside persisted state until explicit validation, migration, deletion, and acknowledgement integration are designed. |
| Five current tabs and `/reset/ten-day`, `/pause`, and Arousal routes | Keep Expo Router and all working routes now; new navigation is outside Phase 1A. |

## Out of Scope for Phase 1A

No UI redesign, Figma implementation, new screens, deleted flows, Protect changes, onboarding scoring replacement, navigation changes, persistence migration, backend, authentication, analytics, AI, or speculative framework is part of this phase. Phase 1B requires a separate task.
