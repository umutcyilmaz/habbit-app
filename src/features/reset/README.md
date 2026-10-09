# 10-Day Reset

A Reset program is terminal only when it has a valid start date and ten valid,
unique completion date keys. Completion helpers reject invalid dates,
deduplicate repeated taps, and cap the stored program at ten days. Terminal
state is derived rather than trusted from a separate Boolean.

`/reset/ten-day/saved` is read-only. It renders success only when the simulated
or real `todayKey` exists in the valid completion set; otherwise it replaces
the route with the canonical next action. The screen shows only recorded
facts: completion date, saved-day count, and terminal status. Bloom does not
claim that suggested behaviors were completed because those facts are not
collected.

Legacy Reset starts expressed as ISO timestamps normalize to date keys.
Completed dates are validated, deduplicated, sorted, and capped at ten without
changing the version 2 envelope. Run `npm run verify:protection-reset` after
changing Reset mutations, terminal rules, or route guards.

# Current 15-Day Reset continuity

The V4 product completion screen first saves the canonical 15-day transition.
An inactive Content-Free tracker then receives the requested continuation
choice only from durable completion truth. Accept/decline is one acknowledged
transaction with shared duplicate-operation and retry protection. A saved,
undecided offer can be reopened from Home after restart. Already-active
Content-Free users return to Home with their original continuity unchanged.

The test-only observation clock lives in `scripts/fixtures/resetContinuity.ts`.
Run `npm run verify:reset-continuity` to simulate Day 15 without changing device
time or production state. The legacy ten-day feature above remains separate.
