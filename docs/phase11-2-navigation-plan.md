# Phase 11.2 — V4 bottom navigation and screen mapping plan

Date: 2026-10-10. Project: `~/Desktop/tms`. Branch: `feature/product-ui-v1`.
Scope: repository inspection and planning only. No application, test, persistence or configuration
changes are included in this phase; no commit or push.

The approved final navigation is **Home | Learn | Kegel | Progress | More**, in that order.
The current **Home | Log | Exercises | Progress | Protect** is legacy navigation, not an alternative
approved product design. A label swap cannot complete this migration: Home is already V4, while
Learn and Kegel are missing, Progress uses legacy product facts, and More has only reusable Settings
destinations. Build and verify the missing destinations before exposing the final five tabs.

## Evidence and design boundary

Inspected the root/tab route files, every current product route wrapper, route constants and flow
mapping, V4 Home and feature hooks/screens, legacy tab/guide screens, Settings, product selectors and
models, provider/lifecycle/failed-save guards, persistence entry points, package verification commands,
and tracked design references. No Simulator run or automated application test is claimed for this
documentation-only phase. The working tree was clean at inspection start.

| Reference | What it establishes | Limits for this task |
| --- | --- | --- |
| User's Phase 11.2 instruction | Final five tab names and order | Does not provide screen layouts, Learn content, Kegel behavior or More menu contents. |
| [Design system spec](design-system/design-system-spec.md), [tokens](design-system/design-tokens.json), [validation report](design-system/validation-report.md) | V4 dark foundations, components, root/pushed/flow title rules, bottom bar height 68 plus safe area, five items and scroll clearance | Component handoff, not five final screen designs. The documents claim Figma extraction; the originating Figma file/link and screen frames are not included. |
| `src/shared/design-system/v4/*`, `src/shared/components/v4/*` | Implemented V4 primitives/components usable by future screens | Tokens do not decide content hierarchy, functionality or tab icons. |
| [Phase 11 audit](phase11-product-audit.md), F02/F03/F04/F06/F13 | Legacy Progress/rule conflicts, Settings limitations and missing record access | Audit recommendations are not approved designs. F01's historical status is superseded by the two Phase 11.1 reports. |
| [Phase 11.1 recovery](phase11-1-failed-save-recovery.md), [obsolete-receipt review](phase11-1-obsolete-receipt-review.md), [Phase 10 continuity](phase10-reset-content-free-continuity.md) | Contracts to preserve for navigation, exact save recovery and Reset continuation | Do not replace these contracts while moving navigation. |
| `SCREEN_INVENTORY.md`, `USER_FLOWS.md`, `PRODUCT_SPEC.md`, earlier MVP docs | Historical intent/context | The old tab inventory and old workflow names cannot override the newly approved navigation. |

No tracked Learn/Kegel/More screen implementation, corresponding screen mockup/export, `.fig` file,
or Figma URL was found. The spec lists an `icons/*.svg` handoff, but those assets are absent from
tracked files. The JSON explicitly records that all five reference tab icons are placeholder
shields and that real icons are pending; the current tab layout renders no icons. Do not invent
replacement icons or treat placeholders as approved assets.

Missing references to obtain before final screen work:

- Learn landing/detail designs, actual approved educational content, interaction and reading-state scope.
- Kegel landing/practice designs, approved instructions and policy, timer/session behavior, and whether
  anything is recorded. No Kegel-specific persisted model exists; do not reuse Arousal logs or add a
  storage migration as a navigation shortcut.
- V4 Progress layout, supported metrics/time ranges and empty/loading/error states. Existing selector
  semantics below are reusable, but charts, filters and trends need approval.
- More menu composition/order and V4 Settings treatment, including disposition of ineffective controls
  and planned features. More is not automatically the existing Settings page with a new title.
- History entry/list/detail/correction designs and which categories ship initially.
- Final tab icon assets and selected/accessibility states; release language for tab-adjacent copy.

Only the tab labels/order are approved here. The feature ownership below is a recommended route
mapping; it does not claim unseen screen designs have been approved. Missing designs gate those
implementation slices, not the repository inspection or this plan.

## Current versus target route map

Expo Router currently has a root `Stack` in `app/_layout.tsx` and a nested `Tabs` navigator in
`app/(tabs)/_layout.tsx`. Tab names/order come from `src/constants/navigation.ts`. Product flows are
root-stack siblings under `/bloom/*`; they are not separate bottom tabs. Keep that structure to
avoid reparenting guarded controllers during this migration.

`/(tabs)` is an internal route group, not a public URL segment: for example Home's public path is
`/today`. Keep `routes.home = "/(tabs)/today"` and its existing wrappers/deep links initially. There
is no need to rename `today` to `home` to display **Home**.

| Surface | Current file/internal destination and mounted screen | Target mapping | Work needed |
| --- | --- | --- | --- |
| Startup | `/` → durable product onboarding gate | Same `/onboarding`, `/bloom/starting-recommendation`, or Home outcomes | Preserve durable acceptance gating; tab migration must not mark onboarding complete. |
| Home | `app/(tabs)/today.tsx`, `/(tabs)/today` → `BloomHomeScreen` | **Home**, same route/component | Preserve current V4 cards and policy-driven actions. |
| Log tab | `app/(tabs)/log.tsx`, `/(tabs)/log` → legacy `LogScreen` | No final tab; retire ordinary menu entry | Retain legacy data; route handling described below. Tracking is accessed from Home, not by renaming Log. |
| Exercises tab | `app/(tabs)/exercises.tsx`, `/(tabs)/exercises` → legacy `ExercisesScreen` | No final tab; separate **Learn** (`/(tabs)/learn`, proposed new file) and **Kegel** (`/(tabs)/kegel`, proposed new file) | Both new screens require references/implementation. Neither is an alias of Exercises/Arousal Control. |
| Progress | `app/(tabs)/progress.tsx`, `/(tabs)/progress` → legacy `ProgressScreen` | **Progress**, same route, new V4 screen/read model | Replace visible legacy summaries/CTAs; keep compatibility fields stored. |
| Protect tab | `app/(tabs)/protect.tsx`, `/(tabs)/protect` → legacy `ProtectScreen` | No final tab; **More** (`/(tabs)/more`, proposed new file) is a new menu | Do not relabel Protection as More/Panic/Content-Free. |
| Settings | `/settings` → `SettingsHomeScreen`, with five subroutes | **More → Settings → approved settings destinations**, keep `/settings/*` | Existing destinations partly reusable; fix truthful presentation before broad exposure. |
| V4 flows | `/bloom/*` → existing product screens | Home-driven root-stack flows; approved read-only Progress/history links may also open them | Retain route paths, identity parameters, lifecycle checks and recovery ownership. |
| History | No general V4 list/hub route | **Progress → feature history/record detail**; feature-local histories remain in their screens | New list/entry design required. A More shortcut is optional only if present in the eventual approved design. |

Proposed `/learn`, `/kegel`, `/more` public paths follow the new tab file names. They do not exist
today. Do not add empty route files that Expo Router could expose as automatic tabs. When the shell
changes, explicitly exclude retained legacy tab files from tab discovery; changing only `tabRoutes`
is insufficient assurance that hidden files cannot appear.

## Implementation status of the final five tabs

| Final tab | Status | Existing implementation that can be reused | Missing or incompatible |
| --- | --- | --- | --- |
| Home | Implemented, already mounted V4 | `src/features/home/screens/BloomHomeScreen.tsx`, `useBloomHomeFeature.ts`, durable Home selector and semantic flow mapper | No direct Settings entry today; primary Settings access should become More. Existing audit gaps remain separate work, not implied fixed by navigation. |
| Learn | Missing | V4 shared components only | No library/detail screen, content model or approved content/design. Old Exercises and the old guide contain obsolete tool links, not a Learn implementation. |
| Kegel | Missing | V4 shared components only | No Kegel route, feature, approved workflow or Kegel record model. The legacy Arousal Control workflow is a different feature. Its exercises must not be recast as Kegel. |
| Progress | Partial: route exists; V4 tab screen missing | V4 progress selectors, Tracking aggregation and persisted records | Mounted screen reads `state.onboarding`, `activePlan`, `tenDayReset`, `arousalControl`, and legacy `getNextBloomAction`. It does not represent V4 product progress. |
| More | Partial: destinations exist; V4 hub missing | `/settings` and existing privacy/data-control route boundaries | No approved More composition or V4 hub. Settings is light/English; notification/personalization controls are transient demo values, App Lock/Subscription are planned placeholders. |

## Access to current V4 features

Keep commands behind the existing `useBloomProductFlowActions` and semantic navigation adapter.
Read the current canonical identity at entry; URL parameters are identities/hints, never a snapshot
of progress. A new menu or history link must not start/complete a domain operation on mount.

| Feature | Recommended ordinary entry | Existing working destination and constraints |
| --- | --- | --- |
| Tracking activation/start | Home's Tracking card | Activation uses the existing acknowledged action. Start goes to `/bloom/masturbation-session/start` only when policy permits. No separate Tracking tab is needed. |
| Active session / pending feedback | Home attention/resume action | `/bloom/masturbation-session/resume?sessionId=…` or `/bloom/masturbation-session/feedback?sessionId=…`; canonical session status determines the target. Resume an unfinished session rather than create another. |
| Content-Free | Home's Content-Free card | `getBloomContentFreeEntryIntent` resolves `/bloom/content-free` or the saved Reset continuation offer. Keep this resolver so a new shortcut cannot bypass earned-credit acceptance/decline. Feature history/undo is already inside Content-Free. |
| Reset | Home's recommendation, baseline, active-progress or elapsed-completion action | `/bloom/reset/recommendation`, `/baseline?journeyId=…`, `/progress?journeyId=…&attemptId=…`, `/completion?journeyId=…&attemptId=…`. Preserve the existing applicable entry; do not add an unconditional “start Reset” menu command. |
| Reset → Content-Free | Saved Reset completion offer | Actual acknowledged completion must precede the offer; existing decision preserves fifteen-day earned credit. Progress links must not auto-complete or auto-accept. |
| Panic / unfinished Urge Control | Existing Home Panic/attention action; Reset's existing Panic action | `/bloom/panic` and `/bloom/urge-control/resume?eventId=…&stage=…`. Keep both distinct from old Pause/Protect. No arbitrary new Panic tab or Kegel shortcut. |
| Completed Tracking record | Progress's approved recent-record/history entry | Existing `MasturbationSessionFeedbackScreen` renders `CompletedSessionCard` for a saved completed `sessionId`; it can show a read-only summary without replay. Reuse this detail behavior once an approved entry exists; it is not a full history/correction UI. |
| Content-Free / Reset violations | Existing feature-local “Geçmişi gör” controls | Lists/undo already render within their screens. Reset history is route/lifecycle scoped; it does not provide a general archive of every completed journey. |
| Completed Reset attempts / Urge records | Progress history after design/implementation | Data exists (`pastAttempts`, violations, `urgeControl.records`), but no general list/detail hub is implemented. Do not route completed Urge records through active-event resume. |
| Settings / data deletion | More → Settings; optionally an approved direct Data Controls row | Preserve `/settings` and `/settings/{privacy,data-controls,notifications,app-lock,subscription}` compatibility. Delete-all stays on the existing acknowledged lifecycle, not a navigation reset or replacement storage API. |

New session starts must honor `getMasturbationTrackingAvailability`, including enabled permission,
unfinished session/pending feedback and the effective V4 Reset restriction. Existing session
continuation remains distinct from starting a new session. Reuse the same policy in any new entry;
do not substitute a check of legacy `tenDayReset` or just `resetJourney.status`.

Completed-session correction/delete APIs already exist in product actions/storage transitions, but
there are no mounted controls. Connecting an existing summary is a routing task; designing a
consequential explicit-content correction or delete confirmation is a separate approved UI slice.

## Progress data contract

Use `BloomLocalStateProvider`'s **durableState** after hydration for confirmed summaries, as V4 Home
does. Accepted data may drive a guarded operation's pending display, but cannot be labeled saved
or counted as confirmed Progress. Observation time is read-only and explicit; viewing Progress
must not persist elapsed-day completion, activate tracking, create an event, or accept a plan.

| V4 source | Reusable selector/behavior | Display scope to approve |
| --- | --- | --- |
| `masturbationTracking` | `getTrackingSummary` in `homePresentation.ts`: completed sessions ended by observation time, mean quality, mean chronological start-to-start interval | Reuse exact Home semantics; fewer than two observations has no interval, not zero. Any different window/trend requires a separate definition. |
| `contentFree` | `getContentFreeProgress`, existing earned-credit/streak selectors | Current completed days, effective best duration, activation/violation facts; preserve intentional-content rules and inactive boundaries. |
| `resetJourney` | `getResetProgress`, `getResetRestrictionStatus`, continuation offer selector | Fifteen elapsed days, current attempt, lifecycle/completion and recorded history; no ten-day calendar marker import. |
| `urgeControl` | Canonical current event/records; existing active progress selector for resume | Historical outcomes may be reviewed only with approved presentation. Old/new event compatibility remains intact. |
| `productOnboarding` | Current V4 saved result/plan acceptance if an approved current-plan section needs it | Historical result must not overwrite current feature state or require repeating the legacy quiz. |

Exclude legacy `onboarding.quizResult`, `activePlan`, `tenDayReset`, `arousalControl.logs`, old
check-ins/Pause/Protection and `getNextBloomAction` from the V4 Progress read model. Preserve them in
storage. Do not convert old practice records into Tracking sessions, ten-day completions into
fifteen-day credit, or legacy onboarding completion into accepted V4 onboarding.

## Legacy exposure and compatibility policy

Hide/remove ordinary navigation links to the following when the relevant navigation slice lands:

| Legacy route/source | Disposition |
| --- | --- |
| `/(tabs)/log`, `/(tabs)/exercises`, `/(tabs)/protect` | No bottom tabs or ordinary More/Learn links. Keep legacy constants/fields if still needed by compatibility tests; do not rename these screens into new product features. |
| `/exercises/arousal-control` and all its child routes | No ordinary V4 entry. This independently writes Arousal records and bypasses V4 session/Reset policy. Guard every command-capable child for direct/stale links, not just its intro. |
| `/reset/ten-day`, `/practice`, `/saved` | No ordinary V4 entry or second Reset program. Preserve stored history; old route compatibility must not enable a new ten-day operation. |
| `/pause`, `/pause/check-in`, `/pause/timer`, `/pause/saved` | Retained legacy compatibility, excluded from new menus unless separately approved. They are not V4 Panic/Urge equivalents. |
| `/protect/setup`, `/active`, `/night-setup`, `/intercept` | Excluded from ordinary V4 menus. Saved in-app preferences must not be presented as content blocking, Content-Free or Panic. |
| `/guidance/what-should-i-use` | Exclude until content/actions are redesigned; it points to legacy practice, ten-day Reset and other old tools. Do not use it as Learn. |
| `src/features/today/screens/TodayScreen.tsx`, `src/features/onboarding/screens/*` | Retained unmounted source; do not remount to fill a missing tab. `/onboarding/*` currently mounts V4 intro/quiz and a durable redirect, so these route paths must remain working. |
| `/debug/bloom-state`, `/debug/phase10` | Keep existing development/E2E guards, absent from ordinary release menus. |

Hiding a tab does not disable its deep links or child mutations. The migration should preserve URL
compatibility through nonmutating Home redirects for retired command routes, with mounted-command
guards where necessary for retained stale callbacks; it should not preserve an unguarded legacy
write path. A verified read-only historical detail may remain only if it neither exposes a command
nor leads back into the legacy workflow. Do not blindly translate an old draft into V4 state.
Implement redirects/guards as an independently tested slice, keeping all current `/bloom/*`,
`/settings/*`, Home and product-onboarding routes executable. Route compatibility is distinct from
continuing to offer unsupported workflows.

Settings needs a narrower exposure decision too: working deletion can be reused, but the current
Data Controls personalization toggle and Notification toggles must not be promoted as effective
V4 controls. Privacy copy references the old quiz. App Lock/Subscription are disclosed future
placeholders, so omit them from a functional More menu unless the approved design explicitly includes
their planned state. Do not implement notifications, security, billing or preference schemas merely
to fill More. These are prerequisites/dependencies from F04/F08, not fixes claimed by this plan.

## Immediately reusable versus blocked work

**Can be connected without new domain behavior:** existing Home; its Tracking start/resume/feedback,
Content-Free resolver, Reset and Panic entries; feature-local violation history; existing completed
session summary when a valid saved ID is selected; Settings route and acknowledged deletion plumbing.
Most Home connections already exist. New entry placement still follows the approved design; current
Settings screens are not wholesale ready for a truthful V4 release menu.

**Require implementation/design:** Learn and its content, Kegel and its policy, the V4 Progress screen,
More hub, global record/history lists and correction controls, V4 Settings presentation/copy and final
icons. Existing shared components/records reduce implementation effort but do not supply these designs.

## Small, independently testable implementation steps

Each step is a separate reviewable change. Use existing TypeScript verification runners and Maestro;
do not add a framework. Design-independent groundwork can start before missing screens are approved.

| Step | Small deliverable and likely boundaries | Independent acceptance/verification | Dependency |
| --- | --- | --- | --- |
| 1. Resolve handoff gaps | Record supplied final screen frames, content/policy, history scope and icons; mark historical navigation docs accordingly | Map every approved destination/state to a source; no inferred Learn/Kegel workflow or fabricated placeholder | Required before affected screen construction, not before safety groundwork |
| 2. Contain legacy entry | Remove ordinary legacy links; explicitly hide legacy tab files; add nonmutating compatibility redirects/command guards to retired legacy paths | Route enumeration plus direct links to every legacy child; active V4 Reset cannot reach legacy practice/start/write; root serialization/record counts unchanged on redirect. Existing legacy pure-domain/migration tests stay valid | Can be independent; any temporary reduced menu is internal transition, not a new final design |
| 3. Add a pure V4 Progress read model | New selector/presentation using existing V4 data contracts; leave the visible tab replacement for step 4 | Fixtures with V4 populated/legacy empty and the reverse; pending accepted write vs durable; Reset elapsed/completed, credit, history undo; empty/single/multiple sessions. Reading creates no IDs/writes | No screen design needed for semantic tests |
| 4. Replace Progress at its existing path | Approved V4 screen with hydration/empty/error states and approved feature/detail links | No old quiz CTA/ten-day markers/Arousal counts; same saved metrics as Home; unknown/stale IDs safe; failed saves not shown as confirmed. `verify:home-ui`, persistence and continuity plus native Home ↔ Progress check | Progress design + step 3 |
| 5. Add More and truthful Settings entry | Approved More screen connects existing Settings/data lifecycle; scoped cleanup of ineffective exposed controls/copy in separate subchanges | No demo toggle represented as working; Settings back returns to the intended origin; delete cancel/failure/success and late-write protection intact; no ordinary debug or legacy tool entry | More/Settings design + explicit disposition of F04/F08 controls |
| 6. Build Learn | Approved landing/detail content only; no legacy exercise alias | Approved content/links, accessible navigation and empty/error behavior as applicable; no mutation or legacy command reachable from educational CTA | Learn references/content |
| 7. Build Kegel | Approved workflow implemented independently of Arousal/Tracking; define state needs first | Approved start/end/cancel behavior and any Reset interaction, no accidental Tracking/Reset writes; save recovery only if recording is actually required | Kegel design/policy. Any new persistent schema requirement needs a separate proposal; this navigation migration preserves v7 |
| 8. Switch the final shell | `tabRoutes`, tab files/layout and approved icons expose exactly Home/Learn/Kegel/Progress/More. Preserve Home/Progress paths and stack sibling product routes | Native tab order/labels/active state/back/deep links; no hidden sixth tab; light status text for new dark paths (`RouteStatusBar` currently recognizes `/today` and `/bloom/*`, not new tabs); safe area/clearance/large text/focus | Steps 4–7 ready; no empty shells or repurposed legacy content |
| 9. Connect approved history incrementally | First saved-session entry → existing summary; then approved list and consequential correction; later Reset/Urge archives if in scope | Exact saved ID/detail, empty/missing/stale IDs; correction updates Content-Free atomically via existing actions; failed persistence retains receipt/recovery; no replay or identity regeneration | History design + new hub available. Categories can be separate changes |

Step 2 need not delete legacy code, migrations or schemas. Do not remove `DemoAppStateProvider` as
an incidental refactor while other compatibility consumers remain. Steps 5–7 can be built behind
nonpublic integration boundaries until their screens are ready; creating a route file alone is not
a sufficient visibility boundary in file-based routing. Do not ship the final five-tab shell with
arbitrary “coming soon” functionality in place of the missing approved screens.

Preserve all Phase 11.1 guards: moving a mutation screen under a tab or adding tab-switch shortcuts
could blur it without removing it, so the existing removal guard alone must not be assumed to cover
every new exit. Keep current flows as root-stack screens initially. Test Close/back/gesture/deep-link
and any newly introduced tab exit during busy, accepted retryable failure and accepted nonretryable
failure; recovery remains available and conflicting actions stay locked. The normal successful
Close-to-Home behavior can remain initially; origin-aware return from a later history detail is a
separate routing refinement that must preserve those checks. No process-kill survival promise for
unconfirmed in-memory state.

## Verification gates for implementation, not results from this planning phase

At each implementation slice run `npm run typecheck`, its relevant existing verification group and
`git diff --check`. At integration run:

- `verify:persistence`, `verify:persistence-acknowledgement`, `verify:reset-continuity` and
  `verify:home-ui` for v7 preservation, exact retry, product policy and continuity.
- `verify:product-onboarding-ui` for startup/recommendation/Home compatibility; maintain the V4
  native selectors rather than trusting old onboarding/legacy navigation suites (audit F07).
- `verify:e2e-runtime`, `verify:e2e-app-identity`, `verify:release-debug-guards` for QA/release isolation.
- Relevant existing legacy verification groups (`verify:journey`, `verify:protection-reset`,
  `verify:guided-flows`) to preserve retained domain/data compatibility; these do not prove that
  legacy screens should remain exposed.
- Isolated Bloom E2E Maestro checks for final tabs, preserved product deep links, retired legacy
  child links, stale identities, Settings deletion/back, completed-record access and new screen states.
  Retain `.maestro/phase10-continuation.yaml`, `.maestro/phase11-save-recovery.yaml` and
  `.maestro/phase11-obsolete-save-recovery.yaml` as continuity/recovery gates.

Use synthetic E2E storage only; do not reset normal Bloom data or device time. Include relaunch/upgrade
fixtures with both legacy and V4 fields populated and prove navigation changes neither drop v7
fields nor synthesize new records. Preserve the serialized storage key `bloom.localState.v7`,
normal hydration/corruption handling and deletion-generation protection. Review text size, touch
targets, accessibility and safe areas on actual screens after implementation; passing controlled
hook tests is not native screen validation.

Planning validation: route/source/reference inventory reviewed; whitespace check performed for this
new document; final working-tree review confirms only this plan was added. No application tests or
Simulator actions were necessary or run in this phase.

## Kısa Türkçe özet

Onaylı yapı **Home | Learn | Kegel | Progress | More**. Home zaten V4; Learn ve Kegel eksik,
Progress eski verilerden ayrılmalı, More için mevcut Settings bağlantıları yeniden kullanılabilir.
Tracking, Content-Free, Reset ve Panic Home üzerinden mevcut kurallarıyla açılmalı; geçmiş erişimi
Progress altında tasarlanmalı. Eksik ekran/ikon referansları gelmeden eski ekranları yeniden
adlandırmak veya yer tutucu özellik üretmek önerilmiyor. Geçiş küçük adımlarla, v7 verileri,
çalışan ürün rotaları ve kayıt kurtarma davranışı korunarak yapılmalı.
