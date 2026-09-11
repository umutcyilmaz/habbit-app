import { isDeepStrictEqual } from "node:util";

import type { ContentFreeState, MasturbationSessionFeedback, ResetJourney } from "../src/domain/models";
import {
  createDefaultBloomState, startMasturbationSessionState, startMasturbationPauseState,
  endMasturbationPauseState, endMasturbationSessionState, completeMasturbationSessionFeedbackState,
  discardActiveMasturbationSessionState, type BloomLocalState
} from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, BLOOM_CORRUPT_BACKUP_PREFIX, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const sessionId = "new-core-session";
const startedAt = "2026-10-01T10:00:00.250Z";
const pauseStart = "2026-10-01T10:01:00.750Z";
const pauseEnd = "2026-10-01T10:02:01.249Z";
const endedAt = "2026-10-01T10:10:00.999Z";
const recordedAt = "2026-10-01T10:15:00.000Z";
const now = () => new Date("2026-10-30T12:00:00.000Z");
const endingReasons = ["climaxed", "stoppedBeforeClimax", "firmnessDecreased", "feltAnxious", "stoppedByChoice", "other"] as const;
type Transition = (state: BloomLocalState, input: never) => BloomLocalState;

export async function verifyBloomMasturbationSessions() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Session lifecycle writes existing canonical shapes and must retain persistence v7.");
  await verifyStartAndPersistence();
  await verifyPauseAndPhysicalEnd();
  await verifyFeedbackAndContentFree();
  verifyFeedbackValuesAndUnrelatedPermissions();
  verifyContentFreeEventBoundaries();
  verifyDiscard();
  const rejected = verifyInvalidTransitions();
  const corrupt = await verifyMalformedStoredSessions();
  console.log(`Bloom Masturbation Session verification passed (${rejected} rejected transitions; ${corrupt} corrupt session/pause cases; optional pauses, feedback, Content-Free atomicity, and v7 round trips).`);
}

async function verifyStartAndPersistence() {
  for (const historical of [false, true]) {
    const state = createReadyState(historical, true);
    const before = JSON.stringify(state);
    const active = startMasturbationSessionState(state, { sessionId, startedAt });
    assert(active !== state, "Enabled tracking with no unfinished session must start one physical session.");
    equal(active.masturbationTracking.currentSession, { id: sessionId, status: "active", startedAt, pauses: [] }, "Active sessions must contain only supplied identity/time and an initially empty optional pause list.");
    assert(active.masturbationTracking.sessions === state.masturbationTracking.sessions, "Starting must preserve completed history by reference.");
    assertOtherReferences(state, active, false, "session start");
    assert(JSON.stringify(state) === before, "Session start must not mutate its source state.");
    equal(startMasturbationSessionState(state, { sessionId, startedAt }), active, "Explicit IDs/times must make start deterministic.");
    const reloaded = await assertRoundTrip(active, "active");
    equal(reloaded.masturbationTracking.currentSession, active.masturbationTracking.currentSession, "Loading weeks later must not add a ticking elapsed counter or automatically end a physical session.");
    assert(startMasturbationSessionState(reloaded, { sessionId: "second-session", startedAt: now().toISOString() }) === reloaded, "Persisted active sessions must block a second unfinished session after reload.");
  }
  const ready = createReadyState(false, false);
  assert(ready.productOnboarding.status === "notCompleted", "Permission fixture must have no product onboarding result.");
  assert(startMasturbationSessionState(ready, { sessionId, startedAt }) !== ready, "Tracking enabled is sufficient permission without directly requiring onboarding.");
  for (const reset of nonActiveResetStates()) {
    const state = { ...ready, resetJourney: reset };
    assert(startMasturbationSessionState(state, { sessionId, startedAt }) !== state, `${reset.status}: only active Reset blocks starting when tracking is enabled.`);
  }
}

async function verifyPauseAndPhysicalEnd() {
  const active = startSession(createReadyState(true, true));
  const activeBytes = JSON.stringify(active);
  const paused = startMasturbationPauseState(active, { startedAt: pauseStart });
  const pausedSession = paused.masturbationTracking.currentSession;
  assert(paused !== active && pausedSession?.status === "active", "An active physical session may begin an optional pause.");
  equal(pausedSession.pauses, [{ status: "active", startedAt: pauseStart }], "Active pauses must not store elapsed duration while running.");
  assert(startMasturbationPauseState(paused, { startedAt: pauseStart }) === paused, "A second simultaneous active pause must be rejected.");
  assert(JSON.stringify(active) === activeBytes, "Starting a pause must not mutate its source session.");
  assertOtherReferences(active, paused, false, "pause start");
  const persistedPause = await assertRoundTrip(paused, "active");
  equal(persistedPause.masturbationTracking.currentSession, pausedSession, "An active pause must survive reload without timer mutation.");
  const resumed = endMasturbationPauseState(paused, { endedAt: pauseEnd });
  const resumedSession = resumed.masturbationTracking.currentSession;
  assert(resumedSession?.status === "active", "Ending a pause must retain the active physical session.");
  equal(resumedSession.pauses, [{ status: "completed", startedAt: pauseStart, endedAt: pauseEnd, durationSeconds: 60 }], "Pause duration must floor 60.499 elapsed seconds to 60 whole seconds.");
  assert(resumedSession.startedAt === startedAt, "Ending a pause must not change the physical session start.");
  const secondPause = startMasturbationPauseState(resumed, { startedAt: pauseEnd });
  const secondResume = endMasturbationPauseState(secondPause, { endedAt: "2026-10-01T10:03:00.999Z" });
  const lastPause = startMasturbationPauseState(secondResume, { startedAt: "2026-10-01T10:05:00.500Z" });
  const awaiting = endMasturbationSessionState(lastPause, { endedAt });
  const ended = awaiting.masturbationTracking.currentSession;
  assert(ended?.status === "awaiting_feedback", "Ending the physical session must produce awaiting_feedback without completing history yet.");
  equal(ended, {
    id: sessionId, status: "awaiting_feedback", startedAt, endedAt, durationSeconds: 600,
    pauses: [
      { status: "completed", startedAt: pauseStart, endedAt: pauseEnd, durationSeconds: 60 },
      { status: "completed", startedAt: pauseEnd, endedAt: "2026-10-01T10:03:00.999Z", durationSeconds: 59 },
      { status: "completed", startedAt: "2026-10-01T10:05:00.500Z", endedAt, durationSeconds: 300 }
    ]
  }, "Physical duration must include all pauses; ending with an active pause closes it at the same session end time.");
  assert(awaiting.masturbationTracking.sessions === active.masturbationTracking.sessions, "Physical end must not append a completed history entry before feedback.");
  assertOtherReferences(lastPause, awaiting, false, "physical session end");
  const reloaded = await assertRoundTrip(awaiting, "awaiting_feedback");
  assert(startMasturbationSessionState(reloaded, { sessionId: "blocked-new-session", startedAt: recordedAt }) === reloaded, "Awaiting feedback must remain unfinished and block new sessions after reload.");
  assert(endMasturbationSessionState(reloaded, { endedAt: recordedAt }) === reloaded, "Repeated physical end must preserve the first end timestamp.");
  const noPauses = endMasturbationSessionState(active, { endedAt });
  assert(noPauses.masturbationTracking.currentSession?.status === "awaiting_feedback" && noPauses.masturbationTracking.currentSession.pauses.length === 0, "Zero pauses is a normal completed physical session.");
  assert(noPauses.masturbationTracking.currentSession.durationSeconds === 600, "Session duration is floor(end−start), independent of whether pauses occurred.");
  const zeroPause = endMasturbationPauseState(startMasturbationPauseState(active, { startedAt }), { endedAt: startedAt });
  assert(zeroPause.masturbationTracking.currentSession?.pauses[0]?.status === "completed" && zeroPause.masturbationTracking.currentSession.pauses[0].durationSeconds === 0, "Pause start/end equality must produce a valid zero-duration pause.");
  const zeroSession = endMasturbationSessionState(active, { endedAt: startedAt });
  assert(zeroSession.masturbationTracking.currentSession?.status === "awaiting_feedback" && zeroSession.masturbationTracking.currentSession.durationSeconds === 0, "Session start/end equality must produce a valid zero-duration physical event.");
}

async function verifyFeedbackAndContentFree() {
  for (const withPauses of [false, true]) {
    for (const usedExplicitContent of [false, true]) {
      for (const contentActive of [false, true]) {
        const awaiting = makeAwaiting(createReadyState(true, contentActive), withPauses);
        const session = awaiting.masturbationTracking.currentSession;
        assert(session?.status === "awaiting_feedback", "Feedback fixture required.");
        const feedback = createFeedback(usedExplicitContent);
        const input = { feedback, recordedAt, ...(usedExplicitContent && contentActive ? { contentFreeViolationId: "session-content-violation" } : {}) };
        const before = JSON.stringify(awaiting);
        const completed = completeMasturbationSessionFeedbackState(awaiting, input);
        assert(completed !== awaiting && completed.masturbationTracking.currentSession === null, "Valid full feedback must complete the session and clear the only unfinished session.");
        equal(completed.masturbationTracking.sessions, [...awaiting.masturbationTracking.sessions, { ...session, status: "completed", ...feedback }], "Feedback must append exactly one complete session using original physical identity, times, duration, and pauses.");
        assert(completed.masturbationTracking.sessions.slice(0, -1).every((entry, index) => entry === awaiting.masturbationTracking.sessions[index]), "Feedback must preserve all previous completed records and their insertion order by reference.");
        const final = last(completed.masturbationTracking.sessions);
        assert(final !== undefined && !("feedback" in final) && !("recordedAt" in final), "Completed feedback remains top-level and must not invent session fields from submission time.");
        equal(final.pauses, session.pauses, "Completing feedback must retain every completed optional pause.");
        const affectsContent = usedExplicitContent && contentActive;
        assertOtherReferences(awaiting, completed, affectsContent, "feedback completion");
        if (affectsContent) {
          const prior = awaiting.contentFree;
          assert(prior.status === "active" && completed.contentFree.status === "active", "Content-Free must remain active across a session-derived violation.");
          const elapsed = Math.floor((Date.parse(endedAt) - Date.parse(prior.currentStreakStartedAt)) / 1000);
          equal(completed.contentFree, {
            ...prior, currentStreakStartedAt: endedAt, bestStreakSeconds: Math.max(prior.bestStreakSeconds, elapsed),
            violations: [...prior.violations, {
              id: "session-content-violation", activationId: prior.activationId, kind: "intentionalExplicitContent", occurredAt: endedAt, recordedAt,
              source: { kind: "masturbationSession", sessionId }, status: "recorded",
              streakBefore: { currentStreakStartedAt: prior.currentStreakStartedAt, bestStreakSeconds: prior.bestStreakSeconds }
            }]
          }, "Explicit feedback must atomically append a session-source violation anchored at physical end, record submission time separately, and preserve the pre-event streak snapshot.");
          assert(completed.contentFree.pastActivations === prior.pastActivations, "A session-derived streak reset must not create or rewrite activation history.");
        } else assert(JSON.stringify(completed.contentFree) === JSON.stringify(awaiting.contentFree), "No explicit content or inactive Content-Free must leave all Content-Free facts unchanged.");
        assert(JSON.stringify(awaiting) === before, "Feedback completion must not mutate its source state.");
        equal(completeMasturbationSessionFeedbackState(awaiting, input), completed, "Feedback completion must be deterministic from the provided complete feedback and recording time.");
        assert(completeMasturbationSessionFeedbackState(completed, input) === completed, "A retry after completion must not append another session or Content-Free event.");
        const completedBytes = JSON.stringify(completed);
        feedback.erectionQuality = 1;
        assert(JSON.stringify(completed) === completedBytes, "Caller mutation of feedback must not change completed historical facts.");
        assert(validateAndNormalizeBloomState(completed).success, "Produced completed sessions and linked Content-Free records must satisfy current runtime validation.");
        const reloaded = await assertRoundTrip(completed, null);
        assert(completeMasturbationSessionFeedbackState(reloaded, input) === reloaded, "Completed-session retry protection must survive reload.");
      }
    }
  }
}

function verifyFeedbackValuesAndUnrelatedPermissions() {
  const awaiting = makeAwaiting(createReadyState(true, true), true);
  for (const endingReason of endingReasons) {
    for (const erectionQuality of [1, 10] as const) {
      const completed = completeMasturbationSessionFeedbackState(awaiting, { recordedAt, feedback: { erectionQuality, endingReason, usedExplicitContent: false } });
      assert(completed !== awaiting, "Every ending reason and both erection-quality bounds must be valid.");
      equal(last(completed.masturbationTracking.sessions)?.erectionQuality, erectionQuality, "Reported quality must be retained without normalization.");
      equal(last(completed.masturbationTracking.sessions)?.endingReason, endingReason, "Reported ending reason must remain a descriptive historical fact.");
    }
  }
  const inconsistentPermissions = clone(awaiting);
  inconsistentPermissions.masturbationTracking.enabled = false;
  inconsistentPermissions.resetJourney = createActiveState(false, true).resetJourney;
  const finished = completeMasturbationSessionFeedbackState(inconsistentPermissions, { recordedAt, feedback: createFeedback(false) });
  assert(finished !== inconsistentPermissions && !finished.masturbationTracking.enabled && finished.resetJourney === inconsistentPermissions.resetJourney, "Finishing an existing event must not require tracking to remain enabled or invent a Reset violation in an inconsistent cross-feature state.");
  const alreadyActive = startSession(createReadyState(false, false));
  alreadyActive.masturbationTracking.enabled = false;
  const paused = startMasturbationPauseState(alreadyActive, { startedAt: pauseStart });
  const resumed = endMasturbationPauseState(paused, { endedAt: pauseEnd });
  const ended = endMasturbationSessionState(resumed, { endedAt });
  assert(ended.masturbationTracking.currentSession?.status === "awaiting_feedback" && !ended.masturbationTracking.enabled, "Existing physical sessions may finish their pause/end lifecycle after tracking is disabled without changing permission.");
  const partial = clone(awaiting);
  assert(partial.masturbationTracking.currentSession?.status === "awaiting_feedback", "Awaiting fixture required.");
  partial.masturbationTracking.currentSession.erectionQuality = 4;
  partial.masturbationTracking.currentSession.usedExplicitContent = true;
  partial.masturbationTracking.currentSession.endingReason = "other";
  const replacement = { erectionQuality: 10 as const, usedExplicitContent: false, endingReason: "climaxed" as const };
  const full = completeMasturbationSessionFeedbackState(partial, { recordedAt, feedback: replacement });
  assert(full !== partial && full.contentFree === partial.contentFree, "Full submitted feedback must replace partial awaiting values rather than combine them into contradictory facts.");
  equal(last(full.masturbationTracking.sessions), { ...partial.masturbationTracking.currentSession, ...replacement, status: "completed" }, "Completed feedback must use all supplied fields in the same top-level location.");
  const historicalDuration = clone(awaiting);
  assert(historicalDuration.masturbationTracking.currentSession?.status === "awaiting_feedback", "Awaiting fixture required.");
  historicalDuration.masturbationTracking.currentSession.durationSeconds = 1;
  historicalDuration.masturbationTracking.currentSession.pauses[0]!.durationSeconds = 0;
  const retained = completeMasturbationSessionFeedbackState(historicalDuration, { recordedAt, feedback: createFeedback(false) });
  assert(retained !== historicalDuration && last(retained.masturbationTracking.sessions)?.durationSeconds === 1, "Feedback must retain valid historical stored durations rather than silently recomputing existing facts.");
}

function verifyContentFreeEventBoundaries() {
  const awaiting = makeAwaiting(createReadyState(false, true), false);
  const laterActivation = clone(awaiting);
  laterActivation.contentFree = activeContent("2026-10-01T10:12:00.000Z", "2026-10-01T10:12:00.000Z", 0);
  const later = completeMasturbationSessionFeedbackState(laterActivation, { recordedAt, feedback: createFeedback(true) });
  assert(later !== laterActivation && later.contentFree === laterActivation.contentFree, "A physical event ending before the current activation must complete normally without backdating that later program or requiring a violation ID.");
  const equalActivation = clone(awaiting);
  equalActivation.contentFree = activeContent(endedAt, endedAt, 0);
  const atActivation = completeMasturbationSessionFeedbackState(equalActivation, feedbackInput(true));
  assert(atActivation !== equalActivation && atActivation.contentFree.violations.length === 1 && atActivation.contentFree.bestStreakSeconds === 0, "Activation at the exact physical end applies and records a zero-second pre-event streak.");
  const fractional = clone(awaiting);
  fractional.contentFree = activeContent("2026-10-01T09:00:00.000Z", "2026-10-01T10:00:00.750Z", 1);
  const rounded = completeMasturbationSessionFeedbackState(fractional, feedbackInput(true));
  assert(rounded !== fractional && rounded.contentFree.bestStreakSeconds === 600, "Content-Free elapsed streaks must floor fractional milliseconds to whole seconds.");
  equal(last(rounded.contentFree.violations)?.streakBefore, { currentStreakStartedAt: "2026-10-01T10:00:00.750Z", bestStreakSeconds: 1 }, "The prior best snapshot must be captured before updating best streak.");
  const higherBest = clone(fractional);
  higherBest.contentFree.bestStreakSeconds = 10000;
  const preserved = completeMasturbationSessionFeedbackState(higherBest, feedbackInput(true));
  assert(preserved.contentFree.bestStreakSeconds === 10000, "A shorter session-derived streak must not reduce a prior best.");
  const manualSameText = clone(awaiting);
  manualSameText.contentFree = activeContent("2026-10-01T09:00:00.000Z", "2026-10-01T09:30:00.000Z", 0);
  manualSameText.contentFree.violations.push({
    id: "manual-same-string", activationId: "session-test-activation", kind: "intentionalExplicitContent", occurredAt: "2026-10-01T09:30:00.000Z", recordedAt: "2026-10-01T09:30:00.000Z",
    source: { kind: "manual", logActionId: sessionId }, streakBefore: { currentStreakStartedAt: "2026-10-01T09:00:00.000Z", bestStreakSeconds: 0 }, status: "recorded"
  });
  assert(completeMasturbationSessionFeedbackState(manualSameText, feedbackInput(true)) !== manualSameText, "A manual source sharing the same string must not collide with the session-kind identity.");
  const equalRecorded = completeMasturbationSessionFeedbackState(awaiting, { ...feedbackInput(true), recordedAt: endedAt });
  assert(equalRecorded !== awaiting, "Feedback submission may occur at the exact physical end timestamp.");
}

function verifyDiscard() {
  for (const paused of [false, true]) {
    const active = startSession(createReadyState(true, true));
    const state = paused ? startMasturbationPauseState(active, { startedAt: pauseStart }) : active;
    const before = JSON.stringify(state);
    const discarded = discardActiveMasturbationSessionState(state);
    equal(discarded, { ...state, masturbationTracking: { ...state.masturbationTracking, currentSession: null } }, "Discarding an active physical session must only clear currentSession, producing no history, violation, or tombstone.");
    assert(discarded.masturbationTracking.sessions === state.masturbationTracking.sessions, "Discard must retain completed session history untouched.");
    assertOtherReferences(state, discarded, false, "active discard");
    assert(JSON.stringify(state) === before, "Discard must not mutate its active source snapshot.");
    assert(discardActiveMasturbationSessionState(discarded) === discarded, "Repeated discard with no current session must be an exact no-op.");
  }
  const awaiting = makeAwaiting(createReadyState(true, true), true);
  assert(discardActiveMasturbationSessionState(awaiting) === awaiting, "An ended physical event awaiting feedback must not be silently discarded.");
}

function verifyInvalidTransitions() {
  let count = 0;
  const reject = (transition: Transition, state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(transition(state, input as never) === state, `${label}: invalid transition must return the exact original state.`);
    assert(JSON.stringify(state) === before, `${label}: invalid input must not leave partial session or Content-Free facts.`);
    count++;
  };
  const ready = createReadyState(true, true);
  const active = startSession(ready);
  const paused = startMasturbationPauseState(active, { startedAt: pauseStart });
  const resumed = endMasturbationPauseState(paused, { endedAt: pauseEnd });
  const awaiting = endMasturbationSessionState(resumed, { endedAt });
  reject(startMasturbationSessionState, { ...ready, masturbationTracking: { ...ready.masturbationTracking, enabled: false } }, { sessionId, startedAt }, "disabled tracking blocks start");
  reject(startMasturbationSessionState, { ...ready, resetJourney: createActiveState(false, true).resetJourney }, { sessionId, startedAt }, "active Reset blocks start, without deriving a permission override from its elapsed time");
  for (const state of [active, awaiting]) reject(startMasturbationSessionState, state, { sessionId: "second-session", startedAt }, "one unfinished session maximum");
  reject(startMasturbationSessionState, ready, { sessionId: "source-session", startedAt }, "session identity already belongs to completed history");
  for (const id of [undefined, "", " ", null, 17]) reject(startMasturbationSessionState, ready, { sessionId: id, startedAt }, "invalid session identity");
  const timedTransitions: Array<[Transition, BloomLocalState, string, Record<string, unknown>]> = [
    [startMasturbationSessionState, ready, "startedAt", { sessionId, startedAt }],
    [startMasturbationPauseState, active, "startedAt", { startedAt: pauseStart }],
    [endMasturbationPauseState, paused, "endedAt", { endedAt: pauseEnd }],
    [endMasturbationSessionState, resumed, "endedAt", { endedAt }],
    [completeMasturbationSessionFeedbackState, awaiting, "recordedAt", feedbackInput(true)]
  ];
  for (const [transition, state, field, input] of timedTransitions) {
    for (const value of [null, [], "transition", {}]) reject(transition, state, value, "missing or malformed input object");
    for (const value of [undefined, "", "2026-02-30T10:00:00.000Z", "2026-10-01", "2026-10-01T10:10:00+00:00", 17, null]) {
      reject(transition, state, { ...input, [field]: value }, `invalid canonical ${field}`);
    }
  }
  for (const transition of [startMasturbationPauseState, endMasturbationPauseState, endMasturbationSessionState]) {
    for (const state of [ready, awaiting]) reject(transition, state, { startedAt: pauseStart, endedAt }, "physical transition requires an active session");
  }
  reject(startMasturbationPauseState, paused, { startedAt: pauseEnd }, "an active pause already exists");
  reject(startMasturbationPauseState, active, { startedAt: "2026-10-01T09:59:59.999Z" }, "pause cannot precede session start");
  reject(startMasturbationPauseState, resumed, { startedAt: "2026-10-01T10:02:01.248Z" }, "next pause cannot precede previous pause end");
  reject(endMasturbationPauseState, active, { endedAt: pauseEnd }, "no active pause to end");
  reject(endMasturbationPauseState, resumed, { endedAt }, "completed pause cannot be ended again");
  reject(endMasturbationPauseState, paused, { endedAt: "2026-10-01T10:01:00.749Z" }, "pause end cannot precede its start");
  reject(endMasturbationSessionState, active, { endedAt: "2026-10-01T10:00:00.249Z" }, "physical end cannot precede session start");
  reject(endMasturbationSessionState, paused, { endedAt: "2026-10-01T10:01:00.749Z" }, "physical end cannot precede an active pause start");
  reject(endMasturbationSessionState, resumed, { endedAt: "2026-10-01T10:02:01.248Z" }, "physical end cannot precede a completed pause end");
  for (const state of [ready, active]) reject(completeMasturbationSessionFeedbackState, state, feedbackInput(true), "feedback requires awaiting_feedback");
  for (const value of [undefined, null, [], {}, { erectionQuality: 7 }, { erectionQuality: 7, usedExplicitContent: false }]) reject(completeMasturbationSessionFeedbackState, awaiting, { ...feedbackInput(false), feedback: value }, "full feedback required");
  for (const value of [0, 11, 1.5, NaN, Infinity, "7", null]) reject(completeMasturbationSessionFeedbackState, awaiting, { recordedAt, feedback: { ...createFeedback(false), erectionQuality: value } }, "erection quality must be an integer 1–10");
  for (const value of ["false", 0, null]) reject(completeMasturbationSessionFeedbackState, awaiting, { recordedAt, feedback: { ...createFeedback(false), usedExplicitContent: value } }, "explicit content usage must be boolean");
  for (const value of ["finished", "", null]) reject(completeMasturbationSessionFeedbackState, awaiting, { recordedAt, feedback: { ...createFeedback(false), endingReason: value } }, "ending reason must be an existing enum value");
  reject(completeMasturbationSessionFeedbackState, awaiting, { ...feedbackInput(false), recordedAt: "2026-10-01T10:10:00.998Z" }, "feedback recording cannot precede physical end even without a Content-Free event");
  for (const id of [undefined, "", " ", null, 17, "cf-recorded", "cf-corrected"]) reject(completeMasturbationSessionFeedbackState, awaiting, { ...feedbackInput(true), contentFreeViolationId: id }, "missing, invalid, or conflicting Content-Free violation identity rejects the whole completion");
  const backdated = clone(awaiting);
  assert(backdated.contentFree.status === "active", "Active Content-Free fixture required.");
  backdated.contentFree.currentStreakStartedAt = "2026-10-01T10:11:00.000Z";
  reject(completeMasturbationSessionFeedbackState, backdated, feedbackInput(true), "unsafe event before current streak start needs historical replay");
  for (const status of ["recorded", "undone"] as const) {
    const duplicate = clone(awaiting);
    assert(duplicate.contentFree.status === "active", "Active Content-Free fixture required.");
    const linked = { id: "already-handled-session", activationId: duplicate.contentFree.activationId, kind: "intentionalExplicitContent" as const, occurredAt: endedAt, recordedAt, source: { kind: "masturbationSession" as const, sessionId }, streakBefore: { currentStreakStartedAt: duplicate.contentFree.currentStreakStartedAt, bestStreakSeconds: duplicate.contentFree.bestStreakSeconds } };
    duplicate.contentFree.violations.push(status === "recorded" ? { ...linked, status } : { ...linked, status, undoneAt: recordedAt });
    reject(completeMasturbationSessionFeedbackState, duplicate, feedbackInput(true), `${status} session source already handled must block a stale atomic completion`);
  }
  for (const [path, value] of [
    ["contentFree.activatedAt", "2026-10-01T10:12:00.000Z"], ["contentFree.activatedAt", "invalid"],
    ["contentFree.bestStreakSeconds", -1], ["masturbationTracking.sessions.0.erectionQuality", 11],
    ["masturbationTracking.currentSession.durationSeconds", -1]
  ] as const) {
    const malformed = clone(awaiting);
    replaceAtPath(malformed, path, value, false);
    reject(completeMasturbationSessionFeedbackState, malformed, feedbackInput(true), `contradictory source facts at ${path}`);
  }
  return count;
}

async function verifyMalformedStoredSessions() {
  const active = startSession(createReadyState(true, true));
  const paused = startMasturbationPauseState(active, { startedAt: pauseStart });
  const resumed = endMasturbationPauseState(paused, { endedAt: pauseEnd });
  const second = endMasturbationPauseState(startMasturbationPauseState(resumed, { startedAt: pauseEnd }), { endedAt: "2026-10-01T10:03:00.999Z" });
  const awaiting = endMasturbationSessionState(second, { endedAt });
  const completed = completeMasturbationSessionFeedbackState(awaiting, feedbackInput(false));
  const prefix = "masturbationTracking.currentSession";
  const cases: Array<[string, BloomLocalState, string, unknown, boolean?]> = [
    ["blank active identity", active, `${prefix}.id`, " "], ["invalid active start", active, `${prefix}.startedAt`, "2026-02-30T10:00:00.000Z"],
    ["active ticking counter", active, `${prefix}.durationSeconds`, 0], ["active carrying feedback", active, `${prefix}.erectionQuality`, 7],
    ["active pause duration", paused, `${prefix}.pauses.0.durationSeconds`, 0], ["pause before session", paused, `${prefix}.pauses.0.startedAt`, "2026-10-01T10:00:00.249Z"],
    ["completed pause negative duration", resumed, `${prefix}.pauses.0.durationSeconds`, -1], ["completed pause fractional duration", resumed, `${prefix}.pauses.0.durationSeconds`, 1.5],
    ["completed pause missing end", resumed, `${prefix}.pauses.0.endedAt`, undefined, true], ["pause ends before start", resumed, `${prefix}.pauses.0.endedAt`, "2026-10-01T10:01:00.749Z"],
    ["ended session before start", awaiting, `${prefix}.endedAt`, "2026-10-01T10:00:00.249Z"], ["missing physical duration", awaiting, `${prefix}.durationSeconds`, undefined, true],
    ["fractional physical duration", awaiting, `${prefix}.durationSeconds`, 0.5], ["ended session contains active pause", awaiting, `${prefix}.pauses.0`, { status: "active", startedAt: pauseStart }],
    ["pause extends beyond session", awaiting, `${prefix}.pauses.1.endedAt`, "2026-10-01T10:10:01.000Z"],
    ["current completed session forbidden", awaiting, prefix, last(completed.masturbationTracking.sessions)],
    ["active history entry forbidden", completed, "masturbationTracking.sessions.0", active.masturbationTracking.currentSession],
    ["awaiting history entry forbidden", completed, "masturbationTracking.sessions.0", awaiting.masturbationTracking.currentSession],
    ["completed quality out of range", completed, "masturbationTracking.sessions.0.erectionQuality", 11],
    ["completed content flag not boolean", completed, "masturbationTracking.sessions.0.usedExplicitContent", "yes"],
    ["completed reason unknown", completed, "masturbationTracking.sessions.0.endingReason", "finished"],
    ["nested feedback forbidden", awaiting, `${prefix}.feedback`, createFeedback(false)],
    ["duplicate current/history identity", awaiting, `${prefix}.id`, "source-session"]
  ];
  for (const [label, state, path, value, remove] of cases) {
    const malformed = clone(state);
    replaceAtPath(malformed, path, value, remove === true);
    await assertCorruptPreserved(malformed, label);
  }
  const reversed = clone(second);
  assert(reversed.masturbationTracking.currentSession?.status === "active", "Active fixture required.");
  reversed.masturbationTracking.currentSession.pauses.reverse();
  await assertCorruptPreserved(reversed, "disjoint completed pauses must still be stored in chronological order");
  const activeNotLast = clone(paused);
  assert(activeNotLast.masturbationTracking.currentSession?.status === "active", "Active fixture required.");
  activeNotLast.masturbationTracking.currentSession.pauses.push({ status: "completed", startedAt, endedAt: "2026-10-01T10:00:30.000Z", durationSeconds: 29 });
  await assertCorruptPreserved(activeNotLast, "an active pause must be last even when the array's intervals do not overlap after sorting");
  const multipleActive = clone(paused);
  assert(multipleActive.masturbationTracking.currentSession?.status === "active", "Active fixture required.");
  multipleActive.masturbationTracking.currentSession.pauses.push({ status: "active", startedAt: pauseEnd });
  await assertCorruptPreserved(multipleActive, "multiple active pauses are invalid");
  const duplicateHistory = clone(completed);
  duplicateHistory.masturbationTracking.sessions.push(duplicateHistory.masturbationTracking.sessions[0]!);
  await assertCorruptPreserved(duplicateHistory, "completed session IDs must remain unique");
  return cases.length + 4;
}

function createReadyState(historical: boolean, contentActive: boolean): BloomLocalState {
  const state = historical ? createPopulatedState() : createDefaultBloomState();
  state.masturbationTracking = { ...state.masturbationTracking, enabled: true, currentSession: null };
  if (!historical && contentActive) state.contentFree = activeContent("2026-10-01T09:00:00.000Z", "2026-10-01T09:00:00.000Z", 0);
  if (!contentActive) {
    const prior = state.contentFree;
    state.contentFree = prior.status === "active" ? {
      status: "inactive", bestStreakSeconds: prior.bestStreakSeconds,
      pastActivations: [...prior.pastActivations, { id: prior.activationId, startedAt: prior.activatedAt, endedAt: "2026-09-30T10:00:00.000Z" }], violations: prior.violations
    } : prior;
  }
  return state;
}

function activeContent(activatedAt: string, currentStreakStartedAt: string, bestStreakSeconds: number): Extract<ContentFreeState, { status: "active" }> {
  return { status: "active", activationId: "session-test-activation", activatedAt, currentStreakStartedAt, bestStreakSeconds, pastActivations: [], violations: [] };
}

function startSession(state: BloomLocalState): BloomLocalState {
  const active = startMasturbationSessionState(state, { sessionId, startedAt });
  assert(active.masturbationTracking.currentSession?.status === "active", "Session fixture must start successfully.");
  return active;
}

function makeAwaiting(state: BloomLocalState, withPauses: boolean): BloomLocalState {
  let active = startSession(state);
  if (withPauses) {
    active = endMasturbationPauseState(startMasturbationPauseState(active, { startedAt: pauseStart }), { endedAt: pauseEnd });
    active = startMasturbationPauseState(active, { startedAt: "2026-10-01T10:05:00.500Z" });
  }
  const awaiting = endMasturbationSessionState(active, { endedAt });
  assert(awaiting.masturbationTracking.currentSession?.status === "awaiting_feedback", "Session fixture must end into awaiting feedback.");
  return awaiting;
}

function createFeedback(usedExplicitContent: boolean): MasturbationSessionFeedback { return { erectionQuality: 7, usedExplicitContent, endingReason: "climaxed" }; }
function feedbackInput(usedExplicitContent: boolean) { return { feedback: createFeedback(usedExplicitContent), recordedAt, ...(usedExplicitContent ? { contentFreeViolationId: "session-content-violation" } : {}) }; }

function nonActiveResetStates(): ResetJourney[] {
  const completed = createPopulatedState().resetJourney;
  assert(completed.status === "completed", "Completed fixture required.");
  const { assessment: _assessment, ...pending } = completed;
  return [
    createDefaultBloomState().resetJourney,
    { status: "recommended", id: "recommended", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] },
    { status: "baseline_pending", id: "pending-baseline", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] },
    { ...pending, status: "assessment_pending" }, completed
  ];
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function last<T>(values: readonly T[]): T | undefined { return values[values.length - 1]; }

function assertOtherReferences(before: BloomLocalState, after: BloomLocalState, contentAffected: boolean, label: string) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (key !== "masturbationTracking" && (key !== "contentFree" || !contentAffected)) assert(after[key] === before[key], `${label}: unrelated ${key} must remain unchanged by reference.`);
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

async function assertRoundTrip(state: BloomLocalState, status: "active" | "awaiting_feedback" | null): Promise<BloomLocalState> {
  assert(validateAndNormalizeBloomState(state).success, "Generated session state must validate before persistence.");
  const client = new SessionTestStorage();
  await persistBloomLocalState(state, client, now);
  const raw = client.values.get(BLOOM_STATE_STORAGE_KEY);
  assert(raw !== undefined && (JSON.parse(raw) as { version: unknown }).version === 7, "Session lifecycle must persist using unchanged v7 envelope.");
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "success" && loaded.source === "current", "Persisted session state must reload as current.");
  assert((loaded.state.masturbationTracking.currentSession?.status ?? null) === status, "Loading must preserve unfinished session phase without automatically ending, discarding, or completing feedback.");
  equal(loaded.state, state, "Session/pause histories, linked Content-Free records, and all unrelated facts must survive save/load unchanged.");
  return loaded.state;
}

async function assertCorruptPreserved(state: BloomLocalState, label: string) {
  assert(!validateAndNormalizeBloomState(state).success, `${label}: malformed session facts must fail direct validation instead of normalization or sorting.`);
  const raw = JSON.stringify({ version: 7, savedAt: now().toISOString(), state });
  const client = new SessionTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
  const loaded = await loadBloomLocalState(client, now);
  assert(loaded.status === "corrupt" && loaded.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: malformed session facts must follow established corruption handling.`);
  assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${label}: original malformed source bytes must remain intact.`);
  assert(loaded.backupKey !== null && loaded.backupKey.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Malformed sessions must receive a scoped backup.");
  const backup = client.values.get(loaded.backupKey);
  assert(backup !== undefined, "Corrupt backup must be durable.");
  const parsed = JSON.parse(backup) as { sourceKey?: unknown; rawPayload?: unknown };
  assert(parsed.sourceKey === BLOOM_STATE_STORAGE_KEY && parsed.rawPayload === raw, "Backup must preserve exact bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class SessionTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
