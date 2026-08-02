# Bloom privacy and local-data retention audit

Audit date: 2026-08-02  
Branch: `fix/privacy-retention-copy`  
Audited commit before the corrections in section 11: `dcc0ae7e4528b8271f9fdc8d309fa105780770ba`

This is a repository-grounded implementation audit, not a legal privacy policy or a platform security certification. Conclusions about operating-system backups, device migration, uninstall behavior, browser profiles, passcodes, and encryption are limited to what the checked-in repository proves.

> **Post-audit implementation status (2026-08-02):** On `fix/production-debug-guards`, after the audited commit, Bloom added a shared `__DEV__`-only debug-tools boundary, guarded the quiz scoring preview and `/debug/bloom-state`, routed release access to `/`, replaced the selected-value Arousal mode test ID, and added `npm run verify:release-debug-guards`. The original findings below remain the evidence for the audited commit. Maestro still shares the normal bundle identifier; a distinct E2E application identity remains follow-up work.

> **Post-audit E2E identity status (2026-08-02):** On `fix/separate-e2e-app-identity`, after the audited commit and release-guard follow-up, Bloom addressed the shared-identity finding by assigning the local E2E development client its own `com.umutcyilmaz.bloom.e2e` application identity and `tms-e2e` URL scheme. Maestro now targets only that isolated identity. The original shared-identity finding remains the evidence for the audited commit.

## 1. Executive summary

Bloom has one runtime persistence authority. Native builds use AsyncStorage, web uses `window.localStorage`, and the whole `BloomLocalState` is serialized as JSON under `bloom.localState.v2` (`src/storage/storageClient.ts:11-31`, `src/storage/bloomStatePersistence.ts:65-76`). No independent feature key, backend, authentication store, analytics client, telemetry client, remote AI call, export/share path, or persisted Demo/E2E namespace was found in `app`, `src`, or the runtime dependencies in `package.json`.

The central findings are:

| Area | Verdict |
| --- | --- |
| Storage boundary | Local app storage only in the inspected application code: AsyncStorage on native and origin `localStorage` on web. The JSON state has no Bloom application-level encryption or app lock. “Local” must not be presented as “encrypted,” “anonymous,” or inaccessible to device/browser/development tools. |
| Data volume | The entire state is rewritten after a canonical mutation. Check-In, completed Pause, and completed Arousal arrays have no cap or expiry. Reset completion dates alone are capped at ten. |
| Quiz retention | Bloom stores all 12 final frequency answers, the final trigger array, a full derived `QuizResult`, a derived `activePlan`, and two copies of the completion timestamp. In-progress quiz answers are transient. No post-scoring reader of persisted `onboarding.quizAnswers` was found. |
| Guided-flow retention | Pause and Arousal drafts persist across relaunch until explicit discard, completion, replacement, or full deletion. Completed records remain indefinitely. Current UI normally needs only the newest few/latest record plus counts or a completion Boolean, not every older raw record. |
| Corrupt/legacy copies | A corrupt or unsupported value remains at its source key and is copied, including its raw payload, to `bloom.localState.corrupt.*`. There is no expiry. A v1 key whose removal fails after successful migration can also remain indefinitely because later loads stop at v2. |
| Full local deletion | Complete for every Bloom-owned key found in this repository: v2, v1, and every quarantine key. It uses the active platform adapter, resets canonical in-memory state and transient Demo settings, waits for durable key removal before success/navigation, and blocks stale write resurrection. |
| Persistence confirmation | Feature mutations report success after changing React state; the AsyncStorage/localStorage write happens later in an effect. Therefore user-facing “saved” text is not a durable-write acknowledgement, and normal feature screens do not surface a later persistence failure. |
| Logging/routes/selectors | Runtime console warnings are generic, development-only strings and contain no state or error payload. No sensitive route/query parameters were found. One selected Arousal mode is interpolated into a `testID`; the debug screen exposes derived state through visible/accessibility hierarchy metadata. |
| Debug/release boundary | Not safe for release as checked in. The quiz scoring inspector is hard-coded on. `/debug/bloom-state` is directly deep-linkable with no release guard and can view or overwrite canonical state. E2E timer shortening is correctly development-gated, but Maestro targets the normal bundle identifier and clears its data container before confirming a Development Client. |
| User copy | Several plainly false or incomplete statements were corrected mechanically in section 11. Remaining “private,” “saved,” personalization, notification, Protection-boundary, and retention language needs product or durability decisions before broader copy changes. |

### Evidence scope

The audit traced:

- every storage adapter call and every repository-defined storage key;
- the v2 envelope, v1 migration, validation/normalization, corrupt-state quarantine, serialized write queue, hydration boundary, and deletion lifecycle;
- every field in `BloomLocalState`, its mutation helpers, feature consumers, Saved/Progress consumers, and journey selector;
- onboarding questions/scoring/debug fixtures;
- Check-In, Protection, Reset, Pause, and Arousal Control screens and lifecycle helpers;
- runtime console/error statements, routes, accessibility labels, `testID` construction, verification scripts, Maestro flows, Expo config, and checked-in iOS configuration;
- user-facing privacy/storage/deletion/account/app-lock/personalization/notification wording.

Dormant future domain interfaces such as `PrivacySettings`, `User`, and types containing `syncStatus` are not runtime persistence. They have no instantiated repository or storage consumer. Likewise, `DemoAppStateProvider` contains three React-memory Settings toggles only; it is not a second guided-flow store (`src/domain/demo/demoTypes.ts:1-7`, `src/app/providers/DemoAppStateProvider.tsx:23-33`).

## 2. Current storage architecture

### 2.1 Runtime path

```text
feature mutation
  -> BloomLocalStateProvider in-memory state
  -> React effect
  -> serialized persistence coordinator
  -> JSON v2 envelope
  -> AsyncStorage (native) or window.localStorage (web)
```

- `StorageClient` exposes asynchronous `getItem`, `setItem`, `removeItem`, and `getAllKeys` (`src/storage/storageAdapters.ts:3-8`).
- Native delegates those operations to `@react-native-async-storage/async-storage` (`src/storage/storageClient.ts:11-25`).
- Web resolves and guards `window.localStorage`. A browser storage exception becomes a structured unavailable error; it is not treated as empty state (`src/storage/storageAdapters.ts:82-188`).
- Memory storage is constructed for tests/non-browser fallback. It is not the native path and is not used to hide a browser storage failure (`src/storage/storageAdapters.ts:63-79,82-140`).

### 2.2 Owned keys and envelope

| Key | Purpose | Retention behavior |
| --- | --- | --- |
| `bloom.localState.v2` | Current `{ version: 2, savedAt, state }` JSON envelope | Rewritten as a whole after state mutations; retained until full deletion or external platform clearing. |
| `bloom.localState.v1` | Known legacy state | Read only when v2 is absent; normalized and copied to v2 before attempted removal. A failed removal is swallowed and not retried automatically once v2 exists. |
| `bloom.localState.corrupt.*` | Stable quarantine record for corrupt or unsupported source values | Stores `sourceKey`, `detectedAt`, `reason`, and the original `rawPayload`; no expiry or recovery cleanup. Full local deletion removes every prefix match. |

Repository-wide searches found no other AsyncStorage/localStorage calls or independent Bloom runtime keys outside `src/storage`. Unrelated app/library storage keys are intentionally preserved; Bloom does not call global `AsyncStorage.clear()` (`src/storage/bloomStatePersistence.ts:140-162`).

### 2.3 Load, normalization, migration, and quarantine

The loader checks v2 first and returns without consulting v1 when v2 exists. If v2 is absent, it checks v1 (`src/storage/bloomStatePersistence.ts:38-63`). Parsed payloads are treated as `unknown`; supported fields are normalized section by section (`src/storage/bloomStateSchema.ts:138-231`). Unknown ordinary state fields are dropped.

For a valid legacy payload, Bloom writes normalized v2 first and only then attempts to remove v1 (`src/storage/bloomStatePersistence.ts:227-257`). This prevents data loss if the new write fails. However, if the v2 write succeeds and v1 removal fails, the exception is swallowed. Because subsequent loads stop at v2, the comment that cleanup can be retried has no implemented retry path; duplicate v1 data remains until full deletion or external clearing.

For invalid JSON, invalid state, or an unsupported version, the active source value is preserved and its entire raw string is copied into a stable quarantine record (`src/storage/bloomStatePersistence.ts:164-225,269-320`). This is conservative for recovery but creates a second high-sensitivity copy. Quarantine is not expired after a later successful hydration.

### 2.4 Hydration and write timing

Normal routes stay behind `BloomHydrationBoundary`, so they do not mount against defaults while durable state is loading (`src/app/providers/AppProviders.tsx:10-21`, `src/app/providers/BloomHydrationBoundary.tsx:12-115`). Mutations requested during loading are queued and applied to validated state; hydration errors block normal routes and autosave (`src/app/providers/BloomLocalStateProvider.tsx:159-240,287-314`).

Writes are serialized and generation-tagged (`src/storage/bloomStatePersistence.ts:86-137`). Feature calls such as `saveCheckInRecord` return a successful `BloomMutationResult` after the in-memory mutation. The actual persistence write is initiated later by a React effect (`src/app/providers/BloomLocalStateProvider.tsx:254-311`). A failure sets `persistenceError`, but normal feature screens do not render that state. Thus “saved” currently means accepted into canonical session state, not confirmed durable storage.

### 2.5 Transient-only and derived state

The following inspected values are not persisted unless/until a later explicit save copies them into `BloomLocalState`:

- quiz `stepIndex` and the partial answer map before final submission;
- Log form values, note text, context visibility, and the current mount's `lastSavedRecord` reference;
- Protection setup selections before Save;
- Reset live countdown/status and Arousal pause countdown/extensions;
- confirmation dialogs, feedback strings, navigation state, loading flags, and live timer values;
- Demo personalization/notification toggles (React memory only);
- computed `todayKey`, Reset day/count/status, latest-record selections, valid-log counts, journey `nextAction`, and presentation strings;
- source-controlled debug answer fixtures and Maestro fixture values before a debug action writes them into canonical state.

Once a Pause/Arousal draft mutation or a Check-In/quiz completion is accepted into canonical state, it is no longer transient: the whole state is scheduled for persistence.

## 3. Persisted field inventory

### 3.1 How to read the inventory

Unless a row says otherwise, its storage location is `bloom.localState.v2 -> envelope.state`, full deletion removes it, and both current and valid legacy payloads pass through the same field normalizer. “Displayed” means normal user UI unless explicitly marked debug-only. Sensitivity is intrinsic to the value; linked records should be handled at the highest sensitivity in that record.

`D/M` means “removed by canonical full deletion / preserved or normalized by migration.”

### 3.2 Envelope, legacy, and quarantine fields

| Location / TypeScript shape | Written at | Read or displayed | Class | D/M | Sensitivity and reason | Necessary now? |
| --- | --- | --- | --- | --- | --- | --- |
| `v2.version: 2` in `PersistedBloomEnvelopeV2` | Every envelope write (`bloomStatePersistence.ts:65-76`) | Envelope dispatch/validation; not displayed | Operational | Yes / New v2 value | Low: format marker | Yes, for version dispatch |
| `v2.savedAt: string` | Real ISO time on every whole-state write | Validated on load; not otherwise read/displayed | Operational timestamp | Yes / New migration-write time, not legacy time | Moderate: reveals last state-write activity | Required by current schema, not by product UI |
| `v2.state: BloomLocalState` serialized as `unknown` | Every autosave | Hydrated into all feature consumers | Mixed | Yes / Yes | High: contains all classes below | Yes, though many members are not |
| `v1` source state | Older/legacy build or failed cleanup | Only when v2 is absent | Legacy mixed data | Yes / Normalized into v2 | High: can duplicate the full dataset | Needed only for migration; leftover copy is not |
| Quarantine key suffix: fingerprint of `sourceKey:rawPayload` | On first corrupt/unsupported detection | Used to reuse a stable backup; not displayed | Operational identifier | Yes / Not migrated | Moderate: stable correlation of a particular payload | Useful for dedupe, not product behavior |
| Quarantine `sourceKey` | Corrupt preservation | Internal load result only | Operational | Yes / Raw preservation only | Low: names a Bloom key | Recovery metadata |
| Quarantine `detectedAt` | Corrupt preservation | Not displayed | Operational timestamp | Yes / Raw preservation only | Moderate: use/recovery time | Not product behavior |
| Quarantine `reason` | Corrupt preservation | A generic reason is retained; raw reason is not shown to users | Operational diagnostic | Yes / Raw preservation only | Low: validation reason excludes payload values | Diagnostic only |
| Quarantine `rawPayload` | Exact original source string | Available only through storage access; deliberately not logged or shown | Raw duplicate | Yes / Preserved verbatim | High: may contain every answer, note, record, and timestamp | Recovery choice; not current feature behavior |

### 3.3 Active plan and onboarding

Types and fields are defined in `src/storage/bloomState.ts:34-89,397-413`; writes are in `bloomState.ts:610-650`, and normalization is in `bloomStateSchema.ts:198-453`.

| Envelope location / field | Written at | Read or displayed | Class | D/M | Sensitivity and reason | Necessary now? |
| --- | --- | --- | --- | --- | --- | --- |
| `activePlan.primaryPattern` | Derived from `quizResult` on save | Debug profile summary; otherwise no direct normal UI read | Derived classification | Yes / Re-derived when result exists | High: sexual-habit classification | Not separately necessary when result exists |
| `activePlan.secondaryPattern` | Same | Debug only | Derived classification | Yes / Re-derived | High: secondary sexual-habit classification | Not separately necessary |
| `activePlan.planName` | Same | Today; fallback Progress/debug | Derived presentation | Yes / Re-derived | High: can reveal profile category | Current UI needs value, but can recompute |
| `activePlan.resultTitle` | Same | Today and Progress fallback/debug | Derived presentation | Yes / Re-derived | High: reveals classification | Current UI needs value, but can recompute |
| `activePlan.recommendedFirstAction` | Same | Journey selector and Progress show logic | Derived journey state | Yes / Re-derived | High: action can imply sensitive profile | Yes for journey, but duplicate of result |
| `onboarding.completed` | Set true with final result | Root redirect, Today/Progress, journey gate | Operational | Yes / Forced true for a valid result | Moderate: participation state | Yes, but derivable from result presence |
| `onboarding.quizAnswers` (all supported key/value pairs) | Final quiz submits the answer map unchanged | No post-score runtime consumer found | Raw input | Yes / Yes; normalizer also preserves supported extra keys | High: direct porn, masturbation, erection, pressure, timing, and trigger answers | No current post-score need |
| `quizResult.scores.PL/PP/CT/FC` | Deterministic scorer | Unguarded scoring/debug UI only | Derived score | Yes / Yes | High: behavior/body-response signals | No normal UI/journey need; debug depends on it |
| `quizResult.normalizedScores.PL/PP/CT/FC` | Deterministic scorer | Unguarded scoring/debug UI only | Derived score | Yes / Yes | High: normalized profile signals | No normal UI/journey need; debug depends on it |
| `quizResult.primaryPattern` | Scorer | Used to derive active plan; debug profile display | Derived classification | Yes / Yes | High: profile label | Needed only to reproduce/derive current presentation |
| `quizResult.secondaryPattern` | Scorer | Used to derive active plan; debug profile display | Derived classification | Yes / Yes | High: secondary label | Same |
| `quizResult.flags.eveningWindow`, `emptyMoments`, `boredom`, `aloneTime`, `stressTrigger`, `phoneLoop`, `firmnessConcern` | Scorer | Debug/scoring inspector only | Derived signals | Yes / Yes | High: direct behavioral and firmness inferences | No normal product consumer found |
| `quizResult.resultTitle` | Scorer | Result and Progress | Derived presentation | Yes / Yes | High: reveals profile | Yes for current display |
| `quizResult.resultBody` | Scorer | Result and Progress | Derived presentation | Yes / Yes | High in context: explains inferred pattern | Yes for current display |
| `quizResult.planName` | Scorer | Result/Progress | Derived presentation | Yes / Yes | High in context | Yes for current display |
| `quizResult.recommendedFirstAction` | Scorer | Copied to active plan and drives journey | Derived journey state | Yes / Yes | High in context | Yes for current journey, not raw answers |
| `quizResult.firstPlanSteps[].title/.description` | Scorer | Result and Progress roadmap | Derived presentation | Yes / Yes | Moderate-to-high: personalized plan content | Yes for current display |
| `quizResult.chips[]` | Scorer | Result and Progress/debug | Derived presentation | Yes / Yes | High: concise classification labels | Yes for current display |
| `quizResult.completedAt` | Final scoring time | Validation; no normal display/read | Operational timestamp | Yes / Yes | Moderate: quiz completion time | No product consumer found |
| `onboarding.completedAt` | Copy of `quizResult.completedAt` | Validation; no normal display/read | Duplicate timestamp | Yes / Yes | Moderate: same activity time retained twice | No |

### 3.4 Reset, debug, and Protection

| Envelope location / field | Written at | Read or displayed | Class | D/M | Sensitivity and reason | Necessary now? |
| --- | --- | --- | --- | --- | --- | --- |
| `tenDayReset.startedAt` (`YYYY-MM-DD` despite name) | Start action or first practice mount | Journey/terminal logic and Progress display | Operational date | Yes / ISO legacy start normalizes to date | High: start of sensitive wellness program | Yes |
| `tenDayReset.completedDates[]` | One unique date per completion, sorted/capped at 10 | Today membership, count, Reset Saved, Progress, terminal journey | Raw activity dates | Yes / Filtered, deduped, capped | High: date-level participation history | Yes for exact current semantics |
| `tenDayReset.lastCompletedAt` | Exact real ISO time on each successful completion | No production/debug reader found | Operational timestamp | Yes / Yes | High: precise time of sensitive activity | No |
| `debug.dateOffsetDays` | Debug next/previous-day actions | Changes derived day, Reset writes, and Arousal `dateKey`; debug display | Test/debug state | Yes / Clamped and preserved | Low alone; can distort user dates if debug is reached | No production need |
| `protection.status` | Configure, pause, resume, turn off | Protection UI, Progress, journey | Operational preference | Yes / Legacy `isEnabled` maps to status | High in context: signals adult-content support usage | Yes |
| `protection.setupCompletedAt` | First valid setup only | Exact value debug-only; null/non-null distinguishes never configured | Operational timestamp | Yes / Yes | High in context: exact setup time | Boolean presence is used; exact time is not |
| `protection.preferredWindow` | Setup/night setup | Prefill/edit and Protection displays | Raw preference | Yes / Yes | High: sensitive routine/window | Yes for saved-setting UI; not enforcement |
| `protection.level` | Setup | Prefill/edit and Protection displays | Raw preference | Yes / Yes | Moderate: support-intensity preference | Yes for saved-setting UI |
| `protection.adultContentPauseEnabled` | Current setup paths write `true` | Protect displays Saved/Not set; no enforcement gate found | Raw preference | Yes / Yes | High: explicit adult-content preference | Only for truthful setting display |
| `protection.nightStartTime`, `nightEndTime` | Setup/night setup | Prefill and display | Raw time preference | Yes / Valid HH:mm preserved/defaulted for legacy night | High: reveals sensitive routine hours | Yes for display; no scheduler consumes it |
| `protection.lastProtectionPauseAt` | Every Intercept mount, even without a later action | Debug only | Raw use timestamp | Yes / Yes | High: precise opening of sensitive-moment support | No normal product need |

### 3.5 Check-In records

`BloomCheckInRecord` is defined at `src/storage/bloomState.ts:157-168`, written by `src/features/log/checkInSubmission.ts:37-99` and `LogScreen.tsx:48-177`, and normalized/deduped at `bloomStateSchema.ts:570-638`.

| `checkIns.records[]` field | Read or display | Class | D/M | Sensitivity and reason | Necessary now? |
| --- | --- | --- | --- | --- | --- |
| `id` | Update identity, hydration dedupe, React key; not displayed | Operational identifier | Yes / Yes, same-ID last wins | Moderate: embeds timestamp plus random nonce and links a record | Yes for current update/dedupe |
| `createdAt` | Sort and month/day in Recent Moments | Raw timestamp | Yes / Yes | High: exact time of a sensitive check-in | Yes for order/display; timing also duplicated in ID |
| `mood` | Recent Moments | Raw input | Yes / Yes | Moderate: emotional state | Yes for current summary |
| `moment` | Recent Moments (evening/boredom/alone/stress/scrolling) | Raw input | Yes / Yes | High: sensitive behavioral context | Yes for current summary |
| `eventType?` | Recent Moments (including adult content/masturbation/both) | Raw input | Yes / Yes | High: explicit sexual activity | Only for optional summary; no Progress/journey need |
| `note?` | Recent Moments, newest three only | Raw free text | Yes / Empty removed; up to 5,000 chars preserved | High: arbitrary personal text | Only for optional history; older notes have no normal UI reach |

### 3.6 Pause draft and completed records

Pause types are at `src/storage/bloomState.ts:212-265`; lifecycle helpers are at `bloomState.ts:795-970`.

| Location / field | Read or display | Class | D/M | Sensitivity and reason | Necessary now? |
| --- | --- | --- | --- | --- | --- |
| `pause.activeSession.id` | Targets update/add/complete/discard | Draft operational ID | Yes / Yes | Moderate: timestamp-bearing linkable ID | Yes |
| `pause.activeSession.startedAt` | Copied to completion; not shown | Draft timestamp | Yes / Yes | High: exact sensitive-session start | Required by validator/record, not UI |
| `pause.activeSession.phase` | Restores check-in/timer/after-pause flow | Draft operational | Yes / Yes | Moderate in context | Yes for resume |
| `pause.activeSession.triggers[]` | Restores form; copied/displayed on completion | Raw draft input | Yes / Yes | High: stress/loneliness/desire/night/habit context | Yes for resume/latest Saved |
| `pause.activeSession.intensityBefore?` | Restores form; copied/displayed | Raw draft input | Yes / Yes | High: urge intensity | Yes for resume/latest Saved |
| `pause.activeSession.selectedAction?` | Restores/copies/displays | Raw draft input | Yes / Yes | High in context | Yes for resume/latest Saved; does not change fixed routing |
| `pause.activeSession.timerStartedAt?` | Only checked as an initialization sentinel | Draft timestamp | Yes / Yes | High: exact timer-start time | Timestamp value itself is unnecessary in current calculation |
| `pause.activeSession.timerDurationSeconds` | Reconstructs configured timer; Add 60 | Operational duration | Yes / Yes | Moderate in context | Yes |
| `pause.activeSession.elapsedDurationSeconds` | Reconstructs remaining time/final duration | Operational duration | Yes / Yes | High when linked to session | Yes |
| `pause.records[].id` | Completion dedupe/identity | Operational identifier | Yes / Same-ID last wins | Moderate | Yes for dedupe |
| `pause.records[].startedAt` | Validation only after completion | Raw timestamp | Yes / Yes | High: exact sensitive-session start | No current post-completion consumer |
| `pause.records[].completedAt` | Sort/latest and Saved date/time | Raw timestamp | Yes / Yes | High: exact completion time | Yes for latest/display |
| `pause.records[].triggers[]` | Latest Saved only | Raw input | Yes / Yes | High | Needed only for truthful latest summary |
| `pause.records[].intensityBefore?`, `intensityAfterChange?` | Latest Saved only | Raw/reflection input | Yes / Yes | High: before/after urge response | Needed only for latest summary |
| `pause.records[].selectedAction?` | Latest Saved only | Raw input | Yes / Yes | High in context | Needed only for latest summary |
| `pause.records[].feltTruth?` | Latest Saved only | Raw reflection | Yes / Yes | High: includes still-pulled/wants-support states | Needed only for latest summary |
| `pause.records[].nextStep?` | Latest Saved only | Raw choice | Yes / Yes | High: includes support/continue choice | Needed only for latest summary |
| `pause.records[].durationSeconds` | Latest Saved only | Operational/raw duration | Yes / Yes | High when linked to event | Needed only for latest summary |

### 3.7 Arousal Control draft and completed logs

Types are at `src/storage/bloomState.ts:267-395`; every session value below can occur in both `arousalControl.draft` and `arousalControl.logs[]`. All are high sensitivity when linked because the record concerns adult-content use, arousal, climax, firmness, anxiety, pleasure, and personal reflections.

| Location / field | Written/read/displayed | Class | D/M | Sensitivity reason | Necessary now? |
| --- | --- | --- | --- | --- | --- |
| Draft/log `id` | Created at mode confirmation; targets all updates, note edit, completion, dedupe | Operational identifier | Yes / Legacy draft may receive derived ID | Timestamp-bearing link across a sexual-practice record | Yes |
| Draft/log `startedAt` | Created with draft; required by validation; not displayed after completion | Raw timestamp | Yes / Yes | Exact sensitive-session start | Draft/validation only; no completed UI need |
| Draft/log `dateKey` | Created from real or debug-offset day; Progress displays | Raw date | Yes / Yes | Date of sexual-practice activity | Yes for current Progress display |
| Log `completedAt` | Added at completion; sorts/selects latest | Raw timestamp | Yes / Yes | Exact completion time | Yes for current newest-log semantics |
| Log `completionStatus?` | Added as `completed`; migration may add `legacyCompleted`; gates validity | Operational marker | Yes / Preserved/derived for genuine legacy record | Linked completion fact | Yes for integrity/journey |
| `mode?` | Starts draft; resumes; Saved/Preview/Progress display; completion requires it | Raw input | Yes / Yes | Practice mode | Yes |
| `focus?` | Before-practice write/resume; Saved displays; completion requires it | Raw input | Yes / Yes | Personal sexual-practice focus | Only for resume/latest summary and validator |
| `adultContent?` | Before-practice write/resume; completion requires it; no completed display | Raw input | Yes / Yes | Explicit adult-content choice | Draft/validator only; no completed-log consumer |
| `firmnessPlan?` | Before-practice write/resume; completion requires it; no completed display | Raw input | Yes / Yes | Explicit firmness plan | Draft/validator only after completion |
| `startingArousalLevel?` | Practice write/resume; Saved/Preview display | Raw body-state input | Yes / Yes | Arousal level | Yes for latest summary |
| `currentArousalLevel?` | Draft resume/update; copied wholesale to log but not read there | Raw draft input | Yes / Yes | Current arousal level | Draft only; unnecessary in completed log |
| `pauseZoneLevel?` | Pause write; Saved/Preview/insight display | Raw body-state input | Yes / Yes | Arousal at pause | Yes for current summaries |
| `afterPauseLevel?` | After-pause write/resume; Saved/Preview display | Raw body-state input | Yes / Yes | Arousal after pause | Yes for current summaries |
| `afterPauseNextStep?` | Controls/resumes draft routing; no completed-log read | Raw choice | Yes / Yes | Continue/pause/finish decision | Draft only |
| `endingChoice?` | Finish write; completion requires; Saved/Preview display | Raw outcome | Yes / Yes | Includes climax/firmness/anxiety/stopping outcome | Yes |
| `highestArousal?` | Updated during practice and can be overwritten by reflection; Saved/Preview/Progress display | Raw/derived input | Yes / Yes | Peak arousal | Yes; cannot safely recompute because reflection may override |
| `pauseCount?` | Draft counter/reflection; summaries display | Raw/derived count | Yes / Yes | Number of pauses in sexual practice | Yes under current formatting |
| `pauseCountBucket?` | Reflection stores 0/1/2/3plus; summaries preserve 3+ meaning | Raw categorical duplicate | Yes / Yes | Same sensitive fact, coarser form | Needed for truthful 3+ semantics; overlaps `pauseCount` |
| `controlFeeling?` | Reflection; Saved/Preview/Progress display | Raw reflection | Yes / Yes | Perceived sexual control | Yes for current summaries |
| `anxietyLevel?` | After-pause form/support/resume; no completed-log read | Raw reflection | Yes / Yes | Anxiety during sexual practice | Draft only; unnecessary in completed log |
| `pleasureQuality?` | Reflection; latest Saved display | Raw reflection | Yes / Legacy string score normalized | Sexual pleasure rating | Only for latest Saved |
| `pressureRushing?` | Reflection; Saved/Preview display | Raw reflection | Yes / Yes | Pressure/rushing | Yes for current summaries |
| `firmnessChange?` | After-pause support/resume; Saved/Preview display | Raw body-response input | Yes / Legacy labels normalized | Erection/firmness change | Yes for current summary |
| `afterwardFeeling?` | Reflection/resume; no modern completed display; legacy completion evidence uses it | Raw reflection | Yes / Yes | Emotional state after sexual activity | Draft and legacy validation only |
| `reflectionCompleted?` | Set by reflection; completion/validity requires; Progress displays Saved/Not logged | Operational marker | Yes / Yes | Confirms a sensitive reflection exists | Yes under current integrity model |
| `durationPreference?` | Duration completion discriminator; Saved/Progress logic | Raw choice | Yes / Yes | Whether/how duration was logged | Yes to distinguish skipped/estimated/exact |
| `durationSeconds?` | Range becomes fixed estimate; exact input persists as seconds; displayed rounded | Raw/derived duration | Yes / Yes | Sexual-practice duration | Yes for current duration display |
| `note?` | Practice write and latest-completed-log edit/display; max 5,000 chars | Raw free text | Yes / Empty removed, valid note preserved | Arbitrary intimate text | Optional latest summary only; old notes remain inaccessible |

No field has an automatic retention deadline. Record arrays are deduplicated by ID and sorted, but not size-limited. Migration preserves every valid supported field above; it does not introduce expiration or aggregation (`src/storage/bloomStateSchema.ts:570-1049`).

## 4. Quiz/profile retention

### 4.1 What is retained

The completed answer map contains all 12 required 0–3 frequency answers:

1. `porn_empty_moments`
2. `porn_without_desire`
3. `porn_to_masturbation`
4. `automatic_phone_loop`
5. `pressure_speed_friction`
6. `force_arousal`
7. `mechanical_get_it_done`
8. `specific_pressure_dependency`
9. `arousal_rises_fast`
10. `notice_too_late`
11. `too_late_to_slow`
12. `checking_firmness`

It also retains `loop_triggers`, an array that may contain `bathroom`, `workBreak`, `gamingBreak`, `beforeSleep`, `bored`, `stressed`, `alone`, `scrolling`, or `notSure` (`src/features/onboarding/quiz.ts:13-40,91-204`). The final screen calls `scoreOnboardingQuiz(finalAnswers)`, then passes the same `finalAnswers` object and the derived result to canonical state (`src/features/onboarding/screens/OnboardingQuizScreen.tsx:54-57`).

The same envelope also retains:

- raw and normalized PL/PP/CT/FC score components;
- primary and optional secondary profile identifiers;
- seven Boolean trigger/concern flags;
- result title/body, plan name, recommended first action, plan steps, and chips;
- `quizResult.completedAt` and a duplicate `onboarding.completedAt`;
- a separately persisted `activePlan` subset, which is recomputed from the result on hydration.

Debug fixtures define complete realistic answer maps for five profiles. They are only source constants until invoked, but `Set only` and `Start as this profile` write them into the same canonical answer/result fields with no fixture provenance marker (`src/features/onboarding/quiz.ts:268-325`, `src/features/debug/screens/BloomStateDebugScreen.tsx:75-86`).

### 4.2 What is transient

Partial onboarding is not durable. `stepIndex` and `answers` are component `useState` values; closing, remounting, or terminating before final submission loses them (`OnboardingQuizScreen.tsx:39-44`). The trigger step can be skipped by submitting an empty array. The 12 frequency questions disable Continue until answered (`OnboardingQuizScreen.tsx:50-52,116-129,589-602`).

### 4.3 Required, derived, and unused values

| Need | Actual dependencies |
| --- | --- |
| Render current Result | `resultTitle`, `resultBody`, `chips`, and `firstPlanSteps`; the plan/action presentation also uses derived result fields (`OnboardingResultScreen.tsx:21-134`). |
| Render Today/Progress | `activePlan.planName/resultTitle`, or corresponding `quizResult` fields; Progress also uses result plan/chips/steps (`TodayScreen.tsx:39-54`, `ProgressScreen.tsx:48-99,145-175`). |
| Make current journey decisions | `onboarding.completed`, `activePlan.recommendedFirstAction`, Protection/Reset state, and existence of a valid completed Arousal log (`src/domain/journey/getNextBloomAction.ts:100-223`). |
| Development inspection | Scores, normalized scores, flags, patterns, chips, and profile result. |
| Persisted raw answers | No post-score reader was found. |

`scoreOnboardingQuiz` is deterministic for a given answer map and supplied `completedAt`. While raw answers exist, Bloom can reproduce the same result using the original completion timestamp (`src/features/onboarding/quiz.ts:350-423`). Conversely, if the full derived result remains, removing raw answers later would not break any current normal user-facing Result, Today, Progress, or journey consumer.

Removing answers would prevent future answer-level review, rescoring under a changed algorithm, and any future journey decision that had not first been expressed in retained derived state. It would also require an approved schema/type/normalizer/test migration. The current normalizer is broader than today's questionnaire: any key matching `[A-Za-z0-9_-]{1,100}` with a supported scalar/string/string-array value can survive, so legacy/future extra answers may be retained too (`src/storage/bloomStateSchema.ts:257-298`). No raw answers were removed in this pass.

## 5. Guided-flow retention

### 5.1 Cross-feature summary

| Feature | Persisted draft/state lifecycle | Completed/history lifecycle | Saved/Progress behavior | Individual deletion | What current Progress/journey actually need |
| --- | --- | --- | --- | --- | --- |
| Check-In | No persisted form draft. A save creates a new ID/time; context/note can update only the record referenced by this screen mount. Unsaved abandonment leaves nothing. | All records retained, unbounded. Same-ID update merges; hydration dedupes. | Recent Moments is read-only and shows newest 3. Overall Progress and journey read no Check-In record. | None; an existing note cannot be cleared by saving blank. | Nothing. Only the newest 3 are visible anywhere in normal UI. |
| Protection | Setup choices are transient until Save. Canonical state is one current configuration, not a draft/history array. | Pause/off preserve configuration. Intercept mount overwrites one `lastProtectionPauseAt`. | Protection screens display preferences. Progress/journey use status; debug shows more. | No field/config clear; Turn off deliberately retains it. | `status` for journey; current setting fields for truthful settings display. |
| 10-Day Reset | No persisted timer draft. Opening practice starts the program; live countdown is transient. | Unique completed date keys, max 10. No attempt/duration/note record. | Saved is read-only; Progress uses start/date-derived count/today/terminal state. | No date/program restart/delete. | `startedAt` and date membership/count. `lastCompletedAt` is unused. |
| Pause | Starting creates a canonical in-memory draft immediately and schedules it for local persistence. After a successful write, force-quit/ordinary abandonment retains it; explicit close/discard removes it and a new start replaces it. | Completion atomically changes canonical memory by clearing the draft and appending one immutable record, then schedules persistence. Same-ID completion is idempotent. History is unbounded. | Saved never completes on mount; it redirects active draft to Timer and shows latest record + total count. Overall Progress/journey use none of it. | Active draft can be discarded; no completed-record delete/edit. | Exact current output needs latest detail + count only. |
| Arousal Control | Confirming a mode creates a canonical in-memory draft and schedules it for local persistence. Every step targets the same ID. After a successful write, abandonment retains it; explicit close/new mode discards or replaces it. Pause countdown itself is transient. | Duration completion validates required fields, changes canonical memory by spreading the draft into one log and clearing it, then schedules persistence. Same-ID completion is idempotent. History is unbounded. | Saved/Preview do not create/complete on mount and show latest valid log. Saved may edit the latest note. Overall Progress shows latest + valid count; journey needs any valid completion. | Active draft discard and latest note edit only; no log delete/older edit. | Latest detail, valid-log count, and an ever-completed Boolean—not every old raw log. |

### 5.2 Check-In details

Every primary Save creates a new timestamp-bearing ID, including repeated saves in one mount. Context and note actions update the current mount's `lastSavedRecord`; after remount, earlier records are display-only (`src/features/log/screens/LogScreen.tsx:34-177`, `src/features/log/README.md:7-12`). Same-ID state updates preserve an existing optional event/note when an incoming update omits it (`src/storage/bloomState.ts:746-780`).

Recent Moments sorts the whole array but renders only three. Records older than those three have no inspected production consumer. Their event types and notes remain in storage indefinitely (`src/features/log/components/RecentMomentsCard.tsx:18-43`).

### 5.3 Protection details

`turnOffProtection` changes only `status`; UI explicitly says the configuration remains (`src/storage/bloomState.ts:715-726`, `src/features/protect/screens/ProtectionActiveScreen.tsx:106-115,166-175`). No scheduling/device blocking implementation consumes the configured window or time; they are in-app saved preferences.

`ProtectionInterceptScreen` calls `recordProtectionPause()` in a mount effect, regardless of current Protection status or whether the user chooses a follow-up action (`src/features/protect/screens/ProtectionInterceptScreen.tsx:16-22`). The resulting exact timestamp is debug-only and overwritten, not a growing history.

### 5.4 Reset details

Mounting the practice route starts Reset if it has not already started. Therefore an abandoned first practice retains a start date but no completion (`src/features/reset/screens/TenDayResetPracticeScreen.tsx:58-73`). Timer completion, Finish, and “I already did it” converge on the same idempotent date completion. Bloom stores no proof, duration, attempt, or reflection for the daily action (`TenDayResetPracticeScreen.tsx:75-149,197-286`).

Completion ignores a duplicate date and anything after ten valid unique dates (`src/storage/bloomState.ts:573-607`). Saved is read-only and requires today's date membership. Derived day/count/terminal Booleans are not persisted separately.

### 5.5 Pause details

Pause Intro replaces any earlier active draft with a new record ID. Check-In choices stay component-local until Start Timer or Save and Close; Save and Close can create a zero-duration record without after-pause values (`src/features/pause/screens/PauseIntroScreen.tsx:13-33`, `PauseCheckInScreen.tsx:69-126`).

The timer records transitions and configured/elapsed duration. `timerStartedAt` is not used to calculate wall-clock elapsed time; it acts only as an initialized sentinel, making its exact timestamp an unnecessary high-sensitivity representation under current logic (`src/features/pause/screens/PauseTimerScreen.tsx:70-147`, `src/features/pause/pauseTimerState.ts:9-108`).

Completion copies draft selections, adds optional after-pause selections and a completion time/duration, clears the draft, and appends once. The Saved route is read-only: draft -> Timer, no record -> Intro, otherwise latest record (`src/storage/bloomState.ts:871-970`, `src/features/pause/screens/PauseSavedScreen.tsx:29-60`). All older detail is retained only so `records.length` can be shown.

### 5.6 Arousal Control details

Writes occur stepwise: mode; focus/adult-content/firmness plan; live levels/pause/note; after-pause values; ending; reflection; then duration/completion. The final helper spreads every draft field into the completed log (`src/storage/bloomState.ts:973-1105`). That wholesale spread retains draft-only values such as `currentArousalLevel`, `afterPauseNextStep`, and `anxietyLevel` after they cease to have a consumer.

Current completion requires mode, focus, adult-content choice, firmness plan, ending, completed reflection, and a duration preference (`src/storage/bloomState.ts:1171-1203,1232-1243`). Some required fields are not displayed from completed logs; they are retained to satisfy the validator. Legacy-completion recognition separately relies on a former field signature including afterward feeling (`bloomState.ts:1206-1229`).

`pauseCount` and `pauseCountBucket` duplicate one fact. The bucket is necessary to avoid presenting `3plus` as exactly three, while numeric count remains part of current/legacy formatting. Consolidation requires a migration decision.

Saved and Progress Preview guard against invalid/missing records and never complete one on mount. Saved's only post-completion mutation edits the latest valid log's note; blank does not delete an existing note (`src/features/arousal-control/screens/PracticeSavedScreen.tsx:22-63`, `ProgressPreviewScreen.tsx:19-32`). Historical logs beyond the latest are used only for validity/count and `some(valid)` journey logic.

### 5.7 Debug “fresh journey” is not full data reset

`saveOnboardingResultForFreshJourneyState` resets Reset, Protection, and the current Arousal draft, but preserves Check-Ins, completed Pause records, and completed Arousal logs (`src/storage/bloomState.ts:627-642`). A debug “Start as this profile” can therefore combine a fixture profile with pre-existing histories. It should not be described as a clean user-data state.

## 6. Local-data deletion coverage

### 6.1 Coverage matrix

| Target | Covered? | Evidence / qualification |
| --- | --- | --- |
| Current `bloom.localState.v2` | Yes | Enumerated and removed by `clearAllBloomStorage` (`src/storage/bloomStatePersistence.ts:140-162`). |
| Known `bloom.localState.v1` | Yes | Removed whether or not it is an orphan left after migration. |
| Every `bloom.localState.corrupt.*` | Yes | Prefix enumeration removes all quarantine copies. |
| Quiz answers/result/active plan | Yes | Members of the removed whole-state envelope. |
| Reset, Protection, Check-In, Pause, Arousal, notes, dates, IDs, debug offset | Yes | Members of the removed whole-state envelope. |
| Native AsyncStorage values | Yes for the known Bloom keys | The same coordinator uses the native adapter. It does not clear unrelated storage. |
| Web localStorage values | Yes for the known Bloom keys | The same coordinator uses the guarded web adapter. It does not clear other origin keys. |
| Independent Bloom feature keys | None found | Repository-wide storage-call/key search found no other runtime key. |
| Demo Settings | Not persisted; reset in memory | `resetDemoAppState()` runs after durable deletion succeeds (`src/app/providers/LocalDataLifecycleProvider.tsx:92-100`). |
| Pending hydration mutations | Yes in effect | Cleared and hydration attempt invalidated before deletion (`BloomLocalStateProvider.tsx:321-325`). |
| Queued/serialized writes | Yes | Generation increment invalidates older queued writes; deletion waits for the active queue (`bloomStatePersistence.ts:86-137`). |
| In-memory canonical state | Yes after durable removal | Replaced with `createDefaultBloomState()` and excluded from immediate autosave (`BloomLocalStateProvider.tsx:327-342`). |
| Writes during reset navigation | Blocked | Mutations remain blocked until `/onboarding` is confirmed (`BloomLocalStateProvider.tsx:316-377`, `LocalDataLifecycleProvider.tsx:74-81`). |
| Persisted E2E-only namespace | None exists | E2E fixtures use canonical state. External Maestro `clearState` can clear the entire app container; see section 8. |
| OS/browser backups, migrated device copies, external screenshots/artifacts | Not established | Outside the repository-owned key operation; platform policy is unresolved in section 10. |

### 6.2 Awaiting, failure, and stale-write behavior

The UI lifecycle de-duplicates concurrent delete calls, sets `deleting`, awaits `deleteAllBloomLocalData`, then resets Demo memory and sets `success` (`src/app/providers/LocalDataLifecycleProvider.tsx:83-119`). Navigation is triggered only from the success state. A navigation failure message explicitly distinguishes successful deletion from failure to open onboarding (`LocalDataLifecycleProvider.tsx:50-72`).

If storage removal fails, canonical in-memory state is retained, the app does not mark success, and the user sees that existing data may still be present. The current key is removed last, after quarantine/legacy keys, so a mid-delete failure favors retaining the active source rather than partially claiming success (`bloomStatePersistence.ts:143-161`).

Stale-write protection is substantive: the coordinator increments its generation before waiting for queued work, skips queued writes from the older generation, and rejects new persistence writes while deletion is active. The provider additionally blocks feature mutations and avoids autosaving the installed default state during the reset transition.

### 6.3 Caveats and test gap

Migration and quarantine writes call the storage client directly rather than the coordinator (`bloomStatePersistence.ts:232,305`). The normal UI waits behind hydration, and hydration-error reset occurs after quarantine completes, so no user-reachable resurrection was demonstrated. There is nevertheless no provider-level integration test that deliberately overlaps retry/reset with those direct writes. This is a verification gap, not a confirmed deletion defect.

Deletion proves removal of every repository-known Bloom key, not hypothetical unknown keys from an unrepresented historic build. Any future namespace must be added to the canonical deletion inventory and migration verification.

## 7. Logging and accidental exposure

### 7.1 Runtime console and errors

Runtime console calls are fixed strings behind `__DEV__`:

- hydration/storage/save/delete warnings in `src/app/providers/BloomLocalStateProvider.tsx:207-230,277-279,350-352`;
- post-delete navigation warning in `src/app/providers/LocalDataLifecycleProvider.tsx:68-70`.

No raw state, note, answer map, record, identifier, route parameter, or caught error object is logged. User-facing hydration/deletion errors are generic and do not expose schema validation paths or raw payloads (`BloomLocalStateProvider.tsx:736-749`). No immediate console edit was warranted.

Verification scripts serialize synthetic fixtures and print pass/fail assertion text. They use temporary compiler output and do not load a real installed application's storage. No production user payload logging was found.

### 7.2 JSON and quarantine

The whole state is necessarily exposed to `JSON.stringify` before local persistence. The more important accidental-copy boundary is quarantine: it serializes the entire original raw payload inside another local value. The payload is not logged or shown, but it is a second durable high-sensitivity copy with no expiry (`src/storage/bloomStatePersistence.ts:292-313`).

### 7.3 Routes and query parameters

No `useLocalSearchParams`, sensitive query object, or sensitive route parameter was found. Feature navigation uses fixed constants; notes, answers, triggers, intensities, profile values, and record IDs do not travel through URLs. The exception is not a parameter leak but a reachability defect: the fixed `tms:///debug/bloom-state` path reaches an unguarded state inspector.

### 7.4 Accessibility and test identifiers

Most value-suffixed test IDs identify a fixed option rendered regardless of whether it is selected. No arbitrary note, raw answer map, or timestamp is interpolated into a production control ID. Selected state on an accessible input is legitimate UI accessibility, not hidden logging.

Concrete concerns:

- `MainPracticeScreen` renders only the active practice and interpolates `draft.mode` into `bloom.arousal.practice.mode.${draft.mode}` (`src/features/arousal-control/screens/MainPracticeScreen.tsx:178-181`). This exposes an actual chosen value in the hierarchy rather than identifying the control semantically.
- Debug summary rows interpolate current values into accessibility labels for Pause count, Reset count, Arousal log count, and next-action label (`src/features/debug/screens/BloomStateDebugScreen.tsx:439-479`). The counts/action are moderate metadata, while the same unguarded screen visibly exposes much more sensitive state.
- Fixed `Urge strength N` labels describe each numeric choice and carry proper selected state. They are necessary assistive semantics, not an accidental private-value interpolation (`src/features/pause/components/UrgeStrengthControl.tsx:28-34`).

Changing the active-mode selector would require coordinated Maestro selector updates, so it was documented rather than changed in this evidence pass.

### 7.5 Maestro and generated artifacts

Maestro YAML contains synthetic sensitive scenarios: adult-content choice, firmness change, anxiety, arousal/control/pleasure scores, duration, Pause triggers/intensity/truth/next step. No `takeScreenshot` command and no generated image/video artifact are committed. `.maestro/README.md` encourages hierarchy/Studio inspection, which can capture whatever state is visible, but no artifact storage, scrubbing, or retention policy is defined.

## 8. Debug/release exposure

### 8.1 Unguarded scoring inspector — critical

`SHOW_QUIZ_SCORING_PREVIEW` is hard-coded to `true`, with a TODO to disable it, and is not combined with `__DEV__` (`src/features/onboarding/screens/OnboardingQuizScreen.tsx:28-31,137-143`). Every normal quiz renders “Test scoring preview,” selected answer/trigger labels, raw and normalized scores, predicted profile, recommended action, flags, and a Clear action (`OnboardingQuizScreen.tsx:357-490`).

This exposes sensitive current input and derived classification to any release user or anyone viewing the screen. Partial answers remain transient, but the exposure is still user-facing and the tool changes normal quiz behavior. Per the task boundary, it is reserved for the dedicated production-debug-guards implementation rather than changed here.

### 8.2 Unguarded debug route — critical

`app/debug/bloom-state.tsx` always renders `BloomStateDebugScreen`; there is no `__DEV__` or release redirect. The route constant is registered at `src/constants/navigation.ts:28`, the `tms` URL scheme is configured in `app.config.ts:9`, and Maestro opens `tms:///debug/bloom-state` directly (`.maestro/subflows/open-debug-state.yaml:1-13`). Hiding the Progress button behind `isDevelopment` (`src/features/progress/screens/ProgressScreen.tsx:30,122-139`) does not protect a direct route/deep link.

The screen displays:

- quiz result title, scores, normalized scores, flags, chips, profile, and next recommendation;
- Reset dates/state and the persisted debug offset;
- Protection status, level, window, adult-content pause flag, times, and timestamps;
- latest Check-In mood/moment/time;
- Pause counts, intensity, and duration;
- Arousal active ID, date, mode, peak, pause count, control, pressure, and duration.

It can also overwrite the saved profile/raw fixture answers, reset parts of the journey, change the persisted date offset, clear onboarding, and perform canonical full deletion (`src/features/debug/screens/BloomStateDebugScreen.tsx:75-88,114-241,245-382`). Debug reset itself is correctly wired to the canonical deletion lifecycle.

### 8.3 E2E timer gate — correct

`EXPO_PUBLIC_E2E_MODE=1` shortens timers only when `__DEV__` is true. Release evaluation always selects production durations (`src/shared/runtime/e2eMode.ts:26-58`). The E2E environment flag does not itself enter persisted state or complete records.

### 8.4 Maestro app-container deletion risk — high

All top-level Maestro flows and the shipped config target `com.umutcyilmaz.bloom`. Each top-level flow invokes `open-bloom.yaml` with `CLEAR_STATE: "true"`. That helper calls `launchApp: clearState: true` before it waits for “Development Servers” (`.maestro/subflows/open-bloom.yaml:1-28`; examples in `.maestro/arousal-complete.yaml:1-8` and the other top-level flows). Both checked-in Xcode configurations also use the same bundle identifier (`ios/Bloom.xcodeproj/project.pbxproj:364,395`).

Therefore a mistaken Maestro run can erase the normal installed Bloom data container before it discovers that the target is not the expected Development Client. An in-app `__DEV__` guard cannot protect data that Maestro clears before launch. A distinct E2E application identity/scheme is required; native configuration changes were explicitly out of scope for this pass.

### 8.5 Debug fixture contamination

Debug fixtures write realistic answers and results into canonical state, not a separate test namespace. “Start as this profile” clears Reset/Protection/current Arousal draft but preserves Check-In, Pause, and completed Arousal histories. Release access can therefore both reveal existing data and create a mixed fixture/user state. No debug tools were removed because Maestro depends on them.

## 9. User-facing privacy-copy audit

The audit treated “private” as a security or access-control claim when it describes storage, not merely as a tone word. Bloom currently stores ordinary JSON through AsyncStorage or localStorage. It does not implement an app lock, protected storage, or app-level encryption, so copy must not imply that local data is inaccessible to someone with device, browser-profile, backup, developer-tool, or operating-system access.

### 9.1 Copy corrected in this pass

| Screen/file | Exact previous copy | Behavior claimed | Classification before correction | Evidence-based issue | Exact current copy |
| --- | --- | --- | --- | --- | --- |
| Onboarding introduction — src/features/onboarding/screens/OnboardingIntroScreen.tsx | “Answer a few private questions so Bloom can suggest a simple first path.” | The questions have a privacy property and drive the first path. | Technically true but potentially misleading | “Private” can imply an unimplemented access-protection boundary. | “Answer a few personal questions so Bloom can suggest a simple first path.” |
| Onboarding introduction — src/features/onboarding/screens/OnboardingIntroScreen.tsx | “Your answers stay private on this device.” | Answers remain confidential and device-bound. | Unsupported | Local persistence is established, but access control, Bloom encryption, backup behavior, and exclusive physical-device retention are not. | “When you finish, Bloom stores your answers in this app’s or browser’s local storage. Data Controls in Settings can delete Bloom’s locally stored data.” |
| Today and Progress — src/features/today/screens/TodayScreen.tsx; src/features/progress/screens/ProgressScreen.tsx | “Answer a few private questions…” | Same privacy property as onboarding. | Technically true but potentially misleading | Repeated the unsupported protection implication. | “Answer a few personal questions…” |
| Settings home — src/features/settings/screens/SettingsHomeScreen.tsx | “Manage privacy, preferences, and account options.” | Account options exist on or through Settings. | False | No account flow or account option exists in the audited application. | “Manage privacy and preferences.” |
| Settings home — src/features/settings/screens/SettingsHomeScreen.tsx | “Your space, your control” and “You choose what to record, what to skip, and what to delete.” | Every input is optional and selectively deletable. | False | Most quiz questions are required, and deletion is all-or-nothing rather than field- or record-level. | “Your data controls” and “Choose optional details to record, and use Data Controls to delete Bloom’s data from this app’s or browser’s local storage.” |
| Privacy Overview — src/features/settings/screens/PrivacyOverviewScreen.tsx | “You choose what to answer” and “Sensitive questions can be skipped anytime.” | Every sensitive quiz answer is skippable. | False | The trigger question can be skipped, but all 12 frequency questions require an answer. | “Quiz choices” and “The trigger question can be skipped. Frequency questions currently require an answer.” |
| Privacy Overview — src/features/settings/screens/PrivacyOverviewScreen.tsx | “You control what is saved” and “You can review and delete your history from Data Controls.” | Data Controls supports history review and selective history deletion. | False | It offers neither history review nor record-level deletion. | “Delete Bloom’s local data” and “Data Controls can remove Bloom’s data from this app’s or browser’s local storage.” |
| Privacy Overview — src/features/settings/screens/PrivacyOverviewScreen.tsx | “A simple view of how this app handles personal reflections.” | Broad handling summary. | Unclear | It did not define its limited scope and did not inventory state. | “A summary of Bloom’s current local-data controls.” |
| Data Controls — src/features/settings/screens/DataControlsScreen.tsx | “Review and manage data stored on this device.” | Users can review persisted data. | False | The screen has no record-review view, but it can summarize categories and perform canonical deletion. | “See what Bloom stores and delete its data from this app or browser.” |
| Data Controls — src/features/settings/screens/DataControlsScreen.tsx | “Check-ins, pause sessions, and protection preferences may be used to personalize your experience.” | A partial inventory is used by a personalization system. | Unsupported and materially incomplete | It omitted onboarding answers/results, Arousal/Reset/drafts/metadata, while the Settings personalization toggle has no consumer. | “Bloom stores onboarding answers and results; check-ins; Pause and Arousal Control drafts and records; Reset progress; Protection preferences; optional notes; and supporting dates, times, and identifiers.” |

These edits make existing behavior more precise. They do not create a new privacy promise, delete data, alter a selector, or imply a platform guarantee.

### 9.2 Accurate or appropriately limited copy left unchanged

| Screen/file | Exact current copy | Behavior claimed | Classification | Evidence |
| --- | --- | --- | --- | --- |
| Data Controls — src/features/settings/screens/DataControlsScreen.tsx | “This removes your onboarding result, plans, Reset progress, practice records, and other Bloom data from this app’s or browser’s local storage.” | The canonical action removes Bloom's categories from the currently addressed storage container. | Accurate | The action awaits deletion of v2, v1, and every quarantine key, then resets canonical and Demo memory. It does not claim removal from backups or other platform copies. |
| Data Controls — src/features/settings/screens/DataControlsScreen.tsx | “This cannot be undone.” | Bloom offers no in-app restore after delete-all. | Accurate within the app, but intentionally not a secure-erasure claim | No restore path exists. The sentence does not say “permanently erased,” “removed from backups,” or “unrecoverable by the platform.” |
| Hydration boundary — src/app/providers/BloomHydrationBoundary.tsx | “Your existing data has not been replaced. You can try again or reset the local data on this device.” | Failed/unsupported hydration preserves the source and offers retry or canonical reset. | Accurate | Autosave is blocked on hydration error; invalid sources are preserved/quarantined; reset uses the same canonical lifecycle. |
| Hydration boundary — src/app/providers/BloomHydrationBoundary.tsx | “Reset local data?” and “This cannot be undone.” | Reset uses the all-local-data destructive path with no Bloom restore. | Accurate within the same bounded meaning as Data Controls | The same awaited deletion lifecycle is invoked. |
| Deletion failure — src/app/providers/LocalDataLifecycleProvider.tsx | “Bloom couldn’t delete all local data. Your existing data may still be present.” | A failed deletion is not reported as success. | Accurate and appropriately cautious | Failure retains/returns the error state; success/navigation is not set. |
| Post-deletion navigation failure — src/app/providers/LocalDataLifecycleProvider.tsx | “Your local data was deleted, but Bloom couldn’t open onboarding.” | Storage deletion can succeed even if navigation fails. | Accurate | The message is set only after deletion success and a caught route replacement failure. |
| App Lock — src/features/settings/screens/AppLockSettingsScreen.tsx | “Add an extra layer of privacy when available.” and “App Lock is planned for a future version. No biometrics or protected storage are connected yet.” | App Lock is unavailable and no protected-storage/biometric control exists today. | Accurate; the subtitle is clarified by the body | No App Lock, biometric, SecureStore, Keychain, or Keystore integration was found. |
| Privacy Overview — src/features/settings/screens/PrivacyOverviewScreen.tsx | “Patterns, not judgment” and “The app uses small signals to support awareness, not to judge you.” | Product purpose/tone, not a confidentiality or retention guarantee. | Accurate as product framing | The scorer derives signals; the wording does not assert security, diagnosis, anonymity, or storage behavior. |

The current UI does not claim that data is anonymous, encrypted, excluded from backups, synchronized, stored in a cloud, sold, shared with third parties, or used for analytics. Those absent claims should remain absent until separately verified.

### 9.3 Copy still requiring product or implementation decisions

| Screen/file | Exact current copy or behavior | Classification | Mismatch or uncertainty | Evidence-based replacement direction |
| --- | --- | --- | --- | --- |
| Data Controls — src/features/settings/screens/DataControlsScreen.tsx | “Personalized recommendations are on/off” and “Toggle personalization.” | False as an effective control | The value is component memory only and no recommendation or journey consumer reads it. | Remove it, label it as a non-functional preview, or implement and persist a defined effect before calling it a control. |
| Notifications — src/features/settings/screens/NotificationSettingsScreen.tsx | “Choose gentle reminders that stay discreet”; “Reminders paused: yes/no”; “Discreet wording: on/off”; and two functional-looking toggles. | Unsupported | Values are component memory only; no notification permission, integration, scheduler, or delivery consumer was found. | Remove or label the screen as a preview, or implement the feature and describe its exact effect. |
| Subscription — src/features/settings/screens/SubscriptionSettingsScreen.tsx | “Basic check-ins, pause tools, privacy overview, and deletion basics should remain available without premium.” | Unclear future policy | These controls are currently ungated, but “should remain” is an unratified future promise. | Adopt it as a documented policy or use a present-tense statement limited to the current build. |
| Protection — src/features/protect/screens/ProtectionActiveScreen.tsx | “Bloom keeps this pause plan inside the app. It is optional, reversible, and available when you choose it.” | Technically true but potentially misleading | Optional/reversible/status behavior is accurate; “inside” may be read as a security boundary and does not identify deletable local app data. | Prefer: “Bloom stores this optional pause plan with its local app data. You can pause, resume, or turn it off.” |
| Protection status — src/features/protect/screens/ProtectScreen.tsx | “Your saved in-app pause plan is available when you choose to open it”; “Protection is paused inside Bloom”; “Your settings are saved and ready when you choose to resume”; and Saved preference/option labels. | Mostly accurate, but unclear as a storage boundary and durability acknowledgement | The singleton preferences remain in canonical state, but “inside Bloom” is not protected-storage language and “saved” precedes durable-write acknowledgement. | Standardize local-storage wording after the terminology/durability decisions. |
| Protection detail — src/features/protect/screens/ProtectionActiveScreen.tsx | “Your saved in-app pause preferences are still available”; “Bloom can remember your local pause-plan settings after setup”; “Your in-app pause plan and preferences are still saved”; and the related saved-plan/resume descriptions. | Mostly accurate, but potentially misleading about durability | The values are retained and turn-off preserves them, but disk persistence is asynchronous and “in-app” is not an access-control boundary. | Distinguish accepted/unsaved/durably saved state, then use one precise “local app data” description. |
| Today and Progress — src/features/today/screens/TodayScreen.tsx; src/features/progress/screens/ProgressScreen.tsx | “Your saved Protection settings are still available inside Bloom.” | Technically true for hydrated state, but unclear as a security boundary | The screens read persisted Protection configuration; “inside” does not mean encrypted or inaccessible. | Prefer “Your Protection settings remain in Bloom’s local app data” after durability semantics are fixed. |
| Log header — src/features/log/screens/LogScreen.tsx | “A private place to notice what is here.” | Technically true as product tone but potentially misleading as security | Check-ins/notes are ordinary persisted JSON and have no individual deletion. | Prefer “A personal place to notice what is here,” unless “private” is approved under a documented threat model. |
| Log reflection — src/features/log/components/PrivateReflectionCard.tsx | “Private reflection.” | Technically true as intended audience but potentially misleading as access control | The note is persisted with the Check-In and is not individually removable in current UI. | Prefer “Reflection” or “Personal reflection.” |
| Arousal Saved — src/features/arousal-control/screens/PracticeSavedScreen.tsx | “Private note saved for this practice”; “Private context, not a score”; “Private note”; and “Add private note.” | Potentially misleading as access control; “saved” also has uncertain durability | The note/context are ordinary local JSON; older notes may remain when only latest is reachable. | Prefer “Note,” “Add a personal note,” and “Optional context, not a score,” then use “saved” only after acknowledgement. |
| Arousal Progress Preview — src/features/arousal-control/screens/ProgressPreviewScreen.tsx | “Duration is private context, not a score. Focus on awareness, not time.” | Non-judgment purpose is accurate; “private” is potentially misleading | Duration persists in a high-sensitivity full record without a protected-storage boundary. | Prefer “Duration is optional context, not a score. Focus on awareness, not time.” |
| Exercises — src/features/exercises/screens/ExercisesScreen.tsx | “Add private note.” | Potentially misleading as access control | The CTA opens the persisted Log note flow. | Prefer “Add personal note” or “Add note.” |
| Optional duration — src/features/arousal-control/screens/OptionalDurationScreen.tsx | “Duration is saved only as a personal trend. It is not rated as good or bad.” | False/incomplete retention description; non-judgment clause accurate | Duration is retained in a complete raw session record, not only as an aggregate trend. | Prefer: “Duration is optional context for your saved practice. Bloom does not rate it.” |
| Session reflection — src/features/arousal-control/screens/SessionReflectionScreen.tsx | “These answers are only for noticing patterns over time.” | Unclear | “Only” states a purpose limitation, while the full reflection record is retained and surfaced in latest-session views. | Name the saved practice record and its current uses, or remove “only.” |
| Check-In save — src/features/log/checkInFeedback.ts; src/features/log/screens/LogScreen.tsx | “Check-in saved”; “Context saved with your recent moment”; and “Note saved with this check-in.” | Technically true for canonical memory but potentially misleading for durability | These messages follow the in-memory mutation; provider disk persistence occurs later. | Await persistence before success, or show an explicit pending/unsaved state. |
| Reset save — src/features/reset/screens/TenDayResetPracticeScreen.tsx; src/features/reset/screens/TenDayResetSavedScreen.tsx; src/features/today/screens/TodayScreen.tsx | “Today’s reset is saved”; “Today’s Reset is saved”; “Today’s saved Reset”; and “10 days saved.” | Technically true for canonical memory but potentially misleading for durability | Reset membership is updated before the provider's asynchronous write completes. | Use persistence-acknowledged success or a visible pending state. |
| Pause save — src/features/pause/screens/PauseSavedScreen.tsx | “Pause saved”; “Saved pauses: N”; and “This saved pause is a record of what you noticed, not a score.” | Record/count content is accurate in canonical memory; durability is potentially misleading | The completed record mutation schedules but does not await storage. | Reserve the success heading for acknowledgement; count/history copy can remain once hydrated. |
| Protection save — src/features/protect/screens/ProtectScreen.tsx; src/features/protect/screens/ProtectionActiveScreen.tsx | The exact saved-plan/settings strings inventoried above. | Technically true for canonical/hydrated state but potentially misleading for durability | Configuration mutation does not await its storage write. | Add pending/error semantics and then standardize the storage-boundary language. |
| Arousal save — src/features/arousal-control/screens/PracticeSavedScreen.tsx; src/features/arousal-control/screens/ProgressPreviewScreen.tsx; src/features/today/screens/TodayScreen.tsx | “Practice saved”; “Private note saved for this practice”; “Saved as awareness context from recent practice”; and “Saved” reflection status. | Technically true for canonical memory but potentially misleading for durability | Completion/note edits schedule persistence and normal screens do not surface persistenceError. | Await acknowledgement or show pending/unsaved state before claiming success. |

No privacy-policy copy was invented for analytics, sharing, backup, uninstall, browser storage, or encryption. Those claims depend on decisions and platform verification in sections 10 and 12.

## 10. Platform limitations and uncertainty

### 10.1 What the repository establishes

- Native builds use AsyncStorage; web uses localStorage. Both receive the same plain JSON envelope.
- No Bloom application code was found that uploads this state to a Bloom backend, analytics endpoint, remote AI service, or synchronization service.
- No SecureStore, Keychain, Keystore, biometric gate, app-level encryption, screenshot shield, or app-switcher redaction is wired to the audited state.
- The App Lock screen explicitly describes biometrics and protected storage as not connected.
- The checked-in iOS entitlements are empty of a storage-protection or backup-exclusion entitlement, and the audited native configuration contains no Bloom-specific backup/exclusion policy. No Android native project is checked in for equivalent verification.
- The web adapter is origin-scoped browser storage, not an application-controlled encrypted vault.

### 10.2 What Bloom therefore must not promise yet

The repository does not support claims that data:

- never leaves the physical device;
- is encrypted by Bloom, passcode-protected, or accessible only to the current user;
- is excluded from iCloud, device backups, device migration, operating-system diagnostics, or developer tooling;
- is deleted from every backup or recoverable platform remnant when Data Controls runs;
- is always removed by uninstall, browser cache/site-data clearing, account sign-out, or device disposal;
- is isolated from another person using the same unlocked device or browser profile;
- is protected from browser extensions, same-origin code, a rooted/jailbroken device, or a compromised operating system.

Some platforms may provide encryption at rest, sandboxing, backup handling, or uninstall cleanup, but those are platform- and configuration-dependent properties. They were not proven for every supported target or release archive in this repository.

### 10.3 Bounded claims that are supportable

The narrow accurate statement is: Bloom application state is written locally through the app's AsyncStorage adapter on native targets and localStorage adapter on web, and the audited Bloom application code contains no state-upload integration. The canonical Data Controls action removes the repository-known Bloom storage keys from the currently addressed app/browser container.

Before broader user-facing claims, validate the signed release artifacts on supported iOS, Android, and web targets; document backup and migration behavior; decide a shared-device threat model; and verify platform privacy manifests and SDK behavior. “Local” describes the application architecture, not a complete confidentiality guarantee.

## 11. Safe mechanical corrections made

This pass made only truthful, behavior-preserving copy corrections and added this audit:

- src/features/onboarding/screens/OnboardingIntroScreen.tsx: changed “private questions” to “personal questions” and replaced the unqualified privacy promise with exact local-storage and canonical-deletion wording.
- src/features/today/screens/TodayScreen.tsx: changed “private questions” to “personal questions.”
- src/features/progress/screens/ProgressScreen.tsx: changed “private questions” to “personal questions.”
- src/features/settings/screens/SettingsHomeScreen.tsx: removed the unsupported account-options reference and narrowed the data-control statement to optional recording plus deletion from the current app/browser storage.
- src/features/settings/screens/PrivacyOverviewScreen.tsx: distinguished the skippable trigger from required frequency answers and removed the unsupported history-review/individual-delete claim.
- src/features/settings/screens/DataControlsScreen.tsx: replaced the unsupported record-review implication, expanded the inventory, and scoped deletion copy to the current app/browser local-storage container.
- docs/privacy-retention-audit.md: added the field inventory, dependency analysis, deletion matrix, exposure findings, decisions, and phased implementation recommendation.

No storage field, key, schema, normalizer, migration, backend, route, debug tool, test selector, native project setting, or application behavior was changed. No persisted data was deleted. Runtime console calls were left alone because the audited calls are development-only fixed strings and do not include user state or caught payloads.

An additional privacy verifier was not added in this pass. Existing persistence and journey scripts already test the current storage invariants, while the two highest-risk release-exposure invariants are knowingly false today. A verifier should be added with the production-debug-guards implementation so it asserts a stable rule rather than memorializing a known exception.

## 12. Product decisions required

| Decision | Current behavior | Privacy impact | Product impact | Recommended option | Alternative options | Migration implications | Requires user approval: yes/no |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Retain raw quiz answers after completion | All 12 answer keys, trigger selections, and the full derived result are retained indefinitely. The raw answers are not read by normal runtime behavior after scoring. | Duplicates sensitive source inputs and derived classifications. | Removing raw answers eliminates future rescoring/audit without another source. | Retain only the derived result and necessary plan/profile fields after an approved migration. | Keep all raw inputs; keep a user-visible history; retain for a product-approved limited period. | Version the state, transform existing results, preserve completedAt semantics, and test v1/v2 recovery and rollback. | Yes |
| Check-In history policy | Every check-in is retained; UI displays only the newest three; only delete-all exists. | Unbounded mood/context history accumulates. | More history could support future trends, but it is not currently visible. | Set a product-approved bound or user-selectable retention policy based on an explicit history feature. | Latest three only; aggregate trends; unlimited user-visible history. | Trim deterministically during migration and define ordering/timestamp tie behavior. | Yes |
| Pause history policy | Completed records are unbounded; UI uses latest detail and total count. | Sensitive trigger, truth, urge, next-step, duration, and reflection data accumulate. | Historical detail beyond latest is currently not surfaced. | Retain latest detail plus the minimum aggregate needed for count, or adopt a bounded visible history. | Unlimited visible history; aggregate-only; user-selected retention. | Replace or trim records without changing displayed latest/count semantics; test legacy fixtures. | Yes |
| Arousal Control history policy | Completed full records are unbounded; UI uses latest detail, valid count, and existence. | High-sensitivity sexual-wellness and anxiety/context records accumulate. | Progress needs a count/existence signal; Saved/Preview needs only latest detail. | Retain latest detail plus minimal aggregate/count, or a bounded user-visible history. | Unlimited visible history; aggregate-only; user-selected retention. | Preserve validity/count rules, latest note editing, active draft behavior, and journey predicates. | Yes |
| Record-level deletion | Users can delete all Bloom data but cannot delete a check-in, practice, reflection, note, or history category. | Users lack proportional removal of individual sensitive entries. | Adds UX, identity, consistency, and empty-state requirements. | Add record/category deletion before making broad “control” or “review history” claims. | Keep delete-all only with explicit copy; add per-feature clear history only. | Stable IDs and aggregate/count recomputation may be required; deletion must be persistence-acknowledged. | Yes |
| Abandoned guided-flow drafts | Pause and Arousal drafts persist indefinitely until completed, explicitly discarded, overwritten, or all data is deleted. | Incomplete sensitive input may outlive user expectations. | Durable resume is useful, but no explicit expiry or resume/discard explanation exists. | Add explicit resume/discard UX and choose a product-approved expiry policy. | Persist indefinitely with prominent disclosure; never persist drafts. | Expiry needs versioned timestamps, deterministic cleanup, and tests for in-progress users. | Yes |
| Corrupt-payload quarantine retention | A corrupt source can be retained and duplicated as an indefinitely stored raw quarantine payload. | Creates a second high-sensitivity copy with no user-visible lifecycle. | Helps diagnosis/recovery but has no current recovery UI. | Define a bounded, documented recovery policy and remove quarantine after successful recovery or expiry. | Delete immediately; keep one encrypted diagnostic copy with explicit consent. | Update canonical key cleanup and test corrupt v1/v2, failed removal, retry, and delete-all. | Yes |
| Orphan legacy v1 cleanup | If v1 removal fails after successful v2 migration, later loads prefer v2 and do not retry v1 cleanup. | A stale complete copy may remain indefinitely. | No user-visible benefit once v2 is validated. | Safely retry known legacy-key removal after validated v2 hydration. | Leave until delete-all; run a one-time release cleanup. | Must never delete the only recoverable state; add failure-injection tests. | Yes |
| Unread persisted fields | Several Reset, Protection, completed Pause, and Arousal fields are stored but not consumed by current product behavior. | Collects more timestamps/context than demonstrated necessary. | Some may be placeholders for planned features. | Approve a field-by-field purpose; remove fields without an accepted current purpose in a versioned migration. | Keep with documented near-term consumers; aggregate selected fields. | Requires schema/type/normalizer and fixture changes plus forward/backward compatibility tests. | Yes |
| Arousal pause-count duplication | Each Arousal draft/log can retain both numeric pauseCount and categorical pauseCountBucket for the same fact. | Duplicated sensitive activity metadata can diverge. | The bucket preserves truthful “3+” presentation while the number supports current/legacy formatting. | Choose one representation that preserves “3+” semantics and enforce it during migration. | Keep both with invariant checks; derive one transiently from the other where lossless. | Reconcile inconsistent historic pairs deterministically and update legacy formatting/validation. | Yes |
| Meaning of “Saved” | UI success follows in-memory mutation; provider persistence is asynchronous and errors are not shown on ordinary feature screens. | Users may believe sensitive changes or deletion-adjacent edits are durable when disk write failed. | Awaited acknowledgement adds loading/error states. | Make persistence acknowledgement explicit before showing “Saved,” with a recoverable global error. | Use “Added for this session” wording; retain optimistic UI with visible unsaved state. | Coordinator/provider API and screen flows change; no data-schema migration is inherently required. | Yes |
| Personalization control | Settings toggle is non-persisted component state with no consumer. | Presents a data-use choice that has no effect. | Removing it reduces apparent feature scope; implementing it requires defined recommendation behavior. | Remove or label as preview until an enforceable effect is implemented. | Implement and persist opt-in/opt-out semantics. | If implemented, add a purpose-limited field and deletion/migration tests. | Yes |
| Notification controls | Settings values are non-persisted and no notification integration was found. | Implies functioning privacy/discretion controls that do not exist. | Removing them avoids false expectations; implementation requires permissions and scheduling design. | Remove or label as preview until end-to-end behavior is implemented and verified. | Implement local notifications with exact disclosure and pause behavior. | Implementation may add permissions, identifiers, schedules, and cleanup obligations. | Yes |
| Release debug guards | Scoring preview and debug route are reachable without a development guard. | Exposes raw/derived sensitive data and permits canonical-state mutation in release. | Guarding requires a supported development/E2E access path. | Gate both at the route/render boundary, add a static release invariant, and keep E2E access only in an explicitly safe build. | Remove tools; move them to an internal-only build. | No state migration, but Maestro/development workflows must be updated together. | Yes |
| E2E app identity and artifacts | Maestro clears com.umutcyilmaz.bloom before confirming a Development Client; no artifact-retention policy is documented. | A mistaken run can erase normal app data; hierarchy/video artifacts can capture sensitive fixtures or real state. | Separate identity adds native build/scheme maintenance. | Use a distinct E2E bundle/application ID and scheme, and document synthetic-data-only artifact handling. | Dedicated simulator/device with procedural safeguards; never use clearState. | Native configuration and CI/install commands change; existing normal-app data must never be migrated into E2E. | Yes |
| Privacy terminology and threat model | Multiple features call ordinary local records “private”; App Lock/encryption are absent. | Users may infer confidentiality guarantees stronger than implemented controls. | More neutral language changes product tone; stronger controls add implementation scope. | Approve a shared-device/access threat model, then align terminology and controls to it. | Replace all “private” labels with “personal”; implement app lock/protected storage first. | Stronger storage protection may require a carefully tested encrypted migration and recovery design. | Yes |
| Platform backup, migration, uninstall, and web disclosure | Behavior is platform/configuration-dependent and not established by this repository. | Overbroad “only on this device” or “permanently deleted” claims could be false. | Precise disclosures may differ by platform. | Verify signed artifacts and supported platforms before publishing narrow backup/uninstall/shared-browser claims. | State only the application-level local-storage boundary and documented uncertainty. | Future backup exclusions or encrypted storage need native changes and upgrade/data-loss testing. | Yes |
| Debug fixture provenance | Debug profiles write realistic fixtures into canonical state, and “fresh journey” preserves several histories. | Test and personal records can be mixed and later mistaken for user data. | Full isolation may affect current QA convenience. | Give debug fixtures explicit provenance and make “fresh” semantics exact, or isolate them in the E2E app identity. | Keep canonical fixtures with a prominent destructive warning and full reset. | Adding provenance is a schema change unless isolation removes the need; migration must classify existing records conservatively. | Yes |

## 13. Recommended implementation phases

### Phase 0 — release containment

1. Guard the scoring preview and the debug route at a release-safe boundary; add a static verifier that fails if either becomes release-reachable.
2. Preserve a deliberate development/E2E entry path and update its tests in the same change.
3. Replace the selected-value Arousal test identifier with a semantic fixed identifier and update Maestro together.
4. In an explicitly approved native-config task, give E2E a distinct application ID and URL scheme before any flow is allowed to clear state.
5. Document that automated test runs use synthetic fixtures only and define screenshot, video, hierarchy, upload, and retention rules.

This phase should not change the persisted schema or retention policy.

### Phase 1 — truthful durability and controls

1. Define a persistence-acknowledged mutation API or an equally clear unsaved/error state before using “Saved.”
2. Remove, label, or implement the non-functional personalization and notification controls.
3. Resolve the remaining “private,” Protection, duration, reflection, and subscription-policy wording after the relevant product decisions.
4. Add normal-screen recovery messaging for persistence failure and test success/failure timing.

### Phase 2 — approve the retention specification

1. Decide retention and visibility for raw quiz inputs, Check-Ins, Pause, Arousal Control, and abandoned drafts.
2. Decide record/category deletion scope and how aggregate counts change.
3. Approve quarantine and orphan-v1 cleanup lifecycles.
4. Classify each unread or duplicated field as necessary, aggregate-only, or removable.
5. Approve the shared-device, backup, browser, uninstall, encryption, and App Lock threat model.

Do not implement destructive migration logic until this specification and its rollback behavior are approved.

### Phase 3 — versioned minimization and deletion

1. Introduce one reviewed schema version and deterministic migration for the approved field reductions, bounds, aggregates, draft expiry, and provenance.
2. Add record/category deletion with persistence acknowledgement, aggregate recomputation, and accessible confirmation/error states.
3. Add failure-injection coverage for legacy cleanup, quarantine cleanup, overlapping mutation/delete, interrupted migration, and downgrade/rollback.
4. Verify normal journeys from retained derived state so removed raw fields are not silently reintroduced.

### Phase 4 — platform and release validation

1. Test signed iOS, Android, and web release artifacts for backup, migration, uninstall/site-data, shared-device/profile, and delete-all behavior.
2. Inspect platform privacy manifests, embedded SDKs, release logging, deep links, and developer tooling.
3. Validate any App Lock, protected-storage, or encryption design with upgrade, recovery, and data-loss tests.
4. Publish final user-facing privacy copy only from the verified application and platform behavior.

### Recommended next implementation prompt

> Implement Phase 0 of docs/privacy-retention-audit.md on a new focused branch. Guard the onboarding scoring preview and /debug/bloom-state so neither is reachable in production, while preserving an intentional development/E2E path. Add a static verifier for both release invariants and update affected tests/selectors. Do not change persisted schemas, migrations, retention, deletion semantics, product copy outside the guard surfaces, or native bundle IDs. Treat the separate E2E application identity as a documented follow-up unless native configuration changes are explicitly approved. Run the existing persistence, guided-flow, journey, typecheck, Expo Doctor, diff-check, and relevant E2E/static verification commands. Do not commit or push.
