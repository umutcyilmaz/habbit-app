import { isDeepStrictEqual } from "node:util";
import type { CurrentUrgeControlEvent, CurrentUrgeControlTrigger, UrgeControlOutcome } from "../src/domain/models";
import { getUrgeControlProgress } from "../src/domain/urgeControl/getUrgeControlProgress";
import {
  completeUrgeControlEventState, completeUrgeControlInterruptState, createDefaultBloomState,
  discardActiveUrgeControlEventState, endUrgeControlPhoneAwayState,
  recordUrgeControlOutcomeState, recordUrgeControlTriggersState, recordUrgeControlTriggerState,
  selectUrgeControlSecondLineActionState, selectUrgeControlTechniqueState,
  startUrgeControlEventState, startUrgeControlPhoneAwayState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_CORRUPT_BACKUP_PREFIX, BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const startedAt = "2026-11-01T12:00:00.250Z";
const interruptAt = "2026-11-01T12:00:05.250Z";
const completedAt = "2026-11-01T12:00:05.251Z";
const now = () => new Date("2026-12-01T12:00:00.000Z");
const triggers: CurrentUrgeControlTrigger[] = ["boredom", "stress", "loneliness", "fatigue", "explicitContentCue", "habitAutomatic", "specificSituation", "other"];
const outcomes: UrgeControlOutcome[] = ["reduced", "stillStrong", "stronger", "unchanged"];
const legacyOnlyFields = ["selectedTechnique", "phoneAwayStartedAt", "phoneAwayEndedAt", "trigger", "secondLineAction"];
type Transition = (state: BloomLocalState, input: never) => BloomLocalState;

export async function verifyBloomCurrentUrgeControl() {
  await verifyCurrentLifecycleAndProgress();
  verifyTriggersAndOutcomes();
  await verifyTimingDiscardAndIndependence();
  await verifyMixedHistoryAndIdentity();
  const rejected = verifyInvalidAndCrossVersionTransitions();
  const malformed = await verifyMalformedCurrentPersistence();
  console.log(`Bloom current Urge Control verification passed (${rejected} rejected transitions; ${malformed} malformed persisted cases; current stages, all outcomes/eight triggers, explicit skip, legacy separation, immutable history, and v7 round trips).`);
}

async function verifyCurrentLifecycleAndProgress() {
  const states = currentStages();
  equal(event(states[0]!), { id: "current-event", flowVersion: 2, status: "active", startedAt }, "New start must persist the current version and only the supplied identity/start fact.");
  const stages = ["interrupt", "outcome", "triggers", "readyToComplete"];
  for (const [index, state] of states.entries()) {
    const before = JSON.stringify(state);
    const progress = getUrgeControlProgress(state.urgeControl, completedAt);
    equal(progress, { stage: stages[index], elapsedEventSeconds: 5 }, "Current resume stages must require interrupt, outcome, then explicit trigger finalization, without phone-away progress.");
    equal(getUrgeControlProgress(state.urgeControl, completedAt), progress, "Current progress must be deterministic from explicit state/time.");
    assert(getUrgeControlProgress(state.urgeControl, shift(startedAt, -1))?.elapsedEventSeconds === 0, "Current event elapsed time safely clamps backward clock skew.");
    assert(getUrgeControlProgress(state.urgeControl, now().toISOString())?.stage === stages[index], "A distant clock may not finalize or advance any current stage.");
    const loaded = await roundTrip(state);
    equal(getUrgeControlProgress(loaded.urgeControl, completedAt), progress, "Persisted current flow version must resume the exact current stage after hydration.");
    assert(JSON.stringify(state) === before, "Progress and persistence reads must not mutate source facts.");
  }
  assert(!Object.hasOwnProperty.call(event(states[2]!), "triggers"), "An outcome with no finalized trigger step must retain absent triggers.");
  equal(event(states[3]!).triggers, [], "An intentionally skipped trigger step is explicitly stored as an empty array.");
  const ready = states[3]!;
  const completed = changed(ready, completeUrgeControlEventState, { completedAt });
  equal(completed.urgeControl.records[0], { ...event(ready), status: "completed", completedAt }, "Completion appends all current facts, including [] triggers, atomically while clearing activeEvent.");
  assert(completed.urgeControl.activeEvent === null && completed.urgeControl.records.length === 1, "Current completion must move the event into history exactly once.");
  assert(completeUrgeControlEventState(completed, { completedAt: now().toISOString() }) === completed, "Repeating completion cannot create duplicate records.");
  assert(getUrgeControlProgress(completed.urgeControl, completedAt) === null, "Completed-only current history has no active progress.");
  await roundTrip(completed);
  for (const value of [undefined, null, 42, "", "2026-11-01", "2026-11-01T12:00:00Z", "2026-11-01T12:00:00.000+00:00", "2026-02-30T12:00:00.000Z"]) {
    assert(getUrgeControlProgress(states[0]!.urgeControl, value as never) === null, "Invalid/noncanonical current selector clocks must fail safely.");
  }
}

function verifyTriggersAndOutcomes() {
  const interrupted = currentStages()[1]!;
  for (const outcome of outcomes) {
    const answered = changed(interrupted, recordUrgeControlOutcomeState, { outcome });
    assert(event(answered).outcome === outcome, "All four existing outcomes remain accepted by the current lifecycle.");
    assert(recordUrgeControlOutcomeState(answered, { outcome }) === answered, "Identical current outcome is an exact no-op.");
    for (const selection of [[], ...triggers.map((trigger) => [trigger]), [...triggers].reverse()]) {
      const input = { triggers: selection };
      const before = JSON.stringify(input);
      freeze(input);
      const selected = changed(answered, recordUrgeControlTriggersState, input);
      equal(event(selected).triggers, selection, "Every current trigger, explicit skip, and multi-selection must preserve the caller's order.");
      assert(event(selected).triggers !== selection, "The accepted trigger array must be detached from the caller's mutable input.");
      assert(JSON.stringify(input) === before, "Trigger recording may not mutate a caller-owned array.");
      assert(recordUrgeControlTriggersState(selected, { triggers: [...selection] }) === selected, "Repeated equal trigger selection is an exact no-op even with a new array identity.");
      assert(getUrgeControlProgress(selected.urgeControl, completedAt)?.stage === "readyToComplete", "Any finalized selection, including [], permits completion.");
      const completed = changed(selected, completeUrgeControlEventState, { completedAt });
      assert(completed.urgeControl.records[0]?.outcome === outcome, "All outcomes permit current completion without legacy prerequisites or escalation.");
    }
  }
  const answered = currentStages()[2]!;
  const mutable: CurrentUrgeControlTrigger[] = ["stress", "boredom"];
  const selected = changed(answered, recordUrgeControlTriggersState, { triggers: mutable });
  mutable.push("fatigue");
  equal(event(selected).triggers, ["stress", "boredom"], "Later caller-array edits must not change an accepted event snapshot.");
  const reordered = changed(selected, recordUrgeControlTriggersState, { triggers: ["boredom", "stress"] });
  equal(event(reordered).triggers, ["boredom", "stress"], "A different ordered selection may correct the active trigger facts.");
  const replaced = changed(reordered, recordUrgeControlTriggersState, { triggers: ["explicitContentCue"] });
  const skipped = changed(replaced, recordUrgeControlTriggersState, { triggers: [] });
  assert(getUrgeControlProgress(skipped.urgeControl, completedAt)?.stage === "readyToComplete", "Correcting a selection to an intentional skip remains finalized.");
  const outcomeCorrected = changed(replaced, recordUrgeControlOutcomeState, { outcome: "reduced" });
  equal(event(outcomeCorrected).triggers, ["explicitContentCue"], "Outcome correction must preserve the user's descriptive trigger selections.");
  assert(!("secondLineAction" in event(outcomeCorrected)), "Current outcome correction must never create historical second-line facts.");
}

async function verifyTimingDiscardAndIndependence() {
  const started = currentStages()[0]!;
  for (const time of [startedAt, shift(startedAt, 1), shift(startedAt, 59_999), shift(startedAt, 90_000)]) {
    let state = changed(started, completeUrgeControlInterruptState, { completedAt: time });
    state = changed(state, recordUrgeControlOutcomeState, { outcome: "stronger" });
    state = changed(state, recordUrgeControlTriggersState, { triggers: [] });
    const completed = changed(state, completeUrgeControlEventState, { completedAt: time });
    assert(completed.urgeControl.records[0]?.completedAt === time, "An explicit interrupt and completion may equal event start or any later supplied time without a 60-second minimum.");
  }
  for (const source of [createDefaultBloomState(), createPopulatedState(), createActiveState(true, true), createActiveState(false, false)]) {
    source.urgeControl = { ...source.urgeControl, activeEvent: null };
    freeze(source);
    for (const state of currentStages(source)) {
      const discarded = changed(state, discardActiveUrgeControlEventState, undefined);
      assert(discarded.urgeControl.activeEvent === null && discarded.urgeControl.records === source.urgeControl.records, "Discard works at every current stage and preserves completed history without tombstones.");
      assert(discardActiveUrgeControlEventState(discarded) === discarded, "Repeated discard is an exact no-op.");
      assert(startUrgeControlEventState(discarded, { eventId: "current-event", startedAt }) !== discarded, "Discard does not reserve an unused event identity.");
    }
    let ready = currentStages(source)[2]!;
    ready = changed(ready, recordUrgeControlTriggersState, { triggers: ["explicitContentCue", "specificSituation"] });
    const completed = changed(ready, completeUrgeControlEventState, { completedAt });
    unrelated(source, completed);
    assert(completed.resetJourney === source.resetJourney && completed.contentFree === source.contentFree && completed.masturbationTracking === source.masturbationTracking, "Seeing an explicit-content cue is only a trigger observation; it cannot produce Behavior Slip, tracker events, or violation records.");
    assert(completed.urgeControl.records.slice(0, -1).every((record, index) => record === source.urgeControl.records[index]), "Current completion preserves historical legacy records by reference and order.");
    await roundTrip(completed);
  }
}

async function verifyMixedHistoryAndIdentity() {
  const source = createPopulatedState();
  source.urgeControl = { ...source.urgeControl, activeEvent: null };
  const firstLegacy = source.urgeControl.records[0];
  assert(firstLegacy !== undefined && !("flowVersion" in firstLegacy), "Genuine historical completed record required.");
  source.urgeControl.records = [firstLegacy, { ...firstLegacy, id: "another-legacy-completed" }];
  const legacyBytes = JSON.stringify(source.urgeControl.records);
  let completed = source;
  for (const id of ["first-current-completed", "second-current-completed"]) {
    let active = changed(completed, startUrgeControlEventState, { eventId: id, startedAt });
    assert(active.urgeControl.records === completed.urgeControl.records, "New current starts must preserve old and current completed history by reference.");
    await roundTrip(active);
    active = changed(active, completeUrgeControlInterruptState, { completedAt: interruptAt });
    active = changed(active, recordUrgeControlOutcomeState, { outcome: "unchanged" });
    active = changed(active, recordUrgeControlTriggersState, { triggers: ["fatigue", "other"] });
    completed = changed(active, completeUrgeControlEventState, { completedAt });
    await roundTrip(completed);
  }
  assert(completed.urgeControl.records.length === 4, "Several legacy and current completed events must coexist in the existing history slice.");
  assert(JSON.stringify(completed.urgeControl.records.slice(0, 2)) === legacyBytes, "Current completion must never rewrite old shapes or synthesize versions/trigger arrays.");
  for (const record of completed.urgeControl.records) {
    assert(startUrgeControlEventState(completed, { eventId: record.id, startedAt }) === completed, "Completed identities from either flow version remain globally consumed.");
  }
  const fresh = changed(completed, startUrgeControlEventState, { eventId: "mixed-active", startedAt });
  assert(startUrgeControlEventState(fresh, { eventId: "second-active", startedAt }) === fresh, "Only one current or legacy event may be active.");
  equal(Object.keys(fresh).sort(), Object.keys(source).sort(), "The current flow remains within the existing Urge Control slice with no new persisted top-level state.");
}

function verifyInvalidAndCrossVersionTransitions() {
  let count = 0;
  const states = currentStages();
  const reject = (fn: Transition, state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(fn(state, input as never) === state, `${label}: invalid current transition must return the exact source state.`);
    assert(JSON.stringify(state) === before, `${label}: rejection cannot mutate event/history or unrelated slices.`);
    count++;
  };
  for (const [fn, state, input] of [
    [completeUrgeControlInterruptState, states[0]!, { completedAt: interruptAt }],
    [recordUrgeControlOutcomeState, states[1]!, { outcome: "reduced" }],
    [recordUrgeControlTriggersState, states[2]!, { triggers: ["boredom"] }],
    [completeUrgeControlEventState, states[3]!, { completedAt }]
  ] as Array<[Transition, BloomLocalState, Record<string, unknown>]>) {
    for (const invalid of [undefined, null, [], 42, "event", {}, { ...input, extra: true }]) reject(fn, state, invalid, "Strict input shape");
    reject(fn, createDefaultBloomState(), input, "No active event");
    reject(fn, completeUrgeControlEventState(states[3]!, { completedAt }), input, "Completed records cannot be corrected through active operations");
  }
  for (const state of states.slice(0, 3)) reject(completeUrgeControlEventState, state, { completedAt }, "Completion requires interrupt, outcome, and explicit trigger finalization");
  reject(recordUrgeControlOutcomeState, states[0]!, { outcome: "reduced" }, "Outcome before interrupt");
  for (const state of states.slice(0, 2)) reject(recordUrgeControlTriggersState, state, { triggers: [] }, "Trigger finalization before outcome");
  reject(completeUrgeControlInterruptState, states[1]!, { completedAt }, "Interrupt may only complete once");
  for (const outcome of [undefined, null, "", "success", "noChange", 42]) reject(recordUrgeControlOutcomeState, states[1]!, { outcome }, "Unsupported outcome");
  for (const selection of [undefined, null, "boredom", {}, 42, ["boredom", "boredom"], ["stress", "fatigue", "stress"], ["notSure"], ["sleeplessnessNighttime"], ["sexualDesire"], ["unknown"], [null], [42], ["stress", undefined]]) {
    reject(recordUrgeControlTriggersState, states[2]!, { triggers: selection }, "Malformed, duplicate, or old-only trigger selection");
    reject(recordUrgeControlTriggersState, states[3]!, { triggers: selection }, "Malformed correction may not erase finalized triggers");
  }
  for (const time of ["", "invalid", "2026-02-30T12:00:00.000Z", "2026-11-01", "2026-11-01T12:00:00Z", shift(startedAt, -1)]) {
    reject(completeUrgeControlInterruptState, states[0]!, { completedAt: time }, "Noncanonical/early interrupt time");
    reject(completeUrgeControlEventState, states[3]!, { completedAt: time }, "Noncanonical/early completion time");
  }
  reject(completeUrgeControlEventState, states[3]!, { completedAt: shift(interruptAt, -1) }, "Completion cannot precede interrupt");
  for (const state of states) {
    for (const [fn, input] of [
      [selectUrgeControlTechniqueState, { technique: "urgeSurfing" }],
      [startUrgeControlPhoneAwayState, { startedAt: interruptAt }],
      [endUrgeControlPhoneAwayState, { endedAt: completedAt }],
      [recordUrgeControlTriggerState, { trigger: "boredom" }],
      [selectUrgeControlSecondLineActionState, { action: "doAnotherTask" }]
    ] as Array<[Transition, Record<string, unknown>]>) reject(fn, state, input, "Legacy-only operation on current event");
  }
  const legacy = createPopulatedState();
  reject(recordUrgeControlTriggersState, legacy, { triggers: [] }, "Current trigger operation on genuine legacy unordered event");
  const legacyMinimal = { ...legacy, urgeControl: { ...legacy.urgeControl, activeEvent: { id: "old-minimal", status: "active" as const, startedAt } } };
  reject(recordUrgeControlTriggersState, legacyMinimal, { triggers: ["stress"] }, "Current trigger operation on minimal legacy event");
  return count;
}

async function verifyMalformedCurrentPersistence() {
  const states = currentStages();
  const ready = states[3]!;
  const completed = completeUrgeControlEventState(ready, { completedAt });
  const cases: Array<[string, BloomLocalState, string, unknown, boolean?]> = [];
  for (const value of [0, 1, 3, "2", null]) cases.push(["unknown flow discriminator", ready, "activeEvent.flowVersion", value]);
  for (const [field, value] of [["selectedTechnique", "urgeSurfing"], ["phoneAwayStartedAt", interruptAt], ["phoneAwayEndedAt", completedAt], ["trigger", "boredom"], ["secondLineAction", "doAnotherTask"]]) {
    cases.push(["mixed active current/legacy fields", ready, `activeEvent.${field}`, value], ["mixed completed current/legacy fields", completed, `records.0.${field}`, value]);
  }
  for (const selection of [null, "boredom", {}, ["boredom", "boredom"], ["notSure"], ["sleeplessnessNighttime"], ["sexualDesire"], ["unknown"], [null], [42]]) {
    cases.push(["malformed active triggers", ready, "activeEvent.triggers", selection], ["malformed completed triggers", completed, "records.0.triggers", selection]);
  }
  cases.push(
    ["unknown active field", ready, "activeEvent.diagnosis", "unsupported"],
    ["active cannot contain completedAt", ready, "activeEvent.completedAt", completedAt],
    ["active outcome before interrupt", states[0]!, "activeEvent.outcome", "reduced"],
    ["active triggers before outcome", states[1]!, "activeEvent.triggers", []],
    ["invalid active start", ready, "activeEvent.startedAt", "invalid"],
    ["invalid active interrupt", ready, "activeEvent.interruptCompletedAt", "2026-02-30T12:00:00.000Z"],
    ["active interrupt before start", ready, "activeEvent.interruptCompletedAt", shift(startedAt, -1)],
    ["missing completed interrupt", completed, "records.0.interruptCompletedAt", undefined, true],
    ["missing completed outcome", completed, "records.0.outcome", undefined, true],
    ["missing completed trigger finalization", completed, "records.0.triggers", undefined, true],
    ["missing completed time", completed, "records.0.completedAt", undefined, true],
    ["completed before interrupt", completed, "records.0.completedAt", shift(interruptAt, -1)],
    ["completed before start", completed, "records.0.completedAt", shift(startedAt, -1)],
    ["current active in records", ready, "records", [event(ready)]],
    ["current completed in active slot", completed, "activeEvent", completed.urgeControl.records[0]],
    ["duplicate current record IDs", completed, "records", [...completed.urgeControl.records, ...completed.urgeControl.records]],
    ["duplicate current active/record IDs", ready, "records", completed.urgeControl.records]
  );
  const legacy = createPopulatedState();
  cases.push(["current triggers on absent-version legacy event", legacy, "activeEvent.triggers", []]);
  const oldRecord = legacy.urgeControl.records[0];
  assert(oldRecord !== undefined, "Historical completed fixture required.");
  cases.push(["duplicate IDs across legacy and current histories", completed, "records", [...completed.urgeControl.records, { ...oldRecord, id: event(ready).id }]]);
  for (const [label, source, path, value, remove] of cases) {
    const malformed = clone(source);
    replaceAtPath(malformed.urgeControl, path, value, remove === true);
    assert(!validateAndNormalizeBloomState(malformed).success, `${label}: malformed current facts must fail persisted validation.`);
    assert(discardActiveUrgeControlEventState(malformed) === malformed, `${label}: discard cannot hide corrupted active/history facts.`);
    const client = createMemoryStorageClient();
    const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state: malformed }, null, 2);
    await client.setItem(BLOOM_STATE_STORAGE_KEY, raw);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "corrupt" && loaded.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: malformed current records must retain existing corruption handling.`);
    assert(await client.getItem(BLOOM_STATE_STORAGE_KEY) === raw, "Corruption handling must preserve exact original v7 payload bytes.");
    assert(loaded.backupKey !== null && loaded.backupKey.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Malformed current records must receive the existing scoped corruption backup.");
    const backup = await client.getItem(loaded.backupKey);
    assert(backup !== null, "Current corruption backup must exist.");
    const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
    assert(parsed.rawPayload === raw && parsed.sourceKey === BLOOM_STATE_STORAGE_KEY, "Current corruption backups retain source ownership and bytes.");
  }
  for (const field of ["startedAt", "interruptCompletedAt"]) {
    const malformed = clone(ready);
    replaceAtPath(event(malformed), field, "invalid", false);
    assert(getUrgeControlProgress(malformed.urgeControl, completedAt) === null, "Malformed current timestamps must not produce NaN progress.");
  }
  return cases.length;
}

function currentStages(source = createDefaultBloomState()) {
  const started = changed(source, startUrgeControlEventState, { eventId: "current-event", startedAt });
  const interrupted = changed(started, completeUrgeControlInterruptState, { completedAt: interruptAt });
  const answered = changed(interrupted, recordUrgeControlOutcomeState, { outcome: "stillStrong" });
  return [started, interrupted, answered, changed(answered, recordUrgeControlTriggersState, { triggers: [] })];
}
function changed(state: BloomLocalState, fn: Transition, input: unknown) {
  const before = JSON.stringify(state);
  const inputBefore = JSON.stringify(input);
  const updated = fn(state, input as never);
  assert(updated !== state && updated.urgeControl !== state.urgeControl, "A valid current transition must return a new state and Urge Control slice.");
  assert(JSON.stringify(state) === before && JSON.stringify(input) === inputBefore, "Current transitions must preserve all caller-owned state/input facts.");
  unrelated(state, updated);
  assert(validateAndNormalizeBloomState(updated).success, "Every current successor must satisfy v7 persistence invariants.");
  equal(fn(state, input as never), updated, "Current transitions are deterministic from supplied facts.");
  if (updated.urgeControl.records.length === state.urgeControl.records.length) assert(updated.urgeControl.records === state.urgeControl.records, "In-progress current steps preserve completed history by reference.");
  const active = updated.urgeControl.activeEvent;
  if (active !== null && active.flowVersion === 2) for (const field of legacyOnlyFields) assert(!(field in active), "Current events cannot synthesize historical technique, phone-away, singular-trigger, or second-line facts.");
  return updated;
}
function event(state: BloomLocalState): Extract<CurrentUrgeControlEvent, { status: "active" }> { const active = state.urgeControl.activeEvent; assert(active !== null && active.flowVersion === 2, "Current versioned active fixture required."); return active; }
function unrelated(before: BloomLocalState, after: BloomLocalState) { for (const key of Object.keys(before) as Array<keyof BloomLocalState>) if (key !== "urgeControl") assert(after[key] === before[key], `Current Urge Control must preserve unrelated ${key} by reference.`); }
async function roundTrip(state: BloomLocalState) {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Current per-event flow version must not change global v7 persistence.");
  const validated = validateAndNormalizeBloomState(state);
  assert(validated.success, "Current/mixed fixture must validate before persistence.");
  equal(validated.state, state, "Normalization must preserve current and legacy event shapes without remapping trigger observations.");
  const client = createMemoryStorageClient();
  await persistBloomLocalState(validated.state, client, now);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current" && !loaded.needsPersist, "Current and mixed history must reload canonically without migration or writeback.");
  equal(loaded.state, state, "Current flow facts and every legacy record must round-trip unchanged.");
  equal(await client.getAllKeys(), [BLOOM_STATE_STORAGE_KEY], "Current Urge Control must use only the existing v7 storage key.");
  return loaded.state;
}
function shift(timestamp: string, milliseconds: number) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) { const keys = path.split("."); const final = keys.pop()!; let parent = root as Record<string, unknown>; for (const key of keys) parent = parent[key] as Record<string, unknown>; if (remove) delete parent[final]; else parent[final] = value; }
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
