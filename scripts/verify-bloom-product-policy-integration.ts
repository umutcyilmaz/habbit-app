import { isDeepStrictEqual } from "node:util";

import { getMasturbationTrackingAvailability } from "../src/domain/productPolicy/getMasturbationTrackingAvailability";
import { getResetRestrictionStatus } from "../src/domain/productPolicy/getResetRestrictionStatus";
import {
  recordActiveResetViolationState, recordManualContentFreeViolationState,
  startMasturbationSessionState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createActiveState } from "./verify-bloom-reset-violations";

const currentStart = "2026-09-07T12:00:00.000Z";
const boundary = "2026-09-22T12:00:00.000Z";
const beforeBoundary = "2026-09-22T11:59:59.999Z";
const afterBoundary = "2026-09-22T12:00:00.001Z";
const recordedAt = "2026-09-25T12:00:00.000Z";
const clock = () => new Date("2026-10-01T00:00:00.000Z");

export async function verifyBloomProductPolicyIntegration() {
  const state = restartedState();
  assert(state.resetJourney.status === "active" && state.resetJourney.currentAttempt.startedAt === currentStart,
    "Integration fixtures must include a real restart with a later current-attempt start.");
  const originalJourneyBoundary = "2026-09-16T12:00:00.000Z";
  assert(getResetRestrictionStatus(state.resetJourney, originalJourneyBoundary)?.isRestrictionActive === true,
    "The original journey reaching Day 15 cannot end a restarted current attempt's restriction.");
  assert(startMasturbationSessionState(state, { sessionId: "at-old-journey-boundary", startedAt: originalJourneyBoundary }) === state,
    "Session start must use the current attempt, not the original journey's elapsed duration.");
  assert(recordManualContentFreeViolationState(state, manualInput(originalJourneyBoundary)) === state,
    "Standalone Content-Free logging must still use the atomic Reset path while the replacement attempt is incomplete.");

  for (const [label, at, restricted] of [
    ["one millisecond before", beforeBoundary, true],
    ["exactly at", boundary, false],
    ["one millisecond after", afterBoundary, false]
  ] as const) {
    const before = JSON.stringify(state);
    const restriction = getResetRestrictionStatus(state.resetJourney, at);
    assert(restriction !== null && restriction.isRestrictionActive === restricted &&
      restriction.isElapsedPeriodComplete === !restricted && restriction.needsCompletionTransition === !restricted,
      `${label} Day 15: effective restriction must distinguish elapsed completion from persisted active status.`);
    const availability = getMasturbationTrackingAvailability(state, at);
    assert(availability !== null && availability.canStartSession === !restricted &&
      availability.blockReason === (restricted ? "resetRestriction" : null),
      `${label} Day 15: the capability selector must agree with session start policy.`);

    const started = startMasturbationSessionState(state, { sessionId: `boundary-session-${label}`, startedAt: at });
    if (restricted) {
      assert(started === state, "Even the last millisecond of the effective restriction must block a new session.");
    } else {
      assert(started !== state && started.masturbationTracking.currentSession?.status === "active" &&
        started.masturbationTracking.currentSession.startedAt === at,
        "An enabled tracker may start at the supplied event time once the real restriction has ended.");
      assertOnlySliceChanged(state, started, "masturbationTracking");
      assert(startMasturbationSessionState(started, { sessionId: "second-unfinished-session", startedAt: recordedAt }) === started,
        "Elapsed Reset completion must not bypass the existing one-unfinished-session rule.");
      await roundTrip(started, `${label} boundary session`);
    }

    const manual = recordManualContentFreeViolationState(state, manualInput(at));
    if (restricted) {
      assert(manual === state, "A pre-boundary occurrence logged after Day 15 still belongs to the atomic Reset violation path.");
    } else {
      assert(manual !== state && manual.contentFree.status === "active" && manual.contentFree.currentStreakStartedAt === at,
        "Standalone CF logging may proceed at/after the boundary despite persisted active Reset.");
      const violation = manual.contentFree.violations[manual.contentFree.violations.length - 1];
      assert(violation?.occurredAt === at && violation.recordedAt === recordedAt &&
        violation.source.kind === "manual" && violation.source.logActionId === "boundary-manual-source",
        "Standalone CF must retain occurrence time separately from its later logging time.");
      assertOnlySliceChanged(state, manual, "contentFree");
      await roundTrip(manual, `${label} boundary Content-Free event`);
    }

    const atomic = recordActiveResetViolationState(state, {
      violationId: "boundary-reset-violation", replacementAttemptId: "boundary-next-attempt",
      occurredAt: at, recordedAt, source: { kind: "manual", logActionId: "boundary-atomic-source" },
      reason: "intentionalExplicitContent", contentFreeViolationId: "boundary-atomic-content"
    });
    assert(restricted ? atomic !== state : atomic === state,
      `${label} Day 15: the existing atomic Reset violation boundary must remain unchanged.`);
    assert(JSON.stringify(state) === before, "Policy reads and transition attempts must not mutate their original Reset/history state.");
  }

  const disabled = { ...state, masturbationTracking: { ...state.masturbationTracking, enabled: false } };
  for (const at of [boundary, afterBoundary, recordedAt]) {
    const availability = getMasturbationTrackingAvailability(disabled, at);
    assert(availability?.blockReason === "trackingDisabled" && !availability.canStartSession,
      "The normal disabled onboarding path remains blocked after Day 15 by its permission flag, not Reset restriction.");
    assert(startMasturbationSessionState(disabled, { sessionId: "disabled-after-boundary", startedAt: at }) === disabled,
      "Elapsed completion cannot enable Tracking or bypass its disabled flag.");
  }
  const invalidClock = "2026-09-22T12:00:00Z";
  assert(startMasturbationSessionState(state, { sessionId: "invalid-time-session", startedAt: invalidClock }) === state,
    "An invalid event clock cannot be interpreted as an expired Reset restriction.");
  assert(recordManualContentFreeViolationState(state, manualInput(invalidClock)) === state,
    "Standalone CF must also reject an invalid restriction-evaluation timestamp.");

  assert(state.contentFree.status === "active", "Active Content-Free fixture required.");
  const laterStreak = { ...state, contentFree: { ...state.contentFree, currentStreakStartedAt: recordedAt } };
  assert(recordManualContentFreeViolationState(laterStreak, manualInput(boundary)) === laterStreak,
    "An expired Reset restriction must not bypass Content-Free's own backdated-streak safety guard.");
  console.log("Bloom product-policy integration verification passed (current-attempt Day-15 ±1ms boundaries, event-time routing, unchanged Reset, and v7 round trips).");
}

function restartedState(): BloomLocalState {
  const initial = createActiveState(false, true);
  const restarted = recordActiveResetViolationState(initial, {
    violationId: "policy-fixture-restart", replacementAttemptId: "policy-current-attempt",
    occurredAt: currentStart, recordedAt: "2026-09-07T12:01:00.000Z",
    source: { kind: "manual", logActionId: "policy-fixture-source" }, reason: "masturbation"
  });
  assert(restarted !== initial && restarted.resetJourney.status === "active" &&
    restarted.resetJourney.startedAt !== restarted.resetJourney.currentAttempt.startedAt,
    "An actual violation transition must create the restarted fixture without modifying journey start.");
  const state = { ...restarted, masturbationTracking: { ...restarted.masturbationTracking, enabled: true } };
  assert(validateAndNormalizeBloomState(state).success, "The enabled Tracking plus active restarted Reset fixture must be valid canonical state.");
  return state;
}

function manualInput(occurredAt: string) {
  return { violationId: "boundary-content-violation", logActionId: "boundary-manual-source", occurredAt, recordedAt };
}

function assertOnlySliceChanged(before: BloomLocalState, after: BloomLocalState, changed: "masturbationTracking" | "contentFree") {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (key !== changed) assert(after[key] === before[key], `Adopting effective restriction policy must preserve ${key} by reference.`);
  }
  assert(after.resetJourney.status === "active", "An allowed post-boundary action must not auto-advance Reset lifecycle.");
}

async function roundTrip(state: BloomLocalState, label: string) {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Product policy must retain persistence v7.");
  assert(validateAndNormalizeBloomState(state).success, `${label}: policy-produced state must remain persistable.`);
  const storage = createMemoryStorageClient();
  await persistBloomLocalState(state, storage, clock);
  const loaded = await loadBloomLocalState(storage, clock);
  assert(loaded.status === "success" && loaded.source === "current" && loaded.state.resetJourney.status === "active",
    `${label}: late hydration must preserve the pending explicit completion transition.`);
  assert(isDeepStrictEqual(loaded.state, state), `${label}: persisted snapshots must contain only state, never derived policy fields.`);
}

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
