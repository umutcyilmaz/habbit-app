# Onboarding Feature

Owns the quick path for Welcome, Safety Note, Privacy / Trust, Goals, Starting Point, Starting Profile, and Starting Plan.

This feature should keep questions optional where possible and should avoid collecting more sensitive detail than the app needs.

## Current Implementation

The quick path is implemented with Expo Router routes under `app/onboarding/` and local React context state in `OnboardingContext.tsx`.

There is intentionally no persistence yet. The final plan screen routes to Today and includes a TODO for saving onboarding completion and draft answers once local storage repositories exist.
