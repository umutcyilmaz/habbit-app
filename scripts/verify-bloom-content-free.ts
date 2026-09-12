import { isDeepStrictEqual } from "node:util";

import type { ContentFreeState, ContentFreeViolation } from "../src/domain/models";
import { getContentFreeProgress } from "../src/domain/contentFree/getContentFreeProgress";
import {
  activateContentFreeState, deactivateContentFreeState, recordManualContentFreeViolationState,
  undoManualContentFreeViolationState, recordActiveResetViolationState, undoActiveResetViolationState,
  createDefaultBloomState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, BLOOM_CORRUPT_BACKUP_PREFIX, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState, createInput } from "./verify-bloom-reset-violations";

const activatedAt = "2026-10-01T10:00:00.750Z";
const occurredAt = "2026-10-03T10:00:00.249Z";
const recordedAt = "2026-10-05T12:00:00.000Z";
const undoneAt = "2026-10-05T12:01:00.000Z";
const now = () => new Date("2026-11-30T12:00:00.000Z");
type Transition = (state: BloomLocalState, input: never) => BloomLocalState;

export async function verifyBloomContentFree() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Standalone Content-Free writes existing valid shapes and must retain persistence v7.");
  await verifyActivationCycles();
  await verifyManualViolationAndUndo();
  await verifySameTimeAndSequentialUndo();
  verifyProgressSelection();
  verifyTransactionOwnership();
  const rejected = verifyRejectedTransitions();
  const corrupt = await verifyMalformedHistory();
  console.log(`Bloom Content-Free verification passed (${rejected} rejected transitions; ${corrupt} corrupt history cases; activation cycles, manual undo, ownership guards, progress selection, and v7 round trips).`);
}

async function verifyActivationCycles() {
  for (const history of [false, true]) {
    const inactive = createInactiveState(history);
    const original = JSON.stringify(inactive);
    const active = activateContentFreeState(inactive, { activationId: "standalone-activation", activatedAt });
    assert(active !== inactive && active.contentFree.status === "active", "Inactive Content-Free must activate with explicitly supplied identity and time.");
    equal(active.contentFree, { ...inactive.contentFree, status: "active", activationId: "standalone-activation", activatedAt, currentStreakStartedAt: activatedAt }, "Activation must retain best/history and start exactly one independent current streak without a violation.");
    assert(active.contentFree.pastActivations === inactive.contentFree.pastActivations && active.contentFree.violations === inactive.contentFree.violations, "Activation must preserve existing history arrays by reference.");
    assertUnrelatedReferences(inactive, active, "activation");
    assert(JSON.stringify(inactive) === original, "Activation must not mutate its source state.");
    equal(activateContentFreeState(inactive, { activationId: "standalone-activation", activatedAt }), active, "Activation must be deterministic without generated IDs or clocks.");
    assert(activateContentFreeState(active, { activationId: "replacement-activation", activatedAt: recordedAt }) === active, "An active program cannot be replaced by a second activation.");
    await assertRoundTrip(active, "active");
    const endedAt = "2026-10-06T10:00:00.249Z";
    const activeBytes = JSON.stringify(active);
    const deactivated = deactivateContentFreeState(active, { endedAt });
    assert(deactivated !== active && deactivated.contentFree.status === "inactive", "Active Content-Free must deactivate without discarding history.");
    equal(deactivated.contentFree, {
      status: "inactive", bestStreakSeconds: Math.max(active.contentFree.bestStreakSeconds, 431999),
      pastActivations: [...active.contentFree.pastActivations, { id: "standalone-activation", startedAt: activatedAt, endedAt }],
      violations: active.contentFree.violations
    }, "Deactivation must floor the ended streak to whole seconds, archive its existing activation once, and preserve violations/best.");
    for (const field of ["activationId", "activatedAt", "currentStreakStartedAt"]) assert(!(field in deactivated.contentFree), "Inactive state must not retain a fake current activation or streak.");
    assertUnrelatedReferences(active, deactivated, "deactivation");
    assert(JSON.stringify(active) === activeBytes, "Deactivation must not mutate its active source.");
    assert(deactivateContentFreeState(deactivated, { endedAt: now().toISOString() }) === deactivated, "Retrying deactivation must not archive the same activation twice.");
    await assertRoundTrip(deactivated, "inactive");
    const reactivatedAt = "2026-10-10T10:00:00.000Z";
    const reactivated = activateContentFreeState(deactivated, { activationId: "reactivated-program", activatedAt: reactivatedAt });
    assert(reactivated !== deactivated && reactivated.contentFree.status === "active", "A fresh activation identity must permit reactivation after a gap.");
    assert(reactivated.contentFree.currentStreakStartedAt === reactivatedAt && reactivated.contentFree.bestStreakSeconds === deactivated.contentFree.bestStreakSeconds, "Reactivation must start a separate streak without merging the inactive gap or losing historical best.");
    equal(reactivated.contentFree.pastActivations, deactivated.contentFree.pastActivations, "Reactivation must not reorder or erase prior activation periods.");
    await assertRoundTrip(reactivated, "active");
  }
  const zero = activateContentFreeState(createInactiveState(false), { activationId: "zero-length-activation", activatedAt });
  const zeroEnded = deactivateContentFreeState(zero, { endedAt: activatedAt });
  assert(zeroEnded.contentFree.status === "inactive" && zeroEnded.contentFree.bestStreakSeconds === 0, "Equality at activation/deactivation creates a valid zero-second activation.");
  assert(activateContentFreeState(zeroEnded, { activationId: "touching-next-activation", activatedAt }) !== zeroEnded, "A new activation may begin exactly when the previous one ended.");
  const reordered = createInactiveState(true);
  reordered.contentFree.pastActivations.reverse();
  const order = JSON.stringify(reordered.contentFree.pastActivations);
  const reactivated = activateContentFreeState(reordered, { activationId: "after-all-history", activatedAt });
  assert(reactivated !== reordered && JSON.stringify(reactivated.contentFree.pastActivations) === order, "Valid disjoint historical activations must retain their existing array order.");
  const resetActive = createInactiveState(false);
  resetActive.resetJourney = createActiveState(false, true).resetJourney;
  const independent = activateContentFreeState(resetActive, { activationId: "independent-program", activatedAt });
  const independentEnd = deactivateContentFreeState(independent, { endedAt: recordedAt });
  assert(independent !== resetActive && independentEnd !== independent && independentEnd.resetJourney === resetActive.resetJourney, "Active Reset must not control manual Content-Free activation/deactivation or cause implicit Reset changes.");
}

async function verifyManualViolationAndUndo() {
  for (const history of [false, true]) {
    const original = makeActive(history);
    const before = JSON.stringify(original);
    const input = manualInput();
    const recorded = recordManualContentFreeViolationState(original, input);
    assert(recorded !== original && recorded.contentFree.status === "active" && original.contentFree.status === "active", "A standalone intentional-content event must reset the streak while leaving Content-Free active.");
    const endedStreak = Math.floor((Date.parse(occurredAt) - Date.parse(original.contentFree.currentStreakStartedAt)) / 1000);
    const violation = {
      id: input.violationId, activationId: original.contentFree.activationId, kind: "intentionalExplicitContent",
      occurredAt, recordedAt, source: { kind: "manual", logActionId: input.logActionId }, status: "recorded",
      streakBefore: { currentStreakStartedAt: original.contentFree.currentStreakStartedAt, bestStreakSeconds: original.contentFree.bestStreakSeconds }
    };
    equal(recorded.contentFree, {
      ...original.contentFree, currentStreakStartedAt: occurredAt,
      bestStreakSeconds: Math.max(original.contentFree.bestStreakSeconds, endedStreak),
      violations: [...original.contentFree.violations, violation]
    }, "Manual logging must construct its own manual source, capture the prior snapshot before best update, and anchor the new streak at historical occurredAt rather than later recordedAt.");
    assert(endedStreak === 172799, "Fixture must test whole-second flooring across fractional endpoints.");
    assert(recorded.contentFree.pastActivations === original.contentFree.pastActivations, "A violation resets a streak without replacing or archiving its activation.");
    assertUnrelatedReferences(original, recorded, "manual violation");
    assert(JSON.stringify(original) === before, "Manual logging must not mutate the prior snapshot.");
    equal(recordManualContentFreeViolationState(original, input), recorded, "Manual logging must be deterministic from explicit inputs.");
    assert(recordManualContentFreeViolationState(recorded, input) === recorded, "Retrying the same manual source must not reset the streak or append a second violation.");
    await assertRoundTrip(recorded, "active");
    const recordedBytes = JSON.stringify(recorded);
    const undone = undoManualContentFreeViolationState(recorded, { violationId: input.violationId, undoneAt });
    assert(undone !== recorded && undone.contentFree.status === "active", "Latest standalone manual undo must restore its active streak atomically.");
    equal(undone.contentFree, {
      ...original.contentFree,
      violations: [...original.contentFree.violations, { ...violation, status: "undone", undoneAt }]
    }, "Undo must restore exact prior streak/best and preserve the event/source as an undone tombstone.");
    assertUnrelatedReferences(recorded, undone, "manual undo");
    assert(JSON.stringify(recorded) === recordedBytes, "Undo must not mutate its recorded source state.");
    assert(undoManualContentFreeViolationState(undone, { violationId: input.violationId, undoneAt: now().toISOString() }) === undone, "Repeated undo must preserve the original correction timestamp by returning the same state.");
    assert(recordManualContentFreeViolationState(undone, input) === undone, "An undone manual source remains consumed and must block stale replay.");
    const changedIds = { ...input, violationId: "different-id-same-source", occurredAt: "2026-10-06T10:00:00.000Z", recordedAt: "2026-10-06T10:01:00.000Z" };
    assert(recordManualContentFreeViolationState(undone, changedIds) === undone, "Different supplied record identity/time cannot make an undone source a new behavior.");
    assert(recordManualContentFreeViolationState(undone, { ...changedIds, logActionId: "genuinely-new-action" }) !== undone, "A genuinely new manual behavior remains loggable after correction.");
    const reloaded = await assertRoundTrip(undone, "active");
    assert(recordManualContentFreeViolationState(reloaded, input) === reloaded, "Tombstone stale-retry protection must survive persistence reload.");
  }
  const equalTime = makeActive(false);
  const equalRecorded = recordManualContentFreeViolationState(equalTime, { ...manualInput(), occurredAt: activatedAt, recordedAt: activatedAt });
  assert(equalRecorded !== equalTime && equalRecorded.contentFree.bestStreakSeconds === 0, "A manual event exactly at activation/streak start may record zero elapsed seconds.");
  const corrected = undoManualContentFreeViolationState(equalRecorded, { violationId: "standalone-violation", undoneAt: activatedAt });
  assert(corrected !== equalRecorded, "Undo time may equal the target's recording time.");
  const endAfterRecord = recordManualContentFreeViolationState(makeActive(false), manualInput());
  const deactivated = deactivateContentFreeState(endAfterRecord, { endedAt: "2026-10-08T10:00:00.249Z" });
  assert(deactivated.contentFree.status === "inactive" && deactivated.contentFree.bestStreakSeconds === 5 * 86400, "Deactivation after a violation must compare the latest effective streak duration with earlier ended streaks.");
  assert(deactivated.contentFree.violations === endAfterRecord.contentFree.violations, "Deactivation must preserve recorded/undone event history.");
}

async function verifySameTimeAndSequentialUndo() {
  const initial = makeActive(false);
  const firstInput = { ...manualInput(), occurredAt: "2026-10-03T10:00:00.000Z", recordedAt: "2026-10-03T10:01:00.000Z" };
  const first = recordManualContentFreeViolationState(initial, firstInput);
  const secondInput = { violationId: "second-same-day-violation", logActionId: "second-same-day-source", occurredAt: firstInput.occurredAt, recordedAt: "2026-10-03T10:02:00.000Z" };
  const second = recordManualContentFreeViolationState(first, secondInput);
  assert(second !== first && second.contentFree.violations.length === 2, "Two different manual sources on the same date, including equal event times, must remain distinct behavior events.");
  assert(undoManualContentFreeViolationState(second, { violationId: firstInput.violationId, undoneAt }) === second, "A later effective recorded event must block older undo even when both event times/current streak start are identical.");
  const secondUndone = undoManualContentFreeViolationState(second, { violationId: secondInput.violationId, undoneAt });
  assert(secondUndone !== second, "The latest equal-time event must remain safely undoable.");
  const firstUndone = undoManualContentFreeViolationState(secondUndone, { violationId: firstInput.violationId, undoneAt: "2026-10-05T12:02:00.000Z" });
  assert(firstUndone !== secondUndone && firstUndone.contentFree.status === "active" && initial.contentFree.status === "active", "A later undone tombstone must not block sequential backwards restoration.");
  assert(firstUndone.contentFree.currentStreakStartedAt === initial.contentFree.currentStreakStartedAt && firstUndone.contentFree.bestStreakSeconds === initial.contentFree.bestStreakSeconds, "Sequential correction must restore the original effective streak and best.");
  assert(firstUndone.contentFree.violations.length === 2 && firstUndone.contentFree.violations.every((violation) => violation.status === "undone"), "Both manual source identities must survive as tombstones.");
  assert(getContentFreeProgress(firstUndone.contentFree, undoneAt)?.hasEffectiveViolation === false, "Undone-only history must not claim a real streak break for first-streak display.");
  for (const input of [firstInput, secondInput]) assert(recordManualContentFreeViolationState(firstUndone, input) === firstUndone, "Both sequentially undone sources must remain consumed.");
  await assertRoundTrip(firstUndone, "active");
}

function verifyProgressSelection() {
  const active = makeActive(false);
  assert(active.contentFree.status === "active", "Active selector fixture required.");
  const before = JSON.stringify(active);
  for (const [elapsedMilliseconds, seconds, days] of [[0, 0, 0], [999, 0, 0], [1000, 1, 0], [86400000 - 1, 86399, 0], [86400000, 86400, 1], [25 * 86400000, 25 * 86400, 25], [-86400000, 0, 0]] as const) {
    const time = new Date(Date.parse(activatedAt) + elapsedMilliseconds).toISOString();
    equal(getContentFreeProgress(active.contentFree, time), { status: "active", currentStreakSeconds: seconds, currentCompletedDays: days, effectiveBestStreakSeconds: seconds, hasEffectiveViolation: false }, "Active progress must derive nonnegative whole elapsed seconds/days and growing effective best without persisted counters.");
  }
  const longerHistoricalBest = { ...active.contentFree, bestStreakSeconds: 100000 };
  const early = getContentFreeProgress(longerHistoricalBest, activatedAt);
  assert(early?.effectiveBestStreakSeconds === 100000, "Effective best must retain a longer historical streak when current elapsed time is smaller.");
  assert(JSON.stringify(active) === before && active.contentFree.bestStreakSeconds === 0, "Selector execution must not persist a ticking counter or update stored best as time passes.");
  for (const invalid of ["", "2026-02-30T10:00:00.000Z", "2026-10-01", "2026-10-01T10:00:00+00:00", null, 17]) {
    assert(getContentFreeProgress(active.contentFree, invalid as string) === null, "Invalid explicit current time must not create display progress.");
    assert(getContentFreeProgress(createDefaultBloomState().contentFree, invalid as string) === null, "Inactive selector must also return its safe result for invalid time input.");
  }
  const recorded = recordManualContentFreeViolationState(active, manualInput());
  assert(getContentFreeProgress(recorded.contentFree, undoneAt)?.hasEffectiveViolation === true, "A recorded real violation must enable the derived effective-violation signal.");
  const disabled = deactivateContentFreeState(recorded, { endedAt: "2026-10-06T10:00:00.000Z" });
  equal(getContentFreeProgress(disabled.contentFree, now().toISOString()), { status: "inactive", effectiveBestStreakSeconds: disabled.contentFree.bestStreakSeconds, hasEffectiveViolation: true }, "Inactive progress must expose historical best/effective history without fabricating current streak fields.");
  const reactivated = activateContentFreeState(disabled, { activationId: "selector-next-activation", activatedAt: "2026-10-07T10:00:00.000Z" });
  assert(getContentFreeProgress(reactivated.contentFree, "2026-10-07T10:00:00.000Z")?.hasEffectiveViolation === true, "Effective recorded history from a previous activation must remain visible after reactivation.");
}

function verifyTransactionOwnership() {
  const activeReset = createActiveState(false, true);
  const atomicInput = createInput("intentionalExplicitContent", { kind: "manual", logActionId: "reset-owned-manual-source" });
  const linked = recordActiveResetViolationState(activeReset, atomicInput);
  assert(linked !== activeReset, "Reset-owned manual violation fixture required.");
  const cfId = atomicInput.contentFreeViolationId;
  assert(cfId !== undefined, "Linked Content-Free identity required.");
  assert(undoManualContentFreeViolationState(linked, { violationId: cfId, undoneAt }) === linked, "A manual source owned by a recorded Reset violation must be corrected through the atomic Reset undo API.");
  const atomicallyUndone = undoActiveResetViolationState(linked, { violationId: atomicInput.violationId, undoneAt });
  assert(atomicallyUndone !== linked, "Atomic Reset undo fixture required.");
  const inconsistentLinked = { ...atomicallyUndone, contentFree: linked.contentFree };
  assert(undoManualContentFreeViolationState(inconsistentLinked, { violationId: cfId, undoneAt }) === inconsistentLinked, "An undone Reset source tombstone still owns its linked manual event and must block partial standalone correction.");
  const sessionOwned = createPopulatedState();
  assert(undoManualContentFreeViolationState(sessionOwned, { violationId: "cf-recorded", undoneAt }) === sessionOwned, "Session-derived violations cannot be corrected with the standalone manual API.");
  const standalone = recordManualContentFreeViolationState(makeActive(false), manualInput());
  const unrelatedReset = { ...standalone, resetJourney: activeReset.resetJourney };
  const corrected = undoManualContentFreeViolationState(unrelatedReset, { violationId: "standalone-violation", undoneAt });
  assert(corrected !== unrelatedReset && corrected.resetJourney === unrelatedReset.resetJourney, "An unrelated active Reset must not block correction of a genuinely standalone event; new explicit behavior during an effective restriction requires the atomic Reset path.");
  const sameString = makeActive(false);
  assert(sameString.contentFree.status === "active", "Active fixture required.");
  sameString.contentFree.violations.push({
    id: "session-source-record", activationId: sameString.contentFree.activationId, kind: "intentionalExplicitContent", occurredAt: activatedAt, recordedAt: activatedAt,
    source: { kind: "masturbationSession", sessionId: "standalone-manual-source" }, streakBefore: { currentStreakStartedAt: activatedAt, bestStreakSeconds: 0 }, status: "recorded"
  });
  assert(recordManualContentFreeViolationState(sameString, manualInput()) !== sameString, "Equal identity strings across manual and session source kinds must remain separate namespaces.");
}

function verifyRejectedTransitions() {
  let count = 0;
  const reject = (fn: Transition, state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(fn(state, input as never) === state, `${label}: invalid transition must return the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: rejected input must not create partial history or affect any other product slice.`);
    count++;
  };
  const inactive = createInactiveState(true);
  const active = makeActive(true);
  const recorded = recordManualContentFreeViolationState(makeActive(false), manualInput());
  const undo = { violationId: "standalone-violation", undoneAt };
  const transitions: Array<[Transition, BloomLocalState, Record<string, unknown>]> = [
    [activateContentFreeState, inactive, { activationId: "fresh-activation", activatedAt }],
    [deactivateContentFreeState, active, { endedAt: recordedAt }],
    [recordManualContentFreeViolationState, active, manualInput()],
    [undoManualContentFreeViolationState, recorded, undo]
  ];
  for (const [fn, state, input] of transitions) {
    for (const invalid of [null, [], "transition", {}, { ...input, unexpected: true }]) reject(fn, state, invalid, "malformed transition input");
    for (const field of Object.keys(input)) {
      const missing = { ...input };
      delete missing[field];
      reject(fn, state, missing, `missing ${field}`);
      if (field.endsWith("At")) {
        for (const value of ["2026-02-30T10:00:00.000Z", "2026-10-01", "2026-10-01T10:00:00+00:00", 17, null]) reject(fn, state, { ...input, [field]: value }, `invalid canonical ${field}`);
      } else {
        for (const value of ["", " ", 17, null]) reject(fn, state, { ...input, [field]: value }, `invalid identity ${field}`);
      }
    }
  }
  reject(activateContentFreeState, active, { activationId: "another-active", activatedAt }, "already active");
  for (const id of ["cf-past", "cf-current", "cf-recorded", "cf-corrected"]) reject(activateContentFreeState, inactive, { activationId: id, activatedAt }, "activation identity conflicts with historical activation or violation records");
  const reversed = clone(inactive);
  reversed.contentFree.pastActivations.reverse();
  reject(activateContentFreeState, reversed, { activationId: "overlapping-new", activatedAt: "2026-02-01T12:00:00.000Z" }, "new activation must follow every historical end, not merely the last array entry");
  reject(deactivateContentFreeState, inactive, { endedAt: recordedAt }, "deactivation requires active state");
  reject(deactivateContentFreeState, active, { endedAt: "2026-10-01T10:00:00.749Z" }, "deactivation cannot precede activation or effective streak start");
  reject(deactivateContentFreeState, recorded, { endedAt: "2026-10-03T10:00:00.248Z" }, "deactivation cannot precede the latest streak start");
  reject(recordManualContentFreeViolationState, inactive, manualInput(), "manual violation requires active Content-Free");
  reject(recordManualContentFreeViolationState, createActiveState(false, true), { ...manualInput(), occurredAt: "2026-09-07T12:00:00.000Z" }, "an incomplete Reset at occurrence time requires the atomic path even when recorded after the elapsed boundary");
  reject(recordManualContentFreeViolationState, active, { ...manualInput(), source: { kind: "masturbationSession", sessionId: "injected" } }, "manual API must not accept caller-supplied arbitrary source");
  reject(recordManualContentFreeViolationState, active, { ...manualInput(), reason: "accidentalExposure" }, "standalone manual API only represents intentional explicit-content behavior");
  reject(recordManualContentFreeViolationState, active, { ...manualInput(), occurredAt: "2026-10-01T10:00:00.749Z" }, "event before activation/current streak needs historical replay");
  reject(recordManualContentFreeViolationState, recorded, { ...manualInput(), violationId: "new-id", logActionId: "new-source", occurredAt: "2026-10-03T10:00:00.248Z" }, "event cannot be inserted before current effective streak");
  reject(recordManualContentFreeViolationState, active, { ...manualInput(), recordedAt: "2026-10-03T10:00:00.248Z" }, "recording cannot precede occurrence");
  for (const id of ["cf-corrected", "cf-recorded"]) reject(recordManualContentFreeViolationState, active, { ...manualInput(), violationId: id }, "violation record identity already used");
  reject(recordManualContentFreeViolationState, recorded, { ...manualInput(), violationId: "new-id" }, "recorded manual source already handled");
  reject(recordManualContentFreeViolationState, active, { ...manualInput(), logActionId: "mistaken-manual-log" }, "undone manual source from historical activation remains consumed");
  reject(undoManualContentFreeViolationState, recorded, { ...undo, violationId: "nonexistent" }, "missing undo target");
  reject(undoManualContentFreeViolationState, recorded, { ...undo, undoneAt: "2026-10-05T11:59:59.999Z" }, "undo cannot precede recording");
  const later = recordManualContentFreeViolationState(recorded, { violationId: "later-violation", logActionId: "later-source", occurredAt: "2026-10-06T10:00:00.000Z", recordedAt: "2026-10-06T10:01:00.000Z" });
  reject(undoManualContentFreeViolationState, later, { ...undo, undoneAt: now().toISOString() }, "later effective violation blocks older undo");
  const deactivated = deactivateContentFreeState(recorded, { endedAt: "2026-10-06T12:00:00.000Z" });
  reject(undoManualContentFreeViolationState, deactivated, undo, "undo requires the original program to remain active");
  const reactivated = activateContentFreeState(deactivated, { activationId: "different-current-activation", activatedAt: "2026-10-07T12:00:00.000Z" });
  reject(undoManualContentFreeViolationState, reactivated, { ...undo, undoneAt: now().toISOString() }, "changed activation blocks historical snapshot restoration");
  for (const [path, value] of [
    ["contentFree.currentStreakStartedAt", "2026-10-03T10:00:00.250Z"],
    ["contentFree.bestStreakSeconds", 172800],
    ["contentFree.violations.0.streakBefore.currentStreakStartedAt", "2026-10-04T10:00:00.000Z"],
    ["contentFree.violations.0.streakBefore.bestStreakSeconds", -1],
    ["contentFree.violations.0.activationId", "unknown-activation"]
  ] as const) {
    const malformed = clone(recorded);
    replaceAtPath(malformed, path, value, false);
    reject(undoManualContentFreeViolationState, malformed, undo, `ambiguous or malformed undo source ${path}`);
  }
  const chronologicalLater = clone(recorded);
  assert(chronologicalLater.contentFree.status === "active", "Active fixture required.");
  const originalViolation = chronologicalLater.contentFree.violations[0];
  assert(originalViolation !== undefined, "Manual violation fixture required.");
  chronologicalLater.contentFree.violations.unshift({
    ...originalViolation, id: "earlier-array-later-event", occurredAt: "2026-10-03T11:00:00.000Z", recordedAt,
    source: { kind: "masturbationSession", sessionId: "later-session-source" },
    streakBefore: { currentStreakStartedAt: occurredAt, bestStreakSeconds: chronologicalLater.contentFree.bestStreakSeconds }
  });
  reject(undoManualContentFreeViolationState, chronologicalLater, undo, "chronologically later event blocks undo even when target is last in array and current streak still matches");
  const earlierEffective = recordManualContentFreeViolationState(makeActive(false), {
    violationId: "earlier-effective-violation", logActionId: "earlier-effective-source",
    occurredAt: "2026-10-02T10:00:00.000Z", recordedAt: "2026-10-02T10:01:00.000Z"
  });
  const crossedSnapshot = recordManualContentFreeViolationState(earlierEffective, manualInput());
  const target = crossedSnapshot.contentFree.violations[1];
  assert(target !== undefined, "Second recorded violation fixture required.");
  target.streakBefore.currentStreakStartedAt = activatedAt;
  crossedSnapshot.contentFree.bestStreakSeconds = 172799;
  reject(undoManualContentFreeViolationState, crossedSnapshot, undo, "a contradictory snapshot must not restore across an earlier retained effective violation even when current best matches the snapshot arithmetic");
  return count;
}

async function verifyMalformedHistory() {
  const active = makeActive(true);
  const recorded = recordManualContentFreeViolationState(makeActive(false), manualInput());
  const undone = undoManualContentFreeViolationState(recorded, { violationId: "standalone-violation", undoneAt });
  const inactive = deactivateContentFreeState(recorded, { endedAt: "2026-10-06T10:00:00.000Z" });
  const cases: Array<[string, BloomLocalState, string, unknown, boolean?]> = [
    ["missing activation identity", active, "contentFree.activationId", undefined, true], ["reused activation identity", active, "contentFree.activationId", "cf-past"],
    ["current streak before activation", active, "contentFree.currentStreakStartedAt", "2026-10-01T10:00:00.749Z"],
    ["negative historical best", active, "contentFree.bestStreakSeconds", -1], ["fractional historical best", active, "contentFree.bestStreakSeconds", 1.5],
    ["nonfinite historical best", active, "contentFree.bestStreakSeconds", Infinity],
    ["completed activation before its start", active, "contentFree.pastActivations.0.endedAt", "2025-12-31T10:00:00.000Z"],
    ["overlapping completed activation periods", active, "contentFree.pastActivations.1.startedAt", "2026-01-19T10:00:00.000Z"],
    ["inactive carrying current identity", inactive, "contentFree.activationId", "fabricated-current"],
    ["unknown violation activation", recorded, "contentFree.violations.0.activationId", "unknown"],
    ["event before activation", recorded, "contentFree.violations.0.occurredAt", "2026-10-01T10:00:00.749Z"],
    ["event after historical activation end", inactive, "contentFree.violations.0.occurredAt", "2026-10-07T10:00:00.000Z"],
    ["recording before occurrence", recorded, "contentFree.violations.0.recordedAt", "2026-10-03T10:00:00.248Z"],
    ["negative snapshot best", recorded, "contentFree.violations.0.streakBefore.bestStreakSeconds", -1],
    ["snapshot before activation", recorded, "contentFree.violations.0.streakBefore.currentStreakStartedAt", "2026-10-01T10:00:00.749Z"],
    ["invalid violation kind", recorded, "contentFree.violations.0.kind", "masturbation"],
    ["malformed manual source", recorded, "contentFree.violations.0.source", { kind: "manual", sessionId: "wrong-field" }],
    ["recorded carries undo timestamp", recorded, "contentFree.violations.0.undoneAt", undoneAt],
    ["undone missing timestamp", undone, "contentFree.violations.0.undoneAt", undefined, true],
    ["invalid undoneAt", undone, "contentFree.violations.0.undoneAt", "2026-02-30T10:00:00.000Z"],
    ["undo before recording", undone, "contentFree.violations.0.undoneAt", "2026-10-05T11:59:59.999Z"]
  ];
  for (const [label, state, path, value, remove] of cases) {
    const malformed = clone(state);
    replaceAtPath(malformed, path, value, remove === true);
    await assertCorruptPreserved(malformed, label);
  }
  for (const sameId of [true, false]) {
    const duplicate = clone(undone);
    const violation = duplicate.contentFree.violations[0];
    assert(violation !== undefined, "Undone fixture required.");
    duplicate.contentFree.violations.push({ ...violation, id: sameId ? violation.id : "new-id-same-source" });
    await assertCorruptPreserved(duplicate, `duplicate ${sameId ? "violation ID" : "stable source"} remains invalid across undone history`);
  }
  return cases.length + 2;
}

function createInactiveState(history: boolean): BloomLocalState {
  const state = createPopulatedState();
  const prior = state.contentFree;
  assert(prior.status === "active", "Populated activation history required.");
  state.contentFree = history ? {
    status: "inactive", bestStreakSeconds: prior.bestStreakSeconds,
    pastActivations: [...prior.pastActivations, { id: prior.activationId, startedAt: prior.activatedAt, endedAt: "2026-09-01T10:00:00.000Z" }],
    violations: prior.violations
  } : createDefaultBloomState().contentFree;
  return state;
}

function makeActive(history: boolean): BloomLocalState {
  const active = activateContentFreeState(createInactiveState(history), { activationId: "standalone-activation", activatedAt });
  assert(active.contentFree.status === "active", "Activation fixture must become active.");
  return active;
}

function manualInput() { return { violationId: "standalone-violation", logActionId: "standalone-manual-source", occurredAt, recordedAt }; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function assertUnrelatedReferences(before: BloomLocalState, after: BloomLocalState, label: string) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (key !== "contentFree") assert(after[key] === before[key], `${label}: ${key} must remain untouched by reference, including Tracking, Reset, onboarding, Urge Control, Protect, and all legacy slices.`);
  }
}

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const keys = path.split(".");
  const final = keys.pop();
  assert(final !== undefined, "Fixture mutation requires a final field.");
  let parent = root as Record<string, unknown>;
  for (const key of keys) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[final];
  else parent[final] = value;
}

async function assertRoundTrip(state: BloomLocalState, status: "active" | "inactive"): Promise<BloomLocalState> {
  assert(validateAndNormalizeBloomState(state).success, "Produced Content-Free state must validate before persistence.");
  const client = new ContentTestStorage();
  await persistBloomLocalState(state, client, now);
  const raw = client.values.get(BLOOM_STATE_STORAGE_KEY);
  assert(raw !== undefined && (JSON.parse(raw) as { version: unknown }).version === 7, "Content-Free lifecycle must retain the v7 envelope.");
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current" && loaded.state.contentFree.status === status, "Persistence must preserve activation status without starting, ending, or repairing a program on load.");
  equal(loaded.state, state, "Content-Free histories, snapshots, tombstones, and all unrelated facts must survive save/load unchanged without ticking counters.");
  const before = JSON.stringify(loaded.state);
  getContentFreeProgress(loaded.state.contentFree, now().toISOString());
  assert(JSON.stringify(loaded.state) === before && client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, "Loading and progress selection must not update persisted historical best merely because time passed.");
  return loaded.state;
}

async function assertCorruptPreserved(state: BloomLocalState, label: string) {
  assert(!validateAndNormalizeBloomState(state).success, `${label}: malformed history must fail direct validation instead of normalization or repair.`);
  const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state });
  const client = new ContentTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "corrupt" && loaded.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: malformed Content-Free history must use existing corruption handling.`);
  assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${label}: malformed original bytes must remain intact.`);
  assert(loaded.backupKey !== null && loaded.backupKey.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt history must receive a scoped backup.");
  const backup = client.values.get(loaded.backupKey);
  assert(backup !== undefined, "Corrupt backup must become durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === BLOOM_STATE_STORAGE_KEY, "Backup must preserve exact source bytes and ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class ContentTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
