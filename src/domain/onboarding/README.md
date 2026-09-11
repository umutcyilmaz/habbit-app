# Bloom onboarding quiz V1

Phase 1C introduces a pure starting-strategy engine alongside the legacy
`features/onboarding/quiz.ts` implementation. Nothing imports this engine from
screens, journey routing, providers, or persistence yet. It does not start any
feature or make tracking-based recommendations.

The result is an initial behavioral hypothesis, not a diagnosis, problem score,
medical explanation, or calibrated assessment. Later behavioral data can
supersede it. All weights, cutoffs, coverage rules, and confidence rules below
are provisional product choices that need future calibration.

## API and raw answers

```ts
scoreBloomOnboarding(answers, completedAt) // BloomOnboardingQuizResult
```

The caller supplies a canonical ISO completion timestamp. There is no internal
clock, randomness, React, navigation, persistence, or AI dependency. Identical
answers and timestamp produce identical results.

`types.ts` defines the answers and result; `questions.ts` holds the 12 questions
and labels independently of scoring. The result includes a detached raw answer
snapshot, `quizVersion: 1`, `scoringVersion: 1`, the five dimensions,
recommendation, confidence, Reset eligibility, safety flag, completion time, and
internal score/coverage evidence. Recalculation can use the original answers
instead of trying to reconstruct them from derived levels. Phase 1D stores the
complete result in the new `productOnboarding` slice; legacy `onboarding` remains
unchanged. Saving a recommendation does not activate it.

A completed submission answers all 12 questions. Unknown answers are explicit;
missing fields, invalid enums/ratings, empty or duplicate selections, conflicting
exclusive selections, and invalid timestamps throw `TypeError`. No answer is
silently defaulted, coerced, or dropped. Q9 `notSure` must stand alone. Q12 `none`
must stand alone, while `unsure` can accompany a reported concern.

## Persisted historical results

`validation.ts` shares raw-answer and timestamp checks with the scorer and adds
structural result validation. It never imports or runs the scoring algorithm.
The stored quiz/scoring versions, exact fields and question IDs, allowed values,
numeric evidence ranges/counts, and repeated confidence/safety values are checked
without comparing the result with what today's scorer would produce. Known
quiz/scoring version 1 results are supported; unfamiliar result versions are
preserved through the storage corruption strategy pending explicit support.

Derived scores, dimensions, recommendation, confidence, and eligibility are
historical facts. They are neither silently recalculated nor reconciled with raw
answers during save/load validation. Raw answer key order, selected values/order,
and explicit unknowns are retained in detached copies for future explicit
re-scoring. Missing, extra, or malformed facts are rejected rather than dropped.
The state mutation stores only the recommendation result, without starting any
feature, changing `activePlan`, or navigating.

## Questions and signals

| Question | Raw answer | Contribution |
| --- | --- | --- |
| Q1: explicit-content frequency, last 4 weeks | Categorical frequency, including unknown | Context only; excluded from scoring, confidence, and eligibility |
| Q2: unplanned opening during another activity | Behavioral frequency | Content weight 1 |
| Q3: interruption of daily activities | Behavioral frequency | Content weight 1 |
| Q4: content leads to unplanned masturbation | Behavioral frequency | Content weight 2 |
| Q5: repeated same-day returns | Behavioral frequency | Content weight 1 |
| Q6: difficulty sustaining a reduction decision | Behavioral frequency or `neverTriedToReduce` | Content weight 2; unknown excluded |
| Q7: typical erection quality | Integer 1–10 or `notSure` | Response weight 2 |
| Q8: difficulty maintaining an erection | Behavioral frequency | Response weight 2 |
| Q9: typical techniques | Multiple selections | Stimulation weight 1; contribution capped regardless of selection count |
| Q10: difficulty without usual technique | Behavioral frequency | Stimulation weight 4 |
| Q11: longer than desired / difficult ejaculation | Behavioral frequency | Response weight 1 |
| Q12: reported safety context | Multiple selections | Safety only; excluded from scoring, confidence, and eligibility |

Behavioral frequency maps `never`, `rarely`, `sometimes`, `often`, and
`almostAlways` to 0, 1, 2, 3, and 4. `notSure` and Q6 `neverTriedToReduce` are
unknown, not zero. Unknowns contribute neither a value nor their weight to the
denominator; evidence retains the known-answer count. No known answers gives
`normalizedScore: null`.

Internal scores use `100 * sum(severity * weight) / (4 * sum(known weights))`.
They are not rounded before classification: low is `[0,35)`, medium is
`[35,60)`, and high is `[60,100]`, subject to each high gate. These fractional
intervals implement the provisional 0–34 / 35–59 / 60–100 bands without rounding
a below-threshold value upward. Scores are internal evidence, not user-facing
clinical percentages.

## Dimension gates

**Content dysregulation:** Q2–Q6 need at least three known answers to assign a
level; otherwise the dimension is `uncertain`. High additionally requires at
least two strong answers (severity 3 or 4). A score at least 60 without this
support is capped at medium. Frequency in Q1 never counts, even as an indirect
confidence or contradiction check.

**Erection-response concern:** Q7 ratings 1–2 / 3–4 / 5–6 / 7–8 / 9–10 map to
concern severities 4 / 3 / 2 / 1 / 0. Q7, Q8, and Q11 need at least two known
answers. High additionally requires two strong answers. A single weak or strong
answer cannot independently produce high concern. This makes no claim about ED
or physical causation.

**Stimulation pattern:** Q9 contributes 4 if at least one of `veryHighSpeed`,
`veryTightPressure`, `frictionThroughClothing`, `rubbingAgainstBedPillowSurface`,
or `proneRubbing` is selected, otherwise 0; `notSure` is unknown. Selecting more
techniques adds no further weight. Q9 supplies at most 20 score units; dependency
in Q10 supplies up to 80. Both answers must be known to assign a level. High
requires dependency severity at least 3 **and** one supporting listed technique.
Even maximum dependency without that support is capped at medium. Merely using
one or several techniques without dependency stays low and never triggers Reset.
This corroboration gate is a conservative product choice, not a claim that any
technique is pathological; an `other` or ordinary-hand-only answer is not assumed
to supply the listed support.

## Eligibility, recommendations, and confidence

`resetEligible` is exactly `erectionResponseConcern === "high" &&
stimulationPattern === "high"`. Neither content frequency nor safety alters it.
Response concern alone and stimulation pattern alone cannot qualify.

The candidate recommendation is deterministic:

| Reset eligible | Content dysregulation high | Candidate |
| --- | --- | --- |
| No | No | `masturbation_tracking` |
| No | Yes | `content_free` |
| Yes | No | `reset` |
| Yes | Yes | `reset_and_content_free` |

Confidence describes evidence for the proposed starting action, not medical
certainty. It never uses Q1 or Q12. A complete, clear result in one dimension
does not become contradictory merely because an independent dimension differs.

- Content-Free: five known content answers gives high confidence; four gives
  medium; three gives low. An unknown Q6 lowers coverage rather than severity.
- Reset: all three response answers gives high confidence; two gives medium.
  High stimulation already requires both Q9 and Q10 known and corroborating.
- Combined: use the lower of the Content-Free and Reset confidence levels.
- Tracking candidate: all three dimensions uncertain gives uncertain confidence;
  any uncertain dimension gives low; a medium dimension or any unknown scored
  answer gives medium; otherwise confidence is high.

Only high confidence retains a non-tracking candidate. Low, medium, or uncertain
confidence returns `masturbation_tracking`, so real behavioral data can be
collected. Eligibility remains the explicit high/high fact if confidence causes
this fallback. For example, high response based on only two known answers plus
high stimulation is eligible but initially recommends tracking. Strong Content-Free
evidence can stand on its own when response or stimulation answers are unknown;
the engine does not invent a contradiction or a cause from those unknowns.

## Safety and compatibility

Q12 `none` produces `noneReported`; `unsure` alone produces `uncertain`; any
explicit reported concern produces `reported`, including when accompanied by
`unsure`. This is context for later safety messaging. No advice, diagnosis,
medical cause, treatment, or special route is generated here.

The Phase 1A model's three scored dimension vocabularies now use
`low | medium | high | uncertain`. These types had no persisted consumers, so
this change requires no migration. Existing safety/confidence labels remain.
The legacy PL/PP/CT/FC quiz, persisted onboarding data, UI, Protect, and journey
routing remain intact.

Run `npm run verify:onboarding` for focused verification, alongside the existing
`verify:quiz`, `verify:persistence`, `verify:journey`, and `typecheck` checks.
