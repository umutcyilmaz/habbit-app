import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  createBloomProductAcknowledgedActions,
  type BloomProductAcknowledgedActions
} from "../src/app/providers/bloomProductAcknowledgedActions";
import type {
  BloomPersistedMutationResult,
  BloomPersistenceRetryToken
} from "../src/app/providers/bloomLocalStateMutationRuntime";
import {
  createDefaultBloomState, saveProductOnboardingResultState, acceptProductOnboardingRecommendationState,
  startResetFromBaselineState, recordActiveResetViolationState, undoActiveResetViolationState,
  completeElapsedResetPeriodState, completePostResetAssessmentState,
  enableMasturbationTrackingState, disableMasturbationTrackingState,
  startMasturbationSessionState, startMasturbationPauseState, endMasturbationPauseState,
  endMasturbationSessionState, completeMasturbationSessionFeedbackState, discardActiveMasturbationSessionState,
  editCompletedMasturbationSessionFeedbackState, deleteCompletedMasturbationSessionState,
  activateContentFreeState, deactivateContentFreeState, recordManualContentFreeViolationState, undoManualContentFreeViolationState,
  startUrgeControlEventState, completeUrgeControlInterruptState, selectUrgeControlTechniqueState,
  startUrgeControlPhoneAwayState, endUrgeControlPhoneAwayState, recordUrgeControlOutcomeState,
  recordUrgeControlTriggerState, selectUrgeControlSecondLineActionState, completeUrgeControlEventState,
  discardActiveUrgeControlEventState, type BloomLocalState
} from "../src/storage/bloomState";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";
import { verifyBloomProductActionsRuntime } from "./verify-bloom-product-actions-runtime";

const at = "2026-11-01T12:00:00.123Z";
const day = 24 * 60 * 60 * 1000;
type Mutation = (state: BloomLocalState) => BloomLocalState;
type CommandCase = {
  name: string;
  state: BloomLocalState;
  invoke: (actions: BloomProductAcknowledgedActions) => Promise<BloomPersistedMutationResult>;
  transition: Mutation;
  noOpState?: BloomLocalState;
};

type Acknowledged<T> = T extends (state: BloomLocalState, ...input: infer A) => BloomLocalState
  ? (...input: A) => Promise<BloomPersistedMutationResult>
  : never;
type ExpectedProductActions = {
  onboarding: {
    saveProductOnboardingResult: Acknowledged<typeof saveProductOnboardingResultState>;
    acceptRecommendation: Acknowledged<typeof acceptProductOnboardingRecommendationState>;
  };
  reset: {
    startFromBaseline: Acknowledged<typeof startResetFromBaselineState>;
    recordViolation: Acknowledged<typeof recordActiveResetViolationState>;
    undoViolation: Acknowledged<typeof undoActiveResetViolationState>;
    completeElapsed: Acknowledged<typeof completeElapsedResetPeriodState>;
    completeAssessment: Acknowledged<typeof completePostResetAssessmentState>;
  };
  tracking: {
    enable: Acknowledged<typeof enableMasturbationTrackingState>;
    disable: Acknowledged<typeof disableMasturbationTrackingState>;
    session: {
      start: Acknowledged<typeof startMasturbationSessionState>;
      startPause: Acknowledged<typeof startMasturbationPauseState>;
      endPause: Acknowledged<typeof endMasturbationPauseState>;
      end: Acknowledged<typeof endMasturbationSessionState>;
      completeFeedback: Acknowledged<typeof completeMasturbationSessionFeedbackState>;
      discardActive: Acknowledged<typeof discardActiveMasturbationSessionState>;
    };
    corrections: {
      editFeedback: Acknowledged<typeof editCompletedMasturbationSessionFeedbackState>;
      deleteSession: Acknowledged<typeof deleteCompletedMasturbationSessionState>;
    };
  };
  contentFree: {
    activate: Acknowledged<typeof activateContentFreeState>;
    deactivate: Acknowledged<typeof deactivateContentFreeState>;
    recordManualViolation: Acknowledged<typeof recordManualContentFreeViolationState>;
    undoManualViolation: Acknowledged<typeof undoManualContentFreeViolationState>;
  };
  urgeControl: {
    start: Acknowledged<typeof startUrgeControlEventState>;
    completeInterrupt: Acknowledged<typeof completeUrgeControlInterruptState>;
    selectTechnique: Acknowledged<typeof selectUrgeControlTechniqueState>;
    startPhoneAway: Acknowledged<typeof startUrgeControlPhoneAwayState>;
    endPhoneAway: Acknowledged<typeof endUrgeControlPhoneAwayState>;
    recordOutcome: Acknowledged<typeof recordUrgeControlOutcomeState>;
    recordTrigger: Acknowledged<typeof recordUrgeControlTriggerState>;
    selectSecondLineAction: Acknowledged<typeof selectUrgeControlSecondLineActionState>;
    complete: Acknowledged<typeof completeUrgeControlEventState>;
    discardActive: Acknowledged<typeof discardActiveUrgeControlEventState>;
  };
};
type EqualTypes<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true : false;
// A widening, missing input, optionalized argument, or different return type
// must fail compilation for the complete public command tree.
const exactCommandTypes: EqualTypes<BloomProductAcknowledgedActions, ExpectedProductActions> = true;

export async function verifyBloomProductActions() {
  assert(exactCommandTypes, "All facade input tuples and Promise result types must exactly match their pure transitions.");
  verifyFactoryIsolation();
  const cases = commandCases();
  const api = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: async () => success(1) });
  equal(commandPaths(api).sort(), cases.map((item) => item.name).sort(), "The facade must expose exactly the 31 grouped command paths covered by delegation tests.");
  assert(cases.length === 31, "Every Phase 1P product transition must have one focused command case.");
  for (const item of cases) {
    await verifyDelegation(item);
    await verifyResultPassthrough(item);
  }
  await verifyRapidSequentialCommands();
  console.log("Bloom product-action facade verification passed (all 31 grouped commands; exact transition delegation, caller facts, runtime-supplied current state, no-ops, acknowledgement passthrough, and rapid sequential commands).");
  await verifyBloomProductActionsRuntime();
}

async function verifyDelegation(item: CommandCase) {
  const mutations: Mutation[] = [];
  const acknowledgement = deferred<BloomPersistedMutationResult>();
  const actions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: (mutation) => { mutations.push(mutation); return acknowledgement.promise; } });
  const pending = item.invoke(actions);
  assert(pending instanceof Promise && mutations.length === 1, `${item.name}: every invocation must submit exactly one acknowledged mutation and return a promise.`);
  // Supply a distinct current snapshot only after the command has been issued.
  // There is no React state, initial-state option, clock, or ID generator here.
  const current = clone(item.state);
  current.debug.dateOffsetDays += 2;
  freeze(current);
  const before = JSON.stringify(current);
  const expected = item.transition(current);
  assert(expected !== current, `${item.name}: the positive fixture must exercise a real domain change.`);
  const actual = mutations[0]!(current);
  equal(actual, expected, `${item.name}: the wrapper must preserve all exact caller identities/timestamps and delegate to the intended pure transition.`);
  assert(JSON.stringify(current) === before, `${item.name}: the wrapper must not mutate runtime-supplied current state.`);
  assert(validateAndNormalizeBloomState(actual).success, `${item.name}: the delegated state must remain valid for existing persistence.`);
  for (const key of Object.keys(current) as Array<keyof BloomLocalState>) {
    assert((actual[key] === current[key]) === (expected[key] === current[key]), `${item.name}: ${key} reference changes must be controlled exclusively by the underlying transition.`);
  }
  const receipt = success(43);
  acknowledgement.resolve(receipt);
  assert(await pending === receipt, `${item.name}: the exact acknowledged result must reach the caller without a replacement success object.`);

  const noOpState = item.noOpState ?? actual;
  const noOpBefore = JSON.stringify(noOpState);
  assert(item.transition(noOpState) === noOpState, `${item.name}: the no-op fixture must actually be rejected/idempotent in the pure transition.`);
  let calls = 0;
  const rejected: BloomPersistedMutationResult = { ok: false, accepted: false, persisted: false, sequence: 44, reason: "invalidSession", retryable: false };
  const noOpActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: async (mutation) => {
    calls++;
    assert(mutation(noOpState) === noOpState, `${item.name}: a domain no-op must preserve the exact state without a forced write.`);
    return rejected;
  } });
  assert(await item.invoke(noOpActions) === rejected && calls === 1, `${item.name}: unchanged-state handling must remain on the existing acknowledged path.`);
  assert(JSON.stringify(noOpState) === noOpBefore, `${item.name}: no-op handling must preserve all stored facts.`);
}

async function verifyResultPassthrough(item: CommandCase) {
  const results: BloomPersistedMutationResult[] = [
    success(51),
    { ok: false, accepted: false, persisted: false, sequence: 52, reason: "hydrationPending", retryable: false },
    { ok: false, accepted: false, persisted: false, sequence: 53, reason: "stateUnavailable", retryable: false },
    { ok: false, accepted: false, persisted: false, sequence: 54, reason: "deletionInProgress", retryable: false },
    { ok: false, accepted: true, persisted: false, sequence: 55, reason: "persistenceFailed", retryable: true, retryToken: 901 as BloomPersistenceRetryToken },
    { ok: false, accepted: true, persisted: false, sequence: 56, reason: "persistenceUnknown", retryable: true, retryToken: 902 as BloomPersistenceRetryToken }
  ];
  for (const result of results) {
    let calls = 0;
    const actions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: async () => { calls++; return result; } });
    assert(await item.invoke(actions) === result && calls === 1, `${item.name}: runtime decisions, accepted/durable distinctions, sequence, and retry tokens must pass through without facade reinterpretation.`);
  }
}

async function verifyRapidSequentialCommands() {
  let current = blankProductState();
  const initial = current;
  const acknowledgements: Array<ReturnType<typeof deferred<BloomPersistedMutationResult>>> = [];
  const actions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: (mutation) => {
    current = mutation(current);
    const acknowledgement = deferred<BloomPersistedMutationResult>();
    acknowledgements.push(acknowledgement);
    return acknowledgement.promise;
  } });
  const pending = [
    actions.tracking.enable(),
    actions.tracking.session.start({ sessionId: "rapid-caller-session", startedAt: at }),
    actions.tracking.session.startPause({ startedAt: shift(at, 5_001) }),
    actions.tracking.session.endPause({ endedAt: shift(at, 10_002) }),
    actions.tracking.session.end({ endedAt: shift(at, 15_003) }),
    actions.tracking.session.completeFeedback({ feedback: { erectionQuality: 8, usedExplicitContent: false, endingReason: "stoppedByChoice" }, recordedAt: shift(at, 20_004) })
  ];
  let expected = enableMasturbationTrackingState(initial);
  expected = startMasturbationSessionState(expected, { sessionId: "rapid-caller-session", startedAt: at });
  expected = startMasturbationPauseState(expected, { startedAt: shift(at, 5_001) });
  expected = endMasturbationPauseState(expected, { endedAt: shift(at, 10_002) });
  expected = endMasturbationSessionState(expected, { endedAt: shift(at, 15_003) });
  expected = completeMasturbationSessionFeedbackState(expected, {
    feedback: { erectionQuality: 8, usedExplicitContent: false, endingReason: "stoppedByChoice" },
    recordedAt: shift(at, 20_004)
  });
  equal(current, expected, "Rapid commands issued before any acknowledgement resolves must compose against the latest accepted runtime state.");
  assert(current.masturbationTracking.currentSession === null && current.masturbationTracking.sessions.length === 1 && acknowledgements.length === 6, "Rapid explicit session work must complete once rather than using a stale captured state.");
  for (const [index, acknowledgement] of acknowledgements.entries()) acknowledgement.resolve(success(index + 1));
  equal(await Promise.all(pending), acknowledgements.map((_, index) => success(index + 1)), "Each rapid caller must retain its own acknowledged result.");
}

function commandCases(): CommandCase[] {
  const blank = blankProductState();
  const existing = createPopulatedState();
  const priorOnboarding = createActiveState(false, false).productOnboarding;
  assert(priorOnboarding.status === "completed", "Canonical stored product result fixture required.");
  const result = { ...priorOnboarding.result, completedAt: shift(at, -120_000), recommendation: "reset_and_content_free" as const };
  const saved = saveProductOnboardingResultState(blank, result);
  const acceptance = { acceptedAt: shift(at, -60_000), resetJourneyId: "caller-reset-journey", contentFreeActivationId: "caller-content-activation" };
  const accepted = acceptProductOnboardingRecommendationState(saved, acceptance);
  const baselineInput = { resetBaseline: { id: "caller-baseline", capturedAt: shift(at, -1_000), averageErectionQuality: 6.5, selfReport: { urgeIntensity: "notSure" as const, abilityToPause: "preferNotToSay" as const, spontaneousOrMorningErections: "sometimes" as const } }, resetAttemptId: "caller-reset-attempt", startedAt: at };
  const resetActive = startResetFromBaselineState(accepted, baselineInput);
  const violationInput = { violationId: "caller-reset-violation", replacementAttemptId: "caller-replacement-attempt", occurredAt: shift(at, 3 * day + 234), recordedAt: shift(at, 3 * day + 1_345), source: { kind: "manual" as const, logActionId: "caller-reset-source" }, reason: "masturbationWithExplicitContent" as const, contentFreeViolationId: "caller-linked-content-violation" };
  const violated = recordActiveResetViolationState(resetActive, violationInput);
  const resetPending = completeElapsedResetPeriodState(resetActive, { observedAt: shift(at, 15 * day + 567) });
  const assessment = { id: "caller-assessment", resetJourneyId: "caller-reset-journey", resetAttemptId: "caller-reset-attempt", baselineId: "caller-baseline", completedAt: shift(at, 15 * day + 678), urgeIntensityChange: "notSure" as const, abilityToPauseChange: "same" as const, spontaneousErectionChange: "lessFrequent" as const, overallSexualResponseChange: "preferNotToSay" as const, readinessToRestartTracking: "notReady" as const };
  const enabled = enableMasturbationTrackingState(blank);
  const sessionBase = activateContentFreeState(enabled, { activationId: "caller-session-content", activatedAt: shift(at, -day) });
  const sessionInput = { sessionId: "caller-session", startedAt: at };
  const session = startMasturbationSessionState(sessionBase, sessionInput);
  const paused = startMasturbationPauseState(session, { startedAt: shift(at, 5_123) });
  const pauseEnded = endMasturbationPauseState(paused, { endedAt: shift(at, 10_234) });
  const sessionEnded = endMasturbationSessionState(pauseEnded, { endedAt: shift(at, 30_345) });
  const contentInput = { activationId: "caller-standalone-content", activatedAt: at };
  const contentActive = activateContentFreeState(blank, contentInput);
  const manualInput = { violationId: "caller-manual-content-violation", logActionId: "caller-content-source", occurredAt: shift(at, day + 123), recordedAt: shift(at, day + 234) };
  const contentViolated = recordManualContentFreeViolationState(contentActive, manualInput);
  const urgeInput = { eventId: "caller-urge-event", startedAt: at };
  const urge = startUrgeControlEventState(blank, urgeInput);
  const interrupted = completeUrgeControlInterruptState(urge, { completedAt: shift(at, 10_123) });
  const technique = selectUrgeControlTechniqueState(interrupted, { technique: "grounding54321" });
  const phone = startUrgeControlPhoneAwayState(technique, { startedAt: shift(at, 12_234) });
  const phoneEnded = endUrgeControlPhoneAwayState(phone, { endedAt: shift(at, 37_345) });
  const outcome = recordUrgeControlOutcomeState(phoneEnded, { outcome: "stillStrong" });
  const triggered = recordUrgeControlTriggerState(outcome, { trigger: "sexualDesire" });
  const supported = selectUrgeControlSecondLineActionState(triggered, { action: "messageSupportPerson" });
  const save = command("onboarding.saveProductOnboardingResult", blank, saveProductOnboardingResultState, (a) => a.onboarding.saveProductOnboardingResult, result);
  save.noOpState = accepted;
  return [
    save,
    command("onboarding.acceptRecommendation", saved, acceptProductOnboardingRecommendationState, (a) => a.onboarding.acceptRecommendation, acceptance),
    command("reset.startFromBaseline", accepted, startResetFromBaselineState, (a) => a.reset.startFromBaseline, baselineInput),
    command("reset.recordViolation", resetActive, recordActiveResetViolationState, (a) => a.reset.recordViolation, violationInput),
    command("reset.undoViolation", violated, undoActiveResetViolationState, (a) => a.reset.undoViolation, { violationId: violationInput.violationId, undoneAt: shift(at, 3 * day + 2_456) }),
    command("reset.completeElapsed", resetActive, completeElapsedResetPeriodState, (a) => a.reset.completeElapsed, { observedAt: shift(at, 15 * day + 567) }),
    command("reset.completeAssessment", resetPending, completePostResetAssessmentState, (a) => a.reset.completeAssessment, assessment),
    command("tracking.enable", blank, enableMasturbationTrackingState, (a) => a.tracking.enable),
    command("tracking.disable", enabled, disableMasturbationTrackingState, (a) => a.tracking.disable),
    command("tracking.session.start", sessionBase, startMasturbationSessionState, (a) => a.tracking.session.start, sessionInput),
    command("tracking.session.startPause", session, startMasturbationPauseState, (a) => a.tracking.session.startPause, { startedAt: shift(at, 5_123) }),
    command("tracking.session.endPause", paused, endMasturbationPauseState, (a) => a.tracking.session.endPause, { endedAt: shift(at, 10_234) }),
    command("tracking.session.end", pauseEnded, endMasturbationSessionState, (a) => a.tracking.session.end, { endedAt: shift(at, 30_345) }),
    command("tracking.session.completeFeedback", sessionEnded, completeMasturbationSessionFeedbackState, (a) => a.tracking.session.completeFeedback, { feedback: { erectionQuality: 8, usedExplicitContent: true, endingReason: "stoppedByChoice" }, recordedAt: shift(at, 35_456), contentFreeViolationId: "caller-session-content-violation" }),
    command("tracking.session.discardActive", session, discardActiveMasturbationSessionState, (a) => a.tracking.session.discardActive),
    command("tracking.corrections.editFeedback", existing, editCompletedMasturbationSessionFeedbackState, (a) => a.tracking.corrections.editFeedback, { sessionId: "session-1", feedback: { erectionQuality: 8, usedExplicitContent: false, endingReason: "other" }, editedAt: at }),
    command("tracking.corrections.deleteSession", existing, deleteCompletedMasturbationSessionState, (a) => a.tracking.corrections.deleteSession, { sessionId: "session-1", deletedAt: at }),
    command("contentFree.activate", blank, activateContentFreeState, (a) => a.contentFree.activate, contentInput),
    command("contentFree.deactivate", contentActive, deactivateContentFreeState, (a) => a.contentFree.deactivate, { endedAt: shift(at, 2 * day + 123) }),
    command("contentFree.recordManualViolation", contentActive, recordManualContentFreeViolationState, (a) => a.contentFree.recordManualViolation, manualInput),
    command("contentFree.undoManualViolation", contentViolated, undoManualContentFreeViolationState, (a) => a.contentFree.undoManualViolation, { violationId: manualInput.violationId, undoneAt: shift(at, day + 345) }),
    command("urgeControl.start", blank, startUrgeControlEventState, (a) => a.urgeControl.start, urgeInput),
    command("urgeControl.completeInterrupt", urge, completeUrgeControlInterruptState, (a) => a.urgeControl.completeInterrupt, { completedAt: shift(at, 10_123) }),
    command("urgeControl.selectTechnique", interrupted, selectUrgeControlTechniqueState, (a) => a.urgeControl.selectTechnique, { technique: "grounding54321" }),
    command("urgeControl.startPhoneAway", technique, startUrgeControlPhoneAwayState, (a) => a.urgeControl.startPhoneAway, { startedAt: shift(at, 12_234) }),
    command("urgeControl.endPhoneAway", phone, endUrgeControlPhoneAwayState, (a) => a.urgeControl.endPhoneAway, { endedAt: shift(at, 37_345) }),
    command("urgeControl.recordOutcome", phoneEnded, recordUrgeControlOutcomeState, (a) => a.urgeControl.recordOutcome, { outcome: "stillStrong" }),
    command("urgeControl.recordTrigger", outcome, recordUrgeControlTriggerState, (a) => a.urgeControl.recordTrigger, { trigger: "sexualDesire" }),
    command("urgeControl.selectSecondLineAction", triggered, selectUrgeControlSecondLineActionState, (a) => a.urgeControl.selectSecondLineAction, { action: "messageSupportPerson" }),
    command("urgeControl.complete", supported, completeUrgeControlEventState, (a) => a.urgeControl.complete, { completedAt: shift(at, 40_456) }),
    command("urgeControl.discardActive", urge, discardActiveUrgeControlEventState, (a) => a.urgeControl.discardActive)
  ];
}

function command<A extends unknown[]>(
  name: string,
  state: BloomLocalState,
  transition: (state: BloomLocalState, ...input: A) => BloomLocalState,
  select: (actions: BloomProductAcknowledgedActions) => (...input: A) => Promise<BloomPersistedMutationResult>,
  ...input: A
): CommandCase {
  freeze(input);
  return {
    name, state,
    invoke: (actions) => select(actions)(...input),
    transition: (current) => transition(current, ...input)
  };
}
function blankProductState() {
  const state = createPopulatedState();
  const defaults = createDefaultBloomState();
  return {
    ...state,
    productOnboarding: defaults.productOnboarding,
    resetJourney: defaults.resetJourney,
    masturbationTracking: defaults.masturbationTracking,
    contentFree: defaults.contentFree,
    urgeControl: defaults.urgeControl
  };
}
function verifyFactoryIsolation() {
  const source = readFileSync("src/app/providers/bloomProductAcknowledgedActions.ts", "utf8");
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert(imports.every((module) => module === "../../storage/bloomState" || module === "./bloomLocalStateMutationRuntime"),
    "The product facade must depend only on pure transitions and acknowledged runtime types, with no React, routes, storage adapters, or queries.");
  for (const forbidden of [
    /\b(?:AsyncStorage|saveBloomLocalState|persistBloomLocalState|getBloomHomeReadModel|getResetRestrictionStatus|getMasturbationTrackingAvailability|getContentFreeProgress|getUrgeControlProgress)\b/,
    /\b(?:Date\.now|new\s+Date|Math\.random|randomUUID|randomBytes|nanoid|setTimeout|setInterval)\b/,
    /\b(?:router|navigation|useState|useEffect|useCallback)\b/
  ]) assert(!forbidden.test(source), "The command factory must not generate facts, run queries, schedule work, navigate, or access storage directly.");
}
function commandPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "function") return [prefix];
  assert(value !== null && typeof value === "object", "Action groups must contain only command functions or nested groups.");
  return Object.entries(value).flatMap(([key, nested]) => commandPaths(nested, prefix ? `${prefix}.${key}` : key));
}
function success(sequence: number): BloomPersistedMutationResult {
  return { ok: true, accepted: true, persisted: true, sequence };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
function shift(timestamp: string, milliseconds: number) {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
function equal(actual: unknown, expected: unknown, message: string) {
  assert(isDeepStrictEqual(actual, expected), message);
}
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
