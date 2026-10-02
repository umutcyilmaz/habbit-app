import { isDeepStrictEqual } from "node:util";

import type { BehaviorSlipReason, ResetJourney } from "../src/domain/models";
import { getBehaviorSlipImpact } from "../src/domain/productPolicy/getBehaviorSlipImpact";
import {
  completeElapsedResetPeriodState,
  createDefaultBloomState,
  recordActiveResetViolationState,
  recordBehaviorSlipState,
  recordManualContentFreeViolationState,
  undoActiveResetViolationState,
  undoManualContentFreeViolationState,
  type BloomLocalState,
  type RecordBehaviorSlipInput
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const startedAt = "2026-09-01T12:00:00.000Z";
const occurredAt = "2026-09-07T12:00:00.000Z";
const recordedAt = "2026-09-07T12:01:00.000Z";
const undoneAt = "2026-09-07T12:02:00.000Z";
const day15 = "2026-09-16T12:00:00.000Z";
const reasons: readonly BehaviorSlipReason[] = ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"];

export async function verifyBloomBehaviorSlip() {
  const scenarios = verifyImpactAndMutationMatrix();
  verifyCurrentAttemptAuthority();
  verifyOccurrenceBoundaries();
  verifyAtomicOwnershipAndUndo();
  verifyConsumedSourcesAcrossOwners();
  const rejected = verifyInvalidFactsAndAtomicRejection();
  await verifyV7RoundTrips();
  console.log(`Bloom behavior-slip verification passed (${scenarios} preview/mutation scenarios; ${rejected} rejected inputs; atomic ownership, current-attempt boundaries, source tombstones, existing undo, and v7 persistence).`);
}

function verifyImpactAndMutationMatrix() {
  let scenarios = 0;
  for (const contentActive of [false, true]) {
    const active = createActiveState(false, contentActive);
    const completed = completeElapsedResetPeriodState(active, { observedAt: day15 });
    assert(completed.resetJourney.status === "completed", "Completed behavior-slip fixture required.");
    const inactive = createDefaultBloomState().resetJourney;
    const cases: Array<[string, BloomLocalState, string, boolean]> = [
      ["active at start", active, startedAt, true],
      ["active before Day 15", active, occurredAt, true],
      ["active final millisecond", active, "2026-09-16T11:59:59.999Z", true],
      ["stale active exact Day 15", active, day15, false],
      ["stale active one millisecond later", active, "2026-09-16T12:00:00.001Z", false],
      ["inactive", { ...active, resetJourney: inactive }, occurredAt, false],
      ["recommended", { ...active, resetJourney: { ...inactive, status: "recommended", id: "slip-recommended" } }, occurredAt, false],
      ["baseline pending", { ...active, resetJourney: { ...inactive, status: "baseline_pending", id: "slip-pending" } }, occurredAt, false],
      ["completed", completed, "2026-09-17T12:00:00.000Z", false]
    ];
    for (const [label, state, time, affectsReset] of cases) {
      for (const reason of reasons) {
        const input = slipInput(reason, time);
        const affectsContent = contentActive && reason !== "masturbation";
        const stateBytes = JSON.stringify(state);
        const inputBytes = JSON.stringify(input);
        const impact = { reset: affectsReset ? "restart" : "unchanged", contentFree: affectsContent ? "resetStreak" : "unchanged" };
        equal(getBehaviorSlipImpact(state, reason, time), impact, `${label}/${reason}: preview must use effective restriction and intentional-content applicability.`);
        equal(getBehaviorSlipImpact(state, reason, time), impact, "Preview must be deterministic from explicit facts.");
        const updated = recordBehaviorSlipState(state, input);
        assert((updated.resetJourney !== state.resetJourney) === affectsReset, `${label}/${reason}: Reset mutation must agree with the canonical preview.`);
        assert((updated.contentFree !== state.contentFree) === affectsContent, `${label}/${reason}: Content-Free mutation must agree with the canonical preview.`);
        if (!affectsReset && !affectsContent) assert(updated === state, `${label}/${reason}: neither-affected commands must return the exact source state without generic history.`);
        for (const key of Object.keys(state) as Array<keyof BloomLocalState>) {
          if (key !== "resetJourney" && key !== "contentFree") assert(updated[key] === state[key], `${label}/${reason}: unrelated ${key} must retain its original reference.`);
        }
        if (affectsReset) {
          assert(state.resetJourney.status === "active" && updated.resetJourney.status === "active", "A restart retains the active lifecycle.");
          assert(updated.resetJourney.baseline === state.resetJourney.baseline, "A slip must preserve the original baseline reference without recapturing questionnaire or Tracking facts.");
          equal(updated, directReset(state, input), "Reset-owned slips must produce the exact existing canonical atomic transaction.");
        } else if (affectsContent) {
          equal(updated, directContent(state, input), "Content-Free-owned slips must produce the existing standalone manual transaction.");
          assert(updated.resetJourney === state.resetJourney, "Reading elapsed restriction must not complete or otherwise alter a stale active Reset.");
        }
        equal(recordBehaviorSlipState(state, input), updated, "Prepared behavior-slip transitions must be deterministic.");
        assert(recordBehaviorSlipState(updated, input) === updated, "Repeating a consumed manual source must not create a second event.");
        assert(JSON.stringify(state) === stateBytes && JSON.stringify(input) === inputBytes, "Neither preview nor mutation may change caller state or prepared input.");
        const validation = validateAndNormalizeBloomState(updated);
        assert(validation.success, `${label}/${reason}: successor must contain only valid existing persisted shapes: ${validation.success ? "" : validation.error}`);
        scenarios++;
      }
    }
  }
  return scenarios;
}

function verifyCurrentAttemptAuthority() {
  const original = createActiveState(false, true);
  const first = recordBehaviorSlipState(original, slipInput("masturbation"));
  assert(first.resetJourney.status === "active", "Restarted current-attempt fixture required.");
  // The original journey has elapsed, but its replacement attempt has six days left.
  const duringReplacement = slipInput("intentionalExplicitContent", day15, "replacement-period");
  equal(getBehaviorSlipImpact(first, duringReplacement.reason, day15), { reset: "restart", contentFree: "resetStreak" }, "Current-attempt start must govern restriction even after the original journey's Day 15.");
  const updated = recordBehaviorSlipState(first, duringReplacement);
  assert(updated.resetJourney !== first.resetJourney && updated.contentFree !== first.contentFree, "The current attempt must atomically own explicit behavior during its own restriction.");
  for (const [time, reset] of [["2026-09-22T11:59:59.999Z", "restart"], ["2026-09-22T12:00:00.000Z", "unchanged"], ["2026-09-22T12:00:00.001Z", "unchanged"]] as const) {
    equal(getBehaviorSlipImpact(first, "intentionalExplicitContent", time), { reset, contentFree: "resetStreak" }, "The replacement attempt has its own exact 15-day boundary.");
    const result = recordBehaviorSlipState(first, slipInput("intentionalExplicitContent", time, `boundary-${time}`));
    assert((result.resetJourney !== first.resetJourney) === (reset === "restart") && result.contentFree !== first.contentFree, "Replacement-attempt boundary preview and mutation must agree.");
  }
}

function verifyOccurrenceBoundaries() {
  const active = createActiveState(false, true);
  const explicit = slipInput("intentionalExplicitContent");
  const delayed = recordBehaviorSlipState(active, { ...explicit, recordedAt: "2026-10-01T12:00:00.000Z" });
  assert(delayed.resetJourney !== active.resetJourney && delayed.contentFree !== active.contentFree, "Backdated behavior during Reset restriction remains Reset-owned even when recorded after Day 15.");
  const standalone = { ...active, resetJourney: createDefaultBloomState().resetJourney };
  const delayedStandalone = recordBehaviorSlipState(standalone, { ...explicit, recordedAt: "2026-10-01T12:00:00.000Z" });
  assert(delayedStandalone.contentFree.status === "active" && delayedStandalone.contentFree.currentStreakStartedAt === occurredAt, "A valid backdated standalone event anchors the new streak at occurrence, not recording time.");
  const beforeAttempt = "2026-09-01T11:59:59.999Z";
  for (const reason of reasons) {
    assert(getBehaviorSlipImpact(active, reason, beforeAttempt) === null, "An event before the current Reset attempt cannot claim a valid restart preview.");
    assert(recordBehaviorSlipState(active, slipInput(reason, beforeAttempt)) === active, "A pre-attempt event must not fall through to a partial standalone Content-Free effect.");
  }
  assert(active.contentFree.status === "active", "Active Content-Free fixture required.");
  for (const resetJourney of [active.resetJourney, standalone.resetJourney]) {
    for (const contentFree of [
      { ...active.contentFree, activatedAt: "2026-09-08T12:00:00.000Z", currentStreakStartedAt: "2026-09-08T12:00:00.000Z" },
      { ...active.contentFree, currentStreakStartedAt: "2026-09-08T12:00:00.000Z" }
    ]) {
      const laterContent = { ...active, resetJourney, contentFree };
      for (const reason of reasons.filter((value) => value !== "masturbation")) {
        assert(getBehaviorSlipImpact(laterContent, reason, occurredAt) === null, "Explicit events before current activation/streak boundaries must fail the preview safely.");
        assert(recordBehaviorSlipState(laterContent, slipInput(reason)) === laterContent, "Unsafe linked Content-Free ownership must publish neither side, never Reset-only fallback.");
      }
      const onlyReset = recordBehaviorSlipState(laterContent, slipInput("masturbation"));
      assert(onlyReset.contentFree === laterContent.contentFree, "Masturbation never affects Content-Free even if its activation or streak starts later.");
      assert((onlyReset.resetJourney !== laterContent.resetJourney) === (resetJourney.status === "active"), "Unrelated Content-Free occurrence boundaries must not block valid masturbation-only Reset behavior.");
    }
  }
}

function verifyAtomicOwnershipAndUndo() {
  const active = createActiveState(true, true);
  const input = slipInput("masturbationWithExplicitContent");
  const updated = recordBehaviorSlipState(active, input);
  assert(updated.resetJourney.status === "active" && updated.contentFree.status === "active", "Atomic linked fixture required.");
  const resetEvent = last(updated.resetJourney.violations);
  const contentEvent = last(updated.contentFree.violations);
  assert(resetEvent !== undefined && contentEvent !== undefined, "One explicit behavior must append both linked records.");
  for (const event of [resetEvent, contentEvent]) {
    equal(event.source, { kind: "manual", logActionId: input.logActionId }, "Linked records must retain the one real-world manual behavior source.");
    assert(event.occurredAt === input.occurredAt && event.recordedAt === input.recordedAt, "Both records must agree on the exact occurrence and operation timestamps.");
  }
  assert(resetEvent.id === input.resetViolationId && contentEvent.id === input.contentFreeViolationId && updated.resetJourney.currentAttempt.id === input.replacementResetAttemptId, "The owning canonical transaction consumes only its preallocated identities.");
  assert(undoManualContentFreeViolationState(updated, { violationId: input.contentFreeViolationId, undoneAt }) === updated, "Standalone undo must not reverse one side of a Reset-owned event.");
  const undone = undoActiveResetViolationState(updated, { violationId: input.resetViolationId, undoneAt });
  assert(undone !== updated && undone.resetJourney.status === "active" && active.resetJourney.status === "active" && undone.contentFree.status === "active" && active.contentFree.status === "active", "Existing Reset undo must retain ownership of atomic reversal.");
  equal(undone.resetJourney.currentAttempt, active.resetJourney.currentAttempt, "Reset undo restores the original attempt.");
  assert(undone.contentFree.currentStreakStartedAt === active.contentFree.currentStreakStartedAt && undone.contentFree.bestStreakSeconds === active.contentFree.bestStreakSeconds, "Reset undo restores both Content-Free streak facts.");
  assert(last(undone.resetJourney.violations)?.status === "undone" && last(undone.contentFree.violations)?.status === "undone", "Atomic undo preserves both consumed source tombstones.");
  assert(recordBehaviorSlipState(undone, { ...input, reason: "masturbation" }) === undone, "Changing reason cannot replay an atomically undone behavior.");
  const standaloneState = { ...createActiveState(false, true), resetJourney: createDefaultBloomState().resetJourney };
  const standalone = recordBehaviorSlipState(standaloneState, input);
  assert(undoActiveResetViolationState(standalone, { violationId: input.resetViolationId, undoneAt }) === standalone, "A standalone Content-Free event has no invented Reset record to undo.");
  const standaloneUndone = undoManualContentFreeViolationState(standalone, { violationId: input.contentFreeViolationId, undoneAt });
  assert(standaloneUndone !== standalone && standaloneUndone.resetJourney === standaloneState.resetJourney && last(standaloneUndone.contentFree.violations)?.status === "undone", "Existing manual Content-Free undo owns standalone events and preserves their source tombstone.");
  assert(recordBehaviorSlipState(standaloneUndone, input) === standaloneUndone, "Standalone tombstones remain consumed through the coordinator.");
}

function verifyConsumedSourcesAcrossOwners() {
  const active = createActiveState(false, true);
  const input = slipInput("masturbation");
  const resetOwned = recordBehaviorSlipState(active, input);
  const afterReplacementPeriod = "2026-09-22T12:00:00.001Z";
  const laterExplicit = { ...slipInput("intentionalExplicitContent", afterReplacementPeriod, "new-candidates"), logActionId: input.logActionId };
  assert(recordBehaviorSlipState(resetOwned, laterExplicit) === resetOwned, "An earlier masturbation-only Reset source cannot become a standalone Content-Free event after restriction elapses.");
  const resetUndone = undoActiveResetViolationState(resetOwned, { violationId: input.resetViolationId, undoneAt });
  assert(recordBehaviorSlipState(resetUndone, laterExplicit) === resetUndone, "Reset-only tombstones must still prevent later standalone replay.");
  const standaloneState = { ...active, resetJourney: createDefaultBloomState().resetJourney };
  const standaloneInput = slipInput("intentionalExplicitContent");
  const standalone = recordBehaviorSlipState(standaloneState, standaloneInput);
  const undone = undoManualContentFreeViolationState(standalone, { violationId: standaloneInput.contentFreeViolationId, undoneAt });
  for (const prior of [standalone, undone]) {
    const withReset = { ...prior, resetJourney: active.resetJourney };
    const reused = { ...slipInput("masturbation", "2026-09-08T12:00:00.000Z", "reset-candidates"), logActionId: standaloneInput.logActionId };
    assert(recordBehaviorSlipState(withReset, reused) === withReset, "A prior standalone Content-Free source, including a tombstone, cannot become a Reset-only event with new IDs and a changed reason.");
    const newBehavior = recordBehaviorSlipState(withReset, { ...reused, logActionId: "new-real-world-event" });
    assert(newBehavior.resetJourney !== withReset.resetJourney && newBehavior.contentFree === withReset.contentFree, "Consumed-source protection must still allow a fresh valid manual behavior.");
  }
  const secondInput = slipInput("intentionalExplicitContent", occurredAt, "second-same-time-event");
  const second = recordBehaviorSlipState(resetOwned, secondInput);
  assert(second.resetJourney.violations.length === 2 && second.contentFree.violations.length === 1, "Distinct source identities at the same timestamp remain distinct intentional behaviors.");
  assert(recordBehaviorSlipState(second, { ...input, ...slipInput("masturbationWithExplicitContent", "2026-09-08T12:00:00.000Z", "later-candidates"), logActionId: input.logActionId }) === second, "Deduplication must search earlier records rather than only the latest source.");
}

function verifyInvalidFactsAndAtomicRejection() {
  let count = 0;
  const active = createActiveState(false, true);
  const input = slipInput("intentionalExplicitContent");
  const reject = (state: BloomLocalState, candidate: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(recordBehaviorSlipState(state, candidate as RecordBehaviorSlipInput) === state, `${label}: malformed/stale facts must return the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: rejection must not leak a partial restart, streak, or record.`);
    count++;
  };
  for (const value of [null, [], "event", {}]) reject(active, value, "Invalid input structure");
  for (const field of Object.keys(input)) {
    const missing: Record<string, unknown> = { ...input };
    delete missing[field];
    reject(active, missing, `Missing ${field}`);
  }
  reject(active, { ...input, unrecognized: true }, "Unexpected input field");
  for (const field of ["logActionId", "resetViolationId", "replacementResetAttemptId", "contentFreeViolationId"] as const) {
    for (const value of ["", " ", null, 17]) reject(active, { ...input, [field]: value }, `Invalid ${field}`);
  }
  for (const field of ["occurredAt", "recordedAt"] as const) {
    for (const value of ["", "2026-02-30T12:00:00.000Z", "2026-09-07", "2026-09-07T12:00:00+00:00", null, 17]) {
      reject(active, { ...input, [field]: value }, `Noncanonical ${field}`);
      if (field === "occurredAt") assert(getBehaviorSlipImpact(active, input.reason, value as string) === null, "Invalid occurrence timestamps must fail the preview safely.");
    }
  }
  for (const reason of ["accidentalExposure", "explicitContent", "both", "", null]) {
    reject(active, { ...input, reason }, "Unknown semantic reason");
    assert(getBehaviorSlipImpact(active, reason as BehaviorSlipReason, occurredAt) === null, "The preview accepts only existing intentional Reset reason values.");
  }
  reject(active, { ...input, recordedAt: "2026-09-07T11:59:59.999Z" }, "Recording before occurrence");
  assert(active.resetJourney.status === "active" && active.contentFree.status === "active", "Active corruption fixture required.");
  reject(active, { ...input, replacementResetAttemptId: active.resetJourney.currentAttempt.id }, "Existing attempt identity");
  const linked = recordBehaviorSlipState(active, input);
  for (const conflict of [{ resetViolationId: input.resetViolationId }, { contentFreeViolationId: input.contentFreeViolationId }, { replacementResetAttemptId: input.replacementResetAttemptId }]) {
    reject(linked, { ...slipInput("intentionalExplicitContent", "2026-09-08T12:00:00.000Z", "fresh-source"), ...conflict }, "Collision in an owned identity scope");
  }
  const malformedStates: BloomLocalState[] = [
    { ...active, resetJourney: { ...active.resetJourney, currentAttempt: { ...active.resetJourney.currentAttempt, startedAt: "invalid" } } },
    { ...active, resetJourney: { ...active.resetJourney, durationDays: 14 } as unknown as ResetJourney },
    { ...active, contentFree: { ...active.contentFree, activatedAt: "invalid" } },
    { ...active, contentFree: { ...active.contentFree, currentStreakStartedAt: "invalid" } },
    { ...active, contentFree: { ...active.contentFree, currentStreakStartedAt: "2026-08-31T12:00:00.000Z" } },
    { ...active, contentFree: { ...active.contentFree, bestStreakSeconds: -1 } }
  ];
  for (const malformed of malformedStates) reject(malformed, input, "Malformed current product facts");
  for (const index of [0, 2, 3, 4]) {
    const malformed = malformedStates[index];
    assert(malformed !== undefined && getBehaviorSlipImpact(malformed, input.reason, occurredAt) === null, "Malformed ownership timestamps must not claim a valid preview.");
  }
  const resetOnly = createActiveState(false, false);
  reject(resetOnly, { ...input, contentFreeViolationId: "" }, "Malformed unused Content-Free candidate");
  const contentOnly = { ...active, resetJourney: createDefaultBloomState().resetJourney };
  reject(contentOnly, { ...input, replacementResetAttemptId: "" }, "Malformed unused Reset candidate");
  return count;
}

async function verifyV7RoundTrips() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Behavior-slip coordination must retain v7 and its existing key.");
  const active = createActiveState(false, true);
  const input = slipInput("intentionalExplicitContent");
  const linked = recordBehaviorSlipState(active, input);
  const standalone = recordBehaviorSlipState({ ...active, resetJourney: createDefaultBloomState().resetJourney }, input);
  const states = [createPopulatedState(), active, linked, standalone,
    undoActiveResetViolationState(linked, { violationId: input.resetViolationId, undoneAt }),
    undoManualContentFreeViolationState(standalone, { violationId: input.contentFreeViolationId, undoneAt })];
  for (const state of states) {
    equal(Object.keys(state).sort(), Object.keys(active).sort(), "Coordination must not add a generic behavior-history or any persisted top-level slice.");
    const validated = validateAndNormalizeBloomState(state);
    assert(validated.success, "Existing and coordinated v7 states must remain valid.");
    const client = createMemoryStorageClient();
    const now = () => new Date("2026-10-01T12:00:00.000Z");
    await persistBloomLocalState(validated.state, client, now);
    const loaded = await loadBloomLocalState(client, now);
    assert(loaded.status === "success" && loaded.source === "current" && !loaded.needsPersist, "Canonical v7 must reload without migration or writeback.");
    equal(loaded.state, state, "Existing shapes, sources, timestamps, history, and tombstones must round-trip unchanged.");
    equal(await client.getAllKeys(), [BLOOM_STATE_STORAGE_KEY], "The coordinator must not introduce a persistence key.");
    if (state !== active && state !== states[0]) assert(recordBehaviorSlipState(loaded.state, input) === loaded.state, "Consumed behavior identities must remain protected after persistence reload.");
  }
}

function slipInput(reason: BehaviorSlipReason, time = occurredAt, suffix = "operation"): RecordBehaviorSlipInput {
  return {
    reason, occurredAt: time, recordedAt: time === occurredAt ? recordedAt : time,
    logActionId: `slip-source-${suffix}`, resetViolationId: `slip-reset-${suffix}`,
    replacementResetAttemptId: `slip-attempt-${suffix}`, contentFreeViolationId: `slip-content-${suffix}`
  };
}

function directReset(state: BloomLocalState, input: RecordBehaviorSlipInput) {
  return recordActiveResetViolationState(state, {
    reason: input.reason, occurredAt: input.occurredAt, recordedAt: input.recordedAt,
    source: { kind: "manual", logActionId: input.logActionId }, violationId: input.resetViolationId,
    replacementAttemptId: input.replacementResetAttemptId, contentFreeViolationId: input.contentFreeViolationId
  });
}

function directContent(state: BloomLocalState, input: RecordBehaviorSlipInput) {
  return recordManualContentFreeViolationState(state, {
    violationId: input.contentFreeViolationId, logActionId: input.logActionId,
    occurredAt: input.occurredAt, recordedAt: input.recordedAt
  });
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function last<T>(values: readonly T[]): T | undefined { return values[values.length - 1]; }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
