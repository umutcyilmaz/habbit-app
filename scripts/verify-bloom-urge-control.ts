import { isDeepStrictEqual } from "node:util";
import type { ActiveUrgeControlEvent, UrgeControlOutcome, UrgeControlSecondLineAction, UrgeControlTechnique, UrgeControlTrigger } from "../src/domain/models";
import { getUrgeControlProgress } from "../src/domain/urgeControl/getUrgeControlProgress";
import {
  createDefaultBloomState, startUrgeControlEventState, completeUrgeControlInterruptState,
  selectUrgeControlTechniqueState, startUrgeControlPhoneAwayState, endUrgeControlPhoneAwayState,
  recordUrgeControlOutcomeState, recordUrgeControlTriggerState, selectUrgeControlSecondLineActionState,
  completeUrgeControlEventState, discardActiveUrgeControlEventState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_CORRUPT_BACKUP_PREFIX, BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const startedAt = "2026-11-01T12:00:00.250Z";
const interruptAt = "2026-11-01T12:00:05.250Z";
const phoneAt = "2026-11-01T12:00:07.750Z";
const phoneEndedAt = "2026-11-01T12:00:10.999Z";
const completedAt = "2026-11-01T12:00:11.125Z";
const now = () => new Date("2026-12-01T12:00:00.000Z");
const techniques: UrgeControlTechnique[] = ["changeEnvironment", "grounding54321", "cognitiveTask", "urgeSurfing", "personalReminder"];
const outcomes: UrgeControlOutcome[] = ["reduced", "stillStrong", "stronger", "unchanged"];
const triggers: UrgeControlTrigger[] = ["boredom", "stress", "loneliness", "sleeplessnessNighttime", "sexualDesire", "habitAutomatic", "notSure"];
const actions: UrgeControlSecondLineAction[] = ["putPhoneInAnotherRoom", "doAnotherTask", "messageSupportPerson"];
type Transition = (state: BloomLocalState, input: never) => BloomLocalState;
type Operation = [Transition, BloomLocalState, Record<string, unknown>];

export async function verifyBloomUrgeControl() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Urge Control must retain persistence v7 and its existing key.");
  await verifyLifecycleAndResume();
  verifyAnswersAndOptionalSupport();
  verifyTimingBoundaries();
  await verifyFeatureIndependenceAndDiscard();
  await verifyOlderCompatibleFacts();
  const rejected = verifyInvalidTransitions();
  const corrupted = await verifyMalformedPersistence();
  console.log(`Bloom Urge Control verification passed (${rejected} rejected transitions; ${corrupted} malformed persisted cases; all guided stages, descriptive answers, independent lifecycle, compatible hydration, and v7 round trips).`);
}

async function verifyLifecycleAndResume() {
  const states = createStages();
  equal(event(states[0]!), { id: "guided-event", status: "active", startedAt }, "Starting must record only supplied identity/start and active status, without inferred answers or counters.");
  const stages = ["interrupt", "technique", "phoneAwayReady", "phoneAwayActive", "outcome", "trigger", "readyToComplete"];
  for (const [index, state] of states.entries()) {
    const before = JSON.stringify(state);
    const progress = getUrgeControlProgress(state.urgeControl, completedAt);
    assert(progress !== null && progress.stage === stages[index], "Progress must identify each next guided step from existing facts.");
    assert(progress.elapsedEventSeconds === 10, "Event elapsed time must floor timestamp differences to whole seconds.");
    if (index < 3) assert(!Object.hasOwnProperty.call(progress, "phoneAwayElapsedSeconds"), "Phone-away elapsed time must be absent before its explicit start.");
    else assert(progress.phoneAwayElapsedSeconds === 3, "Phone-away elapsed time must use supplied physical timestamps and whole seconds.");
    const loaded = await assertRoundTrip(state);
    equal(getUrgeControlProgress(loaded.urgeControl, completedAt), progress, "Hydration must resume the same stage without advancing or discarding an event.");
    const distant = getUrgeControlProgress(loaded.urgeControl, now().toISOString());
    assert(distant?.stage === stages[index], "Elapsed time alone must never advance the lifecycle.");
    if (index >= 4) assert(distant?.phoneAwayElapsedSeconds === 3, "A finished phone-away interval must remain frozen after a late reload.");
    assert(JSON.stringify(state) === before, "Progress and persistence reads must not write ticking counters or change source facts.");
  }
  const ready = states[6]!;
  const beforeEvent = event(ready);
  const completed = changed(ready, completeUrgeControlEventState, { completedAt });
  assert(completed.urgeControl.activeEvent === null && completed.urgeControl.records.length === 1, "Completion must clear the active event and append one record.");
  equal(completed.urgeControl.records[0], { ...beforeEvent, status: "completed", completedAt }, "Completion must preserve every explicit event fact and add only completed status/time.");
  assert(completeUrgeControlEventState(completed, { completedAt: now().toISOString() }) === completed, "Retrying completion must be an exact no-op without duplicate history.");
  assert(getUrgeControlProgress(completed.urgeControl, completedAt) === null, "Completed-only history has no active progress.");
  await assertRoundTrip(completed);
  for (const state of [states[0]!, states[3]!]) {
    const early = getUrgeControlProgress(state.urgeControl, shift(startedAt, -1));
    assert(early?.elapsedEventSeconds === 0, "An early clock must clamp event time to zero.");
    if (state === states[3]) assert(early?.phoneAwayElapsedSeconds === 0, "An early clock must clamp running phone-away time to zero.");
  }
  const frozenEarly = getUrgeControlProgress(states[4]!.urgeControl, shift(startedAt, -1));
  assert(frozenEarly?.elapsedEventSeconds === 0 && frozenEarly.phoneAwayElapsedSeconds === 3, "Completed phone-away time must derive from its end even when the display clock moves backward.");
  for (const invalid of [undefined, null, 42, "", "2026-11-01", "2026-11-01T12:00:00Z", "2026-11-01T12:00:00.000+00:00", "2026-02-30T12:00:00.000Z"]) {
    assert(getUrgeControlProgress(states[3]!.urgeControl, invalid as never) === null, "Invalid/noncanonical selector clocks must return null.");
  }
}

function verifyAnswersAndOptionalSupport() {
  const stages = createStages();
  let selected = stages[1]!;
  for (const technique of techniques) {
    selected = changed(selected, selectUrgeControlTechniqueState, { technique });
    assert(event(selected).selectedTechnique === technique, "Every technique must be selectable and replaceable before phone-away starts.");
    assert(selectUrgeControlTechniqueState(selected, { technique }) === selected, "Identical technique selection must be an exact no-op.");
  }
  for (const outcome of outcomes) {
    let answered = changed(stages[4]!, recordUrgeControlOutcomeState, { outcome });
    assert(event(answered).outcome === outcome && event(answered).trigger === undefined, "Outcome must remain a descriptive enum without inferred triggers or extra timestamps.");
    assert(recordUrgeControlOutcomeState(answered, { outcome }) === answered, "Identical outcome recording must be an exact no-op.");
    for (const trigger of triggers) {
      answered = changed(answered, recordUrgeControlTriggerState, { trigger });
      assert(event(answered).trigger === trigger, "All explicit trigger answers must support correction before completion.");
      assert(recordUrgeControlTriggerState(answered, { trigger }) === answered, "Identical trigger recording must be an exact no-op.");
    }
    const noEscalation = changed(answered, completeUrgeControlEventState, { completedAt });
    assert(noEscalation.urgeControl.records[0]?.secondLineAction === undefined, "Every outcome, including stillStrong, must allow completion without second-line support.");
    if (outcome === "reduced") {
      for (const action of actions) assert(selectUrgeControlSecondLineActionState(answered, { action }) === answered, "Reduced outcomes must reject unnecessary second-line escalation.");
      continue;
    }
    let support = recordUrgeControlOutcomeState(stages[4]!, { outcome });
    for (const action of actions) {
      support = changed(support, selectUrgeControlSecondLineActionState, { action });
      assert(event(support).secondLineAction === action && event(support).trigger === undefined, "Each nonreduced outcome permits all optional choices even before trigger recording.");
      assert(selectUrgeControlSecondLineActionState(support, { action }) === support, "Identical second-line selection must be an exact no-op.");
    }
    const corrected = changed(support, recordUrgeControlOutcomeState, { outcome: "reduced" });
    assert(event(corrected).outcome === "reduced" && !Object.hasOwnProperty.call(event(corrected), "secondLineAction"), "Correcting outcome to reduced must remove the prior second-line field entirely.");
    const withTrigger = changed(support, recordUrgeControlTriggerState, { trigger: "sexualDesire" });
    const completed = changed(withTrigger, completeUrgeControlEventState, { completedAt });
    assert(completed.urgeControl.records[0]?.secondLineAction === "messageSupportPerson", "Completion must retain the chosen optional support action as a fact with no external side effect.");
  }
  let correction = stages[5]!;
  for (const outcome of ["stronger", "unchanged", "reduced", "stillStrong"] as const) correction = changed(correction, recordUrgeControlOutcomeState, { outcome });
  assert(event(correction).outcome === "stillStrong", "An active outcome can be repeatedly corrected without historical records.");
}

function verifyTimingBoundaries() {
  const started = createStages()[0]!;
  for (const completedAt of [startedAt, shift(startedAt, 1), shift(startedAt, 60_000)]) {
    const interrupted = changed(started, completeUrgeControlInterruptState, { completedAt });
    assert(event(interrupted).interruptCompletedAt === completedAt, "Interrupt completion must retain supplied equality, short, and late times without a prescribed duration.");
  }
  const technique = createStages()[2]!;
  const phone = changed(technique, startUrgeControlPhoneAwayState, { startedAt: interruptAt });
  for (const elapsed of [0, 1, 59_999, 120_000, 900_125]) {
    const endedAt = shift(interruptAt, elapsed);
    const ended = changed(phone, endUrgeControlPhoneAwayState, { endedAt });
    assert(event(ended).phoneAwayEndedAt === endedAt, "Phone-away must retain exact equality/early/late end facts without fabricating a two-minute interval.");
    assert(getUrgeControlProgress(ended.urgeControl, now().toISOString())?.phoneAwayElapsedSeconds === Math.floor(elapsed / 1000), "Phone-away elapsed seconds must floor the actual interval and freeze at its end.");
  }
  const ready = createStages()[6]!;
  for (const completedAt of [phoneEndedAt, now().toISOString()]) {
    const completed = changed(ready, completeUrgeControlEventState, { completedAt });
    assert(completed.urgeControl.records[0]?.completedAt === completedAt, "Completion may occur at the phone-away boundary or later and must retain the supplied timestamp.");
  }
}

async function verifyFeatureIndependenceAndDiscard() {
  for (const source of [createDefaultBloomState(), createPopulatedState(), createActiveState(true, true), createActiveState(false, false)]) {
    source.urgeControl = { ...source.urgeControl, activeEvent: null };
    freeze(source);
    const states = createStages(source);
    let ready = changed(states[6]!, selectUrgeControlSecondLineActionState, { action: "messageSupportPerson" });
    ready = changed(ready, recordUrgeControlTriggerState, { trigger: "sexualDesire" });
    const completed = changed(ready, completeUrgeControlEventState, { completedAt });
    unrelated(source, completed);
    assert(completed.urgeControl.records.slice(0, -1).every((record, index) => record === source.urgeControl.records[index]), "Appending an event must retain every existing historical record by reference and in order.");
    await assertRoundTrip(completed);
    const second = changed(completed, startUrgeControlEventState, { eventId: "second-event", startedAt: completedAt });
    const discarded = changed(second, discardActiveUrgeControlEventState, undefined);
    assert(discarded.urgeControl.activeEvent === null && discarded.urgeControl.records === completed.urgeControl.records, "Discard must clear only the active pointer without completed records or tombstones.");
    assert(discardActiveUrgeControlEventState(discarded) === discarded, "Discard with no active event must retain the exact state and completed history.");
    await assertRoundTrip(discarded);
    assert(startUrgeControlEventState(discarded, { eventId: "second-event", startedAt: completedAt }) !== discarded, "Discard must not create a hidden reserved ID or tombstone.");
  }
}

async function verifyOlderCompatibleFacts() {
  const unordered = createPopulatedState();
  const old = event(unordered);
  assert(old.outcome !== undefined && old.phoneAwayStartedAt !== undefined && old.phoneAwayEndedAt === undefined, "Legacy unordered active fixture must contain historical answers before the newer preferred phone-away end.");
  await assertRoundTrip(unordered);
  assert(getUrgeControlProgress(unordered.urgeControl, completedAt)?.stage === "phoneAwayActive", "Legacy resume must identify the first missing step without erasing later recorded answers.");
  assert(recordUrgeControlTriggerState(unordered, { trigger: "stress" }) === unordered, "A correction must not retain noncanonical prerequisites in newly produced active state.");
  const recovered = changed(unordered, endUrgeControlPhoneAwayState, { endedAt: shift(old.phoneAwayStartedAt, 15_250) });
  equal(event(recovered), { ...old, phoneAwayEndedAt: shift(old.phoneAwayStartedAt, 15_250) }, "Supplying the sole missing prerequisite may recover an ordered legacy active event without removing any facts.");
  await assertRoundTrip(changed(recovered, completeUrgeControlEventState, { completedAt }));

  const missingInterrupt = createStages()[0]!;
  event(missingInterrupt).selectedTechnique = "personalReminder";
  await assertRoundTrip(missingInterrupt);
  const filled = changed(missingInterrupt, completeUrgeControlInterruptState, { completedAt: interruptAt });
  assert(event(filled).selectedTechnique === "personalReminder", "An explicit missing interrupt may complete legacy prerequisite ordering while retaining a stored technique.");

  const multipleMissing = createStages()[0]!;
  Object.assign(event(multipleMissing), { phoneAwayStartedAt: phoneAt, phoneAwayEndedAt: phoneEndedAt, outcome: "unchanged" });
  await assertRoundTrip(multipleMissing);
  assert(completeUrgeControlInterruptState(multipleMissing, { completedAt: interruptAt }) === multipleMissing, "Filling only one of multiple missing prerequisites must not emit a still-unordered active state.");
  assert(selectUrgeControlTechniqueState(multipleMissing, { technique: "urgeSurfing" }) === multipleMissing, "Legacy hydration must not waive the transition's interrupt prerequisite.");
  assert(changed(multipleMissing, discardActiveUrgeControlEventState, undefined).urgeControl.activeEvent === null, "A valid legacy unordered active event remains explicitly discardable.");

  const staleReduced = createStages()[6]!;
  Object.assign(event(staleReduced), { outcome: "reduced", secondLineAction: "doAnotherTask" });
  await assertRoundTrip(staleReduced);
  assert(completeUrgeControlEventState(staleReduced, { completedAt }) === staleReduced, "Completion must not retain contradictory reduced-with-escalation state.");
  const staleBefore = JSON.stringify(staleReduced);
  assert(recordUrgeControlOutcomeState(staleReduced, { outcome: "reduced" }) === staleReduced && JSON.stringify(staleReduced) === staleBefore, "An identical outcome must remain an exact no-op even for older reduced-with-escalation facts.");
  const explicitCorrection = changed(staleReduced, recordUrgeControlOutcomeState, { outcome: "unchanged" });
  const cleaned = changed(explicitCorrection, recordUrgeControlOutcomeState, { outcome: "reduced" });
  assert(!Object.hasOwnProperty.call(event(cleaned), "secondLineAction"), "Explicitly correcting a different outcome to reduced must remove stale second-line facts.");
  assert(recordUrgeControlOutcomeState(cleaned, { outcome: "reduced" }) === cleaned, "After explicit escalation removal, an identical reduced answer remains a no-op.");

  const historical = createDefaultBloomState();
  historical.urgeControl.records = [{ id: "older-minimal-completed", status: "completed", startedAt, completedAt, selectedTechnique: "urgeSurfing", outcome: "reduced", trigger: "notSure", secondLineAction: "doAnotherTask" }];
  await assertRoundTrip(historical);
  const started = changed(historical, startUrgeControlEventState, { eventId: "new-with-old-history", startedAt: completedAt });
  assert(started.urgeControl.records === historical.urgeControl.records, "New ordered events must preserve older valid completed records without retrofitting guided timestamps or clearing historical answers.");
}

function verifyInvalidTransitions() {
  let count = 0;
  const reject = (fn: Transition, state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(fn(state, input as never) === state, `${label}: invalid transitions must return the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: rejection must not partially mutate the event, history, or unrelated features.`);
    count++;
  };
  const empty = createDefaultBloomState();
  const stages = createStages();
  const operations: Operation[] = [
    [startUrgeControlEventState, empty, { eventId: "valid-new-id", startedAt }],
    [completeUrgeControlInterruptState, stages[0]!, { completedAt: interruptAt }],
    [selectUrgeControlTechniqueState, stages[1]!, { technique: "urgeSurfing" }],
    [startUrgeControlPhoneAwayState, stages[2]!, { startedAt: phoneAt }],
    [endUrgeControlPhoneAwayState, stages[3]!, { endedAt: phoneEndedAt }],
    [recordUrgeControlOutcomeState, stages[4]!, { outcome: "unchanged" }],
    [recordUrgeControlTriggerState, stages[5]!, { trigger: "boredom" }],
    [selectUrgeControlSecondLineActionState, stages[5]!, { action: "doAnotherTask" }],
    [completeUrgeControlEventState, stages[6]!, { completedAt }]
  ];
  for (const [fn, state, input] of operations) {
    for (const invalid of [undefined, null, [], 42, "event", {}, { ...input, status: "completed" }, { ...input, eventIdOverride: "injected" }]) reject(fn, state, invalid, "required input must be a strict object without unsupported fields");
    for (const key of Object.keys(input)) {
      for (const value of [undefined, null, "", " ", 42, ...(key === "eventId" ? [] : ["unknown"])]) reject(fn, state, { ...input, [key]: value }, `invalid ${key}`);
      if (key.endsWith("At")) for (const value of ["2026-02-30T12:00:00.000Z", "2026-11-01", "2026-11-01T12:00:00Z", "2026-11-01T12:00:00.000+00:00"]) reject(fn, state, { ...input, [key]: value }, "noncanonical timestamp");
    }
    if (fn !== startUrgeControlEventState) reject(fn, empty, input, "no active event");
  }
  // Test undefined against already populated fields too, so it cannot erase an optional answer.
  for (const [fn, state, input] of [
    [selectUrgeControlTechniqueState, stages[2]!, { technique: undefined }],
    [recordUrgeControlOutcomeState, stages[5]!, { outcome: undefined }],
    [recordUrgeControlTriggerState, stages[6]!, { trigger: undefined }],
    [selectUrgeControlSecondLineActionState, selectUrgeControlSecondLineActionState(stages[5]!, { action: "doAnotherTask" }), { action: undefined }]
  ] as Operation[]) reject(fn, state, input, "explicit undefined must not erase an existing answer");
  reject(startUrgeControlEventState, stages[0]!, { eventId: "second-active", startedAt }, "one active event maximum");
  const history = completeUrgeControlEventState(stages[6]!, { completedAt });
  reject(startUrgeControlEventState, history, { eventId: "guided-event", startedAt }, "completed event identity cannot be reused");
  for (const [fn, state, input, label] of [
    [completeUrgeControlInterruptState, stages[0]!, { completedAt: shift(startedAt, -1) }, "interrupt before event start"],
    [completeUrgeControlInterruptState, stages[1]!, { completedAt }, "interrupt already completed"],
    [selectUrgeControlTechniqueState, stages[0]!, { technique: "urgeSurfing" }, "technique requires interrupt"],
    [selectUrgeControlTechniqueState, stages[3]!, { technique: "urgeSurfing" }, "technique is immutable after phone-away begins"],
    [startUrgeControlPhoneAwayState, stages[0]!, { startedAt: phoneAt }, "phone-away requires interrupt"],
    [startUrgeControlPhoneAwayState, stages[1]!, { startedAt: phoneAt }, "phone-away requires technique"],
    [startUrgeControlPhoneAwayState, stages[2]!, { startedAt: shift(interruptAt, -1) }, "phone-away before interrupt"],
    [startUrgeControlPhoneAwayState, stages[3]!, { startedAt: completedAt }, "phone-away already started"],
    [endUrgeControlPhoneAwayState, stages[2]!, { endedAt: phoneEndedAt }, "phone-away end requires start"],
    [endUrgeControlPhoneAwayState, stages[3]!, { endedAt: shift(phoneAt, -1) }, "phone-away end before start"],
    [endUrgeControlPhoneAwayState, stages[4]!, { endedAt: completedAt }, "phone-away already ended"],
    [recordUrgeControlOutcomeState, stages[3]!, { outcome: "reduced" }, "outcome requires finished distance step"],
    [recordUrgeControlTriggerState, stages[4]!, { trigger: "notSure" }, "trigger requires outcome"],
    [selectUrgeControlSecondLineActionState, stages[4]!, { action: "doAnotherTask" }, "second-line requires outcome"],
    [completeUrgeControlEventState, stages[6]!, { completedAt: shift(phoneEndedAt, -1) }, "completion before phone-away end"]
  ] as Array<[Transition, BloomLocalState, Record<string, unknown>, string]>) reject(fn, state, input, label);
  for (const state of stages.slice(0, 6)) reject(completeUrgeControlEventState, state, { completedAt }, "completion requires every guided prerequisite");
  for (const [fn, , input] of operations.slice(1)) reject(fn, history, input, "completed history is outside active-event correction scope");
  const invalidContainer = clone(stages[6]!);
  invalidContainer.urgeControl.records.push({ ...event(invalidContainer), status: "completed", completedAt, selectedTechnique: "urgeSurfing", outcome: "unchanged", trigger: "notSure" });
  for (const [fn, , input] of operations) reject(fn, invalidContainer, input, "existing ambiguous duplicate identity must not be silently repaired");
  reject(discardActiveUrgeControlEventState, invalidContainer, undefined, "discard must validate the existing container before clearing a duplicate identity");
  return count;
}

async function verifyMalformedPersistence() {
  const active = createStages()[6]!;
  const completed = completeUrgeControlEventState(active, { completedAt });
  const cases: Array<[string, BloomLocalState, string, unknown, boolean?]> = [
    ["empty active identity", active, "activeEvent.id", ""],
    ["invalid event start", active, "activeEvent.startedAt", "2026-02-30T12:00:00.000Z"],
    ["interrupt before event start", active, "activeEvent.interruptCompletedAt", shift(startedAt, -1)],
    ["phone start before event start", active, "activeEvent.phoneAwayStartedAt", shift(startedAt, -1)],
    ["phone start before interrupt", active, "activeEvent.phoneAwayStartedAt", shift(interruptAt, -1)],
    ["phone end before start", active, "activeEvent.phoneAwayEndedAt", shift(phoneAt, -1)],
    ["phone end without start", active, "activeEvent.phoneAwayStartedAt", undefined, true],
    ["invalid active technique", active, "activeEvent.selectedTechnique", "unknown"],
    ["invalid active outcome", active, "activeEvent.outcome", "success"],
    ["invalid active trigger", active, "activeEvent.trigger", "diagnosis"],
    ["invalid second line", active, "activeEvent.secondLineAction", "sendMessageAutomatically"],
    ["active cannot carry completion", active, "activeEvent.completedAt", completedAt],
    ["active pointer cannot contain completed record", completed, "activeEvent", completed.urgeControl.records[0]],
    ["history cannot contain active event", active, "records", [event(active)]],
    ["duplicate completed IDs", completed, "records", [completed.urgeControl.records[0], completed.urgeControl.records[0]]],
    ["duplicate active and completed IDs", active, "records", completed.urgeControl.records],
    ["missing completed technique", completed, "records.0.selectedTechnique", undefined, true],
    ["missing completed outcome", completed, "records.0.outcome", undefined, true],
    ["missing completed trigger", completed, "records.0.trigger", undefined, true],
    ["missing completed time", completed, "records.0.completedAt", undefined, true],
    ["completion before event start", completed, "records.0.completedAt", shift(startedAt, -1)],
    ["completion before last known step", completed, "records.0.completedAt", shift(phoneEndedAt, -1)],
    ["history must be array", active, "records", {}],
    ["active pointer must be object or null", active, "activeEvent", []]
  ];
  for (const [label, state, path, value, remove] of cases) {
    const malformed = clone(state);
    replaceAtPath(malformed.urgeControl, path, value, remove === true);
    assert(!validateAndNormalizeBloomState(malformed).success, `${label}: malformed facts must fail persisted validation.`);
    assert(discardActiveUrgeControlEventState(malformed) === malformed, `${label}: transitions must reject malformed existing containers instead of stripping facts.`);
    const client = new UrgeTestStorage();
    const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state: malformed }, null, 2);
    client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "corrupt" && loaded.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: hydration must use existing corruption handling.`);
    assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, "Corrupt hydration must leave original payload bytes untouched.");
    assert(loaded.backupKey !== null && loaded.backupKey.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt Urge Control facts must receive the existing scoped backup.");
    const backup = client.values.get(loaded.backupKey);
    assert(backup !== undefined, "Backup payload must exist.");
    const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
    assert(parsed.rawPayload === raw && parsed.sourceKey === BLOOM_STATE_STORAGE_KEY, "Backup must preserve exact original bytes and source ownership.");
  }
  for (const path of ["startedAt", "interruptCompletedAt", "phoneAwayStartedAt", "phoneAwayEndedAt"]) {
    const malformed = clone(active);
    replaceAtPath(event(malformed), path, "invalid-time", false);
    assert(getUrgeControlProgress(malformed.urgeControl, completedAt) === null, "Malformed known event times must not produce NaN elapsed progress.");
  }
  return cases.length;
}

function createStages(source = createDefaultBloomState()): BloomLocalState[] {
  const states = [changed(source, startUrgeControlEventState, { eventId: "guided-event", startedAt })];
  const steps: Array<[Transition, Record<string, unknown>]> = [
    [completeUrgeControlInterruptState, { completedAt: interruptAt }],
    [selectUrgeControlTechniqueState, { technique: "changeEnvironment" }],
    [startUrgeControlPhoneAwayState, { startedAt: phoneAt }],
    [endUrgeControlPhoneAwayState, { endedAt: phoneEndedAt }],
    [recordUrgeControlOutcomeState, { outcome: "stillStrong" }],
    [recordUrgeControlTriggerState, { trigger: "notSure" }]
  ];
  for (const [fn, input] of steps) states.push(changed(states[states.length - 1]!, fn, input));
  return states;
}
function changed(state: BloomLocalState, fn: Transition, input: unknown): BloomLocalState {
  const before = JSON.stringify(state);
  const after = fn(state, input as never);
  assert(after !== state && after.urgeControl !== state.urgeControl, "A valid explicit transition must produce a new state and Urge Control slice.");
  assert(JSON.stringify(state) === before, "Transitions must never mutate the original event, history, or unrelated state.");
  unrelated(state, after);
  assert(validateAndNormalizeBloomState(after).success, "Every newly produced Urge Control lifecycle state must validate for persistence.");
  if (after.urgeControl.records.length === state.urgeControl.records.length) assert(after.urgeControl.records === state.urgeControl.records, "In-progress steps and discard must preserve completed history by reference.");
  equal(fn(state, input as never), after, "Explicit input timestamps and facts must produce deterministic transitions.");
  return after;
}
function event(state: BloomLocalState): ActiveUrgeControlEvent { const active = state.urgeControl.activeEvent; assert(active !== null, "Active fixture required."); return active; }
function unrelated(before: BloomLocalState, after: BloomLocalState) { for (const key of Object.keys(before) as Array<keyof BloomLocalState>) if (key !== "urgeControl") assert(after[key] === before[key], `Urge Control must preserve ${key} by reference, including active Reset, Content-Free, Tracking, onboarding, and legacy features.`); }
function shift(timestamp: string, milliseconds: number) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) { const keys = path.split("."); const final = keys.pop()!; let parent = root as Record<string, unknown>; for (const key of keys) parent = parent[key] as Record<string, unknown>; if (remove) delete parent[final]; else parent[final] = value; }
async function assertRoundTrip(state: BloomLocalState) {
  assert(validateAndNormalizeBloomState(state).success, "Fixture must be valid before v7 persistence.");
  const client = new UrgeTestStorage();
  await persistBloomLocalState(state, client, now);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Urge Control must load from the existing current v7 envelope.");
  equal(loaded.state, state, "Hydration must preserve exact active/completed facts and all unrelated slices without step advancement or timer persistence.");
  return loaded.state;
}
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
class UrgeTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
