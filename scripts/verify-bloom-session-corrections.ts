import { isDeepStrictEqual } from "node:util";
import type { CompletedMasturbationSession, MasturbationSessionFeedback } from "../src/domain/models";
import {
  createDefaultBloomState, editCompletedMasturbationSessionFeedbackState,
  deleteCompletedMasturbationSessionState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { verifyBloomSessionContentFreeCorrections } from "./verify-bloom-session-content-free-corrections";

const sessionId = "session-1";
const correctedAt = "2026-10-01T12:00:00.000Z";
const now = () => new Date("2026-10-30T12:00:00.000Z");
type Transition = (state: BloomLocalState, input: never) => BloomLocalState;

export async function verifyBloomSessionCorrections() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Completed-session corrections must retain the existing v7 schema/key.");
  await verifySimpleEdits();
  await verifyIndependentDeletion();
  verifyResetOwnership();
  const rejected = verifyInvalidCorrections();
  console.log(`Bloom simple session correction verification passed (${rejected} rejected corrections; immutable feedback edits, deletion, Reset ownership, and v7 round trips).`);
  await verifyBloomSessionContentFreeCorrections();
}

async function verifySimpleEdits() {
  for (const enabled of [false, true]) {
    for (const currentStatus of ["active", "awaiting_feedback"] as const) {
      const state = createPopulatedState();
      state.masturbationTracking.enabled = enabled;
      if (currentStatus === "active") state.masturbationTracking.currentSession = { id: "other-active-session", status: "active", startedAt: correctedAt, pauses: [] };
      const target = findSession(state);
      for (const feedback of [
        { ...feedbackOf(target), erectionQuality: 8 as const },
        { ...feedbackOf(target), endingReason: "other" as const },
        { ...feedbackOf(target), erectionQuality: 8 as const, endingReason: "feltAnxious" as const }
      ]) {
        const before = JSON.stringify(state);
        const input = { sessionId, feedback, editedAt: correctedAt };
        const edited = editCompletedMasturbationSessionFeedbackState(state, input);
        assert(edited !== state, "Quality/reason edits must work with tracking enabled or disabled and another unfinished session present.");
        equal(findSession(edited), { ...target, ...feedback }, "Only the three completed feedback fields may change; identity, physical timestamps, duration, and pauses remain exact.");
        assert(findSession(edited).pauses === target.pauses, "Feedback edits must retain the existing pause history by reference.");
        assertUnrelatedReferences(state, edited);
        assert(edited.masturbationTracking.enabled === enabled && edited.masturbationTracking.currentSession === state.masturbationTracking.currentSession, "Corrections must not change permission or the active/awaiting session.");
        assert(edited.masturbationTracking.sessions.every((entry, index) => entry.id === sessionId || entry === state.masturbationTracking.sessions[index]), "Other completed records must retain identity and insertion order.");
        assert(JSON.stringify(state) === before, "Feedback editing must not mutate its source snapshot.");
        equal(editCompletedMasturbationSessionFeedbackState(state, input), edited, "Explicit correction inputs must produce deterministic state.");
        assert(editCompletedMasturbationSessionFeedbackState(edited, { ...input, editedAt: now().toISOString() }) === edited, "Semantically identical feedback must return the exact state without correction metadata.");
        const saved = JSON.stringify(edited);
        feedback.erectionQuality = 1;
        assert(JSON.stringify(edited) === saved, "Completed feedback must not alias mutable caller input.");
        await assertRoundTrip(edited);
      }
    }
  }
  const state = createPopulatedState();
  const target = findSession(state);
  assert(editCompletedMasturbationSessionFeedbackState(state, { sessionId, feedback: feedbackOf(target), editedAt: correctedAt }) === state, "An already-current full feedback submission is an exact no-op.");
  assert(editCompletedMasturbationSessionFeedbackState(state, { sessionId, feedback: { ...feedbackOf(target), erectionQuality: 1 }, editedAt: target.endedAt }) !== state, "An edit may occur exactly at physical session end.");
}

async function verifyIndependentDeletion() {
  for (const enabled of [false, true]) {
    const state = createPopulatedState();
    state.masturbationTracking.enabled = enabled;
    const before = JSON.stringify(state);
    const deleted = deleteCompletedMasturbationSessionState(state, { sessionId, deletedAt: correctedAt });
    assert(deleted !== state && deleted.masturbationTracking.sessions.length === state.masturbationTracking.sessions.length - 1, "Deleting a completed session without a derived dependency must remove it exactly once.");
    equal(deleted.masturbationTracking.sessions, state.masturbationTracking.sessions.filter((session) => session.id !== sessionId), "Deletion must preserve the ordered remainder without creating a session tombstone.");
    assert(deleted.masturbationTracking.sessions.every((entry) => state.masturbationTracking.sessions.includes(entry)), "Deletion must preserve other completed record references.");
    assert(deleted.masturbationTracking.enabled === enabled && deleted.masturbationTracking.currentSession === state.masturbationTracking.currentSession, "Deletion must retain tracking permission and unfinished session by reference.");
    assertUnrelatedReferences(state, deleted);
    assert(JSON.stringify(state) === before, "Deletion must not mutate its source snapshot.");
    assert(deleteCompletedMasturbationSessionState(deleted, { sessionId, deletedAt: now().toISOString() }) === deleted, "Deleting the same missing session again must be an exact no-op.");
    await assertRoundTrip(deleted);
  }
  const outsideContentFree = createPopulatedState();
  outsideContentFree.contentFree = createDefaultBloomState().contentFree;
  findSession(outsideContentFree).usedExplicitContent = true;
  assert(deleteCompletedMasturbationSessionState(outsideContentFree, { sessionId, deletedAt: findSession(outsideContentFree).endedAt }) !== outsideContentFree, "A true-feedback session outside Content-Free applicability may be deleted with no derived mutation, including at exact physical end.");
}

function verifyResetOwnership() {
  for (const status of ["recorded", "undone"] as const) {
    const state = createPopulatedState();
    if (status === "undone") {
      const prior = state.resetJourney.violations[0];
      assert(prior !== undefined, "Reset-owned source fixture required.");
      state.resetJourney.pastAttempts = [];
      state.resetJourney.violations = [{ ...prior, status, undoneAt: "2026-02-04T10:00:00.000Z" }];
    }
    const target = findSession(state, "source-session");
    assert(editCompletedMasturbationSessionFeedbackState(state, { sessionId: target.id, feedback: { ...feedbackOf(target), usedExplicitContent: false }, editedAt: correctedAt }) === state, `${status} Reset references must block behavior-changing feedback corrections.`);
    assert(deleteCompletedMasturbationSessionState(state, { sessionId: target.id, deletedAt: correctedAt }) === state, `${status} Reset references must block session deletion instead of rewriting Reset history.`);
    const simple = editCompletedMasturbationSessionFeedbackState(state, { sessionId: target.id, feedback: { ...feedbackOf(target), erectionQuality: 8, endingReason: "other" }, editedAt: correctedAt });
    assert(simple !== state && simple.resetJourney === state.resetJourney && simple.contentFree === state.contentFree, "A Reset-linked source still permits simple quality/reason edits that leave the behavior fact intact.");
  }
}

function verifyInvalidCorrections() {
  let count = 0;
  const reject = (fn: Transition, state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(fn(state, input as never) === state, `${label}: invalid corrections must return the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: invalid corrections must not mutate any session or product slice.`);
    count++;
  };
  const state = createPopulatedState();
  const target = findSession(state);
  const feedback = { ...feedbackOf(target), erectionQuality: 8 as const };
  const operations: Array<[Transition, Record<string, unknown>, string]> = [
    [editCompletedMasturbationSessionFeedbackState, { sessionId, feedback, editedAt: correctedAt }, "editedAt"],
    [deleteCompletedMasturbationSessionState, { sessionId, deletedAt: correctedAt }, "deletedAt"]
  ];
  for (const [fn, input, timeField] of operations) {
    for (const invalid of [null, [], "correction", {}, { ...input, startedAt: correctedAt }, { ...input, endedAt: correctedAt }, { ...input, durationSeconds: 0 }, { ...input, pauses: [] }]) reject(fn, state, invalid, "invalid correction object or forbidden timing/pause edits");
    for (const id of [undefined, "", " ", null, 17, "nonexistent", "session-feedback"]) reject(fn, state, { ...input, sessionId: id }, "invalid, missing, or awaiting-feedback target");
    for (const time of [undefined, "2026-02-30T10:00:00.000Z", "2026-10-01", "2026-10-01T12:00:00+00:00", 17, null, "2026-02-03T10:09:59.999Z"]) reject(fn, state, { ...input, [timeField]: time }, "invalid or pre-event correction time");
    const withActive = clone(state);
    withActive.masturbationTracking.currentSession = { id: "current-active-target", status: "active", startedAt: correctedAt, pauses: [] };
    reject(fn, withActive, { ...input, sessionId: "current-active-target" }, "active currentSession is outside completed correction scope");
    const duplicate = clone(state);
    duplicate.masturbationTracking.sessions.push(findSession(duplicate));
    reject(fn, duplicate, input, "duplicate completed target identity is ambiguous");
    const malformed = clone(state);
    findSession(malformed).pauses[0]!.durationSeconds = -1;
    reject(fn, malformed, input, "malformed physical facts must not be silently repaired during correction");
  }
  for (const value of [undefined, null, [], {}, { erectionQuality: 8 }, { erectionQuality: 8, usedExplicitContent: false }, { ...feedback, startedAt: correctedAt }]) reject(editCompletedMasturbationSessionFeedbackState, state, { sessionId, editedAt: correctedAt, feedback: value }, "replacement feedback must be full and contain only permitted feedback fields");
  for (const value of [0, 11, 1.5, NaN, Infinity, "8", null]) reject(editCompletedMasturbationSessionFeedbackState, state, { sessionId, editedAt: correctedAt, feedback: { ...feedback, erectionQuality: value } }, "quality must remain integer 1–10");
  for (const value of ["false", 0, null]) reject(editCompletedMasturbationSessionFeedbackState, state, { sessionId, editedAt: correctedAt, feedback: { ...feedback, usedExplicitContent: value } }, "explicit-content feedback must be boolean");
  for (const value of ["finished", "", null]) reject(editCompletedMasturbationSessionFeedbackState, state, { sessionId, editedAt: correctedAt, feedback: { ...feedback, endingReason: value } }, "ending reason must be a valid descriptive enum");
  return count;
}

function findSession(state: BloomLocalState, id = sessionId): CompletedMasturbationSession {
  const session = state.masturbationTracking.sessions.find((entry) => entry.id === id);
  assert(session !== undefined, `Missing completed fixture ${id}.`);
  return session;
}
function feedbackOf(session: CompletedMasturbationSession): MasturbationSessionFeedback { return { erectionQuality: session.erectionQuality, usedExplicitContent: session.usedExplicitContent, endingReason: session.endingReason }; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function assertUnrelatedReferences(before: BloomLocalState, after: BloomLocalState) { for (const key of Object.keys(before) as Array<keyof BloomLocalState>) if (key !== "masturbationTracking") assert(after[key] === before[key], `Simple corrections must preserve unrelated ${key} by reference.`); }
async function assertRoundTrip(state: BloomLocalState) {
  assert(validateAndNormalizeBloomState(state).success, "Corrected completed history must validate before persistence.");
  const client = new CorrectionTestStorage();
  await persistBloomLocalState(state, client, now);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Corrected histories must load as current v7 state.");
  equal(loaded.state, state, "Edited/deleted history and unchanged current session/product facts must survive v7 round trip.");
}
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
class CorrectionTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
