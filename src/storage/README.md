# Storage Foundation

The app starts with a local-first storage direction. This folder intentionally contains only a placeholder abstraction for now; no persistence package has been installed in this phase.

## Direction

- Feature code should depend on repository or storage interfaces, not a concrete storage package.
- MVP records should live locally by default.
- Future storage can be backed by AsyncStorage, Expo SQLite, SecureStore, or a combination.
- App lock material, if added, should be separate from general app records.

## Deletion Requirement

Data deletion is a core trust feature. The storage layer must support clearing user-created data across onboarding answers, check-ins, logs, pause sessions, exercises, protection windows, insights, reviews, settings, and local subscription state.

## Sensitive Analytics Warning

Private notes and sensitive reflection details must not be sent through analytics or crash metadata. If analytics is added later, events should stay coarse and product-focused.
