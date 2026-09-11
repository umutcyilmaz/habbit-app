# Product Spec

## Authority and Transitional Scope

This document is the source of truth for Bloom's new product model. It supersedes older descriptions of Protection, 10-Day Reset, and standalone Arousal Control as the primary product path. [DATA_MODEL.md](DATA_MODEL.md) defines the corresponding domain boundary.

Phase 1A introduced independent TypeScript models. Phase 1B adds their state containers alongside all legacy `BloomLocalState` slices and upgrades validated local persistence to v3. Migration adds only inactive/empty new defaults; it does not reinterpret legacy user behavior. Existing routes, screens, shared components, onboarding scoring, journey routing, and durable acknowledgement behavior remain in place. The new slices have no feature mutation APIs or UI yet.

Phase 1C adds a separate pure onboarding quiz/scoring engine under `src/domain/onboarding/`. It returns a starting hypothesis and preserves raw answers; it does not replace the legacy quiz, persist new onboarding results, route users, or start features.

Phase 1D persists that complete result in `productOnboarding` alongside legacy onboarding, using persistence v4. Saving a recommendation does not accept or activate it. No existing screen or provider action uses the new save mutation yet.

Phase 1E adds explicit recommendation acceptance as a pure state transition, with a persisted v5 acceptance marker. It remains separate from saving the quiz result and is not connected to screens, providers, or routing.

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

## Onboarding Starting Hypothesis

The new onboarding engine describes five dimensions:

- `contentDysregulation`
- `erectionResponseConcern`
- `stimulationPattern`
- `safetyFlag`
- `recommendationConfidence`

These are not aliases for existing PL/PP/CT/FC scores. The legacy engine, quiz screens, results, and persisted onboarding data remain unchanged. The separate 12-question quiz uses provisional, deterministic scoring documented in [the onboarding domain guide](../src/domain/onboarding/README.md).

The recommendation identifiers are `masturbation_tracking`, `content_free`, `reset`, and `reset_and_content_free`. The first three dimensions use low/medium/high, with uncertain for insufficient known inputs. Low, medium, or uncertain recommendation confidence returns Masturbation Tracking first so real behavioral data can be collected.

| Content dysregulation | Reset eligibility | Candidate recommendation |
| --- | --- | --- |
| Not high | No | `masturbation_tracking` |
| High | No | `content_free` |
| Not high | Yes | `reset` |
| High | Yes | `reset_and_content_free` |
| Any | Any | Return `masturbation_tracking` when recommendation confidence is low, medium, or uncertain. |

Reset eligibility requires **both** high erection-response concern and high stimulation pattern. Content dysregulation uses Q2–Q6, with stronger weights for Q4/Q6 and at least two strong signals for high. Q6 never-tried is unknown, not zero. Q7/Q8/Q11 inform response concern; Q10 dependency outweighs Q9 technique choices. Techniques alone never trigger Reset. Q1 frequency is context only; Q12 safety changes reported context only. Neither affects recommendation confidence or Reset eligibility. These thresholds are product heuristics, not a diagnosis, problem score, medical explanation, or validated assessment. No route or feature action is invoked.

`productOnboarding` starts as `{ status: "notCompleted", result: null }`. A completed record retains raw answers, versions, all derived fields, internal evidence, and the result's completion timestamp, with `planAcceptance: null` until explicitly accepted. Stored derived values are historical facts: loading validates their structure without running today's scorer. Future re-scoring must be explicit and use the retained raw answers.

Saving this record changes only `productOnboarding`. It does not change legacy onboarding or `activePlan`, enable Masturbation Tracking, activate Content-Free, start Reset, create a baseline or activation, or alter Urge Control or Protect. Once accepted, saves cannot overwrite the result and erase its acceptance; retakes remain future work.

Explicit acceptance records the stored recommendation and caller-supplied `acceptedAt`, then prepares its starting state. Tracking acceptance enables Tracking without creating a session. Content-Free acceptance activates Content-Free immediately with a supplied activation ID and starts its streak. Reset acceptance creates a supplied journey ID in `baseline_pending`, with no start time, baseline, or attempt: the 15-day restriction has not begun. Combined acceptance prepares Reset and activates Content-Free atomically. Tracking remains disabled for Content-Free and Reset starting strategies; a later post-Reset transition will enable it.

Initial acceptance requires an inactive Reset and no unfinished session; non-tracking recommendations also require disabled Tracking. Active Content-Free cannot be replaced by a new activation. Existing histories and best values are retained, and unrelated active Content-Free remains unchanged. Invalid input or conflicting state is a no-op. Repeating acceptance retains the original time and identities. Full preconditions are specified in [DATA_MODEL.md](DATA_MODEL.md#explicit-acceptance). No legacy flow, UI, or route is changed.

## Compatibility Gaps Intentionally Retained

| Existing implementation | Target model / later work |
| --- | --- |
| `pornLoop`, `pressurePattern`, `controlTiming`, and legacy quiz recommendations | New dimensions, confidence, and four recommendation identifiers; scoring replacement is deferred. |
| `TenDayResetState`, 10 completed dates, and daily completion actions | 15-day journey with attempts, violations, baseline, and assessment; calculation and migration are deferred. |
| Protection-dependent journey decisions | Protect is deferred and is not required by new flows. Existing decisions still run until routing is deliberately changed. |
| Separate Pause and Arousal Control drafts/logs | Normal Masturbation Sessions with optional timed pauses, plus the separate acute Urge Control tool. No automatic reinterpretation of legacy records. |
| Existing Arousal flow can start without a Reset restriction | The future Masturbation Session start guard applies during active Reset. No existing start action changes in Phase 1B. |
| Content-Free supports initial activation through explicit plan acceptance | Violation, correction, and streak calculations remain deferred. |
| Transitional `BloomLocalState` and version-5 persistence | V4 results gain null acceptance without inference from feature state. Older migrations remain supported, preserving their existing facts and safe defaults. |
| Five current tabs and `/reset/ten-day`, `/pause`, and Arousal routes | Keep Expo Router and all working routes now; new navigation is outside Phase 1B. |

## Out of Scope for the Transitional Foundation

No UI redesign, Figma implementation, new screens, deleted flows, Protect changes, legacy onboarding replacement, navigation changes, Reset baseline completion/restriction start, session or violation mutations, post-Reset Tracking enablement, tracking-based Reset recommendations, backend, authentication, analytics, AI, or speculative framework is part of Phase 1E. Further phases require a separate task.
