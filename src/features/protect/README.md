# Protection

Protection is an optional in-app pause plan. It does not block websites,
monitor browsing, control other apps, contact another person, or enforce
device restrictions.

`BloomLocalState.protection` is the only live authority. Its canonical status
is `off`, `active`, or `paused`; saved configuration includes the preferred
window, reminder level, whether Bloom's internal content-pause flow is
enabled, and supported night start/end times.

Transitions preserve configuration:

- setup or reconfiguration saves supported choices;
- `active -> paused` keeps the plan while making it not ready;
- `paused -> active` resumes the same plan;
- active or paused can become `off` without claiming support is ready.

Routes:

- `/(tabs)/protect` is the tab home for status, current settings, and entry points.
- `/protect/setup`, `/protect/active`, `/protect/night-setup`, and `/protect/intercept` are focused non-tab flows.

Night times are stored preferences, not external scheduling or notifications.
Unsupported reminder options are marked Coming soon. Run
`npm run verify:protection-reset` after changing Protection state, migration,
or transitions.
