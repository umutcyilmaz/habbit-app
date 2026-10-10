# V4 Progress read-model contract

`getBloomProgressReadModel(source, observedAt)` composes confirmed current product facts without
React, routing, persistence, domain commands, generated identities or an implicit clock. It is
groundwork for a future Progress UI; the existing Progress screen/tab is unchanged.

```ts
const model = getBloomProgressReadModel(
  { durableState, hydrationStatus },
  observedAt // canonical ISO timestamp, supplied by the caller
);
```

`BloomProgressSource` requires `durableState` and `hydrationStatus` (`loading | ready | error`).
The state input requires only `masturbationTracking`, `contentFree` and `resetJourney`; a full
provider snapshot is structurally compatible. Its accepted `state` is never read. The caller must
provide the actual acknowledged durable snapshot, not rename accepted memory as `durableState`.
There is no independent persistence acknowledgement or storage read inside this pure function.

The result is `BloomProgressReadModel | null`. It returns `null` before ready hydration, for an
invalid/noncanonical observation timestamp or an unavailable composed selector. It consumes
canonical validated domain state; hydration owns schema validation/corruption recovery. A `null`
result is unavailable data, not an empty dashboard with zeroes.

## Exact output

All output properties are readonly. Selector results are newly derived values; the model exposes
no source record arrays, mutable source objects, route destinations or mutation callbacks.

| Field | Type / meaning |
| --- | --- |
| `observedAt` | The supplied canonical ISO timestamp. |
| `tracking.enabled` | Confirmed Tracking preference; turning it off does not erase historical metrics. |
| `tracking.currentSessionStatus` | `none | active | awaiting_feedback`, from canonical Tracking availability. Unfinished work is not a completed observation. |
| `tracking.summary.completedSessionCount` | Number of completed sessions with `endedAt <= observedAt`. |
| `tracking.summary.averageErectionQuality` | Mean quality of those sessions; `null` for no observations. |
| `tracking.summary.averageIntervalSeconds` | Mean chronological **start-to-start** seconds of those sessions; `null` for fewer than two. An observed zero remains zero. |
| `contentFree.progress` | Exact `getContentFreeProgress` result: `status`, `effectiveBestStreakSeconds`, `hasEffectiveViolation`; active only also has `currentStreakSeconds` and `currentCompletedDays`. Inactive has no fabricated current duration. |
| `contentFree.pastActivationCount` | Count of archived activation periods. Historical best/periods survive deactivation. |
| `contentFree.effectiveViolationCount` | Count of canonical `status: recorded` violations across retained history; undone tombstones are excluded. |
| `reset.status` | Persisted lifecycle: `inactive | recommended | baseline_pending | active | completed`. An elapsed observation does not change it. |
| `reset.progress` | Exact `getResetProgress` result for active/completed journeys; otherwise `null`. Contains `completedDays`, `currentDay`, `isPeriodComplete`, `remainingDays`, `remainingSeconds`. Fifteen elapsed days is the limit. |
| `reset.restriction` | Exact existing Reset restriction result composed through Tracking availability: `isRestrictionActive`, `isElapsedPeriodComplete`, `needsCompletionTransition`, `progress`. Per that selector, completed journeys have no restriction progress; their saved result remains in `reset.progress`. |
| `reset.recordedBestCompletedDays` | Persisted best, from canonical Reset history (0–15). It is not advanced by viewing Progress; current elapsed days remain separately available in `reset.progress`. |
| `reset.pastAttemptCount` | Count of archived completed/restarted attempts. |
| `reset.completedAttemptCount` | Archived completed attempts plus the current attempt **only when persisted status is completed**. A merely elapsed active attempt contributes no completion. |
| `reset.effectiveViolationCount` | Count of canonical `status: recorded` Reset violations; undone tombstones are excluded. |
| `reset.earnedContentFreeCredit` | Exact `getResetContentFreeCredit(reset, content, observedAt)` result or `null`. Credit contains `resetJourneyId`, `bestStreakSecondsBefore`, `earnedStartedAt`, `earnedUntil`. This is evidence of eligible Reset time, not automatic activation or proof of a selected continuation. |
| `reset.continuationOffer` | Exact `getResetContentFreeContinuationOffer(durableState, durableState)` result or `null`: `journeyId`, `attemptId`, `credit`, `earnedSeconds`, `completedDays`, and existing canonical `primaryLabel`. Only a saved eligible completed journey supplies an undecided offer. |

Tracking calculations were moved unchanged from Home to
`../masturbationTracking/getTrackingSummary.ts`. Home's previous `homePresentation.ts` import path
re-exports the same helper/type and retains its existing formatting; there is one calculation for
both consumers. No new time window, trend, chart or metric policy is added.

Content-Free duration already includes its applicable earned Reset credit through the existing
streak selector. **Do not add `earnedContentFreeCredit` or offer days to that duration again.**
The eligible credit may still exist after acceptance/decline; the offer's presence is separate.
Inactive best is a known retained duration, including a legitimate zero; absent current duration
and unobserved averages are not converted to zero.

This is a read of **current canonical facts**, not a retrospective history query. `observedAt`
drives existing elapsed/credit selectors and Home's completed-session cutoff. Retained history
counts follow the current canonical arrays; they are not a new date filter. No history list,
sorting UI, category, record editing or recommendation presentation is introduced.

Legacy onboarding/active plan, ten-day Reset, Arousal Control, Check-In, Pause, Protection and debug
data cannot contribute metrics. Product onboarding and Urge records are also outside this focused
three-feature contract; adding a future approved section requires an explicit contract extension.
All fields remain stored under persistence v7 without migration or deletion.

## Verification

`scripts/verify-bloom-progress.ts` runs through the existing `verify:persistence` runner. It covers
empty/unknown states; unsorted, single, disabled and unfinished Tracking observations; Reset
boundaries and saved completion; fractional/delayed earned continuity; real restart/undo transitions;
inactive/historical evidence and legacy isolation; accepted vs durable snapshots before failure,
after failure and after exact retry; and unchanged v7 round trips. Frozen/repeated reads and real
runtime write/revision counts check purity. UI/native validation belongs to the later screen task.
