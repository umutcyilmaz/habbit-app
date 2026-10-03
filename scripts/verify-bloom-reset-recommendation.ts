import { isDeepStrictEqual } from "node:util";
import type { ErectionQuality, MasturbationEndingReason } from "../src/domain/models/MasturbationSession";
import type { CompletedMasturbationSession, MasturbationTrackingState } from "../src/domain/models/MasturbationTrackingState";
import {
  getTrackingResetRecommendation,
  type TrackingResetRecommendation,
  type TrackingResetRecommendationSignal
} from "../src/domain/reset/getTrackingResetRecommendation";
import { createDefaultBloomState, editCompletedMasturbationSessionFeedbackState } from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";

const at = "2026-10-03T12:00:00.000Z";
const origin = Date.parse("2026-01-01T12:00:00.000Z");
const trend: TrackingResetRecommendationSignal = "erectionQualityDownwardTrend";
const firmness: TrackingResetRecommendationSignal = "repeatedFirmnessDecrease";
const explicit: TrackingResetRecommendationSignal = "recentExplicitContentPattern";
type Analysis = Exclude<TrackingResetRecommendation, { status: "insufficientData" }>;

export function verifyBloomResetRecommendation() {
  verifyEligibility();
  verifyWindowsAndOrdering();
  verifyQualityThreshold();
  verifyFirmnessAndContext();
  verifyRecommendationCombinations();
  verifyIntervalIsolation();
  verifyPurityAndCorrections();
  verifyInvalidInputs();
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "The derived recommendation must retain v7 persistence.");
  console.log("Bloom Tracking Reset recommendation verification passed (latest-six windows, 784 integer-mean boundaries, unrounded evidence, all signal combinations, interval isolation, chronological ties, cutoffs/current exclusions, canonical corrections, immutable reads, and malformed input).");
}

function verifyEligibility() {
  for (const count of [0, 1, 5]) {
    equal(getTrackingResetRecommendation(tracking(history().slice(0, count)), at), {
      status: "insufficientData", eligibleSessionCount: count, requiredSessionCount: 6
    }, "Fewer than six observations must return only the insufficient-data contract.");
  }
  const sessions = history();
  const last = sessions[5]!;
  const cutoff = last.endedAt;
  const beforeCutoff = new Date(Date.parse(cutoff) - 1).toISOString();
  equal(getTrackingResetRecommendation(tracking(sessions), beforeCutoff), {
    status: "insufficientData", eligibleSessionCount: 5, requiredSessionCount: 6
  }, "A sixth future-ended session cannot fill the minimum even when it has already started.");
  assert(analyze(sessions, cutoff).eligibleSessionCount === 6, "A completed session ending exactly at the cutoff must count.");

  const five = sessions.slice(0, 5);
  const expected = getTrackingResetRecommendation(tracking(five), at);
  for (const status of ["active", "awaiting_feedback"] as const) {
    const currentSession = { ...last, status } as MasturbationTrackingState["currentSession"];
    equal(getTrackingResetRecommendation({ ...tracking(five), currentSession }, at), expected,
      "Neither current lifecycle can contribute, even with all feedback and timestamps present.");
    equal(getTrackingResetRecommendation(tracking([...five, currentSession] as CompletedMasturbationSession[]), at), expected,
      "Noncompleted entries in historical input must not satisfy eligibility either.");
  }
  equal(getTrackingResetRecommendation({ ...tracking(sessions), enabled: false }, at), analyze(sessions),
    "Tracking preference must not change historical recommendation evidence.");
}

function verifyWindowsAndOrdering() {
  const sessions = history({ qualities: [8, 8, 8, 6, 6, 7], previousExplicit: 1, recentExplicit: 2, previousFirmness: 1, recentFirmness: 2 });
  const expected = {
    status: "recommended", eligibleSessionCount: 6, windowSize: 3,
    evidence: {
      previousAverageErectionQuality: 8, recentAverageErectionQuality: 19 / 3,
      previousFirmnessDecreaseCount: 1, recentFirmnessDecreaseCount: 2,
      previousExplicitContentRatio: 1 / 3, recentExplicitContentRatio: 2 / 3,
      recentAverageIntervalSeconds: 86400
    },
    signals: [trend, firmness, explicit]
  };
  equal(analyze(sessions), expected, "Six sessions must use preceding three versus latest three with exact unrounded evidence.");
  const older = [
    session("old-a", origin - 2 * 86400000, 1, true, "firmnessDecreased"),
    session("old-b", origin - 86400000, 10, false, "other")
  ];
  const future = session("future-ended", origin + 7 * 86400000, 1, true, "firmnessDecreased");
  future.endedAt = "2026-10-03T12:00:00.001Z";
  const larger = [...older, ...sessions, future];
  const latestExpected = { ...expected, eligibleSessionCount: 8 };
  for (const order of permutations(larger)) {
    equal(analyze(order), latestExpected, "Exclude future ends before latest-six selection; older sessions affect only total count and input order never affects facts.");
  }
  const tied = Array.from({ length: 7 }, (_, index) => session(
    `tie-${index}`, origin, index < 4 ? 8 : 7, index >= 4, "climaxed"
  ));
  for (const order of permutations(tied)) {
    equal(analyze(order), {
      ...expected, eligibleSessionCount: 7,
      evidence: {
        previousAverageErectionQuality: 8, recentAverageErectionQuality: 7,
        previousFirmnessDecreaseCount: 0, recentFirmnessDecreaseCount: 0,
        previousExplicitContentRatio: 0, recentExplicitContentRatio: 1,
        recentAverageIntervalSeconds: 0
      }, signals: [trend, explicit]
    }, "Identical starts must use deterministic ID order at both the latest-six and window split boundaries; observed zero stays zero.");
  }
  const startOrdered = sessions.map((entry) => ({ ...entry }));
  startOrdered[0]!.endedAt = at;
  equal(analyze(startOrdered), expected, "Start chronology, not end chronology or record insertion order, must determine windows.");
}

function verifyQualityThreshold() {
  // Canonical stored feedback is integer-valued. Synthetic fractional fixtures
  // additionally exercise the requested 7.01 boundary without changing that schema.
  for (const [previous, recent, present] of [
    [8, 7, true], [8, 7.01, false], [8, 7.000000001, false], [7, 7, false], [6, 7, false]
  ] as const) {
    const result = analyze(history({ qualities: [previous, previous, previous, recent, recent, recent] }));
    assert(result.signals.includes(trend) === present, "A full one-point decline counts; subthreshold, equal, or improved means must not be rounded into a signal.");
    assert(result.evidence.recentAverageErectionQuality === (recent + recent + recent) / 3, "Returned averages must preserve raw arithmetic precision.");
  }
  for (let previousTotal = 3; previousTotal <= 30; previousTotal++) {
    for (let recentTotal = 3; recentTotal <= 30; recentTotal++) {
      const result = analyze(history({ qualities: [...qualitiesForTotal(previousTotal), ...qualitiesForTotal(recentTotal)], recentExplicit: 2 }));
      assert(result.signals.includes(trend) === (previousTotal - recentTotal >= 3),
        `Exact mean boundaries must survive binary division (totals ${previousTotal}, ${recentTotal}).`);
      assert(result.evidence.previousAverageErectionQuality === previousTotal / 3 && result.evidence.recentAverageErectionQuality === recentTotal / 3,
        "All possible canonical three-session means must remain unrounded.");
    }
  }
}

function verifyFirmnessAndContext() {
  for (const [previousFirmness, recentFirmness, present] of [[0, 2, true], [1, 2, true], [2, 2, false], [0, 1, false], [2, 3, true], [3, 3, false]] as const) {
    const result = analyze(history({ previousFirmness, recentFirmness }));
    assert(result.signals.includes(firmness) === present, "Firmness requires at least two recent endings and strictly more than the prior window.");
    assert(result.evidence.previousFirmnessDecreaseCount === previousFirmness && result.evidence.recentFirmnessDecreaseCount === recentFirmness,
      "Both firmness counts must be descriptive exact counts.");
  }
  for (const previousExplicit of [0, 1, 2, 3]) {
    for (const recentExplicit of [0, 1, 2, 3]) {
      const result = analyze(history({ previousExplicit, recentExplicit, qualities: [8, 8, 8, 7, 7, 7] }));
      assert(result.signals.includes(explicit) === (recentExplicit >= 2), "Recent explicit use needs two of three; previous use cannot require or block it.");
      assert((result.status === "recommended") === (recentExplicit >= 2), "Previous explicit ratio must not influence the final rule.");
      assert(result.evidence.previousExplicitContentRatio === previousExplicit / 3 && result.evidence.recentExplicitContentRatio === recentExplicit / 3,
        "Ratios must preserve zero, thirds, and one without rounding.");
    }
  }
  for (const endingReason of ["climaxed", "stoppedBeforeClimax", "feltAnxious", "stoppedByChoice", "other"] as const) {
    const result = analyze(history({ recentExplicit: 3 }).map((entry) => ({ ...entry, endingReason })));
    equal(result.signals, [explicit], "Other ending reasons must not independently create a response signal.");
    assert(result.status === "noCurrentRecommendation", "Other endings plus context alone must not recommend Reset.");
  }
}

function verifyRecommendationCombinations() {
  for (const hasTrend of [false, true]) {
    for (const hasFirmness of [false, true]) {
      for (const hasExplicit of [false, true]) {
        const result = analyze(history({
          qualities: [8, 8, 8, hasTrend ? 7 : 8, hasTrend ? 7 : 8, hasTrend ? 7 : 8],
          recentFirmness: hasFirmness ? 2 : 0, recentExplicit: hasExplicit ? 2 : 0
        }));
        equal(result.signals, [...(hasTrend ? [trend] : []), ...(hasFirmness ? [firmness] : []), ...(hasExplicit ? [explicit] : [])],
          "Return every observed signal in stable semantic order, even when there is no recommendation.");
        assert(result.status === ((hasTrend || hasFirmness) && hasExplicit ? "recommended" : "noCurrentRecommendation"),
          "The only decision is at least one response signal AND the recent explicit-content pattern.");
      }
    }
  }
}

function verifyIntervalIsolation() {
  for (const recommended of [false, true]) {
    let expectedSignals: TrackingResetRecommendationSignal[] | undefined;
    for (const step of [1, 1000, 86400000, 30 * 86400000]) {
      const result = analyze(history({ step, qualities: recommended ? [8, 8, 8, 7, 7, 7] : [8, 8, 8, 8, 8, 8], recentExplicit: recommended ? 2 : 0 }));
      assert(result.status === (recommended ? "recommended" : "noCurrentRecommendation"), "Extremely short, moderate, or long intervals cannot change identical feedback decisions.");
      if (expectedSignals) equal(result.signals, expectedSignals, "Frequency must not create or remove any signal.");
      expectedSignals = result.signals;
      assert(result.evidence.recentAverageIntervalSeconds === step / 1000, "Intervals are start-to-start evidence only, including fractional seconds.");
    }
  }
  const uneven = history();
  uneven[3] = session("recent-a", origin + 3000, 8, false, "climaxed");
  uneven[4] = session("recent-b", origin + 4250, 8, false, "climaxed");
  uneven[5] = session("recent-c", origin + 7001, 8, false, "climaxed");
  // Keep the previous window before all three recent starts.
  for (let index = 0; index < 3; index++) uneven[index] = session(`previous-${index}`, origin + index * 1000, 8, false, "climaxed");
  assert(analyze(uneven).evidence.recentAverageIntervalSeconds === 2.0005, "Three recent starts produce exactly two intervals; preserve millisecond precision and exclude the cross-window gap.");
}

function verifyPurityAndCorrections() {
  const state = createDefaultBloomState();
  state.masturbationTracking = tracking(history({ qualities: [8, 8, 8, 7, 7, 7], recentExplicit: 2 }));
  const validated = validateAndNormalizeBloomState(state);
  assert(validated.success, "Canonical fixtures must remain valid v7 state without recommendation fields.");
  equal(validated.state, state, "Validation must not materialize a recommendation.");
  const before = JSON.stringify(state);
  deepFreeze(state);
  const result = getTrackingResetRecommendation(state.masturbationTracking, at);
  assert(result?.status === "recommended", "Correction fixture must initially recommend.");
  equal(getTrackingResetRecommendation(state.masturbationTracking, at), result, "Frozen repeated reads must be deterministic.");
  const target = state.masturbationTracking.sessions[5]!;
  const corrected = editCompletedMasturbationSessionFeedbackState(state, {
    sessionId: target.id, editedAt: at,
    feedback: { erectionQuality: 10, usedExplicitContent: target.usedExplicitContent, endingReason: target.endingReason }
  });
  assert(corrected !== state, "Use the existing canonical feedback correction, not a recommendation mutation.");
  assert(getTrackingResetRecommendation(corrected.masturbationTracking, at)?.status === "noCurrentRecommendation", "A correction must naturally change derived recommendation without cached history or advice.");
  assert(JSON.stringify(state) === before && corrected.resetJourney === state.resetJourney && corrected.contentFree === state.contentFree,
    "Selector reads and quality correction preserve source state and unrelated lifecycle identity.");
  const isolated = { sessions: state.masturbationTracking.sessions };
  for (const key of ["enabled", "currentSession", "resetJourney", "contentFree", "onboarding", "urgeControl"]) {
    Object.defineProperty(isolated, key, { get() { throw new Error(`Unexpected dependency: ${key}`); } });
  }
  const originalNow = Date.now;
  const originalRandom = Math.random;
  try {
    Date.now = () => { throw new Error("Selector read a wall clock."); };
    Math.random = () => { throw new Error("Selector generated randomness."); };
    equal(getTrackingResetRecommendation(isolated as MasturbationTrackingState, at), result,
      "Only completed history and explicit time may be read; no wall clock, generated identity, preference, current session, or other product state.");
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
  result.signals.length = 0;
  assert(analyze(state.masturbationTracking.sessions).signals.length === 2, "Returned arrays cannot alias state or later results.");
}

function verifyInvalidInputs() {
  const valid = tracking(history());
  for (const invalidAt of ["", "bad", "2026-10-03", "2026-02-30T12:00:00.000Z", "2026-10-03T12:00:00Z", "2026-10-03T12:00:00.000+00:00", "2026-10-03T12:00:00.00Z", null, undefined, 0, {}, Symbol("time")]) {
    assert(getTrackingResetRecommendation(valid, invalidAt as string) === null, "Invalid or noncanonical observation time must return null without throwing.");
  }
  for (const malformed of [null, undefined, 0, "tracking", [], {}, { sessions: null }, { sessions: {} }, { sessions: [null] }, { sessions: [undefined] }, { sessions: [{}] }, { sessions: [1] }, { sessions: new Array(6) }]) {
    assert(getTrackingResetRecommendation(malformed as MasturbationTrackingState, at) === null, "Malformed containers/history must fail safely rather than fabricate evidence or throw.");
  }
  for (const patch of [
    { id: "" }, { id: " " }, { id: 3 }, { id: "session-1" },
    { startedAt: "bad" }, { startedAt: "2026-10-03T12:00:00.000Z" },
    { endedAt: "bad" }, { endedAt: "2025-01-01T12:00:00.000Z" },
    { erectionQuality: NaN }, { erectionQuality: Infinity }, { erectionQuality: undefined },
    { erectionQuality: "8" }, { erectionQuality: 0 }, { erectionQuality: 11 },
    { usedExplicitContent: undefined }, { usedExplicitContent: 1 },
    { endingReason: "unsupported" }, { endingReason: null }, { status: "unknown" }
  ]) {
    const sessions = history();
    sessions[0] = { ...sessions[0]!, ...patch } as CompletedMasturbationSession;
    assert(getTrackingResetRecommendation(tracking(sessions), at) === null, "Invalid observation facts, chronology, or duplicate identity must safely return null.");
  }
}

function history(options: { qualities?: number[]; previousFirmness?: number; recentFirmness?: number; previousExplicit?: number; recentExplicit?: number; step?: number } = {}): CompletedMasturbationSession[] {
  return Array.from({ length: 6 }, (_, index) => session(
    `session-${index}`, origin + index * (options.step ?? 86400000), options.qualities?.[index] ?? 8,
    index % 3 < ((index < 3 ? options.previousExplicit : options.recentExplicit) ?? 0),
    index % 3 < ((index < 3 ? options.previousFirmness : options.recentFirmness) ?? 0) ? "firmnessDecreased" : "climaxed"
  ));
}

function session(id: string, start: number, quality: number, usedExplicitContent: boolean, endingReason: MasturbationEndingReason): CompletedMasturbationSession {
  return { id, status: "completed", startedAt: new Date(start).toISOString(), endedAt: new Date(start + 1000).toISOString(),
    durationSeconds: 1, pauses: [], erectionQuality: quality as ErectionQuality, usedExplicitContent, endingReason };
}

function tracking(sessions: CompletedMasturbationSession[]): MasturbationTrackingState {
  return { enabled: true, currentSession: null, sessions };
}

function analyze(sessions: CompletedMasturbationSession[], cutoff = at): Analysis {
  const result = getTrackingResetRecommendation(tracking(sessions), cutoff);
  assert(result !== null && result.status !== "insufficientData", "Expected enough valid observations for analysis.");
  return result;
}

function qualitiesForTotal(total: number): number[] {
  const first = Math.min(10, total - 2);
  const second = Math.min(10, total - first - 1);
  return [first, second, total - first - second];
}

function permutations<T>(values: T[]): T[][] {
  return values.flatMap((_, index) => {
    const rotated = [...values.slice(index), ...values.slice(0, index)];
    return [rotated, [...rotated].reverse()];
  });
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  assert(isDeepStrictEqual(actual, expected), message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
