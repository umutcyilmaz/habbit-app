import { isDeepStrictEqual } from "node:util";

import { getBloomProgressReadModel, type BloomProgressReadModel } from "../src/domain/progress/getBloomProgressReadModel";
import { getTrackingSummary as getHomeTrackingSummary } from "../src/features/home/homePresentation";
import { getContentFreeProgress } from "../src/domain/contentFree/getContentFreeProgress";
import { getResetContentFreeCredit, getResetContentFreeContinuationOffer } from "../src/domain/contentFree/getResetContentFreeCredit";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import type { CompletedMasturbationSession } from "../src/domain/models/MasturbationTrackingState";
import type { ErectionQuality } from "../src/domain/models/MasturbationSession";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import {
  activateContentFreeState, completeElapsedResetPeriodState, createDefaultBloomState,
  deactivateContentFreeState, decideResetContentFreeContinuationState,
  recordActiveResetViolationState, undoActiveResetViolationState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createResetContinuityFixture } from "./fixtures/resetContinuity";
import { createActiveState } from "./verify-bloom-reset-violations";
import { createPopulatedState } from "./verify-bloom-product-persistence";

const at = "2026-10-11T10:00:00.250Z";
const day = 86400000;
const start = "2026-10-01T10:00:00.250Z";

export async function verifyBloomProgress() {
  verifyEmptyAndUnavailable();
  verifyTrackingSummary();
  verifyResetLifecycle();
  verifyContentFreeContinuity();
  verifyViolationUndo();
  verifyHistoricalFactsAndLegacyIsolation();
  await verifyDurableBoundary();
  await verifyV7RoundTrips();
  console.log("Bloom V4 Progress verification passed (8 groups: empty/unknown, shared Tracking semantics, 15-day Reset lifecycle, earned continuity, undo, history/legacy isolation, real failed-save durable boundary, and v7 round trips; frozen deterministic reads without writes).");
}

function verifyEmptyAndUnavailable() {
  const state = createDefaultBloomState();
  equal(read(state).tracking, {
    enabled: false, currentSessionStatus: "none",
    summary: { completedSessionCount: 0, averageErectionQuality: null, averageIntervalSeconds: null }
  }, "Empty Tracking must distinguish no observations from numeric zero.");
  equal(read(state).contentFree, {
    progress: { status: "inactive", effectiveBestStreakSeconds: 0, hasEffectiveViolation: false },
    pastActivationCount: 0, effectiveViolationCount: 0
  }, "Inactive Content-Free must not fabricate a current zero-day streak.");
  const reset = read(state).reset;
  assert(reset.status === "inactive" && reset.progress === null && reset.earnedContentFreeCredit === null &&
    reset.continuationOffer === null && reset.completedAttemptCount === 0 && reset.recordedBestCompletedDays === 0,
  "Unstarted Reset has no progress or credit; known empty history counts can be zero.");

  for (const hydrationStatus of ["loading", "error"] as const) {
    const source = { hydrationStatus, get durableState(): BloomLocalState { throw new Error("Unhydrated data was read"); } };
    assert(getBloomProgressReadModel(source, at) === null, "Unhydrated/unavailable state must not appear as an empty dashboard.");
  }
  for (const clock of ["", "invalid", "2026-02-30T10:00:00.000Z", "2026-10-11T10:00:00Z"]) {
    assert(getBloomProgressReadModel({ durableState: state, hydrationStatus: "ready" }, clock) === null,
      "Unknown/noncanonical observation time must return unavailable, never zero metrics.");
  }
  const invalid = { ...state, contentFree: { ...state.contentFree, bestStreakSeconds: -1 } };
  assert(getBloomProgressReadModel({ durableState: invalid, hydrationStatus: "ready" }, at) === null,
    "A selector failure must not be masked as empty progress.");
}

function verifyTrackingSummary() {
  const state = createDefaultBloomState();
  const earlier = session("earlier", 1, 2);
  const middle = session("middle", 3, 8);
  const later = session("later", 9, 5);
  const future = session("future", 12, 10);
  state.masturbationTracking = { enabled: true, currentSession: null, sessions: [later, future, earlier, middle] };
  const model = read(state);
  equal(model.tracking.summary, { completedSessionCount: 3, averageErectionQuality: 5, averageIntervalSeconds: 4 * 86400 },
    "Tracking uses chronological start-to-start intervals and excludes future-ended records.");
  equal(model.tracking.summary, getHomeTrackingSummary(state.masturbationTracking, at), "Home and Progress must share exactly one calculation.");
  const one = { ...state, masturbationTracking: { enabled: false, currentSession: null, sessions: [middle] } };
  equal(read(one).tracking.summary, { completedSessionCount: 1, averageErectionQuality: 8, averageIntervalSeconds: null },
    "A single disabled-but-historical record retains quality; interval remains unknown.");
  const zeroInterval = { ...one, masturbationTracking: { ...one.masturbationTracking, sessions: [middle, { ...middle, id: "same-start" }] } };
  assert(read(zeroInterval).tracking.summary.averageIntervalSeconds === 0, "A genuinely observed zero interval must remain zero, not null.");
  for (const status of ["active", "awaiting_feedback"] as const) {
    const currentSession = status === "active"
      ? { id: "unfinished", status, startedAt: start, pauses: [] }
      : { ...session("unfinished", 0, 10), status };
    const unfinished = { ...one, masturbationTracking: { ...one.masturbationTracking, currentSession } };
    const result = read(unfinished).tracking;
    assert(result.currentSessionStatus === status && !result.enabled, "Current lifecycle and disabled preference remain distinct facts.");
    equal(result.summary, read(one).tracking.summary, "Active/awaiting-feedback values must not become completed historical metrics.");
  }
}

function verifyResetLifecycle() {
  const f = createResetContinuityFixture();
  const history = { durationDays: 15 as const, bestCompletedDays: 0 as const, pastAttempts: [], violations: [] };
  const pendingJourneys: BloomLocalState["resetJourney"][] = [
    { ...history, status: "inactive" },
    { ...history, status: "recommended", id: "pending-reset" },
    { ...history, status: "baseline_pending", id: "pending-reset" }
  ];
  for (const resetJourney of pendingJourneys) {
    const reset = read({ ...f.state, resetJourney }).reset;
    assert(reset.status === resetJourney.status && reset.progress === null && reset.earnedContentFreeCredit === null && reset.continuationOffer === null,
      "A pending/unstarted journey cannot invent elapsed progress or earned time.");
  }
  for (const elapsed of [-1, 0, 9 * day + 1234, 15 * day - 1, 15 * day, 20 * day]) {
    const clock = shift(f.startedAt, elapsed);
    const reset = read(f.state, clock).reset;
    equal(reset.progress, getResetProgress(f.state.resetJourney, clock), "Reset derives the existing exact 15-day boundary.");
    assert(reset.status === "active" && reset.completedAttemptCount === 0 && reset.recordedBestCompletedDays === 0,
      "Elapsed reading must not record completion, archive an attempt or update persisted best.");
    assert(reset.restriction.needsCompletionTransition === (elapsed >= 15 * day) &&
      reset.restriction.isRestrictionActive === (elapsed < 15 * day), "Elapsed completion and saved completion are separate facts.");
    assert(reset.continuationOffer === null, "A merely elapsed active attempt cannot offer saved continuation.");
  }
  const completed = completeElapsedResetPeriodState(f.state, { observedAt: f.observeDays(20) });
  const reset = read(completed, f.observeDays(20)).reset;
  assert(reset.status === "completed" && reset.completedAttemptCount === 1 && reset.recordedBestCompletedDays === 15 &&
    reset.progress?.completedDays === 15 && reset.progress.currentDay === 15 &&
    !reset.restriction.needsCompletionTransition && !reset.restriction.isRestrictionActive,
  "Confirmed completion remains capped at fifteen days without a pending transition.");
  equal(reset.continuationOffer, getResetContentFreeContinuationOffer(completed, completed), "Continuation comes from the existing durable offer selector.");

  const historical = createActiveState(true, false);
  assert(historical.resetJourney.status === "active", "Historical active fixture required.");
  const before = read(historical, "2026-09-07T12:00:00.000Z").reset;
  assert(before.pastAttemptCount === 2 && before.completedAttemptCount === 1 && before.recordedBestCompletedDays === 15,
    "Historical completed and restarted attempts survive a new active journey.");
  const done = completeElapsedResetPeriodState(historical, { observedAt: "2026-09-20T12:00:00.000Z" });
  assert(read(done, "2026-09-20T12:00:00.000Z").reset.completedAttemptCount === 2,
    "The current confirmed completed attempt is counted once alongside archived completions.");
}

function verifyContentFreeContinuity() {
  const f = createResetContinuityFixture();
  const clock = f.observeDays(9, 1234);
  const active = activateContentFreeState(f.state, { activationId: "fractional-credit", activatedAt: clock });
  const result = read(active, f.observeDays(14, 2100));
  assert(result.contentFree.progress.status === "active" && result.contentFree.progress.currentStreakSeconds === 14 * 86400 + 2,
    "Fractional earned plus independent time must floor once and never double count.");
  equal(result.contentFree.progress, getContentFreeProgress(active.contentFree, f.observeDays(14, 2100)), "Content-Free uses the existing credited streak selector.");
  equal(result.reset.earnedContentFreeCredit, getResetContentFreeCredit(active.resetJourney, active.contentFree, f.observeDays(14, 2100)),
    "Eligible earned Reset time must use the canonical evidence selector.");

  const completed = completeElapsedResetPeriodState(f.state, { observedAt: f.observeDays(20) });
  const pending = read(completed, f.observeDays(20));
  assert(pending.reset.continuationOffer?.completedDays === 15 && pending.contentFree.progress.status === "inactive",
    "Eligible earned credit does not mean Content-Free is already active.");
  const accepted = decideResetContentFreeContinuationState(completed, {
    decision: "accepted", activationId: "continued-progress", decidedAt: f.observeDays(20)
  });
  const after = read(accepted, f.observeDays(21));
  assert(after.contentFree.progress.status === "active" && after.contentFree.progress.currentCompletedDays === 16 &&
    after.reset.continuationOffer === null, "Late acceptance excludes the five-day gap and imports fifteen days once.");
  const ended = deactivateContentFreeState(accepted, { endedAt: f.observeDays(21) });
  const inactive = read(ended, f.observeDays(25)).contentFree;
  assert(inactive.progress.status === "inactive" && inactive.progress.effectiveBestStreakSeconds === 16 * 86400 && inactive.pastActivationCount === 1,
    "Inactive Content-Free retains archived credited best without growing across an inactive gap.");
  assert(!("currentStreakSeconds" in inactive.progress), "Inactive current duration is absent, not a fabricated zero.");
  const declined = decideResetContentFreeContinuationState(completed, { decision: "declined", decidedAt: f.observeDays(20), activationId: "unused-declined-activation" });
  assert(read(declined, f.observeDays(21)).reset.continuationOffer === null && declined.contentFree === completed.contentFree,
    "Reading a declined decision neither reoffers it nor activates a tracker.");
}

function verifyViolationUndo() {
  for (const reason of ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
    const f = createResetContinuityFixture();
    const active = activateContentFreeState(f.state, { activationId: "before-slip", activatedAt: f.observeDays(10) });
    const occurredAt = f.observeDays(11);
    const recorded = recordActiveResetViolationState(active, {
      reason, violationId: "progress-violation", replacementAttemptId: "progress-restart",
      occurredAt, recordedAt: occurredAt, source: { kind: "manual", logActionId: "progress-slip" },
      ...(reason === "masturbation" ? {} : { contentFreeViolationId: "progress-content-violation" })
    });
    assert(recorded !== active, "Regression fixture must execute a real atomic restart.");
    const model = read(recorded, f.observeDays(12));
    assert(model.reset.effectiveViolationCount === 1 && model.reset.pastAttemptCount === 1 && model.reset.progress?.completedDays === 1,
      "Current progress follows the replacement attempt, not the old journey start.");
    assert(model.contentFree.effectiveViolationCount === (reason === "masturbation" ? 0 : 1),
      "Masturbation alone does not create a Content-Free violation.");
    assert(model.contentFree.progress.status === "active" && model.contentFree.progress.currentCompletedDays === (reason === "masturbation" ? 12 : 1),
      "Only intentional content breaks the credited streak.");
    const undone = undoActiveResetViolationState(recorded, { violationId: "progress-violation", undoneAt: f.observeDays(12) });
    assert(undone !== recorded && undone.resetJourney.violations[0]?.status === "undone", "Fixture retains a real undo tombstone.");
    const restored = read(undone, f.observeDays(12));
    assert(restored.reset.effectiveViolationCount === 0 && restored.contentFree.effectiveViolationCount === 0 &&
      !restored.contentFree.progress.hasEffectiveViolation && restored.contentFree.progress.status === "active" &&
      restored.contentFree.progress.currentCompletedDays === 12 && restored.reset.progress?.completedDays === 12,
    "Undo restores canonical progress/credit without treating tombstones as effective violations.");
    equal(restored.reset.earnedContentFreeCredit, getResetContentFreeCredit(undone.resetJourney, undone.contentFree, f.observeDays(12)),
      "Undo-derived credit must remain exactly the selector's result.");
  }
}

function verifyHistoricalFactsAndLegacyIsolation() {
  const populated = createPopulatedState();
  const historical = read(populated);
  assert(historical.contentFree.pastActivationCount === 1 && historical.contentFree.effectiveViolationCount === 1 &&
    populated.contentFree.violations.length === 2, "Historical undone rows must not inflate effective violations.");
  const empty = createDefaultBloomState();
  const legacyOnly = { ...populated, masturbationTracking: empty.masturbationTracking, contentFree: empty.contentFree, resetJourney: empty.resetJourney };
  equal(read(legacyOnly), read(empty), "Populated legacy onboarding/ten-day/Arousal/check-ins cannot become V4 metrics.");
  const v4Only = { ...empty, masturbationTracking: populated.masturbationTracking, contentFree: populated.contentFree, resetJourney: populated.resetJourney };
  equal(read(v4Only), historical, "Missing legacy facts cannot suppress valid V4 progress.");

  const minimal = { masturbationTracking: populated.masturbationTracking, contentFree: populated.contentFree, resetJourney: populated.resetJourney };
  for (const key of ["onboarding", "activePlan", "tenDayReset", "arousalControl", "checkIns", "pause", "protection", "debug", "productOnboarding", "urgeControl"]) {
    Object.defineProperty(minimal, key, { get() { throw new Error(`Unexpected dependency: ${key}`); } });
  }
  const source = { durableState: minimal, hydrationStatus: "ready" as const, get state(): BloomLocalState { throw new Error("Accepted state was read"); } };
  equal(getBloomProgressReadModel(source, at), historical, "Only the three declared durable product slices may be read.");
}

async function verifyDurableBoundary() {
  const f = createResetContinuityFixture();
  const cases: Array<{ label: string; initial: BloomLocalState; successor: BloomLocalState; clock: string }> = [
    { label: "new completed Tracking record", initial: createDefaultBloomState(),
      successor: { ...createDefaultBloomState(), masturbationTracking: { enabled: true, currentSession: null, sessions: [session("pending-record", 1, 7)] } }, clock: at },
    { label: "elapsed Reset completion", initial: f.state,
      successor: completeElapsedResetPeriodState(f.state, { observedAt: f.observeDays(20) }), clock: f.observeDays(20) }
  ];
  const completed = cases[1]!.successor;
  cases.push({ label: "Reset continuation activation", initial: completed,
    successor: decideResetContentFreeContinuationState(completed, { decision: "accepted", decidedAt: f.observeDays(20), activationId: "durable-credit" }), clock: f.observeDays(21) });
  for (const item of cases) {
    let writes = 0;
    const runtime = createBloomLocalStateMutationRuntime({ initialState: item.initial, initialHydrationStatus: "ready",
      persistState: async () => {
        writes++;
        if (writes === 1) throw new Error("Synthetic Progress save failure");
        return { status: "persisted", writeId: writes, generation: 0 } satisfies BloomStateWriteReceipt;
      }
    });
    const source = () => ({ state: runtime.getState(), durableState: runtime.getDurableState(), hydrationStatus: runtime.getHydrationStatus() });
    const initial = getBloomProgressReadModel(source(), item.clock);
    const pending = runtime.applyAcknowledgedMutation(() => item.successor);
    assert(runtime.getState() === item.successor && runtime.getDurableState() === item.initial, `${item.label}: fixture must create an actual accepted/durable mismatch.`);
    equal(getBloomProgressReadModel(source(), item.clock), initial, `${item.label}: an accepted pending write must not alter confirmed Progress.`);
    const failed = await pending;
    assert(!failed.ok && failed.accepted && failed.retryable, "Runtime must retain exact retry after a failed save.");
    const revision = runtime.getStateRevision();
    for (let i = 0; i < 3; i++) equal(getBloomProgressReadModel(source(), item.clock), initial,
      `${item.label}: failed accepted state must not become a saved metric or saved continuation offer.`);
    assert(writes === 1 && runtime.getStateRevision() === revision && runtime.getState() === item.successor,
      "Repeated Progress reads cannot create writes, complete/reset a domain operation or regenerate its identity.");
    const saved = await runtime.retryPersistence(failed.retryToken);
    assert(saved.ok && runtime.getDurableState() === item.successor, "Exact retry confirms the same successor.");
    equal(getBloomProgressReadModel(source(), item.clock), read(item.successor, item.clock), "Confirmed Progress updates only after acknowledgement.");
    assert(Number(writes) === 2 && runtime.getStateRevision() === revision, "Reading after retry must not add a revision or write.");
  }
}

async function verifyV7RoundTrips() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Progress must preserve persistence v7.");
  const f = createResetContinuityFixture();
  const completed = completeElapsedResetPeriodState(f.state, { observedAt: f.observeDays(20) });
  const continued = decideResetContentFreeContinuationState(completed, { decision: "accepted", decidedAt: f.observeDays(20), activationId: "roundtrip-credit" });
  const inactiveHistory = {
    ...deactivateContentFreeState(continued, { endedAt: f.observeDays(21) }),
    resetJourney: { status: "inactive" as const, durationDays: 15 as const, bestCompletedDays: 15 as const,
      pastAttempts: completed.resetJourney.status === "completed" ? [completed.resetJourney.currentAttempt] : [], violations: completed.resetJourney.violations }
  };
  const model = read(inactiveHistory, f.observeDays(25));
  assert(model.reset.progress === null && model.reset.pastAttemptCount === 1 && model.reset.completedAttemptCount === 1 && model.reset.recordedBestCompletedDays === 15,
    "Inactive lifecycle retains completed historical evidence without an invented current attempt.");
  const cases: Array<[string, BloomLocalState]> = [
    ["empty", createDefaultBloomState()], ["populated", createPopulatedState()],
    ["completed", completed], ["continued", continued], ["inactive history", inactiveHistory]
  ];
  for (const [label, state] of cases) {
    const client = createMemoryStorageClient();
    const clock = f.observeDays(25);
    await persistBloomLocalState(state, client, () => new Date(clock));
    const bytes = await client.getItem(BLOOM_STATE_STORAGE_KEY);
    const loaded = await loadBloomLocalState(client, () => new Date(clock));
    assert(loaded.status === "success", `${label}: existing v7 snapshot must load successfully (${loaded.status}).`);
    // Existing canonical field-order normalization can request writeback even
    // for semantically unchanged v7 data; it is not a Progress migration.
    assert(loaded.source === "current", `${label}: Progress must use the existing current v7 envelope.`);
    equal(read(loaded.state, clock), read(state, clock), "V4 Progress facts survive v7 reload including legacy compatibility and credited history.");
    assert(await client.getItem(BLOOM_STATE_STORAGE_KEY) === bytes, "Reading Progress cannot rewrite persisted bytes.");
  }
}

function session(id: string, offsetDays: number, erectionQuality: ErectionQuality): CompletedMasturbationSession {
  const startedAt = shift(start, offsetDays * day);
  return { id, status: "completed", startedAt, endedAt: shift(startedAt, 60000), durationSeconds: 60, pauses: [],
    erectionQuality, usedExplicitContent: false, endingReason: "stoppedByChoice" };
}

function read(state: BloomLocalState, clock = at): BloomProgressReadModel {
  const before = JSON.stringify(state);
  freeze(state);
  const model = getBloomProgressReadModel({ durableState: state, hydrationStatus: "ready" }, clock);
  assert(model !== null, "Valid canonical state must yield Progress.");
  equal(getBloomProgressReadModel({ durableState: state, hydrationStatus: "ready" }, clock), model,
    "Repeated fixed-time Progress reads must be deterministic.");
  assert(JSON.stringify(state) === before, "Progress must not change frozen records, preferences, recommendations, lifecycles or identities.");
  return model;
}
function shift(timestamp: string, milliseconds: number) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
