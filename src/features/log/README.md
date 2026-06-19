# Log Feature

Owns daily check-ins, event logs, content reflections, and private reflection entry points.

The log experience should be optional, calm, and focused on noticing patterns without judgment.

## Current Implementation

The Log tab currently implements a lightweight skeleton with local component state only:

- Entry selector.
- Quick Check-In form.
- Saved summary.
- Local route-param support for opening `mode=quickCheckIn`.

There is intentionally no persistence, storage, analytics, advanced reflection flow, or real insight calculation yet. The private note stays in screen state only until local storage repositories are introduced.
