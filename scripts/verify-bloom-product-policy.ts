import { isDeepStrictEqual } from "node:util";
import type { ResetJourney } from "../src/domain/models";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { getResetRestrictionStatus } from "../src/domain/productPolicy/getResetRestrictionStatus";
import { getMasturbationTrackingAvailability } from "../src/domain/productPolicy/getMasturbationTrackingAvailability";
import {
  createDefaultBloomState, enableMasturbationTrackingState, disableMasturbationTrackingState,
  endMasturbationSessionState, completeMasturbationSessionFeedbackState,
  discardActiveMasturbationSessionState, completeElapsedResetPeriodState,
  recordActiveResetViolationState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";
import { verifyBloomProductPolicyIntegration } from "./verify-bloom-product-policy-integration";

const day = 24 * 60 * 60 * 1000;
const period = 15 * day;
const at = "2026-10-01T12:00:00.000Z";
const now = () => new Date("2026-11-01T12:00:00.000Z");
type CurrentStatus = "none" | "active" | "awaiting_feedback";

export async function verifyBloomProductPolicy() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Tracking controls and policy reads must retain the existing v7 schema and storage key.");
  const toggleCases = await verifyToggleMatrix();
  await verifyDisabledUnfinishedWork();
  await verifyRestrictionClockAndResume();
  const availabilityCases = verifyAvailabilityMatrix();
  verifyInvalidSourcesAndClocks();
  console.log(`Bloom product policy verification passed (${toggleCases} Tracking toggle combinations; ${availabilityCases} availability combinations; elapsed Reset boundaries, disabled unfinished-work preservation, pure selectors, and v7 round trips).`);
  await verifyBloomProductPolicyIntegration();
}

async function verifyToggleMatrix() {
  let count = 0;
  for (const base of statusStates()) for (const enabled of [false, true]) for (const current of ["none", "active", "awaiting_feedback"] as const) {
    const state = clone(base);
    state.masturbationTracking.enabled = enabled;
    setCurrent(state, current);
    freeze(state);
    const before = JSON.stringify(state);
    const allowed = ["inactive", "recommended", "completed"].includes(state.resetJourney.status);
    const on = enableMasturbationTrackingState(state);
    const off = disableMasturbationTrackingState(state);
    if (enabled || !allowed) assert(on === state, "Already enabled or baseline/active/assessment-pending Reset must make manual enable an exact no-op.");
    else assertToggleOnly(state, on, true);
    if (!enabled) assert(off === state, "Already disabled Tracking must make manual disable an exact no-op.");
    else assertToggleOnly(state, off, false);
    assert(enableMasturbationTrackingState(on) === on && disableMasturbationTrackingState(off) === off, "Repeated toggles must be idempotent without timestamps or audit records.");
    equal(enableMasturbationTrackingState(state), on, "Enable must be deterministic from plain state without an implicit clock.");
    equal(disableMasturbationTrackingState(state), off, "Disable must be deterministic from plain state without an implicit clock.");
    assert(JSON.stringify(state) === before, "Toggles must never mutate their source snapshot or unfinished work.");
    await assertRoundTrip(on, at);
    await assertRoundTrip(off, at);
    count++;
  }
  return count;
}

async function verifyDisabledUnfinishedWork() {
  for (const base of [createPopulatedState(), createActiveState(true, true)]) {
    base.masturbationTracking.enabled = true;
    setCurrent(base, "active");
    const disabled = disableMasturbationTrackingState(base);
    assertToggleOnly(base, disabled, false);
    const ended = endMasturbationSessionState(disabled, { endedAt: shift(at, 10 * 60_000) });
    assert(ended !== disabled && ended.masturbationTracking.currentSession?.status === "awaiting_feedback" && !ended.masturbationTracking.enabled, "Disabling must retain an active session and allow its physical end even during active Reset.");
    assert(ended.masturbationTracking.currentSession.pauses[0]?.status === "completed", "Resolving a disabled session must still close its explicitly active pause.");
    unrelated(disabled, ended);
    const completed = completeMasturbationSessionFeedbackState(ended, {
      feedback: { erectionQuality: 7, usedExplicitContent: false, endingReason: "stoppedByChoice" },
      recordedAt: shift(at, 11 * 60_000)
    });
    assert(completed !== ended && completed.masturbationTracking.currentSession === null && !completed.masturbationTracking.enabled, "Disabled awaiting feedback must still complete without enabling Tracking.");
    assert(completed.masturbationTracking.sessions.length === base.masturbationTracking.sessions.length + 1, "Disabled completion must append exactly one completed record while retaining prior history.");
    assert(completed.masturbationTracking.sessions.slice(0, -1).every((entry, index) => entry === base.masturbationTracking.sessions[index]), "Resolving disabled work must preserve all earlier session objects.");
    unrelated(ended, completed);
    await assertRoundTrip(completed, at);
    const discarded = discardActiveMasturbationSessionState(disabled);
    assert(discarded !== disabled && discarded.masturbationTracking.currentSession === null && !discarded.masturbationTracking.enabled, "The existing explicit discard action must remain available for a disabled active session.");
    assert(discarded.masturbationTracking.sessions === disabled.masturbationTracking.sessions, "Explicit discard must retain history instead of creating a completed record.");
    unrelated(disabled, discarded);
  }
}

async function verifyRestrictionClockAndResume() {
  for (const state of statusStates().filter((entry) => entry.resetJourney.status !== "active")) {
    equal(getResetRestrictionStatus(state.resetJourney, at), { isRestrictionActive: false, isElapsedPeriodComplete: false, needsCompletionTransition: false, progress: null }, "Every nonactive Reset lifecycle must be behaviorally unrestricted with no live active-period progress.");
  }
  const initial = createActiveState(true, true);
  assert(initial.resetJourney.status === "active", "Active Reset fixture required.");
  const restartAt = shift(initial.resetJourney.currentAttempt.startedAt, 2 * day + 123);
  const restarted = recordActiveResetViolationState(initial, {
    violationId: "policy-restart", replacementAttemptId: "policy-current-attempt", occurredAt: restartAt,
    recordedAt: restartAt, source: { kind: "manual", logActionId: "policy-restart-source" }, reason: "masturbation"
  });
  assert(restarted !== initial && restarted.resetJourney.status === "active", "A real restarted fixture must distinguish original journey start from current attempt start.");
  const boundary = shift(restartAt, period);
  freeze(restarted);
  const before = JSON.stringify(restarted);
  for (const elapsed of [-day, 0, 14 * day, period - 1, period, period + 1, 100 * day]) {
    const clock = shift(restartAt, elapsed);
    const complete = elapsed >= period;
    equal(getResetRestrictionStatus(restarted.resetJourney, clock), {
      isRestrictionActive: !complete, isElapsedPeriodComplete: complete,
      needsCompletionTransition: complete, progress: getResetProgress(restarted.resetJourney, clock)
    }, "Effective Reset policy must use the existing current-attempt progress at the exact supplied event time.");
    await assertRoundTrip(restarted, clock);
  }
  const justBefore = getResetRestrictionStatus(restarted.resetJourney, shift(boundary, -1));
  assert(justBefore?.isRestrictionActive === true && justBefore.progress?.remainingSeconds === 0.001, "The final millisecond must remain restricted without rounding up to the elapsed boundary.");
  const early = getResetRestrictionStatus(restarted.resetJourney, shift(restartAt, -day));
  assert(early?.progress?.completedDays === 0 && early.progress.remainingSeconds === period / 1000, "An early clock must safely clamp active progress to its initial full period.");
  const originalBoundary = shift(restarted.resetJourney.startedAt, period);
  assert(getResetRestrictionStatus(restarted.resetJourney, originalBoundary)?.isRestrictionActive === true, "The original journey's Day 15 must not release a restarted current attempt prematurely.");
  assert(restarted.resetJourney.status === "active" && JSON.stringify(restarted) === before, "Policy reads and hydration must never advance persisted active Reset, append facts, or write counters.");
  assert(enableMasturbationTrackingState(restarted) === restarted, "Elapsed active Reset still blocks manual enable until its persisted lifecycle completes.");
}

function verifyAvailabilityMatrix() {
  let count = 0;
  const fixtures = statusStates().map((state) => ({ state, clock: at }));
  const active = createActiveState(false, false);
  assert(active.resetJourney.status === "active", "Active Reset fixture required.");
  for (const elapsed of [0, period - 1, period, period + 1]) fixtures.push({ state: active, clock: shift(active.resetJourney.currentAttempt.startedAt, elapsed) });
  for (const { state: base, clock } of fixtures) for (const enabled of [false, true]) for (const current of ["none", "active", "awaiting_feedback"] as const) {
    const state = clone(base);
    state.masturbationTracking.enabled = enabled;
    setCurrent(state, current);
    freeze(state);
    const before = JSON.stringify(state);
    const restriction = getResetRestrictionStatus(state.resetJourney, clock);
    assert(restriction !== null, "Valid matrix fixture must have an effective Reset policy.");
    const blockReason = !enabled ? "trackingDisabled" : current === "active" ? "activeSession" : current === "awaiting_feedback" ? "awaitingFeedback" : restriction.isRestrictionActive ? "resetRestriction" : null;
    equal(getMasturbationTrackingAvailability(state, clock), {
      enabled, currentSessionStatus: current, canStartSession: blockReason === null, blockReason, resetRestriction: restriction
    }, "Availability must expose independent permission/session/Reset facts with deterministic disabled → active → awaiting-feedback → Reset precedence.");
    assert(JSON.stringify(state) === before, "Availability must remain a pure read, including after elapsed active Reset completion.");
    count++;
  }
  return count;
}

function verifyInvalidSourcesAndClocks() {
  for (const state of statusStates()) for (const invalid of [undefined, null, 42, "", "2026-10-01", "2026-10-01T12:00:00Z", "2026-10-01T12:00:00.000+00:00", "2026-02-30T12:00:00.000Z"]) {
    assert(getResetRestrictionStatus(state.resetJourney, invalid as never) === null, "Every Reset status must reject an invalid or noncanonical policy clock.");
    assert(getMasturbationTrackingAvailability(state, invalid as never) === null, "Availability must not guess permission from an invalid clock, even when another blocker takes precedence.");
  }
  const unsafe = createActiveState(false, false);
  assert(unsafe.resetJourney.status === "active", "Active Reset fixture required.");
  unsafe.resetJourney.currentAttempt.startedAt = "invalid";
  assert(getResetRestrictionStatus(unsafe.resetJourney, at) === null && getMasturbationTrackingAvailability(unsafe, at) === null, "Unsafe current-attempt progress must return the invalid selector result instead of guessing restriction.");
  const future = createDefaultBloomState();
  future.resetJourney.status = "future-status" as never;
  assert(enableMasturbationTrackingState(future) === future, "An unknown future Reset status must not default to permissive manual enable.");
  for (const mutate of [
    (state: BloomLocalState) => { state.masturbationTracking.enabled = "false" as never; },
    (state: BloomLocalState) => { state.masturbationTracking.sessions.push(state.masturbationTracking.sessions[0]!); },
    (state: BloomLocalState) => { state.masturbationTracking.currentSession = { id: "", status: "active", startedAt: at, pauses: [] }; }
  ]) {
    const state = createPopulatedState();
    mutate(state);
    assert(enableMasturbationTrackingState(state) === state && disableMasturbationTrackingState(state) === state, "Tracking toggles must not silently repair malformed existing Tracking facts.");
  }
}

function statusStates(): BloomLocalState[] {
  const completed = createPopulatedState();
  assert(completed.resetJourney.status === "completed", "Completed Reset fixture required.");
  const prior = completed.resetJourney;
  const history = { durationDays: 15 as const, bestCompletedDays: prior.bestCompletedDays, pastAttempts: [...prior.pastAttempts, prior.currentAttempt], violations: prior.violations };
  const inactive: ResetJourney = { ...history, status: "inactive" };
  const recommended: ResetJourney = { ...history, status: "recommended", id: "policy-recommended" };
  const baseline: ResetJourney = { ...history, status: "baseline_pending", id: "policy-baseline" };
  const active = createActiveState(true, true);
  assert(active.resetJourney.status === "active", "Active Reset fixture required.");
  const pending = completeElapsedResetPeriodState(active, { observedAt: shift(active.resetJourney.currentAttempt.startedAt, period) });
  assert(pending.resetJourney.status === "assessment_pending", "Pending assessment fixture required.");
  return [{ ...completed, resetJourney: inactive }, { ...completed, resetJourney: recommended }, { ...completed, resetJourney: baseline }, active, pending, completed];
}
function setCurrent(state: BloomLocalState, status: CurrentStatus) {
  state.masturbationTracking.currentSession = status === "none" ? null : status === "awaiting_feedback" ? createPopulatedState().masturbationTracking.currentSession : {
    id: "policy-active-session", status: "active", startedAt: at, pauses: [{ status: "active", startedAt: shift(at, 60_000) }]
  };
}
function assertToggleOnly(before: BloomLocalState, after: BloomLocalState, enabled: boolean) {
  assert(after !== before && after.masturbationTracking !== before.masturbationTracking, "A permitted flag change must produce a new state and Tracking slice.");
  equal(after.masturbationTracking, { ...before.masturbationTracking, enabled }, "A Tracking toggle must change only the existing enabled boolean without audit metadata.");
  assert(after.masturbationTracking.currentSession === before.masturbationTracking.currentSession && after.masturbationTracking.sessions === before.masturbationTracking.sessions, "Toggles must preserve unfinished session and completed-history references exactly.");
  unrelated(before, after);
  assert(validateAndNormalizeBloomState(after).success, "Disabled Tracking with unfinished work must remain valid canonical persisted state.");
}
function unrelated(before: BloomLocalState, after: BloomLocalState) { for (const key of Object.keys(before) as Array<keyof BloomLocalState>) if (key !== "masturbationTracking") assert(after[key] === before[key], `Tracking controls and unfinished resolution must preserve ${key} by reference, including CF, Urge Control, onboarding, Reset, and legacy features.`); }
async function assertRoundTrip(state: BloomLocalState, clock: string) {
  assert(validateAndNormalizeBloomState(state).success, "Policy fixture must validate before persistence.");
  const client = new PolicyTestStorage();
  const before = JSON.stringify(state);
  const restriction = getResetRestrictionStatus(state.resetJourney, clock);
  const availability = getMasturbationTrackingAvailability(state, clock);
  await persistBloomLocalState(state, client, now);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Policy/toggle states must hydrate from the existing v7 envelope.");
  equal(loaded.state, state, "Hydration must preserve exact stored facts without derived policy fields or automatic lifecycle advancement.");
  equal(getResetRestrictionStatus(loaded.state.resetJourney, clock), restriction, "Effective restriction must be reproduced from v7 timestamps after reload.");
  equal(getMasturbationTrackingAvailability(loaded.state, clock), availability, "Availability must reproduce from persisted source facts without storing the read model.");
  assert(JSON.stringify(state) === before, "Selectors and persistence must not mutate the source state.");
}
function shift(timestamp: string, milliseconds: number) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
class PolicyTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
