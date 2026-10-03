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

Phase 1I originally introduced elapsed Reset completion followed by a post-reset assessment. Phase 1V supersedes that lifecycle: 15 days → completed, with no new assessment or automatic Tracking enablement. Historical assessments remain readable and valid legacy `assessment_pending` data normalizes to completed within v7 / `bloom.localState.v7`.

Phase 1J adds the pure Masturbation Session lifecycle: start, optional pause/resume, physical end, feedback completion, and active-only discard. Explicit-content feedback applies the required Content-Free change atomically. The v7 schema/key and existing flows remain unchanged.

Phase 1K adds standalone Content-Free activation, deactivation, manual intentional-content logging, latest safe manual undo, and pure streak progress. The existing v7 model/key, migrations, UI, navigation, and legacy flows remain unchanged.

Phase 1L adds completed-session feedback editing and deletion, atomically reconciling safely reversible session-derived Content-Free effects. Session timing and pause history are immutable. Existing v7 shapes and persistence remain unchanged; historical replay and UI integration are outside this phase.

Phase 1M adds the pure Urge Control lifecycle and timestamp-derived resume progress. Existing models, v7 persistence, migrations, UI, navigation, and legacy flows remain unchanged.

Phase 1N adds manual Tracking controls and shared product-policy selectors. Session starts and standalone Content-Free logging use the effective Reset restriction at their event time. Existing models, v7 persistence, UI, providers, navigation, and legacy flows remain unchanged; Home integration is deferred.

Phase 1O adds the separate pure Home read model for the new product. It selects semantic action priority and tracker order from current product facts without changing UI, providers, navigation, legacy Today/next-action behavior, or v7 persistence.

Phase 1W aligns only current Reset baseline questions and canonical Tracking snapshots. It preserves Phase 1V direct completion, persistence v7 / `bloom.localState.v7`, legacy behavior, and the existing screen styling; visual redesign, recommendations, Urge Control work, and new Home cutover remain deferred.

Phase 1Y changes new Urge Control events to a versioned interrupt → outcome → optional multi-trigger → complete lifecycle, while preserving historical v7 events and their resumable guided steps. No Panic route, Figma screen, Home cutover, or second intervention is added.

Phase 1Z makes Panic entry and current/legacy Urge resume executable using simple shared components and durable-save navigation. It preserves domain lifecycles, Behavior Slip rules, persistence v7, Home priority, and bottom tabs. Final V4 visuals and the second intervention remain deferred.

Phase 2A adds only a deterministic Tracking-based Reset recommendation selector. It is a derived domain read, with no screen, Home action changes, command, lifecycle mutation, or persisted recommendation. Both recommendation routes remain pending.

Phase 2B exposes that unchanged derived result as optional advice in the product Home read model and makes Reset recommendation review/acceptance executable. Advice never replaces normal Tracking as the primary action. Explicit acceptance prepares only `baseline_pending`; the existing four baseline questions must still be answered before Reset starts. Legacy Today and bottom tabs remain unchanged.

The Expo Router architecture and local-first approach remain technical constraints. Older inventories in [ARCHITECTURE.md](ARCHITECTURE.md) and product references in [DECISIONS.md](DECISIONS.md) describe earlier stages; they do not require a new flow to depend on Protect. Existing navigation remains unchanged in this phase.

## Product Summary

Bloom is a private sexual-wellness and habit-awareness app for adults. It supports intentional choices about masturbation and explicit content through three primary systems:

1. **Masturbation Tracking:** observe actual masturbation sessions and personal patterns.
2. **Content-Free:** choose a period without intentional explicit-content use.
3. **15-Day Reset:** take a time-limited break and retain a baseline and attempt history.

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

At most one unfinished session is allowed. Starting requires enabled Tracking, no current session, and no effective Reset restriction at the supplied session start time. Exactly 15 full days after the current Reset attempt began, persisted `active` status alone no longer blocks starting. No direct onboarding check is required. The active timer derives from its start timestamp even across app close/background, with no ticking persisted counter. Ended durations use whole nonnegative elapsed seconds and include pause time. Only one pause may be active, and ending the session closes that pause at the session end time.

Tracking may be manually enabled or disabled without deleting history or changing another feature. Disabling preserves an active session or awaiting feedback so existing lifecycle actions can still end, finish, or explicitly discard the active physical session. It blocks new sessions. Manual enable is allowed only with Reset `inactive`, `recommended`, or `completed`; `baseline_pending` and `active` reject it, even after an active attempt's 15 days have elapsed. This existing manual-enable rule is separate from the elapsed behavioral restriction. Recording Reset completion does not change the Tracking preference.

Physical end produces `awaiting_feedback`, which survives reload and continues to block another start. Full feedback appends the session once to completed history and clears the unfinished slot; it can finish even if Tracking was subsequently disabled. Existing history is preserved. Active-only discard clears the unfinished slot without any history record or event. Awaiting feedback cannot be discarded.

`usedExplicitContent` means intentional use during the session. Accidental exposure alone does not set it to true. Explicit-content feedback may atomically complete the session and break an applicable active Content-Free streak. The source is the same session ID, including for retry protection; no Reset violation is created from session feedback in this phase.

Completed sessions allow feedback replacement (`erectionQuality`, `usedExplicitContent`, and `endingReason`) or deletion, even when Tracking is disabled. Their identity, start/end times, duration, and pause timestamps/history cannot be edited in MVP. Correction actions never edit or delete the active/awaiting current session, change Tracking permission, or change another session. Identical feedback and repeated deletion are no-ops.

Quality/reason-only edits leave Content-Free unchanged. Changing explicit-content feedback reconciles any session-derived Content-Free effect in the same transaction. A false-to-true change outside all known activation periods changes feedback only. Inside the current activation it requires a safe event at the session end; inserting before later effective streak activity or into a completed past activation is refused until historical replay exists. A true-to-false change safely restores the linked event's prior streak snapshot and retains its identity as an undone record. Reapplying that same corrected event reuses its existing identity and event anchor only when the restored snapshot is still current.

Deletion removes the completed session from history and atomically undoes a linked recorded Content-Free effect only when safely reversible. An already-undone linked event remains as a tombstone; deletion does not overwrite its correction time. Later effective activity, a changed activation, or required historical recalculation rejects the whole correction. Any Reset violation or tombstone with the session source blocks explicit-content changes and deletion; quality/reason-only edits remain allowed. Session corrections never rewrite Reset history or use standalone manual Content-Free undo.

## Content-Free

Content-Free is independent of Masturbation Tracking and Reset. It can coexist with either.

Its state records whether it is active, the current streak start, best streak, and intentional explicit-content violations. Event history must support undoing an accidental violation-log action and restoring the correct streak information.

- Intentional explicit-content use breaks an active Content-Free streak.
- Masturbation without intentional explicit content does not break Content-Free.
- Accidental exposure does not automatically count as a violation.
- Standalone undo corrects a mistaken log without erasing a Masturbation Session. Session feedback edits and deletion own their derived event corrections atomically.
- A violation originating from a Masturbation Session retains that session's identity for deduplication. Standalone logs retain their own stable identity.

Phase 1G introduced Content-Free violations as part of the active Reset transition. Intentional explicit content restarts the current streak while Content-Free stays active, preserving its activation and history. The ended streak can increase the best duration, and the record retains the previous streak start and original best duration. Phase 1H uses that snapshot only when safely undoing the linked latest Reset event; both violations remain as undone history. Recorded and undone source identities prevent stale retries; arbitrary historical replay and same-day calendar collapse remain deferred.

Phase 1J also applies Content-Free at session feedback completion. `session.endedAt` is the V1 event anchor, not a claim about the exact first instant of explicit-content use; feedback supplies the later recording time. If Content-Free is inactive or its current activation began after the session ended, the session completes without affecting it. Otherwise intentional-content feedback requires a violation ID and atomically appends one session-sourced violation, preserves the original streak snapshot, updates best duration, and restarts the streak at session end. Content-Free remains active with its activation/history retained. A missing ID, existing recorded or undone source, or unsafe event before the current streak start leaves both systems unchanged.

Content-Free can also be enabled or disabled manually, independently of Tracking and Reset. Disabling records the completed activation and retains best streak and all violations. Reactivation uses a new identity/time and starts a separate streak after the previous activation ended. It does not merge periods or erase history.

Standalone manual logs represent intentional explicit-content use and use a stable `logActionId`. An occurrence can be recorded later if it falls within the current effective streak; the new streak starts at occurrence time. Earlier historical insertion is rejected. While Reset is effectively restricted at `occurredAt`, standalone logging is blocked so the atomic Reset violation path owns that event. At or after the current attempt's 15-day boundary, standalone logging may proceed under its Content-Free guards even if persisted Reset remains `active`. Logging and activation/deactivation never advance Reset automatically.

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
| `completed` | The elapsed 15-day period and final completed attempt have been recorded; no assessment is required. |

A journey retains its start, current attempt, best completed progress, violations, pre-reset baseline snapshot, and completion timestamp. Restarting changes the attempt rather than rewriting the original baseline or forgetting prior violations.

**The behavioral restriction ends after 15 full 24-hour days.** Reset temporarily blocks new session starts through that policy; it does not disable Tracking or alter a manual enabled/disabled preference. Recording completion does not enable Tracking. The old lifecycle was `15 days → assessment_pending → assessment → completed`; the current lifecycle is `15 days → completed`.

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

Reporting a Reset violation does not create a Masturbation Session. The separate session start transition checks effective Reset restriction at its supplied `startedAt`. Source identity (`logActionId` for manual events or `sessionId` for session events) prevents applying the same behavior twice, including retries with new record IDs after undo.

### Correcting a mistaken violation

Explicit undo restores the previous active Reset attempt with its original ID and start time, removes the false restart archive, and keeps the violation as an undone tombstone. It preserves the journey's identity/start, baseline, earlier history, and onboarding acceptance. Elapsed progress again uses the restored attempt start; no session, baseline, or completion is created.

Undo is limited to the latest effective restart with a provable relationship to the current attempt. New logs capture prior best progress so rollback can retain historical summaries that are not represented by individual attempts. Older records without that fact can be undone only when the previous best is uniquely recoverable; ambiguous cases are no-ops.

Masturbation-only undo leaves Content-Free unchanged. For a linked content event, Content-Free must still have the same active activation and the target must remain its latest effective streak break. Both streak fields are restored from the original snapshot, and both violation records become undone in one transaction. If Content-Free was unaffected, a later unrelated activation remains unchanged. Missing or contradictory links, later effective activity, or a changed activation reject the entire undo. Full safeguards are in [DATA_MODEL.md](DATA_MODEL.md#undoing-the-latest-violation).

Newer events can be undone first, then earlier events when both systems remain safely reversible. Repeating undo preserves the first undo timestamp; a stale retry cannot reapply an undone source. A genuinely new behavior needs a new source identity. Arbitrary history editing and replay remain outside this phase.

Reset starts only when the current four-question baseline form is complete. UI supplies semantic answers only. The flow prepares baseline/attempt IDs and one timestamp for capture/start; the pure transition derives the Tracking snapshot from current state and constructs the baseline. Repeating the start is a no-op. Existing journey history and best progress are preserved; Content-Free, Tracking, onboarding acceptance, and legacy systems remain unchanged.

Progress advances with elapsed time even when the app is closed. Each day is a full 24 hours from the current attempt's start; users do not complete days manually. Before 24 hours progress is 0 completed days / Day 1, at 24 hours it is 1 / Day 2, and at 15 full days it is 15 completed days with the period complete. Progress clamps safely between 0 and 15. Local calendar dates and timezone/DST changes do not affect these durations.

The selector reports period completion without changing persisted status. Loading, hydration, validation, and migration do not automatically finish active Reset or undo violations. Valid legacy `assessment_pending` records already contain completion facts and normalize to `completed`. Shared product policy distinguishes effective restriction from a pending completion transition: after 15 days an `active` journey needs that explicit transition while imposing no continued behavioral restriction. An explicit completion transition accepts a supplied observation time at or after the boundary and moves `active` directly to `completed`. Journey and final attempt `completedAt` equal the current attempt's start plus exactly 15 full days, even when completion is observed later. A September 1, 10:00 start ends September 16, 10:00 even if the next observation is September 18.

Tracking availability is a pure read model. Its deterministic start-block precedence is `trackingDisabled`, `activeSession`, `awaitingFeedback`, then `resetRestriction`; otherwise starting is allowed. If the user has disabled Tracking, that preference remains the blocker after Day 15 and after Reset completion. These selectors supply facts and capabilities without choosing Home cards, actions, routes, or screen copy, and without writing state.

Elapsed completion preserves the journey's original start, baseline, prior attempts, violations/tombstones, and independent Content-Free state. The final completed attempt remains `currentAttempt`, and best progress becomes 15. It creates no assessment or session and leaves Tracking unchanged: enabled stays enabled and disabled stays disabled. Invalid or early observation times and repeated completion calls are no-ops.

## Reset Baseline and Historical Assessment

**ResetBaseline** records four current self-reports: erection decline; needing stronger or faster stimulation; climax taking longer; and difficulty becoming aroused without intentional explicit sexual content. The current form starts unanswered and requires all four choices. [DATA_MODEL.md](DATA_MODEL.md#resetbaseline) defines the exact field/value contract, including the second question's intentional lack of `notSure`. These answers produce no score, eligibility decision, or interpretation.

Old three-question baselines (`urgeIntensity`, `abilityToPause`, `spontaneousOrMorningErections`) remain readable historical snapshots. They are not collected by the current flow or translated into new answers. Exact legacy and current shapes are structurally validated; mixed, incomplete, and unsupported shapes are rejected. No discriminator or new answers are added to old v7 records.

At start, the canonical pure Tracking snapshot helper includes all completed sessions with `endedAt <= capturedAt`, regardless of Tracking enablement, and excludes unfinished/future-ended sessions. It captures mean erection quality and the explicit-content session ratio for at least one observation, plus the mean chronological start-to-start interval in seconds for at least two. With no eligible observations all aggregates are absent; observed zero ratios remain zero. Values retain precision without storage rounding. The baseline remains fixed through restart, undo, and completion. Capture/start use one flow operation timestamp; no screen calculates aggregates.

**PostResetAssessment** remains optional historical metadata on completed journeys. Existing answers describe perceived changes in urge intensity, ability to pause, spontaneous erections, overall sexual response, and readiness to restart tracking. They remain readable and validated, without clinical interpretation or new collection.

There is no current assessment submission API, form, Home action, semantic flow intent, or `/bloom/reset/assessment` route. A valid v7 `assessment_pending` journey normalizes to completed using its existing baseline, final attempt, completion timestamps, best progress, and histories, without fabricating an assessment. Historical completed journeys retain their existing assessment and timestamps. Durable completion returns to existing Today; the final result UI and new Home experience remain deferred.

Baseline/assessment reports and future post-Reset session comparisons remain deferred. Phase 2A adds the separate Tracking-derived read below; its presentation and activation remain deferred. Reset completion generates no report, comparison score, medical interpretation, or session.

No numeric score thresholds, diagnosis, guaranteed benefit, or medical interpretation is defined here.

## Tracking-Based Reset Recommendation — Phase 2A

[`getTrackingResetRecommendation`](../src/domain/reset/getTrackingResetRecommendation.ts) detects a conservative within-user pattern in recorded observations. It is a deterministic product heuristic, not a diagnosis, risk level, addiction score, dysfunction detection, or evidence that explicit content caused a change. No onboarding answers substitute for actual sessions.

At least six completed historical sessions with `endedAt <= at` are required. Current active/awaiting-feedback sessions and future-ended records are excluded. Tracking enablement does not affect historical observations. Sessions are ordered by start time with a deterministic ID tie-breaker; only the latest six are analyzed as the preceding three versus the recent three. The total eligible count is returned separately.

The observed signals are:

- `erectionQualityDownwardTrend`: recent mean erection quality is at least 1.0 lower than the preceding mean, including exactly 1.0.
- `repeatedFirmnessDecrease`: at least two recent sessions ended with `firmnessDecreased`, and that count exceeds the preceding window's count.
- `recentExplicitContentPattern`: at least two of the recent three sessions used intentional explicit content, regardless of the preceding ratio.

Recommendation requires at least one of the two response signals **and** the recent explicit-content pattern. All observed signals are returned, even when their combination yields no current recommendation. No weighted score or confidence percentage is produced; other ending reasons add no response signal.

Evidence preserves both quality means, both firmness counts, both explicit-content ratios, and the recent average start-to-start interval without rounding. The three recent starts produce two intervals; their mean in seconds is display context only. Neither session frequency nor the preceding explicit-content ratio participates in the decision. Frequency alone never recommends Reset.

The result is `insufficientData`, `noCurrentRecommendation`, or `recommended`; invalid time or unsafe observation input returns null. Corrections to canonical completed feedback naturally change later derived results. Nothing is saved, no IDs/timestamps are created, and Reset never enters a persisted `recommended` status through this selector. Reset, Tracking, Content-Free, onboarding, Urge Control, routes, and Home behavior remain unchanged; persistence remains v7 / `bloom.localState.v7`.

### Optional review and explicit acceptance — Phase 2B

The product Home read model exposes `trackingResetRecommendation` separately from `primaryAction`. Its optional `resetRecommendationAction` is `{ id: "reviewResetRecommendation" }` only when the derived result is recommended, Reset is inactive, no Masturbation Session awaits completion/feedback, and no completed onboarding recommendation awaits acceptance. Tracking enablement and Content-Free activation do not gate advice. Active Urge Control retains primary priority while advice may coexist; startable Tracking remains the primary action when no higher-priority task exists.

Review maps to `{ flow: "resetRecommendation" }` and the parameter-free `/bloom/reset/recommendation` route. The feature re-derives evidence from accepted state, never URL snapshots. Descriptive observations and interval context carry no causal, medical, or frequency-concern interpretation. The route is ready; Starting Recommendation remains pending. Final V4 visuals are deferred.

The explicit Continue action calls `flowActions.reset.acceptRecommendation()`. The canonical transition reevaluates the unchanged Phase 2A selector at the supplied acceptance time. Corrected feedback or changed history that removes the recommendation makes acceptance an exact no-op. The transition also rejects unfinished sessions, unresolved onboarding acceptance, malformed inputs, and Reset already baseline-pending, active, or completed.

Success changes only Reset to the existing `baseline_pending` shape, preserving duration, best progress, past attempts, and violations. There is no baseline, attempt, start timestamp, or persisted advice/evidence yet. Tracking's enabled/disabled preference is unchanged; baseline-pending does not itself restrict session starts. Content-Free, Urge Control, onboarding, and all legacy slices remain unchanged. The 15-day restriction begins only when the existing baseline flow starts the active attempt.

Persisted v7 Reset `recommended` remains readable and retains its existing Home review priority. Its review shows compatibility copy without fabricated Tracking evidence; acceptance uses its existing journey ID and does not require Tracking-derived evidence. It still requires no unfinished session or unresolved onboarding acceptance. This is separate from derived advice, which never materializes an inactive journey as `recommended`.

Navigation replaces review with the existing baseline route only after durable persistence, using the actual accepted journey ID. Failed saves retain that successor and retry persistence without repeating acceptance or generating another ID/time. Closing without accepting returns to Today with no write. Dismissal/snooze history, repeated Reset journeys after a completed journey, and final recommendation visuals remain deferred. Persistence stays v7 / `bloom.localState.v7`.

## Manual Behavior Slips

Phase 1X provides one application command for the future “Seriyi bozdum” flow: `behaviorSlip.record(reason, occurredAt?)`. It reuses the existing reasons for masturbation, intentional explicit-content use, and both behaviors; accidental exposure is outside this command. UI does not choose which trackers to mutate.

One manual event has one coordinator. Effective Reset restriction at occurrence owns the event first. Masturbation restarts Reset only. Either explicit-content reason restarts Reset and, when active/applicable, Content-Free in the existing atomic Reset transaction. An unsafe linked transaction changes neither system; it never falls back to a partial write.

Only without effective Reset restriction may standalone Content-Free own an explicit-content event in its current activation/streak. Stored Reset `active` alone does not imply restriction: at/after exactly 15 elapsed days from the current attempt start, explicit content can reset active Content-Free while Reset remains unchanged. Masturbation alone never resets Content-Free. If neither tracker is affected, the action stores nothing. Slip evaluation never advances Reset completion.

The canonical impact selector returns semantic tracker effects without display text or mutation. Invalid occurrence timestamps and unsafe temporal ownership fail safely. Backdated occurrence remains an explicit event fact; recording uses the operation time. Persistence retries retain the same accepted event, identities, timestamps, and snapshot.

Existing direct feature commands and undo ownership remain unchanged. Phase 1Z makes this coordinator executable through Panic confirmation, without new Figma visuals, post-save/undo result UI, Home cutover, recommendation logic, or Urge lifecycle changes. Persistence remains v7 / `bloom.localState.v7`.

## Urge Control

Urge Control is optional acute support that creates a brief moment to choose. It does not aim to eliminate sexual desire, diagnose behavior, guarantee prevention or urge reduction, or assign success/failure.

Current lifecycle: **start → short interrupt → outcome → optional multi-select triggers → complete**. New events carry `flowVersion: 2`. The interrupt ends explicitly, with no domain-enforced 60-second minimum. All elapsed values are derived from timestamps; no timer counter is persisted and wall-clock passage never completes a step automatically.

Exactly one outcome is recorded: `reduced` (Azaldı), `stillStrong` (Hâlâ güçlü), `stronger` (Daha güçlü), or `unchanged` (Değişmedi). Outcome follows interrupt completion and may be corrected while active. Completion does not require the urge to have decreased.

Current triggers are optional and allow multiple selections:

| Value | Product meaning |
| --- | --- |
| `boredom` | Can sıkıntısı |
| `stress` | Stres |
| `loneliness` | Yalnızlık |
| `fatigue` | Yorgunluk |
| `explicitContentCue` | İçerik gördüm |
| `habitAutomatic` | Alışkanlık |
| `specificSituation` | A specific situation; intentionally broad while UI copy is unfinished |
| `other` | Diğer |

The trigger step must be explicitly finalized: `triggers` absent means not finalized, `[]` means intentionally skipped, and a non-empty array records observations in selected order. Duplicate or unsupported choices are rejected. A different valid selection replaces an earlier one before completion; identical selections are no-ops. No current `notSure` choice is inferred from the old model.

Trigger observations have no scoring, diagnosis, or tracker effects. In particular, `explicitContentCue` is a cue observation, not intentional explicit-content behavior. It does not call Behavior Slip, reset Content-Free, restart Reset, or change Masturbation Tracking.

Current completion requires interrupt completion, outcome, explicitly finalized triggers (possibly empty), and a completion time at/after event start and interrupt completion. It appends the event and clears the active slot atomically. Current events contain no technique, phone-away, singular trigger, or second-line fields. The future “Başka bir şey dene” / second intervention is deferred.

Historical events without a flow discriminator retain the old interrupt → technique → phone-away → outcome → singular trigger → optional second-line lifecycle. Legacy techniques, trigger values, timestamps, and second-line choices remain readable and resumable under their existing rules, including reduced-outcome correction. Older partial/unordered records retain their historical accepted shapes. Loading does not add a version, map triggers, delete facts, or require writeback merely because an event is legacy. Current and legacy completed records coexist in the same history.

Only one event may be active, including across app restart. Starting requires no Tracking, Content-Free, Reset, or onboarding permission. An Urge event never changes those systems. Discard removes only the active event with no history/tombstone; completed records remain append-only. Home retains its existing priority and version-aware `resumeUrgeControl` stage. Persistence stays v7 / `bloom.localState.v7`. Phase 1Z makes the current and legacy resume route executable through the simple Panic/Urge features described below.

## Panic Entry and Executable Urge Resume

`/bloom/panic` opens through the parameter-free semantic intent `{ flow: "panic" }`. With no active Urge event, it offers “Şu an tetiklendim” and “Seriyi bozdum”. An existing current or legacy active event offers Continue without starting another event.

The triggered branch explicitly starts the current Urge lifecycle through the existing flow command. After durable save it replaces the route with `/bloom/urge-control/resume`, carrying the actual `eventId` and a stage hint. The active event's accepted state owns progress; URL stage never overrides it. Wrong, missing, duplicated, stale, or completed event identities cannot target other work.

Current UI supports interrupt completion without a 60-second lock, the four existing outcomes, optional multi-trigger selection with Kaydet or an explicit “Bu adımı atla” (`[]`), and completion. Checkbox toggles are local drafts only. Historical active records remain usable through basic technique, phone-away, outcome, and singular-trigger controls using the existing legacy commands. There is no second intervention or automatic timer completion.

The slip branch uses exactly the existing three reasons: masturbation, intentional explicit content, or both. “Bunlar değişecek” reads canonical `getBehaviorSlipImpact` results; it does not calculate tracker ownership or duplicate progress arithmetic. A null preview disables confirmation. If neither tracker changes, the feature explains that no active tracker would be affected and dispatches nothing. Confirmation rechecks the rendered Reset/Content-Free facts and calls only `flowActions.behaviorSlip.record(reason)`; current state at press time remains authoritative. Slip creates no Urge event, and Urge observations create no behavior slip.

Successful slip, Urge completion, and explicit discard return to existing Today only after durable acknowledgement. Accepted save failures keep state visible, lock conflicting commands, and offer persistence-only retry without new IDs/timestamps or command replay. A stale/rejected command shows an unavailable message rather than a saved claim. Leaving or unmounting never silently discards an event.

Phase 1Z made nine routes ready: the seven earlier Session/Content-Free/Reset routes, Panic, and Urge resume. Phase 2B adds parameter-free Reset recommendation for ten ready routes; only Starting recommendation remains pending. Future buttons can use the Panic intent; existing Home, Reset, Content-Free, and tab buttons are not cut over. Final V4 visuals, post-save result/undo screens, and “Başka bir şey dene” remain deferred.

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

Explicit acceptance records the stored recommendation and caller-supplied `acceptedAt`, then prepares its starting state. Tracking acceptance enables Tracking without creating a session. Content-Free acceptance activates Content-Free immediately with a supplied activation ID and starts its streak. Reset acceptance creates a supplied journey ID in `baseline_pending`, with no start time, baseline, or attempt: the 15-day restriction has not begun. Combined acceptance prepares Reset and activates Content-Free atomically. Tracking remains disabled for Content-Free and Reset starting strategies. Reset completion leaves that preference unchanged; enabling Tracking remains an explicit user action.

Initial acceptance requires an inactive Reset and no unfinished session; non-tracking recommendations also require disabled Tracking. Active Content-Free cannot be replaced by a new activation. Existing histories and best values are retained, and unrelated active Content-Free remains unchanged. Invalid input or conflicting state is a no-op. Repeating acceptance retains the original time and identities. Full preconditions are specified in [DATA_MODEL.md](DATA_MODEL.md#explicit-acceptance). No legacy flow, UI, or route is changed.

## New Product Home Priority

The new Home engine is a pure read model using explicit time and the five new product slices. It composes existing availability/progress selectors and returns semantic action IDs and tracker facts, with no presentation copy, routes, state writes, generated time/identity, or automatic lifecycle advancement. The existing legacy `getNextBloomAction` remains unchanged and separate.

Priority is deterministic: unfinished Masturbation Session or awaiting feedback first; then active Urge Control resume; elapsed-but-still-active Reset completion; pending baseline; effectively active Reset; unaccepted stored onboarding recommendation; persisted `recommended` Reset compatibility; and finally the primary tracker's action. Tracking-derived advice is separate and never enters this primary-action sequence. Pending session work wins even when other feature states conflict. Urge Control resume includes the version-aware current or legacy stage. Reset preparation is not an active restriction; completed Reset has no pending assessment action.

Exactly at/after Day 15, an active Reset requests `recordResetElapsedCompletion` before normal tracker actions. This asks a later integration layer to persist the existing completion transition; reading Home never invokes it. Onboarding recommendations are returned as stored without rescoring. An unaccepted onboarding recommendation wins over a recommended Reset, while `productOnboarding: notCompleted` alone does not force an action or onboarding gate.

Current feature state determines tracker roles independently of legacy `activePlan` or an old recommendation. Enabled Tracking is primary; active Content-Free is secondary when both exist, or primary when Tracking is disabled. Tracker summaries remain available beneath a higher-priority Reset or unfinished-flow action. With no higher-priority item, startable Tracking offers `startMasturbationSession`, Content-Free alone offers `viewContentFree`, and otherwise no primary action is required. Inactive Urge Control remains available as optional support rather than becoming a default task.

The exact output and action payloads are defined in [DATA_MODEL.md](DATA_MODEL.md#new-product-home-read-model). Quick-action presentation, navigation mapping, Home/Today UI, provider wiring, onboarding routing, and replacement of the legacy engine remain deferred.

## Compatibility Gaps Intentionally Retained

| Existing implementation | Target model / later work |
| --- | --- |
| `pornLoop`, `pressurePattern`, `controlTiming`, and legacy quiz recommendations | New dimensions, confidence, and four recommendation identifiers; scoring replacement is deferred. |
| `TenDayResetState`, 10 completed dates, and daily completion actions | The new 15-day journey starts from a baseline and derives elapsed progress. Legacy daily actions remain separate. |
| Protection-dependent journey decisions | Protect is deferred and is not required by new flows. Existing decisions still run until routing is deliberately changed. |
| Separate Pause and Arousal Control drafts/logs | Normal Masturbation Sessions with optional timed pauses, plus the separate acute Urge Control tool. No automatic reinterpretation of legacy records. |
| Existing Arousal flow can start without a Reset restriction | The new Masturbation Session start transition checks effective Reset restriction at event time; existing legacy start actions remain unchanged. |
| Content-Free supports manual activation/deactivation, standalone logging/undo, Reset-linked events, session-derived violations/corrections, and timestamp progress | Arbitrary historical replay, completed-activation recalculation, and same-day calendar collapse remain deferred. |
| Transitional `BloomLocalState` and version-7 persistence | Old Reset violations become recorded without invented undo or rollback facts. Earlier active-counter and onboarding migrations remain supported. |
| Five current tabs and `/reset/ten-day`, `/pause`, and Arousal routes | Keep Expo Router and all working routes now; new navigation is outside Phase 1B. |

## Out of Scope for the Transitional Foundation

No UI redesign, Figma implementation, new screens, deleted flows, Protect changes, legacy onboarding replacement, provider wiring, navigation/Today/Home integration, legacy next-action replacement, session timestamp/duration/pause editing, active/awaiting-session correction or deletion, Reset history rewriting, Reset violations from session feedback, completed Urge Control editing/deletion/undo, arbitrary historical replay, same-day calendar collapse, post-Reset reports/comparisons, tracking-based Reset recommendations, backend, authentication, analytics, AI, or speculative framework is part of Phase 1O. Further phases require a separate task.
