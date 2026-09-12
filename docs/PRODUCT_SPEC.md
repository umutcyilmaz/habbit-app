# Product Spec

## Authority and Transitional Scope

This document is the source of truth for Bloom's new product model. It supersedes older descriptions of Protection, 10-Day Reset, and standalone Arousal Control as the primary product path. [DATA_MODEL.md](DATA_MODEL.md) defines the corresponding domain boundary.

Phase 1A introduced independent TypeScript models. Phase 1B adds their state containers alongside all legacy `BloomLocalState` slices and upgrades validated local persistence to v3. Migration adds only inactive/empty new defaults; it does not reinterpret legacy user behavior. Existing routes, screens, shared components, onboarding scoring, journey routing, and durable acknowledgement behavior remain in place. Phase 1B added no feature mutation APIs or UI.

Phase 1C adds a separate pure onboarding quiz/scoring engine under `src/domain/onboarding/`. It returns a starting hypothesis and preserves raw answers; it does not replace the legacy quiz, persist new onboarding results, route users, or start features.

Phase 1D persists that complete result in `productOnboarding` alongside legacy onboarding, using persistence v4. Saving a recommendation does not accept or activate it. No existing screen or provider action uses the new save mutation yet.

Phase 1E adds explicit recommendation acceptance as a pure state transition, with a persisted v5 acceptance marker. It remains separate from saving the quiz result and is not connected to screens, providers, or routing.

Phase 1F completes the supplied pre-reset baseline and starts the 15-day attempt through a pure transition. Progress derives from elapsed time; persistence v6 removes the active day counter. No screens, providers, routes, or legacy behavior are connected or changed.

Phase 1G records an active Reset violation and restarts its attempt, atomically restarting an active Content-Free streak when intentional explicit content is involved. It writes existing v6 shapes; the persistence version and migrations remain unchanged.

Phase 1H corrects the latest mistaken Reset violation through explicit atomic undo. V7 persistence retains recorded/undone Reset violations and prior-best rollback data for new logs. No screen, navigation, or legacy behavior changes.

Phase 1I explicitly records elapsed Reset completion and the post-reset assessment. The assessment submission enables Masturbation Tracking in the onboarding Reset flow. These transitions use existing v7 shapes without changing persistence, migrations, UI, navigation, or legacy behavior.

Phase 1J adds the pure Masturbation Session lifecycle: start, optional pause/resume, physical end, feedback completion, and active-only discard. Explicit-content feedback applies the required Content-Free change atomically. The v7 schema/key and existing flows remain unchanged.

Phase 1K adds standalone Content-Free activation, deactivation, manual intentional-content logging, latest safe manual undo, and pure streak progress. The existing v7 model/key, migrations, UI, navigation, and legacy flows remain unchanged.

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

At most one unfinished session is allowed. Starting requires enabled Tracking and no current session; an `active` Reset blocks starting. No direct onboarding check is required. The active timer derives from its start timestamp even across app close/background, with no ticking persisted counter. Ended durations use whole nonnegative elapsed seconds and include pause time. Only one pause may be active, and ending the session closes that pause at the session end time.

Physical end produces `awaiting_feedback`, which survives reload and continues to block another start. Full feedback appends the session once to completed history and clears the unfinished slot; it can finish even if Tracking was subsequently disabled. Existing history is preserved. Active-only discard clears the unfinished slot without any history record or event. Awaiting feedback cannot be discarded, and completed editing/deletion remains deferred.

`usedExplicitContent` means intentional use during the session. Accidental exposure alone does not set it to true. Explicit-content feedback may atomically complete the session and break an applicable active Content-Free streak. The source is the same session ID, including for retry protection; no Reset violation is created from session feedback in this phase.

## Content-Free

Content-Free is independent of Masturbation Tracking and Reset. It can coexist with either.

Its state records whether it is active, the current streak start, best streak, and intentional explicit-content violations. Event history must support undoing an accidental violation-log action and restoring the correct streak information.

- Intentional explicit-content use breaks an active Content-Free streak.
- Masturbation without intentional explicit content does not break Content-Free.
- Accidental exposure does not automatically count as a violation.
- Undo corrects a mistaken log. It does not erase a Masturbation Session or create an event claiming the opposite behavior.
- A violation originating from a Masturbation Session retains that session's identity for deduplication. Standalone logs retain their own stable identity.

Phase 1G introduced Content-Free violations as part of the active Reset transition. Intentional explicit content restarts the current streak while Content-Free stays active, preserving its activation and history. The ended streak can increase the best duration, and the record retains the previous streak start and original best duration. Phase 1H uses that snapshot only when safely undoing the linked latest Reset event; both violations remain as undone history. Recorded and undone source identities prevent stale retries; arbitrary historical replay and same-day calendar collapse remain deferred.

Phase 1J also applies Content-Free at session feedback completion. `session.endedAt` is the V1 event anchor, not a claim about the exact first instant of explicit-content use; feedback supplies the later recording time. If Content-Free is inactive or its current activation began after the session ended, the session completes without affecting it. Otherwise intentional-content feedback requires a violation ID and atomically appends one session-sourced violation, preserves the original streak snapshot, updates best duration, and restarts the streak at session end. Content-Free remains active with its activation/history retained. A missing ID, existing recorded or undone source, or unsafe event before the current streak start leaves both systems unchanged.

Content-Free can also be enabled or disabled manually, independently of Tracking and Reset. Disabling records the completed activation and retains best streak and all violations. Reactivation uses a new identity/time and starts a separate streak after the previous activation ended. It does not merge periods or erase history.

Standalone manual logs represent intentional explicit-content use and use a stable `logActionId`. An occurrence can be recorded later if it falls within the current effective streak; the new streak starts at occurrence time. Earlier historical insertion is rejected. While Reset status is `active`, manual Content-Free logging is blocked: the atomic Reset violation path must handle that event. Activation/deactivation themselves do not change Reset.

Standalone undo corrects only the latest safely reversible manual event in the same active activation. It restores the prior streak snapshot and retains an undone tombstone, keeping its source consumed against stale retries. Session-derived and Reset-linked events cannot be undone by this action. Later effective activity or a changed activation causes a no-op; arbitrary history editing remains deferred.

Progress derives from timestamps in whole nonnegative seconds and full 24-hour days without ticking stored counters. Effective best includes a growing current streak even before a later event persists that duration. Only recorded violations count toward `hasEffectiveViolation`; corrected mistakes alone do not count as a real streak break. Inactive state has historical best without a fabricated current streak. Distinct events on one date are not collapsed until timezone/calendar semantics are modeled.

## 15-Day Reset

The target Reset lasts **15 days**, replacing the old conceptual 10-Day Reset. Its lifecycle is:

| State | Meaning |
| --- | --- |
| `inactive` | No Reset is underway or being prepared. |
| `recommended` | Reset has been suggested but has not started. |
| `baseline_pending` | A pre-reset baseline is being prepared; Reset has not started. |
| `active` | An attempt has started. Elapsed time determines whether its 15-day period is still underway; explicit completion records its end. |
| `assessment_pending` | The 15-day Reset period has ended; assessment is outstanding and Tracking remains disabled in the onboarding Reset flow. |
| `completed` | The assessment is recorded and its submission has enabled Tracking. |

A journey retains its start, current attempt, best completed progress, violations, pre-reset baseline snapshot, and completion timestamp. Restarting changes the attempt rather than rewriting the original baseline or forgetting prior violations.

**The behavioral restriction ends after 15 full 24-hour days.** Assessment does not extend that period. In the onboarding Reset flow, Tracking remains disabled in `assessment_pending` and becomes enabled when the assessment is submitted. Every valid readiness answer (`ready`, `notReady`, or `notSure`) enables Tracking; readiness describes the user's experience and does not decide permission.

### Restart Rules

| Behavior | Active Reset | Active Content-Free |
| --- | --- | --- |
| Masturbation without intentional explicit content | Restart from Day 1. | Unaffected. |
| Intentional explicit-content use without masturbation | Restart from Day 1. | Restart the streak. |
| Masturbation with intentional explicit-content use | Restart from Day 1 once for the event. | Restart the streak once for the event. |
| Accidental explicit-content exposure alone | Does not automatically restart. | Does not automatically restart. |

These restart rules apply only while the current attempt's 15-day period is incomplete at the event's `occurredAt`. At or after 15 full elapsed days, the entire violation transition is a no-op, even if persisted status is still `active`. Explicit completion records the period's end; a late violation cannot extend it.

A valid violation archives the old attempt with its elapsed completed-day count (0–14), appends one linked violation, and starts a new attempt at the event time. The same journey remains active with its original journey start, baseline, previous attempts, and violations. Best Reset progress becomes the greater of the existing best and the archived attempt's progress. No onboarding or baseline step is repeated.

Masturbation alone leaves Content-Free unchanged. Content-involved events affect Content-Free only when it is already active: one violation shares the Reset event's source identity, and the streak restarts without a new activation. All required IDs and timestamps are supplied explicitly. Invalid input, conflicting IDs, a repeated source identity, or an event before the current attempt or affected Content-Free streak start leaves the entire state unchanged. Reset and Content-Free changes form one atomic snapshot; the transition itself does not write storage.

Reporting a Reset violation does not create a Masturbation Session. The separate session start transition blocks while Reset status is `active`. Source identity (`logActionId` for manual events or `sessionId` for session events) prevents applying the same behavior twice, including retries with new record IDs after undo.

### Correcting a mistaken violation

Explicit undo restores the previous active Reset attempt with its original ID and start time, removes the false restart archive, and keeps the violation as an undone tombstone. It preserves the journey's identity/start, baseline, earlier history, and onboarding acceptance. Elapsed progress again uses the restored attempt start; no session, baseline, or completion is created.

Undo is limited to the latest effective restart with a provable relationship to the current attempt. New logs capture prior best progress so rollback can retain historical summaries that are not represented by individual attempts. Older records without that fact can be undone only when the previous best is uniquely recoverable; ambiguous cases are no-ops.

Masturbation-only undo leaves Content-Free unchanged. For a linked content event, Content-Free must still have the same active activation and the target must remain its latest effective streak break. Both streak fields are restored from the original snapshot, and both violation records become undone in one transaction. If Content-Free was unaffected, a later unrelated activation remains unchanged. Missing or contradictory links, later effective activity, or a changed activation reject the entire undo. Full safeguards are in [DATA_MODEL.md](DATA_MODEL.md#undoing-the-latest-violation).

Newer events can be undone first, then earlier events when both systems remain safely reversible. Repeating undo preserves the first undo timestamp; a stale retry cannot reapply an undone source. A genuinely new behavior needs a new source identity. Arbitrary history editing and replay remain outside this phase.

Reset starts only when its baseline is completed. The caller supplies the baseline, attempt ID, and one start timestamp used for both journey and attempt. Repeating the start is a no-op. Existing history and best progress are preserved, while Content-Free, Tracking, onboarding acceptance, and legacy systems remain unchanged.

Progress advances with elapsed time even when the app is closed. Each day is a full 24 hours from the current attempt's start; users do not complete days manually. Before 24 hours progress is 0 completed days / Day 1, at 24 hours it is 1 / Day 2, and at 15 full days it is 15 completed days with the period complete. Progress clamps safely between 0 and 15. Local calendar dates and timezone/DST changes do not affect these durations.

The selector reports period completion without changing persisted status. Loading, hydration, validation, and migration do not automatically complete or undo Reset. An explicit completion transition accepts a supplied observation time at or after the boundary and moves `active` to `assessment_pending`. Journey and final attempt `completedAt` equal the current attempt's start plus exactly 15 full days, even when completion is observed later. A September 1, 10:00 start ends September 16, 10:00 even if the next observation is September 18.

Elapsed completion preserves the journey's original start, baseline, prior attempts, violations/tombstones, and independent Content-Free state. The final completed attempt remains `currentAttempt`, and best progress becomes 15. It creates no assessment or session and leaves Tracking unchanged, so onboarding Tracking remains disabled. Invalid or early observation times and repeated completion calls are no-ops.

## Reset Baseline and Post-Reset Assessment

**ResetBaseline** is a snapshot of available pre-reset information. It can retain average interval between sessions, average self-reported erection quality, and the proportion of sessions with intentional explicit content. Unknown aggregates remain absent; no observations is not equivalent to a measured zero.

The baseline also supports self-reports about urge intensity, ability to pause or delay acting, and perceived spontaneous or morning erections. Unknown or declined responses must not be interpreted as the absence of a concern.

A user starting directly from onboarding may supply only these self-reports, an ID, and capture time. Phase 1F validates known aggregates without computing them from session history. Tracking-off periods and observation windows must be modeled before that calculation can be trustworthy. The start timestamp must be at or after capture time; timestamps are not rewritten.

**PostResetAssessment** records perceived changes in urge intensity, ability to pause, spontaneous erections, and overall sexual response, plus readiness to restart tracking. These are subjective answers, not clinical outcomes or evidence that Reset caused a change. Readiness never gates tracking access.

A valid assessment submission moves `assessment_pending` to `completed`, stores the supplied answers, and enables Tracking for every readiness value. It must identify the same journey, final attempt, and baseline, with a canonical submission time at or after the Reset period ended. An unexpected unfinished session makes the whole action a no-op. Session history, Reset history, Content-Free, onboarding, and legacy state are preserved. Repeated submissions cannot replace the stored assessment or change either completion timestamp.

Baseline/assessment reports, future post-Reset session comparisons, and tracking-based Reset recommendations remain deferred. These Reset completion transitions generate no report, comparison score, medical interpretation, or session.

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

Explicit acceptance records the stored recommendation and caller-supplied `acceptedAt`, then prepares its starting state. Tracking acceptance enables Tracking without creating a session. Content-Free acceptance activates Content-Free immediately with a supplied activation ID and starts its streak. Reset acceptance creates a supplied journey ID in `baseline_pending`, with no start time, baseline, or attempt: the 15-day restriction has not begun. Combined acceptance prepares Reset and activates Content-Free atomically. Tracking remains disabled for Content-Free and Reset starting strategies. For the onboarding Reset path, assessment submission enables it after the elapsed period ends.

Initial acceptance requires an inactive Reset and no unfinished session; non-tracking recommendations also require disabled Tracking. Active Content-Free cannot be replaced by a new activation. Existing histories and best values are retained, and unrelated active Content-Free remains unchanged. Invalid input or conflicting state is a no-op. Repeating acceptance retains the original time and identities. Full preconditions are specified in [DATA_MODEL.md](DATA_MODEL.md#explicit-acceptance). No legacy flow, UI, or route is changed.

## Compatibility Gaps Intentionally Retained

| Existing implementation | Target model / later work |
| --- | --- |
| `pornLoop`, `pressurePattern`, `controlTiming`, and legacy quiz recommendations | New dimensions, confidence, and four recommendation identifiers; scoring replacement is deferred. |
| `TenDayResetState`, 10 completed dates, and daily completion actions | The new 15-day journey starts from a baseline and derives elapsed progress. Legacy daily actions remain separate. |
| Protection-dependent journey decisions | Protect is deferred and is not required by new flows. Existing decisions still run until routing is deliberately changed. |
| Separate Pause and Arousal Control drafts/logs | Normal Masturbation Sessions with optional timed pauses, plus the separate acute Urge Control tool. No automatic reinterpretation of legacy records. |
| Existing Arousal flow can start without a Reset restriction | The new Masturbation Session start transition blocks active Reset; existing legacy start actions remain unchanged. |
| Content-Free supports manual activation/deactivation, standalone logging/undo, Reset-linked events, session-derived violations, and timestamp progress | Session-derived correction, arbitrary historical replay, and same-day calendar collapse remain deferred. |
| Transitional `BloomLocalState` and version-7 persistence | Old Reset violations become recorded without invented undo or rollback facts. Earlier active-counter and onboarding migrations remain supported. |
| Five current tabs and `/reset/ten-day`, `/pause`, and Arousal routes | Keep Expo Router and all working routes now; new navigation is outside Phase 1B. |

## Out of Scope for the Transitional Foundation

No UI redesign, Figma implementation, new screens, deleted flows, Protect changes, legacy onboarding replacement, navigation changes, completed-session editing/deletion, awaiting-feedback deletion, session-derived Content-Free undo, Reset violations from session feedback, Urge Control behavior, arbitrary history editing, same-day calendar collapse, post-Reset reports/comparisons, tracking-based Reset recommendations, backend, authentication, analytics, AI, or speculative framework is part of Phase 1K. Further phases require a separate task.
