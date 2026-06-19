# Pause Feature

Owns Pause Now, 90-Second Pause, and After Pause Check-In.

The pause flow creates space before an automatic loop and should always preserve user agency.

## Current Implementation

The Pause Now skeleton is implemented with Expo Router routes under `app/pause/`:

- Pause intro
- Quick pause check-in
- 90-second timer
- Saved summary

The timer uses local React state and a screen-level interval. There is intentionally no persistence, analytics, background timer behavior, audio, haptics, or native module support yet.

Today's placeholder primary action routes to `/pause` until the full Today quick-action grid is present in this checkout.
