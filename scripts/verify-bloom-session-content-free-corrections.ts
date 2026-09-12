import { isDeepStrictEqual } from "node:util";

import type { ContentFreeState, ContentFreeViolation, MasturbationSessionFeedback } from "../src/domain/models";
import type { CompletedMasturbationSession } from "../src/domain/models/MasturbationTrackingState";
import {
  activateContentFreeState, completeMasturbationSessionFeedbackState, createDefaultBloomState,
  deactivateContentFreeState, deleteCompletedMasturbationSessionState,
  editCompletedMasturbationSessionFeedbackState, recordManualContentFreeViolationState,
  type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";

const sessionId = "correction-session";
const violationId = "correction-session-content";
const activatedAt = "2026-11-01T10:10:00.250Z";
const endedAt = "2026-11-03T10:10:00.750Z";
const editedAt = "2026-11-04T10:00:00.000Z";
const undoneAt = "2026-11-04T10:01:00.000Z";
const reappliedAt = "2026-11-04T10:02:00.000Z";
const now = () => new Date("2026-12-01T00:00:00.000Z");
let rejected = 0;

export async function verifyBloomSessionContentFreeCorrections() {
  rejected = 0;
  verifyActivationApplicability();
  await verifyCreationAndRestoration();
  await verifyTombstoneReapplication();
  await verifyDeletion();
  verifyUnsafeSnapshotsAndHistory();
  await verifyDuplicateLinks();
  console.log(`Bloom session Content-Free correction verification passed (${rejected} rejected atomic corrections; activation applicability, tombstones, safe deletion, and v7 round trips).`);
}

function verifyActivationApplicability() {
  const neverActive = baseState(false);
  const laterActive = baseState(true);
  laterActive.contentFree = { ...activeContent(laterActive), activatedAt: editedAt, currentStreakStartedAt: editedAt };
  const gap = baseState(false);
  gap.contentFree.pastActivations = [{ id: "past-before-session", startedAt: "2026-10-01T00:00:00.000Z", endedAt: "2026-10-10T00:00:00.000Z" }];
  for (const [label, before] of [["never active", neverActive], ["activated after the event", laterActive], ["outside all known activation intervals", gap]] as const) {
    const result = edit(before, true);
    assert(result !== before && target(result).usedExplicitContent, `${label}: false -> true must remain a feedback-only correction.`);
    assert(result.contentFree === before.contentFree, `${label}: correction must not invent a Content-Free event or activation.`);
    const reverted = edit(result, false, undoneAt);
    assert(reverted !== result && !target(reverted).usedExplicitContent && reverted.contentFree === before.contentFree,
      `${label}: true -> false with no applicable linked event must change feedback only.`);
  }
  const past = pastActivationState(false);
  expectNoop(past, () => edit(past, true, editedAt, violationId), "A completed activation covering the event requires historical replay even while Content-Free is inactive.");
  const pastWithLaterActive = activateContentFreeState(past, { activationId: "later-program", activatedAt: "2026-11-06T00:00:00.000Z" });
  assert(pastWithLaterActive !== past, "A later unrelated activation fixture must be valid.");
  expectNoop(pastWithLaterActive, () => edit(pastWithLaterActive, true, "2026-11-06T12:00:00.000Z", violationId), "A later current activation must not hide that the session belonged to a past activation.");
  const boundary = baseState(true);
  boundary.contentFree = {
    ...activeContent(boundary), activatedAt: endedAt, currentStreakStartedAt: endedAt,
    pastActivations: [{ id: "touching-past", startedAt: activatedAt, endedAt }]
  };
  valid(boundary, "shared activation boundary fixture");
  expectNoop(boundary, () => edit(boundary, true, editedAt, violationId), "An event touching both a completed and current activation cannot be assigned by guessing.");
  const tooLate = baseState(true);
  tooLate.contentFree = { ...activeContent(tooLate), currentStreakStartedAt: "2026-11-03T10:11:00.000Z" };
  expectNoop(tooLate, () => edit(tooLate, true, editedAt, violationId), "An event before the current effective streak cannot be inserted atomically without replay.");
  const missingDependency = baseState(true);
  target(missingDependency).usedExplicitContent = true;
  expectNoop(missingDependency, () => edit(missingDependency, false, undoneAt), "Applicable Content-Free with a missing required event is ambiguous and cannot be silently corrected.");
  const alreadyRecorded = recordedState();
  target(alreadyRecorded).usedExplicitContent = false;
  expectNoop(alreadyRecorded, () => edit(alreadyRecorded, true, reappliedAt), "An already-recorded link with false source feedback is not an undone tombstone and cannot be reapplied by guessing.");
}

async function verifyCreationAndRestoration() {
  const before = baseState(true);
  const bytes = JSON.stringify(before);
  const after = edit(before, true, editedAt, violationId);
  assert(after !== before && target(after).usedExplicitContent, "False -> true in the active current streak must create a derived event atomically.");
  equal(after.contentFree, {
    ...before.contentFree, currentStreakStartedAt: endedAt, bestStreakSeconds: 172800,
    violations: [{
      id: violationId, activationId: "correction-program", kind: "intentionalExplicitContent",
      occurredAt: endedAt, recordedAt: editedAt, source: { kind: "masturbationSession", sessionId },
      status: "recorded", streakBefore: { currentStreakStartedAt: activatedAt, bestStreakSeconds: 60 }
    }]
  }, "New derived violations must preserve exact source/event time/snapshot and floor the interrupted streak to whole seconds.");
  assert(JSON.stringify(before) === bytes, "Editing must not mutate its input state.");
  assert(target(after).pauses === target(before).pauses && after.masturbationTracking.sessions[0] === before.masturbationTracking.sessions[0],
    "Atomic Content-Free correction must preserve pause and unrelated session references.");
  assertUnrelated(before, after);
  await roundTrip(after, "new derived Content-Free event");

  for (const invalidId of [undefined, "", "   ", null, 42]) {
    expectNoop(before, () => editCompletedMasturbationSessionFeedbackState(before, {
      sessionId, feedback: feedback(true), editedAt,
      ...(invalidId === undefined ? {} : { contentFreeViolationId: invalidId })
    } as Parameters<typeof editCompletedMasturbationSessionFeedbackState>[1]), "Missing/malformed required event identity must leave both slices untouched.");
  }
  const existingId = recordManualContentFreeViolationState(baseState(true), {
    violationId: "occupied-event-id", logActionId: "older-independent-event",
    occurredAt: "2026-11-02T00:00:00.000Z", recordedAt: "2026-11-02T00:01:00.000Z"
  });
  assert(existingId.contentFree.violations.length === 1, "The occupied event ID fixture must exist before the target session event.");
  expectNoop(existingId, () => edit(existingId, true, editedAt, "occupied-event-id"), "A new derived violation cannot reuse an unrelated existing record identity.");
  const restored = edit(after, false, undoneAt);
  assert(restored !== after && !target(restored).usedExplicitContent, "True -> false must undo the linked derived fact together with feedback.");
  equal(restored.contentFree, {
    ...before.contentFree,
    violations: [{ ...linked(after), status: "undone", undoneAt }]
  }, "Undo must restore exact pre-event streak/best while retaining its source tombstone.");
  expectNoop(restored, () => edit(restored, false, reappliedAt), "Retrying the same feedback correction must preserve undoneAt.");
  const restoredEvent = linked(restored);
  assert(restoredEvent.status === "undone" && restoredEvent.undoneAt === undoneAt,
    "The original undo timestamp must survive retry.");
  assertUnrelated(after, restored);
  await roundTrip(restored, "feedback with undone derived violation");
}

async function verifyTombstoneReapplication() {
  const undone = undoneState();
  const prior = linked(undone);
  const reapplied = edit(undone, true, reappliedAt);
  assert(reapplied !== undone && target(reapplied).usedExplicitContent, "A safely restored current activation must allow reapplying its own session tombstone.");
  const event = linked(reapplied);
  assert(event.status === "recorded" && !("undoneAt" in event), "Reapplication must make the existing tombstone effective again without contradictory undo fields.");
  assert(reapplied.contentFree.violations.length === undone.contentFree.violations.length && event.id === prior.id &&
    event.activationId === prior.activationId && event.occurredAt === prior.occurredAt,
    "Reapplication must retain exact record/activation/event identity and never append a second source.");
  equal(event.source, prior.source, "The original session source must be reused.");
  assert(event.recordedAt === prior.recordedAt, "Reapplication preserves the original recording timestamp instead of rewriting the original log action.");
  equal(event.streakBefore, prior.streakBefore, "Reapplication must use the existing truthful snapshot, not replace it with guesses.");
  assert(activeContent(reapplied).currentStreakStartedAt === endedAt && reapplied.contentFree.bestStreakSeconds === 172800,
    "Safe reapplication must reproduce the interruption's original streak and best effect.");
  await roundTrip(reapplied, "reapplied source tombstone");
  const optionalReplacement = edit(undone, true, reappliedAt, "unused-replacement-event-id");
  equal(optionalReplacement, reapplied, "An optional allocation ID is unused during reapplication; the existing identity must win.");

  const wrongStreak = clone(undone);
  wrongStreak.contentFree = { ...activeContent(wrongStreak), currentStreakStartedAt: "2026-11-02T00:00:00.000Z" };
  expectNoop(wrongStreak, () => edit(wrongStreak, true, reappliedAt), "Reapplication requires the exact restored streak start.");
  const wrongBest = clone(undone);
  wrongBest.contentFree.bestStreakSeconds = 61;
  expectNoop(wrongBest, () => edit(wrongBest, true, reappliedAt), "Reapplication must not overwrite a best value that changed after the snapshot was restored.");
  const later = withLaterManualEvent(undone);
  expectNoop(later, () => edit(later, true, reappliedAt), "Later effective activity blocks reapplication without replay.");
  const changed = changeActivation(undone);
  expectNoop(changed, () => edit(changed, true, "2026-11-06T12:00:00.000Z"), "An old activation's tombstone cannot be reapplied to a new activation.");
  expectNoop(undone, () => edit(undone, true, editedAt), "A correction timestamp before the existing undo cannot silently reverse future correction history.");
  const laterArray = clone(undone);
  laterArray.contentFree.violations.push(manualViolation("later-array-at-restored-start", activatedAt));
  valid(laterArray, "later array activity during restored streak");
  expectNoop(laterArray, () => edit(laterArray, true, reappliedAt), "A recorded event after the tombstone in application order makes reapplication ambiguous even at a tied timestamp.");
  const intervening = clone(undone);
  intervening.contentFree.violations.unshift(manualViolation("intervening-before-tombstone", "2026-11-02T00:00:00.000Z"));
  valid(intervening, "retained effective event inside restored snapshot");
  expectNoop(intervening, () => edit(intervening, true, reappliedAt), "Reapplication cannot reuse a snapshot covering an existing effective event.");

  const inconsistent = clone(undone);
  target(inconsistent).usedExplicitContent = true;
  const corrected = edit(inconsistent, false, reappliedAt);
  assert(corrected !== inconsistent && !target(corrected).usedExplicitContent && corrected.contentFree === inconsistent.contentFree,
    "Already-undone derived history may be reconciled by changing stale true feedback to false without another CF mutation.");
  equal(linked(corrected), linked(inconsistent), "Recovery must retain the existing tombstone and its original undoneAt exactly.");
}

async function verifyDeletion() {
  const recorded = recordedState();
  const deleted = remove(recorded, undoneAt);
  assert(deleted !== recorded && !deleted.masturbationTracking.sessions.some((session) => session.id === sessionId),
    "Deleting a latest recorded-derived session must remove that session and undo its CF effect atomically.");
  assert(deleted.masturbationTracking.sessions[0] === recorded.masturbationTracking.sessions[0], "Deletion preserves unrelated session records.");
  equal(deleted.contentFree, {
    ...recorded.contentFree, currentStreakStartedAt: activatedAt, bestStreakSeconds: 60,
    violations: [{ ...linked(recorded), status: "undone", undoneAt }]
  }, "Deletion must retain the linked source tombstone and restore its exact pre-event state.");
  assertUnrelated(recorded, deleted);
  await roundTrip(deleted, "deleted session with retained source tombstone");

  const undone = undoneState();
  const removedUndone = remove(undone, reappliedAt);
  assert(removedUndone !== undone && removedUndone.contentFree === undone.contentFree, "An already-undone dependency permits deletion without changing CF facts.");
  equal(linked(removedUndone), linked(undone), "Deletion must not overwrite an existing correction timestamp.");
  const historicalUndone = changeActivation(undone);
  const removedHistorical = remove(historicalUndone, "2026-11-06T12:00:00.000Z");
  assert(removedHistorical !== historicalUndone && removedHistorical.contentFree === historicalUndone.contentFree,
    "An undone event in a completed activation requires no effective historical replay and may retain its tombstone after session deletion.");
  await roundTrip(removedHistorical, "deleted session with historical undone CF event");

  for (const [label, unsafe] of [["later event", withLaterManualEvent(recorded)], ["changed activation", changeActivation(recorded)],
    ["completed activation", pastActivationState(true)]] as const) {
    expectNoop(unsafe, () => remove(unsafe, "2026-11-06T12:00:00.000Z"), `${label}: unsafe dependency restoration must block the whole deletion.`);
    expectNoop(unsafe, () => edit(unsafe, false, "2026-11-06T12:00:00.000Z"), `${label}: unsafe dependency restoration must block the whole feedback edit.`);
  }
  expectNoop(recorded, () => remove(recorded, "2026-11-04T09:59:00.000Z"), "Deletion must not undo an event before its recordedAt even when the session ended earlier.");
}

function verifyUnsafeSnapshotsAndHistory() {
  const fixtures: Array<[string, BloomLocalState]> = [];
  const changedBest = recordedState();
  changedBest.contentFree.bestStreakSeconds += 1;
  fixtures.push(["changed best after event", changedBest]);
  const snapshotAfter = recordedState();
  linked(snapshotAfter).streakBefore.currentStreakStartedAt = "2026-11-03T10:11:00.000Z";
  fixtures.push(["snapshot begins after event", snapshotAfter]);
  const mismatchingAnchor = recordedState();
  linked(mismatchingAnchor).occurredAt = "2026-11-03T10:11:00.000Z";
  mismatchingAnchor.contentFree = { ...activeContent(mismatchingAnchor), currentStreakStartedAt: linked(mismatchingAnchor).occurredAt };
  fixtures.push(["linked event anchor differs from physical end", mismatchingAnchor]);
  const laterReordered = withLaterManualEvent(recordedState());
  laterReordered.contentFree.violations.reverse();
  laterReordered.contentFree = { ...activeContent(laterReordered), currentStreakStartedAt: endedAt, bestStreakSeconds: 172800 };
  fixtures.push(["later chronological event hidden by array order", laterReordered]);
  const earlierRetained = recordedState();
  earlierRetained.contentFree.violations.unshift(manualViolation("retained-earlier", "2026-11-02T10:10:00.250Z"));
  fixtures.push(["snapshot predates a retained effective event", earlierRetained]);
  const arrayLater = recordedState();
  arrayLater.contentFree.violations.push(manualViolation("later-tied-event", endedAt));
  fixtures.push(["later application-order event at the same timestamp", arrayLater]);
  const lateRecorded = recordedState();
  linked(lateRecorded).recordedAt = "2026-11-05T00:00:00.000Z";
  fixtures.push(["correction before event recording", lateRecorded]);
  for (const [label, state] of fixtures) {
    valid(state, label);
    expectNoop(state, () => edit(state, false, undoneAt), `${label}: feedback must not change without safe CF restoration.`);
    expectNoop(state, () => remove(state, undoneAt), `${label}: session must not disappear without safe CF restoration.`);
  }
}

async function verifyDuplicateLinks() {
  const duplicate = recordedState();
  duplicate.contentFree.violations.push({ ...linked(duplicate), id: "duplicate-session-source" });
  assert(!validateAndNormalizeBloomState(duplicate).success, "Duplicate session-derived source identities must remain corrupt even when record IDs differ.");
  expectNoop(duplicate, () => edit(duplicate, false, undoneAt), "Conflicting linked records must block the whole feedback correction.");
  expectNoop(duplicate, () => remove(duplicate, undoneAt), "Conflicting linked records must block deletion.");
  const storage = createMemoryStorageClient();
  const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state: duplicate });
  await storage.setItem(BLOOM_STATE_STORAGE_KEY, raw);
  const loaded = await loadBloomLocalState(storage, now);
  assert(loaded.status === "corrupt" && loaded.backupKey !== null, "Malformed linked sources must follow the existing corruption preservation strategy.");
  assert(await storage.getItem(BLOOM_STATE_STORAGE_KEY) === raw, "Corrupt source bytes must remain untouched.");
  const backup = await storage.getItem(loaded.backupKey);
  assert(backup !== null && JSON.parse(backup).rawPayload === raw, "A backup must retain the exact original malformed payload.");
}

function baseState(active: boolean): BloomLocalState {
  const state = createDefaultBloomState();
  state.masturbationTracking = { enabled: false, currentSession: null, sessions: [session("prior-session", false), session(sessionId, false)] };
  if (active) state.contentFree = { status: "active", activationId: "correction-program", activatedAt,
    currentStreakStartedAt: activatedAt, bestStreakSeconds: 60, pastActivations: [], violations: [] };
  return state;
}

function session(id: string, usedExplicitContent: boolean): CompletedMasturbationSession {
  return {
    id, status: "completed", startedAt: "2026-11-03T10:00:00.000Z", endedAt, durationSeconds: 600,
    pauses: [{ status: "completed", startedAt: "2026-11-03T10:01:00.000Z", endedAt: "2026-11-03T10:02:00.000Z", durationSeconds: 60 }],
    ...feedback(usedExplicitContent)
  };
}

function feedback(usedExplicitContent: boolean): MasturbationSessionFeedback {
  return { erectionQuality: 6, usedExplicitContent, endingReason: "climaxed" };
}

function recordedState(): BloomLocalState {
  const state = baseState(true);
  const physical = target(state);
  state.masturbationTracking.sessions = state.masturbationTracking.sessions.filter((entry) => entry.id !== sessionId);
  state.masturbationTracking.currentSession = {
    id: physical.id, status: "awaiting_feedback", startedAt: physical.startedAt, endedAt: physical.endedAt,
    durationSeconds: physical.durationSeconds, pauses: physical.pauses
  };
  const recorded = completeMasturbationSessionFeedbackState(state, { feedback: feedback(true), recordedAt: editedAt, contentFreeViolationId: violationId });
  assert(recorded !== state, "Existing session completion must create a valid recorded dependency fixture.");
  valid(recorded, "recorded dependency fixture");
  return recorded;
}

function undoneState(): BloomLocalState {
  const state = recordedState();
  target(state).usedExplicitContent = false;
  state.contentFree = { ...activeContent(state), currentStreakStartedAt: activatedAt, bestStreakSeconds: 60,
    violations: [{ ...linked(state), status: "undone", undoneAt }] };
  valid(state, "undone dependency fixture");
  return state;
}

function pastActivationState(recorded: boolean): BloomLocalState {
  const state = recorded ? recordedState() : baseState(true);
  const result = deactivateContentFreeState(state, { endedAt: "2026-11-05T00:00:00.000Z" });
  assert(result !== state && result.contentFree.status === "inactive", "A completed activation fixture must archive correctly.");
  return result;
}

function changeActivation(state: BloomLocalState): BloomLocalState {
  const inactive = deactivateContentFreeState(state, { endedAt: "2026-11-05T00:00:00.000Z" });
  const active = activateContentFreeState(inactive, { activationId: "replacement-program", activatedAt: "2026-11-06T00:00:00.000Z" });
  assert(inactive !== state && active !== inactive, "Changing activation must preserve and separate the prior period.");
  return active;
}

function withLaterManualEvent(state: BloomLocalState): BloomLocalState {
  const result = recordManualContentFreeViolationState(state, {
    violationId: "later-content-event", logActionId: "later-manual-source",
    occurredAt: "2026-11-03T11:00:00.000Z", recordedAt: "2026-11-04T10:01:30.000Z"
  });
  assert(result !== state, "A later effective manual event fixture must be recordable.");
  return result;
}

function manualViolation(id: string, occurredAt: string): ContentFreeViolation {
  return { id, activationId: "correction-program", kind: "intentionalExplicitContent", occurredAt,
    recordedAt: editedAt, source: { kind: "manual", logActionId: id }, status: "recorded",
    streakBefore: { currentStreakStartedAt: activatedAt, bestStreakSeconds: 60 } };
}

function edit(state: BloomLocalState, usedExplicitContent: boolean, at = editedAt, id?: string): BloomLocalState {
  return editCompletedMasturbationSessionFeedbackState(state, {
    sessionId, feedback: feedback(usedExplicitContent), editedAt: at,
    ...(id === undefined ? {} : { contentFreeViolationId: id })
  });
}

function remove(state: BloomLocalState, at: string): BloomLocalState {
  return deleteCompletedMasturbationSessionState(state, { sessionId, deletedAt: at });
}

function target(state: BloomLocalState): CompletedMasturbationSession {
  const value = state.masturbationTracking.sessions.find((entry) => entry.id === sessionId);
  assert(value !== undefined, "A completed target fixture must exist.");
  return value;
}

function linked(state: BloomLocalState): ContentFreeViolation {
  const value = state.contentFree.violations.find((entry) => entry.source.kind === "masturbationSession" && entry.source.sessionId === sessionId);
  assert(value !== undefined, "A linked event fixture must exist.");
  return value;
}

function activeContent(state: BloomLocalState): Extract<ContentFreeState, { status: "active" }> {
  assert(state.contentFree.status === "active", "An active Content-Free fixture must exist.");
  return state.contentFree;
}

async function roundTrip(state: BloomLocalState, label: string) {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Session corrections must retain persistence v7.");
  valid(state, label);
  const storage = createMemoryStorageClient();
  await persistBloomLocalState(state, storage, now);
  const loaded = await loadBloomLocalState(storage, now);
  assert(loaded.status === "success" && loaded.source === "current", `${label}: state must reload from the current key.`);
  equal(loaded.state, state, `${label}: v7 round trip must preserve corrected feedback and linked tombstones.`);
}

function assertUnrelated(before: BloomLocalState, after: BloomLocalState) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (key !== "masturbationTracking" && key !== "contentFree") assert(after[key] === before[key], `Session CF correction must preserve ${key} by reference.`);
  }
  assert(after.masturbationTracking.enabled === before.masturbationTracking.enabled &&
    after.masturbationTracking.currentSession === before.masturbationTracking.currentSession, "Correction preserves Tracking permission and unfinished sessions.");
}

function expectNoop(state: BloomLocalState, action: () => BloomLocalState, message: string) {
  const bytes = JSON.stringify(state);
  assert(action() === state && JSON.stringify(state) === bytes, message);
  rejected += 1;
}

function valid(state: BloomLocalState, label: string) {
  const result = validateAndNormalizeBloomState(state);
  assert(result.success, `${label} must be a valid persisted fixture: ${result.success ? "" : result.error}`);
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
