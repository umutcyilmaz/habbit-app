# Debug Preview

Developer-only preview controls for switching the in-memory demo state while building the MVP.

The `/debug` route is intentionally not part of the bottom tab bar. In development, Settings links to it from the Developer Preview section. Selecting a mode dispatches `SET_DEMO_MODE` and replaces the current preview state with a deterministic preset.

Before production, remove or hide the Settings entry and any production access to this route.
