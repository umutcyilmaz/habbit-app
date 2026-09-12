import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  createBloomProductFlowActions,
  type BloomProductFlowActions,
  type BloomProductFlowIdPrefix
} from "../src/app/flows/bloomProductFlowActions";
import {
  createBloomProductAcknowledgedActions,
  type BloomProductAcknowledgedActions
} from "../src/app/providers/bloomProductAcknowledgedActions";
import {
  createBloomLocalStateMutationRuntime,
  type BloomMutationRuntimeHydrationStatus,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../src/app/providers/bloomLocalStateMutationRuntime";
import type { MasturbationSessionFeedback } from "../src/domain/models";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const at = "2026-11-01T12:00:00.123Z";
const earlier = "2026-10-31T10:00:00.456Z";
type FlowCase = {
  path: string;
  invoke: (flow: BloomProductFlowActions) => Promise<BloomPersistedMutationResult>;
  args: unknown[];
  prefixes: BloomProductFlowIdPrefix[];
  prepared?: false;
};

export async function verifyBloomProductFlowActions() {
  const cases = flowCases();
  const paths = new Set(cases.map((item) => item.path));
  assert(paths.size === 31, "Every new-product command must have a flow/preparation or direct-alias verification case.");
  for (const [index, item] of cases.entries()) await verifyPreparedInputs(item, index);
  verifyDefaultIdConvention();
  await verifyFreshInvocationFacts();
  await verifyRetryWithoutRegeneration();
  await verifyNoOpAndRuntimeBlocks();
  verifyIsolation();
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Flow integration must preserve the established v7 persistence contract.");
  console.log(`Bloom product flow-action verification passed (all 31 paths; ${cases.length} exact-input cases; one-time mechanical facts, direct aliases, semantic passthrough, real runtime retry/no-op/lifecycle safety, and v7 isolation).`);
}

async function verifyPreparedInputs(item: FlowCase, index: number) {
  const harness = recordingHarness();
  const before = JSON.stringify(item.args);
  const promise = item.invoke(harness.flow);
  assert(promise === harness.acknowledgement.promise, `${item.path}: return the product action's original acknowledgement promise.`);
  assert(harness.calls.length === 1 && harness.calls[0]!.path === item.path, `${item.path}: dispatch exactly once to the matching product command.`);
  equal(harness.calls[0]!.args, item.args, `${item.path}: generated facts and caller semantic fields must reach the exact product-action input.`);
  const actualInput = harness.calls[0]!.args[0] as Record<string, unknown> | undefined;
  const expectedInput = item.args[0] as Record<string, unknown> | undefined;
  if (item.path === "onboarding.saveProductOnboardingResult") assert(actualInput === expectedInput, "An already-scored onboarding result must pass through by reference without rescoring.");
  if (expectedInput?.feedback !== undefined) assert(actualInput?.feedback === expectedInput.feedback, "Feedback semantic objects must remain caller-owned through mechanical preparation.");
  if (expectedInput?.resetBaseline !== undefined) {
    assert((actualInput?.resetBaseline as { selfReport: unknown }).selfReport === (expectedInput.resetBaseline as { selfReport: unknown }).selfReport,
      "Baseline preparation must preserve the caller's self-report reference and optional aggregate absence.");
  }
  if ((expectedInput?.source as { kind?: string } | undefined)?.kind === "masturbationSession") {
    assert(actualInput?.source === expectedInput?.source, "Existing session source identity must pass through unchanged.");
  }
  assert(harness.clockCalls() === (item.prepared === false ? 0 : 1), `${item.path}: capture one operation time only when mechanical preparation is needed.`);
  equal(harness.ids.map((entry) => entry.prefix).sort(), [...item.prefixes].sort(), `${item.path}: generate exactly the required identities without inspecting product state.`);
  assert(harness.ids.every((entry) => entry.date === harness.date), `${item.path}: every generated identity must receive the single captured Date object.`);
  assert(harness.events[harness.events.length - 1] === "dispatch" && harness.events.filter((entry) => entry === "dispatch").length === 1,
    `${item.path}: all mechanical generation must finish before the product command is invoked.`);
  if (item.prepared === false) {
    assert(atPath(harness.flow, item.path) === atPath(harness.productActions, item.path), `${item.path}: commands without preparation should remain direct function aliases.`);
    equal(harness.events, ["dispatch"], "Direct aliases must not call the clock or ID generator.");
  } else assert(harness.events[0] === "now", "Prepared operations must capture time before generating any IDs.");
  assert(JSON.stringify(item.args) === before, "Preparation must not mutate caller objects or semantic inputs.");
  const result: BloomPersistedMutationResult = index % 2 === 0
    ? { ok: true, accepted: true, persisted: true, sequence: index + 1 }
    : { ok: false, accepted: true, persisted: false, sequence: index + 1, reason: "persistenceFailed", retryable: true, retryToken: (index + 100) as BloomPersistenceRetryToken };
  harness.acknowledgement.resolve(result);
  assert(await promise === result, `${item.path}: acknowledgement outcomes and retry tokens must pass through as the exact original object.`);
  assert(harness.clockCalls() === (item.prepared === false ? 0 : 1) && harness.calls.length === 1, "Settling an acknowledgement must not regenerate facts or replay a command.");
}

function flowCases(): FlowCase[] {
  const feedback: MasturbationSessionFeedback = { erectionQuality: 8, usedExplicitContent: true, endingReason: "stoppedByChoice" };
  const baseline = {
    averageIntervalSeconds: 86400.5, averageErectionQuality: 6.5, explicitContentSessionRatio: 0.25,
    selfReport: { urgeIntensity: "notSure" as const, abilityToPause: "preferNotToSay" as const, spontaneousOrMorningErections: "sometimes" as const }
  };
  const assessment = {
    resetJourneyId: "existing-journey", resetAttemptId: "existing-attempt", baselineId: "existing-baseline",
    urgeIntensityChange: "notSure" as const, abilityToPauseChange: "same" as const,
    spontaneousErectionChange: "moreFrequent" as const, overallSexualResponseChange: "preferNotToSay" as const,
    readinessToRestartTracking: "notReady" as const
  };
  const onboarding = createActiveState(false, false).productOnboarding;
  assert(onboarding.status === "completed", "Canonical onboarding result fixture required.");
  const result = { ...onboarding.result, recommendation: "masturbation_tracking" as const };
  freeze([feedback, baseline, assessment, result]);
  const cases: FlowCase[] = [
    { path: "onboarding.saveProductOnboardingResult", invoke: (f) => f.onboarding.saveProductOnboardingResult(result), args: [result], prefixes: [], prepared: false },
    { path: "onboarding.acceptRecommendation", invoke: (f) => f.onboarding.acceptRecommendation(), args: [{ acceptedAt: at, resetJourneyId: id("reset-journey"), contentFreeActivationId: id("content-free-activation") }], prefixes: ["reset-journey", "content-free-activation"] },
    { path: "reset.startFromBaseline", invoke: (f) => f.reset.startFromBaseline(baseline), args: [{ resetBaseline: { ...baseline, id: id("reset-baseline"), capturedAt: at }, resetAttemptId: id("reset-attempt"), startedAt: at }], prefixes: ["reset-baseline", "reset-attempt"] },
    { path: "reset.recordViolation", invoke: (f) => f.reset.recordViolation({ reason: "masturbationWithExplicitContent", source: { kind: "manual" } }), args: [resetViolation("masturbationWithExplicitContent", { kind: "manual", logActionId: id("log-action") }, at)], prefixes: ["reset-violation", "reset-attempt", "content-free-violation", "log-action"] },
    { path: "reset.undoViolation", invoke: (f) => f.reset.undoViolation({ violationId: "existing-reset-violation" }), args: [{ violationId: "existing-reset-violation", undoneAt: at }], prefixes: [] },
    { path: "reset.completeElapsed", invoke: (f) => f.reset.completeElapsed(), args: [{ observedAt: at }], prefixes: [] },
    { path: "reset.completeAssessment", invoke: (f) => f.reset.completeAssessment(assessment), args: [{ ...assessment, id: id("reset-assessment"), completedAt: at }], prefixes: ["reset-assessment"] },
    { path: "tracking.enable", invoke: (f) => f.tracking.enable(), args: [], prefixes: [], prepared: false },
    { path: "tracking.disable", invoke: (f) => f.tracking.disable(), args: [], prefixes: [], prepared: false },
    { path: "tracking.session.start", invoke: (f) => f.tracking.session.start(), args: [{ sessionId: id("masturbation-session"), startedAt: at }], prefixes: ["masturbation-session"] },
    { path: "tracking.session.startPause", invoke: (f) => f.tracking.session.startPause(), args: [{ startedAt: at }], prefixes: [] },
    { path: "tracking.session.endPause", invoke: (f) => f.tracking.session.endPause(), args: [{ endedAt: at }], prefixes: [] },
    { path: "tracking.session.end", invoke: (f) => f.tracking.session.end(), args: [{ endedAt: at }], prefixes: [] },
    { path: "tracking.session.completeFeedback", invoke: (f) => f.tracking.session.completeFeedback(feedback), args: [{ feedback, recordedAt: at, contentFreeViolationId: id("content-free-violation") }], prefixes: ["content-free-violation"] },
    { path: "tracking.session.discardActive", invoke: (f) => f.tracking.session.discardActive(), args: [], prefixes: [], prepared: false },
    { path: "tracking.corrections.editFeedback", invoke: (f) => f.tracking.corrections.editFeedback({ sessionId: "existing-session", feedback }), args: [{ sessionId: "existing-session", feedback, editedAt: at, contentFreeViolationId: id("content-free-violation") }], prefixes: ["content-free-violation"] },
    { path: "tracking.corrections.deleteSession", invoke: (f) => f.tracking.corrections.deleteSession({ sessionId: "existing-session" }), args: [{ sessionId: "existing-session", deletedAt: at }], prefixes: [] },
    { path: "contentFree.activate", invoke: (f) => f.contentFree.activate(), args: [{ activationId: id("content-free-activation"), activatedAt: at }], prefixes: ["content-free-activation"] },
    { path: "contentFree.deactivate", invoke: (f) => f.contentFree.deactivate(), args: [{ endedAt: at }], prefixes: [] },
    { path: "contentFree.recordManualViolation", invoke: (f) => f.contentFree.recordManualViolation(), args: [{ violationId: id("content-free-violation"), logActionId: id("log-action"), occurredAt: at, recordedAt: at }], prefixes: ["content-free-violation", "log-action"] },
    { path: "contentFree.undoManualViolation", invoke: (f) => f.contentFree.undoManualViolation({ violationId: "existing-content-violation" }), args: [{ violationId: "existing-content-violation", undoneAt: at }], prefixes: [] },
    { path: "urgeControl.start", invoke: (f) => f.urgeControl.start(), args: [{ eventId: id("urge-control-event"), startedAt: at }], prefixes: ["urge-control-event"] },
    { path: "urgeControl.completeInterrupt", invoke: (f) => f.urgeControl.completeInterrupt(), args: [{ completedAt: at }], prefixes: [] },
    { path: "urgeControl.selectTechnique", invoke: (f) => f.urgeControl.selectTechnique({ technique: "grounding54321" }), args: [{ technique: "grounding54321" }], prefixes: [], prepared: false },
    { path: "urgeControl.startPhoneAway", invoke: (f) => f.urgeControl.startPhoneAway(), args: [{ startedAt: at }], prefixes: [] },
    { path: "urgeControl.endPhoneAway", invoke: (f) => f.urgeControl.endPhoneAway(), args: [{ endedAt: at }], prefixes: [] },
    { path: "urgeControl.recordOutcome", invoke: (f) => f.urgeControl.recordOutcome({ outcome: "stronger" }), args: [{ outcome: "stronger" }], prefixes: [], prepared: false },
    { path: "urgeControl.recordTrigger", invoke: (f) => f.urgeControl.recordTrigger({ trigger: "sexualDesire" }), args: [{ trigger: "sexualDesire" }], prefixes: [], prepared: false },
    { path: "urgeControl.selectSecondLineAction", invoke: (f) => f.urgeControl.selectSecondLineAction({ action: "messageSupportPerson" }), args: [{ action: "messageSupportPerson" }], prefixes: [], prepared: false },
    { path: "urgeControl.complete", invoke: (f) => f.urgeControl.complete(), args: [{ completedAt: at }], prefixes: [] },
    { path: "urgeControl.discardActive", invoke: (f) => f.urgeControl.discardActive(), args: [], prefixes: [], prepared: false }
  ];
  for (const occurredAt of [earlier, "", "invalid", null, 7]) {
    const source = { kind: "masturbationSession" as const, sessionId: "existing-source-session" };
    cases.push({
      path: "reset.recordViolation",
      invoke: (f) => f.reset.recordViolation({ reason: "masturbation", source, occurredAt: occurredAt as string }),
      args: [resetViolation("masturbation", source, occurredAt)],
      prefixes: ["reset-violation", "reset-attempt", "content-free-violation"]
    });
    cases.push({
      path: "contentFree.recordManualViolation",
      invoke: (f) => f.contentFree.recordManualViolation(occurredAt as string),
      args: [{ violationId: id("content-free-violation"), logActionId: id("log-action"), occurredAt, recordedAt: at }],
      prefixes: ["content-free-violation", "log-action"]
    });
  }
  const invalidFeedback = { ...feedback, erectionQuality: 99 } as unknown as MasturbationSessionFeedback;
  cases.push({ path: "tracking.session.completeFeedback", invoke: (f) => f.tracking.session.completeFeedback(invalidFeedback), args: [{ feedback: invalidFeedback, recordedAt: at, contentFreeViolationId: id("content-free-violation") }], prefixes: ["content-free-violation"] });
  const contentFreeFeedback = { ...feedback, usedExplicitContent: false };
  cases.push({ path: "tracking.session.completeFeedback", invoke: (f) => f.tracking.session.completeFeedback(contentFreeFeedback), args: [{ feedback: contentFreeFeedback, recordedAt: at, contentFreeViolationId: id("content-free-violation") }], prefixes: ["content-free-violation"] });
  const minimalBaseline = { selfReport: baseline.selfReport };
  cases.push({ path: "reset.startFromBaseline", invoke: (f) => f.reset.startFromBaseline(minimalBaseline), args: [{ resetBaseline: { ...minimalBaseline, id: id("reset-baseline"), capturedAt: at }, resetAttemptId: id("reset-attempt"), startedAt: at }], prefixes: ["reset-baseline", "reset-attempt"] });
  return cases;
}

function recordingHarness() {
  const acknowledgement = deferred<BloomPersistedMutationResult>();
  const calls: Array<{ path: string; args: unknown[] }> = [];
  const events: string[] = [];
  const ids: Array<{ prefix: BloomProductFlowIdPrefix; date: Date }> = [];
  const date = new Date(at);
  let clockCalls = 0;
  const shape = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: async () => { throw new Error("Spy must intercept product commands."); } });
  function spy(value: unknown, path = ""): unknown {
    if (typeof value === "function") return (...args: unknown[]) => { events.push("dispatch"); calls.push({ path, args }); return acknowledgement.promise; };
    assert(value !== null && typeof value === "object", "Product action groups required.");
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, spy(nested, path ? `${path}.${key}` : key)]));
  }
  const productActions = spy(shape) as BloomProductAcknowledgedActions;
  const flow = createBloomProductFlowActions({
    productActions,
    now: () => { events.push("now"); clockCalls++; return date; },
    createId: (prefix, capturedAt) => { events.push(`id:${prefix}`); ids.push({ prefix, date: capturedAt }); return id(prefix); }
  });
  return { flow, productActions, calls, ids, date, events, acknowledgement, clockCalls: () => clockCalls };
}

function verifyDefaultIdConvention() {
  const harness = recordingHarness();
  const flow = createBloomProductFlowActions({ productActions: harness.productActions, now: () => new Date(at) });
  flow.tracking.session.start();
  flow.urgeControl.start();
  const session = harness.calls[0]!.args[0] as { sessionId: string; startedAt: string };
  const urge = harness.calls[1]!.args[0] as { eventId: string; startedAt: string };
  const timestamp = at.replace(/[^0-9A-Za-z]/g, "");
  assert(new RegExp(`^masturbation-session-${timestamp}-[a-z0-9]{7}$`).test(session.sessionId), "Default IDs must follow the established prefix/sanitized-ISO/base36 nonce convention.");
  assert(new RegExp(`^urge-control-event-${timestamp}-[a-z0-9]{7}$`).test(urge.eventId), "Default ID generation must use the flow-specific semantic namespace.");
  assert(session.startedAt === at && urge.startedAt === at, "Default ID generation must reuse the captured operation time.");
  harness.acknowledgement.resolve({ ok: true, accepted: true, persisted: true, sequence: 1 });
}

async function verifyFreshInvocationFacts() {
  const harness = recordingHarness();
  const dates = [new Date(at), new Date("2026-11-01T12:00:01.234Z")];
  let clockCalls = 0;
  let idCalls = 0;
  const flow = createBloomProductFlowActions({
    productActions: harness.productActions,
    now: () => dates[clockCalls++]!,
    createId: (prefix, operationTime) => {
      assert(operationTime === dates[idCalls], "Each new logical invocation must give its own captured Date to ID generation.");
      idCalls++;
      return `${prefix}-invocation-${idCalls}`;
    }
  });
  assert(clockCalls === 0 && idCalls === 0, "Constructing the flow factory must not cache an operation time or identity.");
  const first = flow.tracking.session.start();
  const second = flow.tracking.session.start();
  equal(harness.calls.map((call) => call.args), [
    [{ sessionId: "masturbation-session-invocation-1", startedAt: dates[0]!.toISOString() }],
    [{ sessionId: "masturbation-session-invocation-2", startedAt: dates[1]!.toISOString() }]
  ], "Two distinct invocations on one factory must prepare fresh caller-independent facts before acknowledgement settles.");
  assert(Number(clockCalls) === 2 && Number(idCalls) === 2, "Each logical invocation must capture time and generate identity once.");
  const result: BloomPersistedMutationResult = { ok: true, accepted: true, persisted: true, sequence: 1 };
  harness.acknowledgement.resolve(result);
  assert(await first === result && await second === result, "Fresh preparation must still return the original command acknowledgement.");
}

async function verifyRetryWithoutRegeneration() {
  const harness = runtimeHarness(createPopulatedState());
  const sourceSessionId = harness.initialState.masturbationTracking.currentSession?.id;
  assert(sourceSessionId !== undefined, "Existing awaiting-feedback fixture required.");
  const feedback: MasturbationSessionFeedback = { erectionQuality: 7, usedExplicitContent: true, endingReason: "stoppedByChoice" };
  const pending = harness.flow.tracking.session.completeFeedback(feedback);
  const accepted = harness.runtime.getState();
  assert(accepted !== harness.initialState && accepted.masturbationTracking.currentSession === null, "The real flow must resolve an existing session through productActions and the runtime.");
  const linked = accepted.contentFree.violations.find((entry) => entry.id === id("content-free-violation"));
  assert(linked?.source.kind === "masturbationSession" && linked.source.sessionId === sourceSessionId, "The generated linked identity must reach the underlying atomic feedback transition.");
  assert(harness.clockCalls() === 1 && harness.idCalls() === 1 && harness.mutationCalls() === 1, "A real logical invocation generates facts and applies its transition exactly once.");
  harness.attempts[0]!.fail();
  const failure = await pending;
  assert(!failure.ok && failure.accepted && failure.retryable && failure.reason === "persistenceFailed", "Failed persistence must preserve the runtime's accepted state and retry token.");
  assert(harness.runtime.getState() === accepted && harness.runtime.getDurableState() === harness.initialState, "A failed save must not roll back accepted truth or advance durable state.");
  const retry = harness.runtime.retryPersistence(failure.retryToken);
  assert(harness.attempts.length === 2 && harness.attempts[1]!.state === accepted, "Retry must write the original accepted snapshot.");
  harness.attempts[1]!.succeed();
  assert((await retry).ok && (await harness.runtime.retryPersistence(failure.retryToken)).ok, "The existing retry API must acknowledge the same prepared command idempotently.");
  assert(harness.clockCalls() === 1 && harness.idCalls() === 1 && harness.mutationCalls() === 1 && harness.attempts.length === 2, "Persistence retry must never replay flow generation, domain mutation, or linked-history creation.");
}

async function verifyNoOpAndRuntimeBlocks() {
  const invalidFeedback = runtimeHarness(createPopulatedState());
  const rejected = await invalidFeedback.flow.tracking.session.completeFeedback({ erectionQuality: 99, usedExplicitContent: false, endingReason: "other" } as never);
  assertRejected(rejected, "invalidSession");
  assert(invalidFeedback.runtime.getState() === invalidFeedback.initialState && invalidFeedback.attempts.length === 0, "Invalid semantic feedback must remain a normal transition no-op without a save.");
  assert(invalidFeedback.clockCalls() === 1 && invalidFeedback.idCalls() === 1 && invalidFeedback.mutationCalls() === 1, "The flow must mechanically prepare malformed semantics and leave validation to the existing transition.");
  const stale = runtimeHarness(createPopulatedState());
  assertRejected(await stale.flow.tracking.corrections.deleteSession({ sessionId: "missing-session" }), "invalidSession");
  assert(stale.attempts.length === 0 && stale.runtime.getState() === stale.initialState, "Stale target identities must not be replaced or converted into a fabricated success.");
  const disabled = runtimeHarness();
  assertRejected(await disabled.flow.tracking.session.start(), "invalidSession");
  assert(disabled.attempts.length === 0 && disabled.clockCalls() === 1 && disabled.idCalls() === 1, "Flow preparation must not bypass Tracking permission or prevalidate it itself.");
  for (const invalid of [null, "invalid", {}, 42]) {
    const content = runtimeHarness(createPopulatedState());
    const pendingContent = content.flow.contentFree.recordManualViolation(invalid as never);
    assert(content.attempts.length === 0 && content.runtime.getState() === content.initialState,
      "Invalid explicit CF occurrence must not be replaced by a valid current timestamp and accepted.");
    assertRejected(await pendingContent, "invalidSession");
    const reset = runtimeHarness(createActiveState(false, true), "ready", "2026-09-03T12:00:00.123Z");
    const pendingReset = reset.flow.reset.recordViolation({ reason: "intentionalExplicitContent", source: { kind: "manual" }, occurredAt: invalid as never });
    assert(reset.attempts.length === 0 && reset.runtime.getState() === reset.initialState,
      "Invalid explicit Reset occurrence must remain invalid while the otherwise-valid operation time is inside the active period.");
    assertRejected(await pendingReset, "invalidSession");
  }
  for (const status of ["loading", "error", "ready"] as const) {
    const harness = runtimeHarness(createDefaultBloomState(), status);
    if (status === "ready") harness.runtime.beginDeletion();
    const result = await harness.flow.tracking.session.start();
    assertRejected(result, status === "loading" ? "hydrationPending" : status === "error" ? "stateUnavailable" : "deletionInProgress");
    assert(harness.clockCalls() === 1 && harness.idCalls() === 1 && harness.mutationCalls() === 0 && harness.attempts.length === 0, "Unsafe lifecycle states must inherit acknowledged runtime rejection after mechanical flow preparation, without domain execution.");
    assert(harness.runtime.getPendingMutationCount() === 0, "Blocked flow commands must not be placed into a new replay queue.");
  }
}

function runtimeHarness(initialState = createDefaultBloomState(), initialHydrationStatus: BloomMutationRuntimeHydrationStatus = "ready", operationAt = at) {
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({
    initialState, initialHydrationStatus,
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({ state, succeed: () => resolve({ status: "persisted", writeId, generation: 0 }), fail: () => reject(new Error("Synthetic flow persistence failure.")) });
    })
  });
  let mutationCalls = 0;
  let clockCalls = 0;
  let idCalls = 0;
  const productActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: (mutation) => runtime.applyAcknowledgedMutation((state) => { mutationCalls++; return mutation(state); }) });
  const flow = createBloomProductFlowActions({ productActions, now: () => { clockCalls++; return new Date(operationAt); }, createId: (prefix) => { idCalls++; return id(prefix); } });
  return { runtime, flow, initialState, attempts, mutationCalls: () => mutationCalls, clockCalls: () => clockCalls, idCalls: () => idCalls };
}

function verifyIsolation() {
  const source = readFileSync("src/app/flows/bloomProductFlowActions.ts", "utf8");
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]!);
  assert(imports.every((entry) => !/react|router|navigation|storage|productPolicy|domain\/home|contentFree\/get|urgeControl\/get/.test(entry)), "The flow factory must remain React-free and must not import navigation, persistence, transitions, or read selectors.");
  assert(!/\b(?:AsyncStorage|saveBloomLocalState|persistBloomLocalState|getBloomHomeReadModel|setInterval|setTimeout|useBloomLocalState|retryPersistence)\b/.test(source), "Flow actions must only prepare facts and invoke productActions, with no storage, queries, timers, provider capture, or alternative retry mechanism.");
}
function resetViolation(reason: string, source: unknown, occurredAt: unknown) {
  return { violationId: id("reset-violation"), replacementAttemptId: id("reset-attempt"), contentFreeViolationId: id("content-free-violation"), reason, source, occurredAt, recordedAt: at };
}
function id(prefix: BloomProductFlowIdPrefix) {
  return `generated-${prefix}`;
}
function atPath(root: unknown, path: string) {
  let value = root;
  for (const key of path.split(".")) value = (value as Record<string, unknown>)[key];
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
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
function assertRejected(result: BloomPersistedMutationResult, reason: string) {
  assert(!result.ok && !result.accepted && !result.persisted && !result.retryable && result.reason === reason,
    `Expected existing runtime rejection ${reason}.`);
}
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
