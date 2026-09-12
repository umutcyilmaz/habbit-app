import { isDeepStrictEqual } from "node:util";
import type { ActiveUrgeControlEvent, OnboardingRecommendation } from "../src/domain/models";
import { getBloomHomeReadModel } from "../src/domain/home/getBloomHomeReadModel";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { getUrgeControlProgress } from "../src/domain/urgeControl/getUrgeControlProgress";
import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import { completeElapsedResetPeriodState, createDefaultBloomState, recordActiveResetViolationState, type BloomLocalState } from "../src/storage/bloomState";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";
import { verifyBloomHomeComposition } from "./verify-bloom-home-composition";

const at = "2026-09-20T12:00:00.123Z";
const day = 24 * 60 * 60 * 1000;
const period = 15 * day;
type Home = NonNullable<ReturnType<typeof getBloomHomeReadModel>>;
type Action = Home["primaryAction"];
type PriorityCase = { label: string; state: BloomLocalState; clock: string; action: Action };

export async function verifyBloomHome() {
  const priorities = priorityCases();
  for (const item of priorities) expectAction(item.state, item.clock, item.action, item.label);
  const sessionCases = verifyUnfinishedSessionPriority(priorities);
  const urgeCases = verifyUrgePriorityAndResume(priorities);
  verifyCurrentAttemptBoundaries();
  verifyStoredRecommendations();
  console.log(`Bloom Home priority verification passed (${priorities.length} action cases; ${sessionCases} session precedence combinations; ${urgeCases} Urge precedence/stage combinations; elapsed Reset completion and stored recommendation identity).`);
  await verifyBloomHomeComposition();
}

function priorityCases(): PriorityCase[] {
  const idle = createDefaultBloomState();
  const tracking = clearWork(createPopulatedState());
  const contentOnly = clone(tracking);
  contentOnly.masturbationTracking.enabled = false;
  const recommended = clone(tracking);
  recommended.resetJourney = { ...createDefaultBloomState().resetJourney, status: "recommended", id: "home-recommended-reset" };
  const startingRecommendation = clone(recommended);
  setRecommendation(startingRecommendation, "masturbation_tracking");
  const active = clearWork(createActiveState(true, true));
  active.masturbationTracking.enabled = true;
  setRecommendation(active, "content_free");
  assert(active.resetJourney.status === "active", "Active Reset fixture required.");
  const activeAt = shift(active.resetJourney.currentAttempt.startedAt, 5 * day);
  const elapsedAt = shift(active.resetJourney.currentAttempt.startedAt, period);
  const activeProgress = getResetProgress(active.resetJourney, activeAt);
  const elapsedProgress = getResetProgress(active.resetJourney, elapsedAt);
  assert(activeProgress !== null && elapsedProgress !== null, "Active progress must be available.");
  const baseline = clone(tracking);
  baseline.resetJourney = { ...createDefaultBloomState().resetJourney, status: "baseline_pending", id: "home-baseline-reset" };
  setRecommendation(baseline, "reset_and_content_free");
  const pending = completeElapsedResetPeriodState(active, { observedAt: elapsedAt });
  assert(pending.resetJourney.status === "assessment_pending", "Assessment-pending fixture required.");
  return [
    { label: "notCompleted product onboarding alone must not force onboarding or generic support", state: idle, clock: at, action: null },
    { label: "startable Tracking supplies the ordinary action", state: tracking, clock: at, action: { id: "startMasturbationSession" } },
    { label: "Content-Free alone supplies the ordinary action", state: contentOnly, clock: at, action: { id: "viewContentFree" } },
    { label: "Reset recommendation outranks normal trackers", state: recommended, clock: at, action: { id: "reviewResetRecommendation", journeyId: "home-recommended-reset" } },
    { label: "unaccepted stored onboarding recommendation outranks Reset recommendation and trackers", state: startingRecommendation, clock: at, action: { id: "reviewStartingRecommendation", recommendation: "masturbation_tracking" } },
    { label: "effective active Reset outranks unaccepted recommendation and enabled Tracking", state: active, clock: activeAt, action: { id: "viewActiveReset", journeyId: active.resetJourney.id, attemptId: active.resetJourney.currentAttempt.id, progress: activeProgress } },
    { label: "baseline preparation outranks unaccepted recommendation and trackers", state: baseline, clock: at, action: { id: "completeResetBaseline", journeyId: "home-baseline-reset" } },
    { label: "pending assessment outranks unaccepted recommendation and trackers", state: pending, clock: elapsedAt, action: { id: "completeResetAssessment", journeyId: pending.resetJourney.id, attemptId: pending.resetJourney.currentAttempt.id } },
    { label: "exact Day 15 requests explicit lifecycle persistence before recommendation or tracker actions", state: active, clock: elapsedAt, action: { id: "recordResetElapsedCompletion", journeyId: active.resetJourney.id, attemptId: active.resetJourney.currentAttempt.id, progress: elapsedProgress } }
  ];
}

function verifyUnfinishedSessionPriority(cases: PriorityCase[]) {
  let count = 0;
  for (const lower of cases) for (const enabled of [false, true]) for (const status of ["active", "awaiting_feedback"] as const) {
    const state = clone(lower.state);
    state.masturbationTracking.enabled = enabled;
    state.masturbationTracking.currentSession = status === "active"
      ? { id: "highest-active-session", status, startedAt: "2026-09-01T10:00:00.000Z", pauses: [] }
      : { id: "highest-feedback-session", status, startedAt: "2026-09-01T10:00:00.000Z", endedAt: "2026-09-01T10:01:00.000Z", durationSeconds: 60, pauses: [], erectionQuality: 8 };
    state.urgeControl.activeEvent = { id: "lower-urge-event", status: "active", startedAt: "2026-09-01T10:00:00.000Z" };
    const action: Action = status === "active" ? { id: "resumeMasturbationSession", sessionId: "highest-active-session" } : { id: "finishMasturbationSessionFeedback", sessionId: "highest-feedback-session" };
    const model = expectAction(state, lower.clock, action, `${status} unfinished work must outrank ${lower.label}, including the conflicting active Urge event`);
    assert(model.trackingAvailability.currentSessionStatus === status && model.urgeControlProgress?.stage === "interrupt", "Higher-priority session work must preserve independently derived session and lower-priority Urge facts.");
    assert(!model.trackingAvailability.canStartSession, "Unfinished work must never coexist with a contradictory start permission.");
    count++;
  }
  return count;
}

function verifyUrgePriorityAndResume(cases: PriorityCase[]) {
  let count = 0;
  const stages: Array<[ActiveUrgeControlEvent, string]> = [];
  let event: ActiveUrgeControlEvent = { id: "resumable-home-urge", status: "active", startedAt: "2026-09-01T10:00:00.000Z" };
  stages.push([event, "interrupt"]);
  event = { ...event, interruptCompletedAt: "2026-09-01T10:00:10.000Z" }; stages.push([event, "technique"]);
  event = { ...event, selectedTechnique: "grounding54321" }; stages.push([event, "phoneAwayReady"]);
  event = { ...event, phoneAwayStartedAt: "2026-09-01T10:00:12.000Z" }; stages.push([event, "phoneAwayActive"]);
  event = { ...event, phoneAwayEndedAt: "2026-09-01T10:01:37.250Z" }; stages.push([event, "outcome"]);
  event = { ...event, outcome: "stronger", secondLineAction: "messageSupportPerson" }; stages.push([event, "trigger"]);
  event = { ...event, trigger: "sexualDesire" }; stages.push([event, "readyToComplete"]);
  for (const lower of cases) {
    const state = clone(lower.state);
    state.urgeControl.activeEvent = stages[0]![0];
    expectAction(state, lower.clock, { id: "resumeUrgeControl", eventId: event.id, stage: "interrupt" }, `Active Urge Control must outrank ${lower.label}`);
    count++;
  }
  for (const [activeEvent, expectedStage] of stages) {
    const state = clearWork(createPopulatedState());
    state.urgeControl.activeEvent = activeEvent;
    const progress = getUrgeControlProgress(state.urgeControl, at);
    assert(progress !== null && progress.stage === expectedStage, "Stage fixture must match the existing Urge selector.");
    const model = expectAction(state, at, { id: "resumeUrgeControl", eventId: activeEvent.id, stage: progress.stage }, "Home must resume the exact existing Urge event at its timestamp-derived stage");
    equal(model.urgeControlProgress, progress, "Home must expose the composed Urge progress without a second timer/stage implementation.");
    count++;
  }
  const legacy = clearWork(createPopulatedState());
  legacy.urgeControl.activeEvent = createPopulatedState().urgeControl.activeEvent;
  assert(legacy.urgeControl.activeEvent !== null, "Legacy unordered active fixture required.");
  expectAction(legacy, at, { id: "resumeUrgeControl", eventId: legacy.urgeControl.activeEvent.id, stage: "phoneAwayActive" }, "Older valid unordered Urge facts must resume from the first missing step rather than auto-completing from later answers");
  return count + 1;
}

function verifyCurrentAttemptBoundaries() {
  const initial = clearWork(createActiveState(true, true));
  assert(initial.resetJourney.status === "active", "Active Reset fixture required.");
  const restartedAt = shift(initial.resetJourney.currentAttempt.startedAt, 3 * day + 123);
  const restarted = recordActiveResetViolationState(initial, { violationId: "home-reset-restart", replacementAttemptId: "home-current-attempt", occurredAt: restartedAt, recordedAt: restartedAt, source: { kind: "manual", logActionId: "home-restart-source" }, reason: "masturbation" });
  assert(restarted !== initial && restarted.resetJourney.status === "active", "Boundary test must use a real restarted current attempt.");
  for (const enabled of [false, true]) for (const elapsed of [-1, 0, period - 1, period, period + 1, period + 4 * day]) {
    const state = clone(restarted);
    state.masturbationTracking.enabled = enabled;
    const clock = shift(restartedAt, elapsed);
    const progress = getResetProgress(restarted.resetJourney, clock);
    assert(progress !== null, "Active Reset progress required.");
    const model = expectAction(state, clock, { id: elapsed < period ? "viewActiveReset" : "recordResetElapsedCompletion", journeyId: restarted.resetJourney.id, attemptId: "home-current-attempt", progress }, "Reset priority must switch at precisely 15 full 24-hour intervals of the current attempt");
    assert(model.trackingAvailability.resetRestriction.isRestrictionActive === (elapsed < period), "The explicit completion action must not imply continued behavioral restriction after the elapsed boundary.");
    assert(model.trackingAvailability.canStartSession === (enabled && elapsed >= period), "Lifecycle priority must remain distinct from truthful Tracking start capability.");
  }
  const originalBoundary = shift(restarted.resetJourney.startedAt, period);
  const progress = getResetProgress(restarted.resetJourney, originalBoundary);
  assert(progress !== null, "Original journey boundary fixture required.");
  expectAction(restarted, originalBoundary, { id: "viewActiveReset", journeyId: restarted.resetJourney.id, attemptId: "home-current-attempt", progress }, "The earlier overall journey boundary must not complete a later restarted attempt");
}

function verifyStoredRecommendations() {
  for (const recommendation of ["masturbation_tracking", "content_free", "reset", "reset_and_content_free"] as const) for (const recommended of [false, true]) {
    const state = clearWork(createPopulatedState());
    state.resetJourney = recommended ? { ...createDefaultBloomState().resetJourney, status: "recommended", id: "home-both-recommendations" } : createDefaultBloomState().resetJourney;
    setRecommendation(state, recommendation);
    assert(state.productOnboarding.status === "completed", "Stored recommendation fixture required.");
    const stored = state.productOnboarding.result;
    const fresh = scoreBloomOnboarding(stored.answers, stored.completedAt);
    if (recommendation !== "reset_and_content_free") assert(fresh.recommendation !== stored.recommendation, "Historical recommendation fixture must intentionally differ from today's scorer for the same raw answers.");
    expectAction(state, at, { id: "reviewStartingRecommendation", recommendation }, "Home must return the exact stored recommendation without rescoring or assigning permanent tracker ownership");
    const accepted = clone(state);
    assert(accepted.productOnboarding.status === "completed", "Accepted fixture requires a stored result.");
    accepted.productOnboarding.planAcceptance = { acceptedAt: at, recommendation };
    expectAction(accepted, at, recommended ? { id: "reviewResetRecommendation", journeyId: "home-both-recommendations" } : { id: "startMasturbationSession" }, "An accepted onboarding result must stop forcing starting-recommendation review while independent current feature facts remain authoritative");
  }
  const migrated = clearWork(createPopulatedState());
  assert(migrated.productOnboarding.status === "notCompleted", "Migrated product onboarding fixture must remain uncompleted.");
  expectAction(migrated, at, { id: "startMasturbationSession" }, "Migrated notCompleted onboarding must not hide enabled Tracking or force an onboarding action");
}

function setRecommendation(state: BloomLocalState, recommendation: OnboardingRecommendation) {
  const onboarding = createActiveState(false, false).productOnboarding;
  assert(onboarding.status === "completed", "Stored historical onboarding fixture required.");
  state.productOnboarding = { status: "completed", result: { ...onboarding.result, recommendation }, planAcceptance: null };
}
function clearWork(state: BloomLocalState) { state.masturbationTracking = { ...state.masturbationTracking, currentSession: null }; state.urgeControl = { ...state.urgeControl, activeEvent: null }; return state; }
function expectAction(state: BloomLocalState, clock: string, action: Action, label: string): Home {
  freeze(state);
  const before = JSON.stringify(state);
  const model = getBloomHomeReadModel(state, clock);
  assert(model !== null, `${label}: valid product facts must produce a Home read model.`);
  equal(model.primaryAction, action, label);
  assert(model.urgeControlAvailable === true, "Optional Urge support remains available without inventing a default start-Urge action.");
  equal(getBloomHomeReadModel(state, clock), model, "Repeated explicit-time reads must be deterministic.");
  assert(JSON.stringify(state) === before, "Home priority must never mutate events, advance Reset, rescore stored facts, or persist derived state.");
  return model;
}
function shift(timestamp: string, milliseconds: number) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const nested of Object.values(value)) freeze(nested); Object.freeze(value); } return value; }
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
