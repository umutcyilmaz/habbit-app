# Native Kegel persistence evidence

2026-10-12, iPhone 17 Pro / iOS 26.3. Existing Bloom E2E client, unique
`bloom.e2e.kegel.qa_20261012_settled_c41f.` namespace. Every saved session is a
full-duration workout; no completion shortcut, synthetic Kegel history, clearState or
Simulator clock edits were used. QA controls are development/E2E/identity/run guarded
and do not appear on `/bloom/kegel` in ordinary builds.

| Native state | Capture |
| --- | --- |
| Actual pause/resume | [00-paused.png](00-paused.png) |
| First durably saved set | [01-saved-completion.png](01-saved-completion.png) |
| Reopened app, one set / ten repetitions | [02-reopened-one-session.png](02-reopened-one-session.png) |
| Two sets / twenty repetitions after duplicate callback and cancellation | [03-two-sessions-after-cancel.png](03-two-sessions-after-cancel.png) |
| Completed set with failed durable write and retained Retry | [04-save-failure.png](04-save-failure.png) |
| Reopened after Retry, three sets / thirty repetitions | [05-reopened-after-retry.png](05-reopened-after-retry.png) |
| Genuine calendar / heat map | [06-real-calendar.png](06-real-calendar.png) |
| Read-only resume verification: existing sessions survive two more restarts | [07-resume-reopened.png](07-resume-reopened.png) |

The final reopened-home capture was refreshed with `simctl` after compositing settled.
The stored envelope contains exactly three distinct completed identities, the first set's
actual pause count/duration, and a durable onboarding timestamp. Its Tracking, Content-Free
and Reset slices remain at their initial values. Before/after SHA-256 checks also matched
all pre-existing normal Bloom (one key) and E2E (three keys) values; earlier QA namespaces
were preserved rather than cleared.

See [implementation, verification and changed files](../../kegel-persistence.md).

The resumed task reran all listed typecheck/unit/persistence/regression checks and restarted
the same isolated E2E app twice. No new exercise or mutation was triggered. Three sessions
and thirty repetitions remained visible; the entire QA envelope and every pre-existing normal/E2E
value stayed byte-identical. The new reopened-screen capture was also visually inspected.
