# Today Feature

Owns the Today dashboard, the post-onboarding home base, and lightweight daily action entry points.

Today should link into check-in, pause, log, exercises, progress, protection, and settings without becoming crowded.

## Current Implementation

The Today dashboard skeleton uses mock data from `data/todayMockData.ts`.

It includes:

- Greeting and plan note.
- Main recommendation card.
- Quick action grid.
- Weekly progress preview.
- Gentle coach insight.
- Optional first-use mock state.

There is intentionally no persistence, analytics, recommendation engine, pause timer, check-in form, or progress calculation yet. Quick actions route to existing tabs until dedicated feature flows are implemented.
