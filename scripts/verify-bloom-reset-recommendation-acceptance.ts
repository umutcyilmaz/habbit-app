import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import type { CompletedMasturbationSession } from "../src/domain/models/MasturbationTrackingState";
import { getTrackingResetRecommendation } from "../src/domain/reset/getTrackingResetRecommendation";
import {
  acceptResetRecommendationState,
  createDefaultBloomState,
  editCompletedMasturbationSessionFeedbackState,
  endMasturbationSessionState,
  startMasturbationSessionState,
  startResetFromBaselineState,
  type AcceptResetRecommendationInput,
  type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const at = "2026-11-01T12:00:00.123Z";
const input: AcceptResetRecommendationInput = { resetJourneyId: "accepted-tracking-reset", acceptedAt: at };

export async function verifyBloomResetRecommendationAcceptance() {
  verifyAcceptancePreservation();
  verifyRevalidation();
  verifyRejections();
  await verifyPersistenceCompatibility();
  verifyIsolation();
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7",
    "Explicit acceptance must retain the existing v7 persistence contract.");
  console.log("Bloom Reset recommendation acceptance verification passed (derived revalidation, persisted recommendation identity, exact no-ops, history/reference isolation, Tracking and Content-Free preservation, baseline-only preparation, and v7 roundtrip).");
}

// Includes populated legacy/product slices and Reset history so preservation
// tests cannot pass merely because every unrelated value is empty.
export function createTrackingResetRecommendationState(): BloomLocalState {
  const state = createPopulatedState();
  const reset = state.resetJourney;
  state.resetJourney = {
    status: "inactive", durationDays: reset.durationDays, bestCompletedDays: reset.bestCompletedDays,
    pastAttempts: reset.pastAttempts, violations: reset.violations
  };
  state.masturbationTracking = {
    enabled: true, currentSession: null,
    sessions: Array.from({ length: 6 }, (_, index): CompletedMasturbationSession => ({
      id: index === 0 ? "source-session" : `recommendation-observation-${index}`,
      status: "completed", startedAt: `2026-03-0${index + 1}T10:00:00.000Z`,
      endedAt: `2026-03-0${index + 1}T10:10:00.000Z`, durationSeconds: 600, pauses: [],
      erectionQuality: index < 3 ? 8 : 7, usedExplicitContent: index >= 3, endingReason: "climaxed"
    }))
  };
  const normalized = validateAndNormalizeBloomState(state);
  assert(normalized.success, `Recommendation acceptance fixture must be canonical: ${normalized.success ? "" : normalized.error}`);
  return normalized.state;
}

function verifyAcceptancePreservation() {
  for (const compatible of [false, true]) {
    for (const enabled of [false, true]) {
      for (const contentActive of [false, true]) {
        const state = createTrackingResetRecommendationState();
        state.masturbationTracking = { ...state.masturbationTracking, enabled,
          ...(compatible ? { sessions: [] } : {}) };
        if (!contentActive) state.contentFree = createDefaultBloomState().contentFree;
        if (compatible) state.resetJourney = { ...state.resetJourney, status: "recommended", id: "existing-reset-id" };
        const before = JSON.stringify(state);
        freeze(state);
        const result = acceptResetRecommendationState(state, Object.freeze({ ...input }));
        assert(result !== state && result.resetJourney.status === "baseline_pending",
          "Explicit acceptance must prepare the existing baseline_pending lifecycle for either recommendation source.");
        equal(result.resetJourney, {
          status: "baseline_pending", id: compatible ? "existing-reset-id" : input.resetJourneyId,
          durationDays: state.resetJourney.durationDays, bestCompletedDays: state.resetJourney.bestCompletedDays,
          pastAttempts: state.resetJourney.pastAttempts, violations: state.resetJourney.violations
        }, "Only the supported baseline_pending fields may be produced; no evidence, baseline, attempt, start, or acceptedAt is persisted.");
        assert(result.resetJourney.pastAttempts === state.resetJourney.pastAttempts &&
          result.resetJourney.violations === state.resetJourney.violations,
        "Historical Reset arrays must retain identity, including existing violations and completed-day summaries.");
        for (const key of Object.keys(state) as Array<keyof BloomLocalState>) {
          if (key !== "resetJourney") assert(result[key] === state[key],
            `${key}: recommendation acceptance must retain every current and legacy slice by reference.`);
        }
        assert(JSON.stringify(state) === before && validateAndNormalizeBloomState(result).success,
          "Acceptance must not mutate frozen input and must create an already-valid v7 Reset shape.");
        reject(result, input, "A second acceptance cannot replace a prepared journey.");

        const session = startMasturbationSessionState(result, { sessionId: "after-recommendation", startedAt: at });
        assert(enabled ? session !== result : session === result,
          "Baseline preparation must preserve the user's Tracking preference and cannot itself restrict enabled Tracking.");
        const started = startResetFromBaselineState(result, {
          resetBaselineId: "accepted-baseline", resetAttemptId: "accepted-attempt", capturedAt: at, startedAt: at,
          selfReport: { erectionDecline: "mild", needsStrongerOrFasterStimulation: "no", climaxTakesLonger: "notSure",
            difficultyArousingWithoutExplicitContent: "sometimes" }
        });
        assert(started !== result && started.resetJourney.status === "active" &&
          startMasturbationSessionState(started, { sessionId: "after-baseline", startedAt: at }) === started,
        "Only completing the existing required baseline starts the period and its effective session restriction.");
      }
    }
  }
}

function verifyRevalidation() {
  let corrected = createTrackingResetRecommendationState();
  assert(getTrackingResetRecommendation(corrected.masturbationTracking, at)?.status === "recommended",
    "Canonical history must first expose the recommendation before a feedback correction.");
  for (const session of corrected.masturbationTracking.sessions.slice(-3)) {
    corrected = editCompletedMasturbationSessionFeedbackState(corrected, {
      sessionId: session.id, feedback: { erectionQuality: 8, usedExplicitContent: true, endingReason: "climaxed" },
      editedAt: at, contentFreeViolationId: `unused-correction-${session.id}`
    });
  }
  assert(getTrackingResetRecommendation(corrected.masturbationTracking, at)?.status === "noCurrentRecommendation",
    "Actual canonical feedback corrections must remove the former quality signal.");
  reject(corrected, { ...input, acceptedAt: "2026-11-02T12:00:00.123Z" },
    "A rendered recommendation cannot authorize acceptance after current feedback removes the signal.");

  const state = createTrackingResetRecommendationState();
  const sixth = state.masturbationTracking.sessions[5]!;
  reject(state, { ...input, acceptedAt: new Date(Date.parse(sixth.endedAt) - 1).toISOString() },
    "Future-ended history at the acceptance timestamp cannot support the six-observation minimum.");
  assert(acceptResetRecommendationState(state, { ...input, acceptedAt: sixth.endedAt }) !== state,
    "An observation ending exactly at acceptedAt must remain eligible under the authoritative Phase 2A selector.");
  const removed = { ...state, masturbationTracking: { ...state.masturbationTracking, sessions: state.masturbationTracking.sessions.slice(0, 5) } };
  reject(removed, input, "Removing eligible history before submission must invalidate stale recommendation evidence.");
}

function verifyRejections() {
  const derived = createTrackingResetRecommendationState();
  const compatible: BloomLocalState = { ...derived, resetJourney: { ...derived.resetJourney, status: "recommended", id: "existing-reset-id" } };
  for (const state of [derived, compatible]) {
    for (const acceptedAt of [undefined, null, "", "bad", "2026-11-01", "2026-11-01T12:00:00Z", "2026-02-30T12:00:00.000Z", 0]) {
      reject(state, { ...input, acceptedAt }, "Malformed acceptedAt must exact-no-op for both sources.");
    }
    for (const resetJourneyId of [undefined, null, "", "  ", 0, {}, []]) {
      reject(state, { ...input, resetJourneyId }, "The candidate ID must be valid even when the historical journey ID would be reused.");
    }
    for (const malformed of [undefined, null, false, 7, "accept", [], {}, { acceptedAt: at }, { resetJourneyId: "id" },
      { ...input, recommendation: "recommended" }, { ...input, evidence: {} }, { ...input, signals: [] }]) {
      reject(state, malformed, "Malformed or extraneous prepared input must not supply recommendation authority.");
    }
    const active = startMasturbationSessionState(state, { sessionId: "unfinished", startedAt: at });
    assert(active !== state && active.masturbationTracking.currentSession?.status === "active", "Active-session fixture required.");
    reject(active, input, "An active session must block acceptance for both sources.");
    const feedback = endMasturbationSessionState(active, { endedAt: at });
    assert(feedback.masturbationTracking.currentSession?.status === "awaiting_feedback", "Awaiting-feedback fixture required.");
    reject(feedback, input, "Awaiting feedback must block acceptance for both sources.");
    const onboarding = createActiveState(false, false).productOnboarding;
    assert(onboarding.status === "completed", "Completed onboarding fixture required.");
    reject({ ...state, productOnboarding: { ...onboarding, planAcceptance: null } }, input,
      "An unresolved onboarding recommendation must take precedence over either Reset recommendation source.");
  }
  const prepared = acceptResetRecommendationState(derived, input);
  for (const resetJourney of [prepared.resetJourney, createActiveState(false, false).resetJourney, createPopulatedState().resetJourney]) {
    reject({ ...derived, resetJourney }, input, "Prepared, active, and completed Reset must not create another lifecycle.");
  }
  reject(createDefaultBloomState(), input, "Insufficient history must not prepare a journey.");
  const unchanged = { ...derived, masturbationTracking: { ...derived.masturbationTracking,
    sessions: derived.masturbationTracking.sessions.map((session) => ({ ...session, erectionQuality: 8 as const })) } };
  reject(unchanged, input, "Adequate history without the authoritative signal combination must not prepare Reset.");
  reject({ ...derived, resetJourney: { ...derived.resetJourney, durationDays: 14 } as never }, input,
    "Invalid source Reset facts must not be reconstructed into a valid-looking successor.");
  reject({ ...derived, masturbationTracking: { ...derived.masturbationTracking, enabled: "yes" } as never }, input,
    "Malformed Tracking input must fail safely without an unrelated preference change.");
}

async function verifyPersistenceCompatibility() {
  const source = createTrackingResetRecommendationState();
  const existing: BloomLocalState = { ...source, resetJourney: { ...source.resetJourney, status: "recommended", id: "historical-reset-id" } };
  for (const state of [existing, acceptResetRecommendationState(source, input), acceptResetRecommendationState(existing, input)]) {
    const normalized = validateAndNormalizeBloomState(state);
    assert(normalized.success, "The compatibility and accepted fixtures must be valid before storage.");
    assert(state === existing || !normalized.wasNormalized,
      "Both acceptance sources must directly produce canonical v7 successors without a normalization writeback.");
    const storage = createMemoryStorageClient();
    // Existing canonical persistence comparison includes key order. Normalize
    // constructed fixture order, as the product persistence suite does.
    await persistBloomLocalState(normalized.state, storage, () => new Date(at));
    const raw = await storage.getItem(BLOOM_STATE_STORAGE_KEY);
    assert(raw !== null, "The accepted or compatible Reset shape must use the existing storage key.");
    const envelope = JSON.parse(raw) as { version: number; state: BloomLocalState };
    assert(envelope.version === 7, "Recommendation acceptance must not introduce a new envelope version.");
    equal(envelope.state.resetJourney, state.resetJourney, "No recommendation evidence or other new facts may enter persistence.");
    const loaded = await loadBloomLocalState(storage, () => new Date(at));
    assert(loaded.status === "success" && loaded.source === "current" && !loaded.needsPersist,
      "Existing recommended and new baseline_pending must hydrate as current v7 without migration or writeback.");
    equal(loaded.state, state, "Roundtrip must preserve all existing legacy and product facts.");
  }
}

function verifyIsolation() {
  const source = readFileSync("src/storage/bloomResetRecommendationTransitions.ts", "utf8");
  assert(!/\b(?:Date\.now|new\s+Date|Math\.random|randomUUID|setTimeout|setInterval|AsyncStorage|router|navigate|persistBloomLocalState)\b/.test(source),
    "The acceptance transition must generate no facts or side effects.");
  assert(source.includes("getTrackingResetRecommendation(tracking, acceptedAt)"),
    "The transition must delegate authoritative acceptance-time recommendation evaluation to Phase 2A.");
}

function reject(state: BloomLocalState, prepared: unknown, message: string) {
  const before = JSON.stringify(state);
  assert(acceptResetRecommendationState(state, prepared as AcceptResetRecommendationInput) === state && JSON.stringify(state) === before, message);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
