# Protect Feature

Owns Protection Center, Sensitive Window Setup, and Protected Window Delay.

Protection means optional gentle support. It is not a hard stop and should remain editable and reversible.

Routes:

- `/(tabs)/protect` is the tab home for status, current settings, and entry points.
- `/protect/setup`, `/protect/active`, `/protect/night-setup`, and `/protect/intercept` are focused non-tab flows.

Current implementation uses in-memory demo state for protection status and level. Scheduling and night-support controls are UI/demo only until persistence and native integrations exist.
