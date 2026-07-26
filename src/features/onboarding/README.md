# Onboarding Feature

Owns the quick path for Welcome, Safety Note, Privacy / Trust, Goal Selection, Adaptive Questions, Starting Profile, and Starting Plan.

This feature should keep questions optional where possible and should avoid collecting more sensitive detail than the app needs.

## Quiz scoring policy

- PL, PP, and CT are ranked profile axes. FC is only a firmness-concern modifier.
- A completed quiz needs a normalized ranked-axis score of at least `0.35`; otherwise it returns `General starting point` and recommends `startQuickCheckIn`.
- A secondary profile needs a normalized score of at least `0.50`, or at least `0.35` while within `0.12` of the primary.
- The mixed Porn Loop + Pressure result requires PL and PP to each be at least `0.50` and occupy the top score positions.
- Exact normalized ties resolve in this order: Porn Loop, Control/Timing, Pressure Pattern.
- When all three ranked axes are equally strong, v1 intentionally returns the PL + PP mixed result rather than adding a third main profile.
- Development preview withholds profile and action predictions until four frequency questions are answered. Eligible previews use the same scorer as final submission.
- Debug profiles are complete answer fixtures passed through the production scorer; they do not contain handcrafted scores or results.

Run `npm run verify:quiz` after changing quiz questions, weights, thresholds, result
construction, preview behavior, fixtures, or persisted quiz-result types.
