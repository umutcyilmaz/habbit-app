# Settings Feature

Owns the trust layer for Settings, Privacy Overview, Data Controls, Notifications, App Lock, and Subscription.

Settings remains outside the bottom tab bar. The feature uses local state and mock copy only until persistence, export, deletion, notification scheduling, app lock, and purchase services are introduced.

## MVP Skeleton

- `/settings` renders grouped settings sections and trust copy.
- `/settings/privacy` explains privacy principles without overclaiming security.
- `/settings/data-controls` previews review, personalization, export, and deletion controls without touching storage.
- `/settings/notifications` manages local-only reminder preferences with discreet copy.
- `/settings/app-lock` shows disabled future app lock options.
- `/settings/subscription` presents optional premium copy without paywalling privacy or deletion basics.

## Intentional TODOs

- Connect Data Controls to a local repository once real persistence exists.
- Add export and deletion flows after storage is implemented.
- Add notification permissions and scheduling later.
- Add app lock only when platform privacy support is chosen.
- Add purchase restore and premium options only after product scope is approved.
