# Bloom Journey Decision

`getNextBloomAction(state, todayKey)` is the canonical selector for Bloom's next
journey action. It accepts the current onboarding, active-plan, Protection,
10-Day Reset, and Arousal Control state plus an explicit `YYYY-MM-DD` date key.
It does not read the clock or mutate state.

The output is a discriminated action containing an id, phase, centralized
route, and reason. The decision order is:

1. incomplete onboarding;
2. terminal Reset (10 valid unique dates), then practice or review;
3. active Reset with the supplied date incomplete;
4. active Reset with the supplied date complete;
5. general observation;
6. Protection setup, or Reset once Protection is enabled;
7. pressure-plan Reset;
8. Arousal Control practice or review.

An absent or unknown recommendation after completed onboarding falls back to
the same neutral Quick Check-In used by the general starting point.

Today, Progress, Onboarding Result, Reset Saved, and Bloom Debug consume this
selector. Screen-specific prose remains in each screen; shared CTA labels live
in `nextBloomActionPresentation.ts`.

Add a new phase by extending the discriminated action type, inserting its
priority explicitly in the selector, updating presentation mappings and every
consumer, then adding deterministic fixtures.

Run `npm run verify:journey` after changing journey priority, routes, state
interpretation, or action presentation.
