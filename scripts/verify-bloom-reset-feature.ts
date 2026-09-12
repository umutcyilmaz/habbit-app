import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";

import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { getResetRestrictionStatus } from "../src/domain/productPolicy/getResetRestrictionStatus";
import { getMasturbationTrackingAvailability } from "../src/domain/productPolicy/getMasturbationTrackingAvailability";
import type { PostResetAssessment, ResetBaseline, ResetJourney, ResetViolation } from "../src/domain/models";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import {
  BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState,
  type BloomStateWriteReceipt
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";
import { createResetController } from "../src/features/reset/resetController";
import {
  getResetRouteView, getLatestResetUndoCandidate, type ResetRouteInput
} from "../src/features/reset/resetView";

const startedAt = "2026-11-01T12:00:00.123Z";
const day = 86400000;
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
const selfReport: ResetBaseline["selfReport"] = {
  urgeIntensity: "preferNotToSay", abilityToPause: "sometimesPossible", spontaneousOrMorningErections: "notSure"
};
const answers = {
  urgeIntensityChange: "notSure", abilityToPauseChange: "easier", spontaneousErectionChange: "preferNotToSay",
  overallSexualResponseChange: "same", readinessToRestartTracking: "notReady"
} as const;

export async function verifyBloomResetFeature() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7",
    "Executable Reset must retain the current v7 persistence contract.");
  await verifyLifecycle();
  await verifyReasonsAndReadiness();
  await verifyIdentityGuards();
  verifyViewsAndBoundary();
  verifySourceAndForms();
  await verifyHookWiring();
  console.log("Bloom Reset feature verification passed (explicit baseline, restart/undo atomicity, elapsed boundaries, assessment, stale route guards, durable-only navigation/retry, v7 reloads, and controlled hook/forms).");
}

async function verifyLifecycle() {
  const initial = baselinePendingState();
  const original = JSON.stringify(initial);
  const h = createHarness(initial);
  h.controller.getSnapshot();
  const unsubscribe = h.controller.subscribe(() => undefined);
  unsubscribe();
  h.makeController().getSnapshot();
  equal(h.counts(), { clockCalls: 0, idCalls: 0, mutationCalls: 0 }, "Mounting/reading Reset controllers must not submit a baseline.");
  const baseline = h.controller.startFromBaseline(selfReport, initial.resetJourney);
  assert(baseline !== null && h.controller.startFromBaseline(selfReport, initial.resetJourney) === baseline,
    "Duplicate baseline submits must share one in-flight operation.");
  const active = h.runtime.getState();
  assert(active.resetJourney.status === "active", "Explicit baseline submit must accept the active journey through the flow API.");
  const firstAttempt = active.resetJourney.currentAttempt;
  equal(active.resetJourney.baseline.selfReport, selfReport, "The exact nonmedical self-report values must remain unchanged.");
  equal(Object.keys(active.resetJourney.baseline).sort(), ["capturedAt", "id", "selfReport"],
    "The feature must omit unknown aggregates rather than compute or fill historical observations.");
  assert(active.resetJourney.startedAt === startedAt && firstAttempt.startedAt === startedAt &&
    active.resetJourney.baseline.capturedAt === startedAt && h.persisted.length === 0 && h.runtime.getDurableState() === initial,
  "Baseline flow facts must use one clock; accepted start must not navigate before durable success.");
  equal(h.counts(), { clockCalls: 1, idCalls: 2, mutationCalls: 1 }, "Baseline IDs/time must be generated exactly once by the existing flow.");
  h.attempts[0]!.succeed();
  assert((await baseline).ok && h.persisted[0]?.reset === active.resetJourney,
    "Durable baseline acknowledgement must carry the newly canonical attempt for navigation.");
  assertOtherReferences(initial, active, ["resetJourney"]);
  await roundTrip(active);

  h.setRoute({ mode: "progress", journeyId: active.resetJourney.id, attemptId: firstAttempt.id });
  const occurredAt = shift(startedAt, 3 * day + 567);
  h.setTime(occurredAt);
  const restart = h.controller.recordViolation("masturbationWithExplicitContent", active.resetJourney);
  assert(restart !== null && h.controller.recordViolation("masturbationWithExplicitContent", active.resetJourney) === restart,
    "Duplicate confirmation presses must remain one Reset restart operation.");
  const restarted = h.runtime.getState();
  assert(restarted.resetJourney.status === "active" && restarted.contentFree.status === "active",
    "Combined explicit-content reporting must atomically restart active Reset and retain active Content-Free.");
  const event = restarted.resetJourney.violations[0];
  assert(event?.source.kind === "manual" && event.reason === "masturbationWithExplicitContent" &&
    event.attemptId === firstAttempt.id && restarted.resetJourney.currentAttempt.id !== firstAttempt.id,
  "Restart must preserve the old attempt/source fact and create exactly one new attempt.");
  const linked = restarted.contentFree.violations.find((record) => record.source.kind === "manual" &&
    event.source.kind === "manual" && record.source.logActionId === event.source.logActionId);
  assert(linked !== undefined && linked.occurredAt === occurredAt && restarted.contentFree.currentStreakStartedAt === occurredAt,
    "One Reset command must own the linked Content-Free event and streak change atomically.");
  equal(h.counts(), { clockCalls: 2, idCalls: 6, mutationCalls: 2 }, "Restart must generate four shared operation IDs once, with no separate Content-Free command.");
  assert(Number(h.persisted.length) === 1 && h.runtime.getDurableState() === active,
    "The newly accepted attempt must not be treated as a durably navigable destination yet.");
  await failAndRetry(h, restart, 1);
  assert(h.persisted[1]?.reset === restarted.resetJourney && h.persisted[1]?.operation === "recordViolation",
    "Successful retry must navigate using the captured replacement attempt without replaying a violation.");
  assertOtherReferences(active, restarted, ["resetJourney", "contentFree"]);
  await roundTrip(restarted);

  h.setRoute({ mode: "progress", journeyId: restarted.resetJourney.id, attemptId: restarted.resetJourney.currentAttempt.id });
  h.setTime(shift(occurredAt, 1000));
  const undo = h.controller.undoViolation(event.id, restarted.resetJourney);
  assert(undo !== null && h.controller.undoViolation(event.id, restarted.resetJourney) === undo &&
    h.controller.undoViolation("other-event", restarted.resetJourney) === null,
  "Undo must preserve and deduplicate the exact displayed violation ID.");
  const restored = h.runtime.getState();
  assert(restored.resetJourney.status === "active" && restored.contentFree.status === "active" &&
    restored.resetJourney.currentAttempt.id === firstAttempt.id && restored.resetJourney.currentAttempt.startedAt === firstAttempt.startedAt,
  "Canonical Reset undo must restore the original attempt identity/start.");
  assert(restored.resetJourney.violations[0]?.status === "undone" &&
    restored.contentFree.violations.find((record) => record.id === linked.id)?.status === "undone" &&
    active.contentFree.status === "active" && restored.contentFree.currentStreakStartedAt === active.contentFree.currentStreakStartedAt &&
    restored.contentFree.bestStreakSeconds === active.contentFree.bestStreakSeconds,
  "The domain must restore linked Content-Free streak/best and preserve both source tombstones atomically.");
  assert(Number(h.persisted.length) === 2, "Accepted undo must not navigate to its restored attempt before persistence.");
  await failAndRetry(h, undo, 3);
  assert(h.persisted[2]?.reset === restored.resetJourney, "Durable undo retry must retain the restored canonical navigation target.");
  assertOtherReferences(restarted, restored, ["resetJourney", "contentFree"]);
  await roundTrip(restored);

  h.setRoute({ mode: "completion", journeyId: restored.resetJourney.id, attemptId: firstAttempt.id });
  h.setTime(shift(startedAt, 15 * day - 1));
  const beforeBoundary = h.counts();
  assert(h.controller.completeElapsed(restored.resetJourney) === null, "Completion must not dispatch one millisecond before the current attempt's exact boundary.");
  equal(h.counts(), beforeBoundary, "An unavailable completion route must not generate operation time or mutate state.");
  const completedAt = shift(startedAt, 15 * day);
  h.setTime(shift(completedAt, 2 * day));
  const completion = h.controller.completeElapsed(restored.resetJourney);
  assert(completion !== null && h.controller.completeElapsed(restored.resetJourney) === completion,
    "Explicit elapsed completion must delegate exactly once.");
  const pending = h.runtime.getState();
  assert(pending.resetJourney.status === "assessment_pending" && pending.resetJourney.completedAt === completedAt &&
    pending.resetJourney.currentAttempt.completedAt === completedAt && Number(h.persisted.length) === 3,
  "The transition must record the true 15-day boundary, not the later observation clock; navigation must wait.");
  await failAndRetry(h, completion, 5);
  assert(h.persisted[3]?.reset === pending.resetJourney && h.persisted[3]?.operation === "completeElapsed",
    "Durable elapsed completion must expose the same canonical attempt for assessment navigation.");
  assertOtherReferences(restored, pending, ["resetJourney"]);
  await roundTrip(pending);

  h.setRoute({ mode: "assessment", journeyId: pending.resetJourney.id, attemptId: pending.resetJourney.currentAttempt.id });
  h.setTime(shift(completedAt, 3 * day));
  const assessment = h.controller.completeAssessment(answers, pending.resetJourney);
  assert(assessment !== null && h.controller.completeAssessment(answers, pending.resetJourney) === assessment,
    "Duplicate assessment submissions must share the canonical acknowledgement.");
  const finished = h.runtime.getState();
  assert(finished.resetJourney.status === "completed" && finished.masturbationTracking.enabled,
    "A descriptive notReady answer must still complete Reset and let the existing transition enable Tracking.");
  equal(finished.resetJourney.assessment, {
    ...answers, id: "reset-assessment-reset-feature-7", completedAt: shift(completedAt, 3 * day),
    resetJourneyId: pending.resetJourney.id, resetAttemptId: pending.resetJourney.currentAttempt.id,
    baselineId: pending.resetJourney.baseline.id
  }, "Assessment must contain exact semantic answers and validated canonical references, with only flow-generated identity/time.");
  assert(Number(h.persisted.length) === 4, "Accepted assessment completion must not close to Today before a durable receipt.");
  await failAndRetry(h, assessment, 7);
  assert(h.persisted[4]?.reset === finished.resetJourney && h.persisted[4]?.operation === "completeAssessment",
    "Durable assessment success must carry only its completed canonical Reset.");
  assertOtherReferences(pending, finished, ["resetJourney", "masturbationTracking"]);
  assert(finished.masturbationTracking.sessions === pending.masturbationTracking.sessions,
    "Transition-owned Tracking enablement must preserve historical sessions by reference.");
  await roundTrip(finished);
  assert(JSON.stringify(initial) === original, "The complete executable lifecycle must not mutate its original populated snapshot.");
}

async function failAndRetry(
  h: ReturnType<typeof createHarness>,
  command: Promise<import("../src/app/providers/bloomLocalStateMutationRuntime").BloomPersistedMutationResult>,
  writeIndex: number
) {
  const accepted = h.runtime.getState();
  const callbackCount = h.persisted.length;
  h.attempts[writeIndex]!.fail();
  const failure = await command;
  assert(!failure.ok && failure.accepted && failure.retryable && failure.reason === "persistenceFailed" &&
    h.controller.getSnapshot().result === failure && h.persisted.length === callbackCount,
  "Accepted failed operations must preserve retryable receipts and never emit success navigation.");
  const counts = h.counts();
  const retry = h.controller.retry();
  assert(retry !== null && h.controller.retry() === retry && h.attempts[writeIndex + 1]!.state === accepted,
    "Duplicate retries must share persistence of the same accepted snapshot.");
  h.attempts[writeIndex + 1]!.succeed();
  assert((await retry).ok && h.runtime.getDurableState() === accepted, "Retry must acknowledge the original accepted logical operation.");
  equal(h.counts(), counts, "Persistence retry must never replay a Reset transition or regenerate timestamps/IDs.");
  assert(h.persisted.length === callbackCount + 1 && h.controller.retry() === null,
    "A successful retry must publish its durable navigation callback once.");
}

async function verifyReasonsAndReadiness() {
  const baseline = createHarness();
  const start = baseline.controller.startFromBaseline(selfReport, baseline.initialState.resetJourney);
  assert(start !== null, "Baseline retry fixture must submit explicitly.");
  await failAndRetry(baseline, start, 0);
  for (const reason of ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
    const state = createActiveState(false, true);
    assert(state.resetJourney.status === "active", "Active reason fixture required.");
    const h = createHarness(state);
    h.setTime(shift(state.resetJourney.currentAttempt.startedAt, 3 * day));
    const command = h.controller.recordViolation(reason, state.resetJourney);
    assert(command !== null && h.counts().mutationCalls === 1, "Every canonical reason must dispatch exactly one Reset command.");
    const accepted = h.runtime.getState();
    const event = accepted.resetJourney.violations[0];
    assert(event?.reason === reason && event.source.kind === "manual", "Reset confirmation must retain its exact reason and a flow-created manual source.");
    if (reason === "masturbation") assert(accepted.contentFree === state.contentFree,
      "Masturbation alone must not break Content-Free or dispatch a Content-Free operation.");
    else assert(accepted.contentFree !== state.contentFree && accepted.contentFree.violations.length === 1,
      "Explicit-content reasons must retain one atomic Content-Free effect within the same Reset command.");
    h.attempts[0]!.succeed();
    assert((await command).ok, "All three reason values must preserve acknowledged saves.");
  }
  for (const readinessToRestartTracking of ["ready", "notReady", "notSure"] as const) {
    const state = assessmentPendingState();
    const h = createHarness(state);
    const command = h.controller.completeAssessment({ ...answers, readinessToRestartTracking }, state.resetJourney);
    assert(command !== null && h.counts().mutationCalls === 1, "All descriptive readiness answers must delegate the same assessment command.");
    const accepted = h.runtime.getState();
    assert(accepted.resetJourney.status === "completed" && accepted.resetJourney.assessment.readinessToRestartTracking === readinessToRestartTracking &&
      accepted.masturbationTracking.enabled && accepted.masturbationTracking.sessions === state.masturbationTracking.sessions,
    "Readiness must not gate completion or transition-owned Tracking enablement.");
    h.attempts[0]!.succeed();
    assert((await command).ok, "Every readiness answer must complete with normal durable acknowledgement.");
    assertOtherReferences(state, accepted, ["resetJourney", "masturbationTracking"]);
  }
  // A real session-derived event stays session-derived; the Reset owner may
  // still reverse it by exact ID without calling Content-Free undo separately.
  const state = createActiveState(false, true);
  assert(state.resetJourney.status === "active", "Session-source fixture required.");
  const h = createHarness(state);
  h.setTime(shift(state.resetJourney.currentAttempt.startedAt, day));
  const recorded = h.flowActions.reset.recordViolation({ reason: "masturbation", source: { kind: "masturbationSession", sessionId: "source-session" } });
  h.attempts[0]!.succeed();
  assert((await recorded).ok, "Canonical session-derived Reset history must be representable.");
  const accepted = h.runtime.getState();
  const target = getLatestResetUndoCandidate(accepted.resetJourney);
  assert(target?.source.kind === "masturbationSession", "Latest candidate selection must retain a session source, without inventing manual identity.");
  h.setRoute(routeFor(accepted.resetJourney));
  const undo = h.controller.undoViolation(target.id, accepted.resetJourney);
  assert(undo !== null && h.counts().mutationCalls === 2 && h.runtime.getState().contentFree === state.contentFree,
    "Session-derived candidate undo must delegate exactly one Reset command and preserve unrelated Content-Free.");
  h.attempts[1]!.succeed();
  assert((await undo).ok, "The existing Reset transition must remain the authority on session-derived undo safety.");
}

async function verifyIdentityGuards() {
  const invalidIds: unknown[] = [undefined, null, "", " ", [], ["feature-reset"], ["one", "two"], 42, "different-id"];
  for (const mode of ["baseline", "progress", "completion", "assessment"] as const) {
    const state = mode === "baseline" ? baselinePendingState() : mode === "assessment" ? assessmentPendingState() : createActiveState(false, true);
    for (const id of invalidIds) {
      const h = createHarness(state);
      const valid = routeFor(state.resetJourney, mode);
      h.setRoute({ ...valid, journeyId: id });
      if (state.resetJourney.status === "active") h.setTime(shift(state.resetJourney.currentAttempt.startedAt, 15 * day));
      const invoke = () => mode === "baseline" ? h.controller.startFromBaseline(selfReport, state.resetJourney) :
        mode === "progress" ? h.controller.recordViolation("masturbation", state.resetJourney) :
        mode === "completion" ? h.controller.completeElapsed(state.resetJourney) : h.controller.completeAssessment(answers, state.resetJourney);
      assert(invoke() === null && h.counts().clockCalls === 0 && h.attempts.length === 0,
        "Every Reset route must reject missing, non-scalar, blank, or mismatched journey identity before dispatch.");
      if (mode !== "baseline") {
        h.setRoute({ ...valid, attemptId: id });
        assert(invoke() === null && h.counts().mutationCalls === 0,
          "Progress/completion/assessment must require the exact canonical current attempt ID.");
      }
    }
  }
  for (const mode of ["baseline", "progress", "completion"] as const) {
    const state = assessmentPendingState();
    const h = createHarness(state);
    h.setRoute(routeFor(state.resetJourney, mode));
    assert(h.controller.startFromBaseline(selfReport, state.resetJourney) === null &&
      h.controller.recordViolation("masturbation", state.resetJourney) === null && h.controller.completeElapsed(state.resetJourney) === null,
    "A finished period must not be treated as baseline-pending or a new active attempt by stale routes.");
    assert(h.counts().mutationCalls === 0, "Incorrect lifecycle routes must not mutate canonical state.");
  }
  const active = createActiveState(false, true);
  assert(active.resetJourney.status === "active", "Stale attempt fixture required.");
  const h = createHarness(active);
  h.setTime(shift(active.resetJourney.currentAttempt.startedAt, day));
  const recorded = h.controller.recordViolation("masturbation", active.resetJourney);
  assert(recorded !== null, "Stale attempt fixture must create one canonical restart.");
  h.attempts[0]!.succeed();
  await recorded;
  const restarted = h.runtime.getState();
  assert(restarted.resetJourney.status === "active", "Canonical replacement attempt required.");
  const target = getLatestResetUndoCandidate(restarted.resetJourney);
  assert(target !== null, "Recorded candidate required.");
  const counts = h.counts();
  assert(h.controller.recordViolation("masturbation", active.resetJourney) === null &&
    h.controller.undoViolation(target.id, restarted.resetJourney) === null,
  "An older route/attempt must not target the newer accepted Reset even when a fresh candidate is supplied.");
  h.setRoute(routeFor(restarted.resetJourney));
  for (const id of [...invalidIds, "different-violation"]) {
    assert(h.controller.undoViolation(id, restarted.resetJourney) === null, "Undo must reject invalid or noncandidate IDs without silent retargeting.");
  }
  equal(h.counts(), counts, "Invalid route or target guards must execute before fact generation.");
  for (const change of ["undone", "source", "journey", "baseline"] as const) {
    const changed = { ...restarted.resetJourney, violations: restarted.resetJourney.violations.map((event) => ({ ...event })) };
    if (change === "undone") changed.violations = [{ ...target, status: "undone", undoneAt: startedAt }];
    if (change === "source") changed.violations = [{ ...target, source: { kind: "manual", logActionId: "different-source" } }];
    if (change === "journey") changed.id = "newer-journey";
    if (change === "baseline") changed.baseline = { ...changed.baseline, id: "different-baseline" };
    const index = h.attempts.length;
    const external = h.runtime.applyAcknowledgedMutation((current) => ({ ...current, resetJourney: changed }));
    h.attempts[index]!.succeed();
    await external;
    assert(h.controller.undoViolation(target.id, restarted.resetJourney) === null,
      "Retained undo must reject changed canonical status/source/journey/baseline even when the target ID string survives.");
    equal(h.counts(), counts, "Event-time accepted-state reads must prevent a stale row from issuing another mutation.");
  }
  const pending = assessmentPendingState();
  const assessment = createHarness(pending);
  assert(pending.resetJourney.status === "assessment_pending", "Assessment reference fixture required.");
  const changed = { ...pending.resetJourney, baseline: { ...pending.resetJourney.baseline, id: "new-baseline" } };
  const external = assessment.runtime.applyAcknowledgedMutation((state) => ({ ...state, resetJourney: changed }));
  assessment.attempts[0]!.succeed();
  await external;
  assert(assessment.controller.completeAssessment(answers, pending.resetJourney) === null && assessment.counts().clockCalls === 0,
    "Assessment must not submit caller answers against a baseline identity replaced after rendering.");
}

function verifyViewsAndBoundary() {
  const baseline = baselinePendingState().resetJourney;
  const active = createActiveState(false, true).resetJourney;
  assert(active.status === "active", "Active boundary fixture required.");
  assert(getResetRouteView(baseline, routeFor(baseline), startedAt).kind === "baseline",
    "The exact baseline-pending journey must resolve to its baseline view.");
  for (const id of [undefined, null]) assert(getResetRouteView(baseline, { mode: "baseline", journeyId: id }, startedAt).kind === "missing",
    "Absent Reset route identity must be represented without starting or redirecting work.");
  for (const id of ["", " ", [], ["feature-reset"], 42]) assert(getResetRouteView(baseline, { mode: "baseline", journeyId: id }, startedAt).kind === "invalid",
    "Non-scalar or empty URL values must never become canonical Reset identities.");
  assert(getResetRouteView(baseline, { mode: "baseline", journeyId: "stale" }, startedAt).kind === "mismatch",
    "A different journey must not be silently substituted for the route target.");
  const original = JSON.stringify(active);
  for (const elapsed of [-1, 0, day, 15 * day - 1, 15 * day, 15 * day + 1]) {
    const at = shift(active.currentAttempt.startedAt, elapsed);
    const view = getResetRouteView(active, routeFor(active), at);
    assert(view.kind === "active", "The progress route must retain active lifecycle display at the elapsed boundary.");
    equal(view.progress, getResetProgress(active, at), "Progress must exactly reuse the current-attempt domain selector.");
    equal(view.restriction, getResetRestrictionStatus(active, at), "Restriction presentation must use the effective domain policy.");
    assert(view.progress.isPeriodComplete === (elapsed >= 15 * day), "The final millisecond must not round up into a completed 15-day period.");
    const completion = getResetRouteView(active, routeFor(active, "completion"), at);
    assert(completion.kind === "active" && completion.progress.isPeriodComplete === (elapsed >= 15 * day),
      "A completion URL may display early progress, but its completion eligibility must follow the exact elapsed selector boundary.");
    const state = { ...createDefaultBloomState(), resetJourney: active,
      masturbationTracking: { ...createDefaultBloomState().masturbationTracking, enabled: true } };
    const availability = getMasturbationTrackingAvailability(state, at);
    assert(availability?.canStartSession === (elapsed >= 15 * day),
      "Tracking availability must remain consistent with effective Reset policy rather than active lifecycle status alone.");
  }
  assert(JSON.stringify(active) === original && active.status === "active", "Clock reads must never persist progress counters or complete the lifecycle.");
  const restarted = { ...active, currentAttempt: { ...active.currentAttempt, startedAt: shift(active.startedAt, 3 * day) } };
  const oldBoundary = getResetRouteView(restarted, routeFor(restarted), shift(active.startedAt, 15 * day));
  assert(oldBoundary.kind === "active" && !oldBoundary.progress.isPeriodComplete,
    "A restarted attempt must not finish at the older overall journey's boundary.");
  const pending = assessmentPendingState().resetJourney;
  assert(getResetRouteView(pending, routeFor(pending), startedAt).kind === "assessment", "Only matching assessment-pending identity may expose assessment answers.");
  const completed = createPopulatedState().resetJourney;
  assert(getResetRouteView(completed, routeFor(completed), startedAt).kind === "completed", "A completed assessment route may show saved completion without resubmitting it.");
}

async function verifyHookWiring() {
  const h = createHarness();
  const hooks = createControlledHooks();
  const navigation: Array<{ intent?: unknown; mode?: unknown; path?: unknown }> = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let displayTime = Date.parse(startedAt);
  let hasHydrated = false;
  let hydrationStatus: "loading" | "error" | "ready" = "loading";
  let mode: ResetRouteInput["mode"] = "baseline";
  let params: { journeyId?: string | string[]; attemptId?: string | string[] } = { journeyId: "feature-reset" };
  const router = { replace: (path: unknown) => navigation.push({ path }) };
  const dependencies: Record<string, unknown> = {
    react: hooks.react,
    "expo-router": { useRouter: () => router, useLocalSearchParams: () => params },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => h.flowActions },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({
      state: h.runtime.getState(), durableState: h.runtime.getDurableState(),
      getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated, hydrationStatus
    }) },
    "../../app/navigation/navigateBloomProductFlow": { navigateBloomProductFlow: (_router: unknown, intent: unknown, mode: unknown) => navigation.push({ intent, mode }) },
    "../../constants/navigation": { routes: { home: "/existing-today" } },
    "../../domain/reset/getResetProgress": { getResetProgress },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: () => () => undefined },
    "./resetController": { createResetController },
    "./resetView": { getResetRouteView }
  };
  const module = { exports: {} as Record<string, unknown> };
  const source = readFileSync("src/features/reset/useResetFeature.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  class DisplayDate extends Date { static now() { return displayTime; } }
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, Date: DisplayDate,
    require: (name: string) => { assert(name in dependencies, `Unexpected Reset hook dependency ${name}.`); return dependencies[name]; },
    setInterval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearInterval: (id: number) => timers.delete(id)
  });
  type Feature = {
    view: ReturnType<typeof getResetRouteView>; busy: boolean; locked: boolean; canRetry: boolean;
    saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed";
    recoveryTarget: "progress" | "assessment" | "today" | null; canContinue: boolean; canOpenCompletion: boolean;
    actions: {
      startFromBaseline: (answers: ResetBaseline["selfReport"]) => void;
      recordViolation: (reason: ResetViolation["reason"]) => void; undoViolation: (id: string) => void;
      completeElapsed: () => void; completeAssessment: (values: typeof answers) => void;
      retry: () => void; continueAfterSave: () => void; continueToCompletion: () => void; close: () => void;
    };
  };
  const useFeature = module.exports.useResetFeature as (mode: ResetRouteInput["mode"]) => Feature;
  const render = () => hooks.render(() => useFeature(mode));
  const tick = (at: string) => { displayTime = Date.parse(at); for (const callback of timers.values()) callback(); };
  const receipt = async (index: number) => { h.attempts[index]!.succeed(); await flush(); };
  const assertNavigation = (index: number, expected: unknown, message: string) =>
    equal(JSON.parse(JSON.stringify(navigation[index])), expected, message);
  let feature = render();
  render();
  hooks.reattachEffects();
  tick(shift(startedAt, 1000));
  feature = render();
  assert(feature.locked && feature.view.kind === "unavailable" && feature.saveState === "loading",
    "Unhydrated Reset must hide default/cached facts and keep controls locked.");
  hydrationStatus = "error";
  feature = render();
  assert(feature.locked && feature.view.kind === "unavailable" && feature.saveState === "unavailable",
    "Hydration failure must remain unavailable rather than be presented as a new Reset opportunity.");
  hasHydrated = true;
  hydrationStatus = "ready";
  feature = render();
  assert(feature.view.kind === "baseline" && feature.saveState === "saved" && !feature.locked,
    "The valid canonical baseline route must appear once hydration is ready.");
  equal(h.counts(), { clockCalls: 0, idCalls: 0, mutationCalls: 0 }, "Mount, hydration changes, effect reattachment, and display ticks must never start Reset.");
  assert(h.attempts.length === 0 && navigation.length === 0, "No route may auto-submit or navigate simply from rendered Reset state.");

  feature.actions.startFromBaseline(selfReport);
  feature.actions.startFromBaseline(selfReport);
  feature = render();
  const active = h.runtime.getState().resetJourney;
  assert(active.status === "active" && feature.view.kind === "mismatch" && feature.busy &&
    feature.recoveryTarget === "progress" && !feature.canContinue && feature.saveState === "saving",
  "Accepted baseline must preserve pending recovery UI while the old baseline URL no longer matches active state.");
  feature.actions.close();
  feature.actions.continueAfterSave();
  assert(navigation.length === 0 && h.counts().mutationCalls === 1, "Duplicate baseline submits must be one command without premature navigation.");
  h.attempts[0]!.fail();
  await flush();
  feature = render();
  assert(feature.locked && feature.canRetry && feature.saveState === "unconfirmed" && !feature.canContinue,
    "Accepted unsaved baseline must retain retry instead of replaying its start or allowing continuation.");
  const baselineCounts = h.counts();
  feature.actions.retry();
  feature.actions.retry();
  await receipt(1);
  feature = render();
  equal(h.counts(), baselineCounts, "Actual hook baseline retry must not regenerate baseline/attempt identities or time facts.");
  assertNavigation(0, { intent: { flow: "resetProgress", journeyId: active.id, attemptId: active.currentAttempt.id,
    progress: getResetProgress(active, new Date(displayTime).toISOString()) }, mode: "replace" },
  "Only durable baseline success may navigate to the newly accepted current attempt.");

  mode = "progress";
  params = { journeyId: active.id, attemptId: active.currentAttempt.id };
  feature = render();
  const oldProgress = feature.actions;
  const occurredAt = shift(startedAt, 2 * day + 1000);
  h.setTime(occurredAt);
  tick(occurredAt);
  feature = render();
  feature.actions.recordViolation("intentionalExplicitContent");
  feature.actions.recordViolation("intentionalExplicitContent");
  feature = render();
  const restarted = h.runtime.getState().resetJourney;
  assert(restarted.status === "active" && restarted.currentAttempt.id !== active.currentAttempt.id &&
    feature.view.kind === "mismatch" && feature.recoveryTarget === "progress" && feature.busy && !feature.canContinue,
  "A restart must preserve acknowledgement/recovery UI while the stale URL retains its old attempt ID.");
  assert(Number(navigation.length) === 1 && h.counts().mutationCalls === 2 && h.runtime.getState().contentFree.violations.length > 0,
    "Manual confirmation must issue one atomic Reset command and no navigation to unsaved replacement work.");
  h.attempts[2]!.fail();
  await flush();
  feature = render();
  assert(feature.canRetry && feature.locked && feature.recoveryTarget === "progress",
    "A failed restart must preserve its recovery target instead of treating the old URL as the new attempt.");
  const restartCounts = h.counts();
  feature.actions.retry();
  feature.actions.retry();
  await receipt(3);
  equal(h.counts(), restartCounts, "Hook restart retry must persist the same event/attempt without another logical restart.");
  assertNavigation(1, { intent: { flow: "resetProgress", journeyId: restarted.id, attemptId: restarted.currentAttempt.id,
    progress: getResetProgress(restarted, occurredAt) }, mode: "replace" },
  "Durable restart retry must replace the route with the new canonical attempt ID.");
  oldProgress.close();
  assert(Number(navigation.length) === 2, "A retained same-controller Close must reject changed accepted Reset identity even after its save settles.");
  params = { journeyId: restarted.id, attemptId: restarted.currentAttempt.id };
  feature = render();
  oldProgress.recordViolation("masturbation");
  oldProgress.continueAfterSave();
  oldProgress.close();
  equal(h.counts(), restartCounts, "Handlers retained from the older attempt/controller must not issue another command.");
  assert(Number(navigation.length) === 2, "Old attempt/controller handlers must not navigate over the current route.");

  const target = getLatestResetUndoCandidate(restarted);
  assert(target !== null, "Latest active violation required for hook undo.");
  h.setTime(shift(occurredAt, 1000));
  tick(shift(occurredAt, 1000));
  feature = render();
  feature.actions.undoViolation(target.id);
  feature.actions.undoViolation(target.id);
  feature = render();
  const restored = h.runtime.getState().resetJourney;
  assert(restored.status === "active" && restored.currentAttempt.id === active.currentAttempt.id && feature.busy &&
    feature.recoveryTarget === "progress" && Number(navigation.length) === 2,
  "Accepted undo must retain receipt UI and avoid navigating before the restored attempt is saved.");
  await receipt(4);
  assertNavigation(2, { intent: { flow: "resetProgress", journeyId: restored.id, attemptId: restored.currentAttempt.id,
    progress: getResetProgress(restored, new Date(displayTime).toISOString()) }, mode: "replace" },
  "Durable undo must navigate using the canonical restored attempt ID.");
  params = { journeyId: restored.id, attemptId: restored.currentAttempt.id };
  feature = render();
  assert(feature.view.kind === "active" && feature.view.undoCandidateId === null,
    "A tombstoned violation must disappear from actionable undo candidates after canonical undo.");

  // Keep old handlers actionable by identity and state while changing only the
  // controller/mode, so this specifically exercises stale-instance guards.
  const retained = feature.actions;
  mode = "completion";
  render();
  const guardedCounts = h.counts();
  retained.recordViolation("masturbation");
  retained.close();
  equal(h.counts(), guardedCounts, "A valid old progress callback must still be blocked after its controller is replaced.");
  assert(Number(navigation.length) === 3, "Stale controller Close must not navigate away from the new route.");
  mode = "progress";
  feature = render();
  hooks.unmount();
  feature.actions.recordViolation("masturbation");
  feature.actions.undoViolation(target.id);
  feature.actions.close();
  equal(h.counts(), guardedCounts, "Unmounted feature callbacks must not mutate or prepare facts.");
  assert(Number(navigation.length) === 3, "Unmounted callbacks must not navigate.");
  hooks.reattachEffects();
  feature = render();

  const boundary = shift(restored.currentAttempt.startedAt, 15 * day);
  const beforeTicks = h.runtime.getState();
  tick(shift(boundary, -1));
  feature = render();
  assert(feature.view.kind === "active" && !feature.canOpenCompletion && feature.view.restriction.isRestrictionActive,
    "The final millisecond before Day 15 completion must remain correctly restricted.");
  tick(boundary);
  feature = render();
  assert(feature.view.kind === "active" && feature.view.progress.isPeriodComplete && !feature.view.restriction.isRestrictionActive &&
    feature.canOpenCompletion && h.runtime.getState() === beforeTicks && Number(navigation.length) === 3,
  "The exact boundary must end displayed restriction without a timer mutation or automatic navigation.");
  equal(h.counts(), guardedCounts, "Progress ticks through the boundary must never persist calculated day/time counters.");
  const continueAtBoundary = feature.actions.continueToCompletion;
  displayTime = Date.parse(shift(boundary, -1));
  continueAtBoundary();
  assert(Number(navigation.length) === 3, "A retained Continue must recheck the live selector if the display clock moves before the boundary.");
  displayTime = Date.parse(boundary);
  continueAtBoundary();
  assertNavigation(3, { intent: { flow: "resetCompletion", journeyId: restored.id, attemptId: restored.currentAttempt.id,
    progress: getResetProgress(restored, boundary) }, mode: "replace" },
  "Explicit Continue must navigate to completion using canonical attempt identity and selector progress.");

  mode = "completion";
  feature = render();
  render();
  assert(h.runtime.getState() === beforeTicks, "Mounting the elapsed completion route must not automatically execute its write.");
  h.setTime(shift(boundary, 12345));
  feature.actions.completeElapsed();
  feature.actions.completeElapsed();
  feature = render();
  const pending = h.runtime.getState().resetJourney;
  assert(pending.status === "assessment_pending" && pending.completedAt === boundary && feature.busy &&
    feature.recoveryTarget === "assessment" && Number(navigation.length) === 4,
  "Explicit completion must retain the domain boundary and wait before opening assessment.");
  await receipt(5);
  assertNavigation(4, { intent: { flow: "resetAssessment", journeyId: pending.id, attemptId: pending.currentAttempt.id }, mode: "replace" },
    "Durable elapsed completion must navigate to the canonical assessment route.");

  mode = "assessment";
  params = { journeyId: pending.id, attemptId: pending.currentAttempt.id };
  feature = render();
  assert(feature.view.kind === "assessment", "Validated assessment route must expose the canonical pending baseline references.");
  h.setTime(shift(boundary, 20000));
  feature.actions.completeAssessment(answers);
  feature.actions.completeAssessment(answers);
  feature = render();
  assert(h.runtime.getState().resetJourney.status === "completed" && h.runtime.getState().masturbationTracking.enabled &&
    feature.busy && feature.recoveryTarget === "today" && Number(navigation.length) === 5,
  "Accepted notReady assessment must preserve pending-save UI and must not navigate to Today yet.");
  await receipt(6);
  assertNavigation(5, { path: "/existing-today" }, "Only durable assessment completion may return to the existing Today route.");
  await roundTrip(h.runtime.getState());
  hooks.unmount();
}

function verifySourceAndForms() {
  const directory = "src/features/reset/";
  const screen = readFileSync(`${directory}screens/ResetProductScreen.tsx`, "utf8");
  const hook = readFileSync(`${directory}useResetFeature.ts`, "utf8");
  const controller = readFileSync(`${directory}resetController.ts`, "utf8");
  const view = readFileSync(`${directory}resetView.ts`, "utf8");
  for (const source of [screen, hook, controller, view]) {
    assert(!/AsyncStorage|persistBloomLocalState|loadBloomLocalState|applyAcknowledgedMutation|bloomResetTransitions|getNextBloomAction/.test(source),
      "Reset feature modules must not directly access storage, transitions, or legacy journey routing.");
    assert(!/createBloomRecordId|Math\.random|createId\s*\(/.test(source), "Reset feature code must leave operation identity generation to the flow layer.");
  }
  assert(!/Date\.|new Date|useEffect|setInterval|averageIntervalSeconds|averageErectionQuality|explicitContentSessionRatio/.test(screen),
    "Reset screens must not create timestamps, mount writes, or ad-hoc baseline aggregates.");
  assert(!/flowActions\.contentFree|recordManualViolation|undoManualViolation|streakBefore|currentStreakStartedAt|masturbationTracking\.enabled\s*=/.test(screen + hook + controller),
    "One Reset command must own linked Content-Free effects and Tracking enablement without feature-level policy writes.");
  assert(hook.includes("getState: getAcceptedState") && hook.includes("useBloomProductFlowActions") &&
    view.includes("getResetProgress(reset, at)") && view.includes("getResetRestrictionStatus(reset, at)"),
  "Reset event handlers and progress must reuse the canonical provider getter, flow hook, and domain selectors.");
  assert(screen.includes("view.restriction.isRestrictionActive") && screen.includes("view.progress.isPeriodComplete") &&
    screen.includes("view.progress.remainingSeconds") && screen.includes("view.bestCompletedDays"),
  "Progress and restriction presentation must consume selector-derived facts, including live best progress.");
  assert(screen.includes("view.undoCandidateId === violation.id") && screen.includes("onUndo(violation.id)") &&
    screen.includes('violation.source.kind === "masturbationSession"') && screen.includes('violation.status === "undone"'),
  "History must preserve canonical source/status and expose only the exact candidate for Reset-owned undo.");
  for (const component of ["AppScreen", "AppCard", "AppText", "AppButton"]) {
    assert(screen.includes(`import { ${component} }`), `Reset must use shared ${component} UI.`);
  }
  const parsed = ts.createSourceFile("ResetProductScreen.tsx", screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const formNames = ["ResetBaselineForm", "ResetAssessmentForm", "ResetViolationForm", "ResetChoice"];
  const definitions = parsed.statements.flatMap((node) => {
    if (ts.isFunctionDeclaration(node) && formNames.includes(node.name?.text ?? "")) return [`export ${node.getText(parsed)}`];
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
      ["uncertainChoices", "violationReasons"].includes(declaration.name.getText(parsed)))) return [node.getText(parsed)];
    return [];
  }).join("\n");
  const compileForms = (hooks: ReturnType<typeof createControlledHooks>) => {
    const jsx = (type: unknown, props: Record<string, unknown>): FormElement =>
      typeof type === "function" ? (type as (props: Record<string, unknown>) => FormElement)(props) : { type, props };
    const module = { exports: {} as Record<string, (props: Record<string, unknown>) => FormElement> };
    const compiled = ts.transpileModule(definitions, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX
    } });
    runInNewContext(compiled.outputText, {
      module, exports: module.exports, useState: hooks.react.useState, useRef: hooks.react.useRef,
      View: "View", AppCard: "AppCard", AppText: "AppText", AppButton: "AppButton", styles: {},
      require: (name: string) => { assert(name === "react/jsx-runtime", "Isolated forms must only import JSX rendering."); return { jsx, jsxs: jsx, Fragment: "Fragment" }; }
    });
    return module.exports;
  };
  verifyAnswerForm("ResetBaselineForm", "baseline", {
    urgeIntensity: ["low", "medium", "high", "notSure", "preferNotToSay"],
    abilityToPause: ["difficult", "sometimesPossible", "manageable", "notSure", "preferNotToSay"],
    spontaneousOrMorningErections: ["often", "sometimes", "rarely", "notSure", "preferNotToSay"]
  }, selfReport, compileForms);
  verifyAnswerForm("ResetAssessmentForm", "assessment", {
    urgeIntensityChange: ["decreased", "same", "increased", "notSure", "preferNotToSay"],
    abilityToPauseChange: ["harder", "same", "easier", "notSure", "preferNotToSay"],
    spontaneousErectionChange: ["lessFrequent", "same", "moreFrequent", "notSure", "preferNotToSay"],
    overallSexualResponseChange: ["worse", "same", "better", "notSure", "preferNotToSay"],
    readinessToRestartTracking: ["ready", "notReady", "notSure"]
  }, answers, compileForms);

  const hooks = createControlledHooks();
  const forms = compileForms(hooks);
  const recorded: unknown[] = [];
  const render = (locked = false) => hooks.render(() => forms.ResetViolationForm!({ locked, onRecord: (reason: unknown) => recorded.push(reason) }));
  let tree = render();
  render();
  assert(recorded.length === 0, "Rendering a Reset violation form must never restart the attempt.");
  for (const reason of ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"]) {
    pressForm(tree, "bloom.reset.violation.open");
    tree = render();
    const choices = findFormElements(tree).filter((element) => String(element.props.testID).startsWith("bloom.reset.violation.reason."));
    equal(choices.map((element) => String(element.props.testID).split(".").pop()),
      ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"],
      "Violation confirmation must expose exactly the three existing reasons.");
    assert(choices.every((element) => (element.props.accessibilityState as { checked: boolean }).checked === false),
      "Each newly opened confirmation must require a fresh explicit reason choice.");
    const before: number = recorded.length;
    pressForm(tree, "bloom.reset.violation.confirm");
    assert(recorded.length === before, "A missing reason must never dispatch a violation.");
    pressForm(tree, `bloom.reset.violation.reason.${reason}`);
    tree = render();
    const repeat = pressForm(tree, "bloom.reset.violation.confirm");
    repeat();
    tree = render();
    repeat();
    assert(recorded.length === before + 1 && recorded[before] === reason,
      "One explicit confirmation must emit its exact reason once, including duplicate clicks before and after rerender.");
    pressForm(tree, "bloom.reset.violation.open");
    tree = render();
    pressForm(tree, `bloom.reset.violation.reason.${reason}`);
    tree = render();
    const canceled = formElement(tree, "bloom.reset.violation.confirm").props.onPress as () => void;
    pressForm(tree, "bloom.reset.violation.cancel");
    canceled();
    tree = render();
    assert(recorded.length === before + 1, "Cancel must consume a pending confirmation so retained handlers cannot restart Reset.");
  }
  pressForm(tree, "bloom.reset.violation.open");
  tree = render();
  pressForm(tree, "bloom.reset.violation.reason.masturbation");
  tree = render(true);
  assert(formElement(tree, "bloom.reset.violation.confirm").props.disabled === true,
    "Saving/locked state must disable the confirmation action.");
  pressForm(tree, "bloom.reset.violation.confirm");
  assert(Number(recorded.length) === 3, "Even direct invocation of a locked confirmation must not dispatch a restart.");
}

type FormElement = { type: unknown; props: Record<string, unknown> };
function findFormElements(node: unknown): FormElement[] {
  if (Array.isArray(node)) return node.flatMap(findFormElements);
  if (typeof node !== "object" || node === null || !("props" in node)) return [];
  const element = node as FormElement;
  return [element, ...findFormElements(element.props.children)];
}
function formElement(tree: FormElement, id: string) {
  const element = findFormElements(tree).find((node) => node.props.testID === id);
  assert(element !== undefined, `Expected form control ${id}.`);
  return element;
}
function pressForm(tree: FormElement, id: string) {
  const callback = formElement(tree, id).props.onPress;
  assert(typeof callback === "function", `Expected explicit callback on ${id}.`);
  (callback as () => void)();
  return callback as () => void;
}
function verifyAnswerForm(
  name: string, prefix: string, options: Record<string, readonly string[]>, values: Record<string, string>,
  compileForms: (hooks: ReturnType<typeof createControlledHooks>) => Record<string, (props: Record<string, unknown>) => FormElement>
) {
  const hooks = createControlledHooks();
  const forms = compileForms(hooks);
  const submissions: unknown[] = [];
  const render = (locked = false) => hooks.render(() => forms[name]!({ locked, onSubmit: (answers: unknown) => submissions.push(answers) }));
  let tree = render();
  render();
  assert(submissions.length === 0, "Rendering a baseline/assessment form must never submit.");
  for (const [field, expected] of Object.entries(options)) {
    const choices = findFormElements(tree).filter((element) => String(element.props.testID).startsWith(`bloom.reset.${prefix}.${field}.`));
    equal(choices.map((element) => String(element.props.testID).split(".").pop()), expected,
      "Every self-report field must expose exactly its canonical domain values, including uncertainty/nonresponse.");
    assert(choices.every((element) => (element.props.accessibilityState as { checked: boolean }).checked === false),
      "Self-report choices must start unanswered rather than preselecting a derived/default answer.");
  }
  assert(formElement(tree, `bloom.reset.${prefix}.submit`).props.disabled === true,
    "The submit button must be disabled until every required answer is explicit.");
  pressForm(tree, `bloom.reset.${prefix}.submit`);
  assert(submissions.length === 0, "Direct incomplete submission must preserve an empty answer history.");
  for (const [field, value] of Object.entries(values)) {
    pressForm(tree, `bloom.reset.${prefix}.${field}.${value}`);
    tree = render();
  }
  assert(formElement(tree, `bloom.reset.${prefix}.submit`).props.disabled === false,
    "A complete descriptive answer set must be submittable, including notReady.");
  pressForm(tree, `bloom.reset.${prefix}.submit`);
  equal(JSON.parse(JSON.stringify(submissions)), [values], "Forms must submit only exact semantic answer fields, with no generated links, IDs, scores, or timestamps.");
  tree = render(true);
  pressForm(tree, `bloom.reset.${prefix}.submit`);
  assert(Number(submissions.length) === 1, "Locked baseline/assessment callbacks must never dispatch even if directly invoked.");
  if (prefix === "assessment") {
    for (const readiness of ["ready", "notSure"]) {
      tree = render();
      pressForm(tree, `bloom.reset.assessment.readinessToRestartTracking.${readiness}`);
      tree = render();
      assert(formElement(tree, "bloom.reset.assessment.submit").props.disabled === false,
        "Every readiness answer must preserve assessment eligibility without extending restriction.");
      pressForm(tree, "bloom.reset.assessment.submit");
    }
    equal(JSON.parse(JSON.stringify(submissions)), [values, { ...values, readinessToRestartTracking: "ready" }, { ...values, readinessToRestartTracking: "notSure" }],
      "Actual assessment form wiring must treat every readiness answer descriptively.");
  }
}

function createHarness(initialState = baselinePendingState()) {
  let at = startedAt;
  let route = routeFor(initialState.resetJourney);
  let clockCalls = 0;
  let idCalls = 0;
  let mutationCalls = 0;
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const persisted: Array<{ operation: string; reset: ResetJourney }> = [];
  const runtime = createBloomLocalStateMutationRuntime({
    initialState,
    initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({
        state,
        succeed: () => resolve({ status: "persisted", writeId, generation: 0 }),
        fail: () => reject(new Error("Synthetic Reset feature persistence failure."))
      });
    })
  });
  const productActions = createBloomProductAcknowledgedActions({
    applyAcknowledgedMutation: (mutation) => runtime.applyAcknowledgedMutation((state) => {
      mutationCalls++;
      return mutation(state);
    })
  });
  const flowActions = createBloomProductFlowActions({
    productActions,
    now: () => { clockCalls++; return new Date(at); },
    createId: (prefix) => { idCalls++; return `${prefix}-reset-feature-${idCalls}`; }
  });
  const makeController = () => createResetController({
    flowActions, getState: runtime.getState, getRoute: () => route, getDisplayTime: () => at,
    retryPersistedMutation: runtime.retryPersistence,
    onPersisted: (operation, reset) => persisted.push({ operation, reset })
  });
  return {
    initialState, runtime, flowActions, attempts, persisted, makeController, controller: makeController(),
    setRoute: (value: ResetRouteInput) => { route = value; },
    setTime: (value: string) => { at = value; },
    counts: () => ({ clockCalls, idCalls, mutationCalls })
  };
}

function routeFor(reset: ResetJourney, mode?: ResetRouteInput["mode"]): ResetRouteInput {
  return {
    mode: mode ?? (reset.status === "active" ? "progress" : reset.status === "assessment_pending" || reset.status === "completed" ? "assessment" : "baseline"),
    journeyId: "id" in reset ? reset.id : undefined,
    ...("currentAttempt" in reset ? { attemptId: reset.currentAttempt.id } : {})
  };
}

function baselinePendingState(): BloomLocalState {
  const state = createPopulatedState();
  state.resetJourney = { ...createDefaultBloomState().resetJourney, status: "baseline_pending", id: "feature-reset" };
  state.masturbationTracking = { ...state.masturbationTracking, enabled: false, currentSession: null };
  return state;
}

function assessmentPendingState(): BloomLocalState {
  const state = createPopulatedState();
  assert(state.resetJourney.status === "completed", "Finished Reset fixture required.");
  const { assessment: _assessment, ...finished } = state.resetJourney;
  state.resetJourney = { ...finished, status: "assessment_pending" };
  state.masturbationTracking = { ...state.masturbationTracking, enabled: false, currentSession: null };
  return state;
}

// Execute the actual feature hook/forms with controlled dependencies. This
// exercises their wiring, not React's renderer or reconciliation implementation.
function createControlledHooks() {
  const slots: unknown[] = [];
  let cursor = 0;
  const effects: Array<{ setup: () => void | (() => void); cleanup?: (() => void) | undefined }> = [];
  const pending: Array<() => void> = [];
  const same = (left: readonly unknown[], right: readonly unknown[]) => left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const react = {
    useRef: <T>(initial: T) => {
      const index = cursor++;
      if (slots[index] === undefined) slots[index] = { current: initial };
      return slots[index] as { current: T };
    },
    useState: <T>(initial: T | (() => T)) => {
      const index = cursor++;
      if (slots[index] === undefined) slots[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial };
      const cell = slots[index] as { value: T };
      return [cell.value, (value: T | ((previous: T) => T)) => {
        cell.value = typeof value === "function" ? (value as (previous: T) => T)(cell.value) : value;
      }] as const;
    },
    useMemo: <T>(create: () => T, dependencies: readonly unknown[]) => {
      const index = cursor++;
      const previous = slots[index] as { value: T; dependencies: readonly unknown[] } | undefined;
      if (previous === undefined || !same(previous.dependencies, dependencies)) slots[index] = { value: create(), dependencies: Array.from(dependencies) };
      return (slots[index] as { value: T }).value;
    },
    useEffect: (setup: () => void | (() => void), dependencies: readonly unknown[]) => {
      const index = cursor++;
      const previous = slots[index] as { dependencies: readonly unknown[]; cleanup?: () => void } | undefined;
      if (previous === undefined || !same(previous.dependencies, dependencies)) {
        const effect = { setup, dependencies: Array.from(dependencies), cleanup: undefined as (() => void) | undefined };
        slots[index] = effect;
        effects.push(effect);
        pending.push(() => { previous?.cleanup?.(); effect.cleanup = setup() ?? undefined; });
      }
    },
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => { cursor++; return getSnapshot(); }
  };
  return {
    react,
    render: <T>(render: () => T) => { cursor = 0; const result = render(); for (const effect of pending.splice(0)) effect(); return result; },
    reattachEffects: () => { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup() ?? undefined; } },
    unmount: () => { for (const effect of effects) effect.cleanup?.(); }
  };
}

async function roundTrip(state: BloomLocalState) {
  const storage = new FeatureStorage();
  const now = () => new Date("2026-12-31T12:00:00.000Z");
  await persistBloomLocalState(state, storage, now);
  const loaded = await loadBloomLocalState(storage, now);
  assert(loaded.status === "success" && loaded.source === "current", "Reset feature facts must load from current v7 storage.");
  equal(loaded.state, state, "Hydration must preserve Reset identity, baseline, history, and assessment without automatic lifecycle advancement.");
  return loaded.state;
}

function assertOtherReferences(before: BloomLocalState, after: BloomLocalState, changed: Array<keyof BloomLocalState>) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (!changed.includes(key)) assert(before[key] === after[key], `Reset feature must preserve unrelated ${key} by reference.`);
  }
}

function shift(at: string, milliseconds: number) { return new Date(Date.parse(at) + milliseconds).toISOString(); }
function flush() { return new Promise<void>((done) => setImmediate(done)); }
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
class FeatureStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
