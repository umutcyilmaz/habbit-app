import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";
import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import {
  createBloomLocalStateMutationRuntime,
  type BloomPersistedMutationResult
} from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import {
  BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState,
  type BloomStateWriteReceipt
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";
import { getMasturbationTrackingAvailability } from "../src/domain/productPolicy/getMasturbationTrackingAvailability";
import {
  getMasturbationSessionRouteView,
  formatMasturbationElapsedSeconds
} from "../src/features/masturbation-tracking/masturbationSessionView";
import { createMasturbationSessionController } from "../src/features/masturbation-tracking/masturbationSessionController";

const startedAt = "2026-11-01T12:00:00.123Z";
const day = 24 * 60 * 60 * 1000;
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");

export async function verifyBloomMasturbationFeature() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "The executable feature must retain v7 persistence.");
  await verifyExecutableLifecycle();
  await verifyRouteGuardsAndRecovery();
  await verifyAcknowledgementRetry();
  await verifyStartAvailability();
  verifyRouteViews();
  verifyFeatureWiring();
  await verifyHookMountAndPersistenceNavigation();
  console.log("Bloom Masturbation Session feature verification passed (explicit start, duplicate-operation guards, canonical route identity, pause/end/feedback, accepted/durable recovery, retry without replay, elapsed policy, and feature wiring).");
}

async function verifyExecutableLifecycle() {
  const initial = createPopulatedState();
  initial.masturbationTracking.currentSession = null;
  const h = createHarness(initial);
  const unsubscribe = h.controller.subscribe(() => undefined);
  const before = JSON.stringify(initial);
  h.controller.getSnapshot();
  h.controller.getSnapshot();
  unsubscribe();
  const remount = h.makeController();
  const unmount = remount.subscribe(() => undefined);
  unmount();
  assert(h.attempts.length === 0 && h.counts().clockCalls === 0 && h.counts().idCalls === 0,
    "Controller construction, repeated reads, subscriptions, and Strict-Mode-like remount must never start a session.");
  const start = h.controller.start();
  assert(start !== null && h.controller.start() === start && h.controller.end() === null,
    "One explicit start operation must share its in-flight promise while different operations are blocked.");
  const active = h.runtime.getState().masturbationTracking.currentSession;
  assert(active?.status === "active", "Explicit start must immediately expose the canonical accepted active session.");
  const sessionId = active.id;
  assert(h.runtime.getDurableState() === initial && h.persisted.length === 0,
    "Accepted start must not be treated as durably saved or trigger successful navigation before its receipt.");
  assert(h.counts().clockCalls === 1 && h.counts().idCalls === 1 && h.counts().mutationCalls === 1,
    "Duplicate start clicks must not generate another ID/time or invoke another flow mutation.");
  h.attempts[0]!.succeed();
  assert((await start).ok, "A successful receipt must acknowledge the explicit start.");
  equal(h.persisted, [{ operation: "start", sessionId }], "Only durable start success may emit the session navigation callback.");
  assert(h.controller.start() === start, "The same controller must retain its accepted start acknowledgement instead of replaying the operation.");
  h.setRoute(sessionId);
  const reloadedActive = await roundTrip(h.runtime.getState());
  assert(getMasturbationSessionRouteView(reloadedActive, sessionId, Date.parse(startedAt)).kind === "active",
    "Reloaded active work must resume the same session without creating another record.");

  h.setTime(shift(startedAt, 5_123));
  const pause = h.controller.startPause();
  assert(pause !== null && h.controller.startPause() === pause, "Pause double-clicks must delegate once and share acknowledgement.");
  const paused = getMasturbationSessionRouteView(h.runtime.getState(), sessionId, Date.parse(shift(startedAt, 10_999)));
  assert(paused.kind === "active" && paused.paused && paused.elapsedSeconds === 10,
    "An active pause is part of the same physical session; elapsed display still includes its time.");
  h.attempts[1]!.succeed();
  assert((await pause).ok, "Pause must use acknowledged persistence.");
  h.setTime(shift(startedAt, 12_456));
  const resume = h.controller.endPause();
  assert(resume !== null, "Resume must delegate to the existing end-pause flow.");
  h.attempts[2]!.succeed();
  assert((await resume).ok, "Resume must preserve acknowledgement semantics.");
  const resumed = getMasturbationSessionRouteView(h.runtime.getState(), sessionId, Date.parse(shift(startedAt, 15_999)));
  assert(resumed.kind === "active" && !resumed.paused && resumed.elapsedSeconds === 15,
    "Resuming from pause must not restart or subtract from whole-session elapsed display.");
  h.setTime(shift(startedAt, 20_789));
  const end = h.controller.end();
  assert(end !== null && h.controller.end() === end, "Ending a session must share one in-flight acknowledgement.");
  const awaiting = h.runtime.getState().masturbationTracking.currentSession;
  assert(awaiting?.status === "awaiting_feedback" && awaiting.durationSeconds === 20 && awaiting.pauses[0]?.durationSeconds === 7,
    "Underlying transitions must retain whole session duration including the optional pause.");
  const callbacksBeforeEndReceipt = h.persisted.length;
  assert(!h.persisted.some((entry) => entry.operation === "end"), "Accepted physical end must not navigate as though durably saved yet.");
  h.attempts[3]!.succeed();
  assert((await end).ok && h.persisted.length === callbacksBeforeEndReceipt + 1, "Durable end may request feedback navigation exactly once.");
  const reloadedFeedback = await roundTrip(h.runtime.getState());
  assert(getMasturbationSessionRouteView(reloadedFeedback, sessionId, Date.parse(startedAt)).kind === "awaitingFeedback",
    "Awaiting feedback must survive reload without invented answers or another session.");
  h.setTime(shift(startedAt, 25_999));
  const feedback = { erectionQuality: 8 as const, usedExplicitContent: true, endingReason: "stoppedByChoice" as const };
  const completion = h.controller.completeFeedback(feedback);
  assert(completion !== null && h.controller.completeFeedback(feedback) === completion,
    "Duplicate feedback submissions must share the same in-flight operation even after accepted state clears currentSession.");
  const completed = h.runtime.getState();
  assert(completed.masturbationTracking.currentSession === null, "Feedback completion must clear only the canonical unfinished pointer.");
  const record = completed.masturbationTracking.sessions.find((entry) => entry.id === sessionId);
  equal(record, { ...awaiting, ...feedback, status: "completed" }, "The feature must pass the exact required feedback and preserve canonical physical facts.");
  const linked = completed.contentFree.violations.find((entry) => entry.source.kind === "masturbationSession" && entry.source.sessionId === sessionId);
  assert(linked?.occurredAt === awaiting.endedAt && linked.recordedAt === shift(startedAt, 25_999),
    "Existing session feedback must own atomic Content-Free reconciliation using physical end and recording time.");
  assert(!h.persisted.some((entry) => entry.operation === "completeFeedback"), "Feedback success navigation must await its durable receipt.");
  h.attempts[4]!.succeed();
  assert((await completion).ok && h.persisted.filter((entry) => entry.operation === "completeFeedback").length === 1,
    "Durable feedback may emit its terminal callback once.");
  await roundTrip(completed);
  assert(JSON.stringify(initial) === before, "The full executable flow must preserve its original snapshot and all unrelated feature facts.");
}

async function verifyRouteGuardsAndRecovery() {
  const invalidIds: unknown[] = [undefined, null, "", " ", [], ["guard-session"], ["guard-session", "other"], 42, "other-session"];
  for (const id of invalidIds) {
    const active = activeState();
    const h = createHarness(active);
    h.setRoute(id);
    assert(h.controller.startPause() === null && h.controller.endPause() === null && h.controller.end() === null,
      "Missing, non-scalar, blank, and mismatched resume IDs must not mutate the canonical active session.");
    assert(h.counts().clockCalls === 0 && h.counts().mutationCalls === 0 && h.attempts.length === 0,
      "Invalid route identity must be rejected before flow fact generation or command dispatch.");
    const feedback = createHarness(createPopulatedState());
    feedback.setRoute(id);
    assert(feedback.controller.completeFeedback({ erectionQuality: 8, usedExplicitContent: false, endingReason: "other" }) === null,
      "The feedback route must require the matching canonical awaiting-feedback ID.");
    assert(feedback.counts().mutationCalls === 0, "Invalid feedback routes must not mutate another session.");
  }
  const h = createHarness(activeState());
  h.setRoute("guard-session");
  assert(h.controller.completeFeedback({ erectionQuality: 8, usedExplicitContent: false, endingReason: "other" }) === null,
    "An active physical session cannot be completed by the feedback route.");
  const rendered = getMasturbationSessionRouteView(h.runtime.getState(), "guard-session", Date.parse(startedAt));
  assert(rendered.kind === "active", "The route may initially match a rendered active session.");
  const external = h.runtime.applyAcknowledgedMutation((state) => ({
    ...state,
    masturbationTracking: { ...state.masturbationTracking, currentSession: { id: "new-canonical-session", status: "active", startedAt, pauses: [] } }
  }));
  h.attempts[0]!.succeed();
  assert((await external).ok, "Fixture must replace canonical work before the stale handler fires.");
  const counts = h.counts();
  assert(h.controller.end() === null && h.controller.startPause() === null,
    "Handlers must re-read current canonical identity at invocation, not trust the earlier rendered route match.");
  equal(h.counts(), counts, "A stale handler must not dispatch after canonical identity changes.");
  const awaiting = createHarness(createPopulatedState());
  const session = awaiting.initialState.masturbationTracking.currentSession;
  assert(session?.status === "awaiting_feedback", "Awaiting-feedback recovery fixture required.");
  awaiting.setRoute(session.id);
  assert(awaiting.controller.end() === null && awaiting.controller.startPause() === null && awaiting.controller.endPause() === null,
    "Awaiting-feedback work must not be mistaken for an active resume/pause flow.");
  assert(awaiting.controller.start() !== null, "Existing unfinished work should remain an ordinary acknowledged start no-op, not create a second session.");
  assert(awaiting.runtime.getState() === awaiting.initialState && awaiting.attempts.length === 0,
    "Entering start with unfinished work must not overwrite or duplicate it.");
}

async function verifyAcknowledgementRetry() {
  const h = createHarness();
  const started = h.controller.start();
  assert(started !== null, "Explicit start must submit one flow action.");
  const accepted = h.runtime.getState();
  h.attempts[0]!.fail();
  const failure = await started;
  assert(!failure.ok && failure.accepted && failure.retryable && failure.reason === "persistenceFailed",
    "A failed write must retain accepted work and the runtime's retry token.");
  assert(h.controller.getSnapshot().result === failure && h.persisted.length === 0 && h.runtime.getDurableState() === h.initialState,
    "Controller feedback must expose the original failure without false durable progression or success callbacks.");
  const counts = h.counts();
  const session = accepted.masturbationTracking.currentSession;
  assert(session?.status === "active", "Failed-start accepted session required.");
  h.setRoute(session.id);
  assert(h.controller.start() === started && h.controller.startPause() === null && h.controller.end() === null,
    "Accepted unsaved work must not be replayed or overwritten by another controller operation.");
  const retry = h.controller.retry();
  assert(retry !== null && h.controller.retry() === retry, "Concurrent retry clicks must share the persistence-only retry operation.");
  assert(h.attempts.length === 2 && h.attempts[1]!.state === accepted && h.persisted.length === 0,
    "Retry must persist the same accepted snapshot and wait for its receipt.");
  h.attempts[1]!.succeed();
  assert((await retry).ok, "The existing runtime retry must acknowledge accepted work.");
  equal(h.counts(), counts, "Retry must not recreate IDs/timestamps or replay the flow/domain transition.");
  equal(h.persisted, [{ operation: "start", sessionId: session.id }], "Successful retry must retain the original operation/session navigation target exactly once.");
  assert(h.controller.retry() === null && h.controller.start() === retry,
    "A settled retry cannot emit another success or replay the accepted start.");
}

async function verifyStartAvailability() {
  const disabled = createHarness(createDefaultBloomState());
  const blocked = disabled.controller.start();
  assert(blocked !== null, "Explicit start delegates availability enforcement to existing product policy.");
  const rejected = await blocked;
  assert(!rejected.ok && !rejected.accepted && rejected.reason === "invalidSession" && disabled.attempts.length === 0,
    "Opening/starting this feature must never enable Tracking or fabricate success when disabled.");
  for (const elapsed of [15 * day - 1, 15 * day, 15 * day + 1]) {
    const state = createActiveState(false, true);
    state.masturbationTracking.enabled = true;
    assert(state.resetJourney.status === "active", "Active Reset fixture required.");
    const at = shift(state.resetJourney.currentAttempt.startedAt, elapsed);
    const availability = getMasturbationTrackingAvailability(state, at);
    assert(availability !== null, "Canonical explicit-time availability required.");
    const h = createHarness(state);
    h.setTime(at);
    const result = h.controller.start();
    assert(result !== null, "An explicit start should use the existing acknowledged flow.");
    if (elapsed < 15 * day) {
      const failed = await result;
      assert(!failed.ok && !availability.canStartSession && h.attempts.length === 0, "Before the current attempt's exact boundary, effective Reset restriction must block starting.");
    } else {
      assert(availability.canStartSession && h.attempts.length === 1, "At/after the elapsed boundary, persisted active Reset alone must not block an enabled start.");
      h.attempts[0]!.succeed();
      assert((await result).ok, "Boundary start must retain normal persistence acknowledgement.");
    }
    assert(h.runtime.getState().resetJourney === state.resetJourney && state.resetJourney.status === "active",
      "The feature must never auto-complete or alter Reset as part of starting a session.");
  }
}

function verifyRouteViews() {
  const state = activeState();
  const before = JSON.stringify(state);
  for (const value of [undefined, null]) assert(getMasturbationSessionRouteView(state, value, Date.parse(startedAt)).kind === "missing", "Absent route identity must be represented explicitly.");
  for (const value of ["", " ", [], ["guard-session"], 42]) assert(getMasturbationSessionRouteView(state, value, Date.parse(startedAt)).kind === "invalid", "Non-scalar or empty identity must not resolve to canonical work.");
  assert(getMasturbationSessionRouteView(state, "not-current", Date.parse(startedAt)).kind === "mismatch", "Stale or unknown identity must not silently start a new session.");
  const future = getMasturbationSessionRouteView(state, "guard-session", Date.parse(startedAt) - 1);
  assert(future.kind === "active" && future.elapsedSeconds === 0, "Display time must clamp an early clock to zero.");
  const unsafe = getMasturbationSessionRouteView(state, "guard-session", NaN);
  assert(unsafe.kind === "active" && unsafe.elapsedSeconds === null, "An invalid display clock must not invent elapsed time.");
  const history = createPopulatedState();
  assert(getMasturbationSessionRouteView(history, "session-1", Date.parse(startedAt)).kind === "completed", "A completed route identity must resolve as saved history, without editing the current unfinished session.");
  assert(typeof formatMasturbationElapsedSeconds(65) === "string" && typeof formatMasturbationElapsedSeconds(null) === "string", "Display formatting must handle real elapsed facts and unavailable timing safely.");
  assert(JSON.stringify(state) === before, "Route/timer reads must not mutate or persist ticking values.");
}

function verifyFeatureWiring() {
  const controller = readFileSync("src/features/masturbation-tracking/masturbationSessionController.ts", "utf8");
  assert(!/\b(?:AsyncStorage|persistBloomLocalState|saveBloomLocalState|startMasturbationSessionState|completeMasturbationSessionFeedbackState|Date\.now|new Date)\b/.test(controller),
    "The feature controller must use flow actions, without persistence, direct transitions, or mechanical fact generation.");
  const hook = readFileSync("src/features/masturbation-tracking/useMasturbationSessionFeature.ts", "utf8");
  assert(/getState:\s*getAcceptedState/.test(hook) && /useBloomProductFlowActions\(\)/.test(hook),
    "React must supply the live accepted-state accessor and existing flow API to route-safe handlers.");
  assert(/retryPersistedMutation/.test(hook) && !/AsyncStorage|persistBloomLocalState|saveBloomLocalState|startMasturbationSessionState|completeMasturbationSessionFeedbackState/.test(hook),
    "The hook must retain existing retry/flow boundaries without direct writes or reconciliation.");
  const screen = readFileSync("src/features/masturbation-tracking/screens/MasturbationSessionScreen.tsx", "utf8");
  for (const [mode, action] of [["start", "start"], ["active", "startPause"], ["active", "endPause"], ["active", "end"], ["feedback", "completeFeedback"]]) {
    assert(screen.includes(`useMasturbationSessionFeature("${mode}")`) && screen.includes(`actions.${action}`),
      `The ${mode} screen must use the matching feature callback ${action}.`);
  }
  assert(/onPress=\{actions\.start\}/.test(screen) && !/useEffect|createId|new Date|Date\.now|AsyncStorage|contentFree\.violations/.test(screen),
    "Starting must remain an explicit button event; screens must not generate facts, start on mount, persist ticks, or reconcile Content-Free.");
  assert(/key=\{view\.session\.id\}/.test(screen) && /onSubmit=\{actions\.completeFeedback\}/.test(screen),
    "Feedback choices must be scoped to the canonical session and submit through the feature action.");
  const parsed = ts.createSourceFile("MasturbationSessionScreen.tsx", screen, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
  const declarations: import("typescript").VariableDeclaration[] = [];
  const submissions: import("typescript").CallExpression[] = [];
  const visit = (node: import("typescript").Node) => {
    if (ts.isVariableDeclaration(node)) declarations.push(node);
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === "onSubmit") submissions.push(node);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  const qualities = declarations.find((node) => node.name.getText(parsed) === "erectionQualities")?.initializer;
  assert(qualities !== undefined && ts.isArrayLiteralExpression(qualities), "Feedback must expose the canonical numeric quality scale.");
  equal(qualities.elements.map((node) => Number(node.getText(parsed))), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "All ten integer erection-quality choices must be available without invented scoring.");
  const reasons = declarations.find((node) => node.name.getText(parsed) === "endingReasons")?.initializer;
  assert(reasons !== undefined && ts.isArrayLiteralExpression(reasons), "Feedback must expose the existing ending reasons.");
  const reasonValues = reasons.elements.map((node) => {
    assert(ts.isObjectLiteralExpression(node), "Ending option must have an explicit canonical value.");
    const value = node.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText(parsed) === "value");
    assert(value !== undefined && ts.isPropertyAssignment(value) && ts.isStringLiteral(value.initializer), "Ending option must use an existing enum string.");
    return value.initializer.text;
  });
  equal(reasonValues, ["climaxed", "stoppedBeforeClimax", "firmnessDecreased", "feltAnxious", "stoppedByChoice", "other"], "Screen choices must preserve all existing descriptive ending reasons.");
  const submission = submissions[0]?.arguments[0];
  assert(submissions.length === 1 && submission !== undefined && ts.isObjectLiteralExpression(submission), "Feedback must submit one explicit full semantic object.");
  equal(submission.properties.map((node) => node.name?.getText(parsed)), ["erectionQuality", "usedExplicitContent", "endingReason"], "Screen submission must contain only the three canonical feedback fields.");
}

async function verifyHookMountAndPersistenceNavigation() {
  const h = createHarness();
  const source = readFileSync("src/features/masturbation-tracking/useMasturbationSessionFeature.ts", "utf8");
  const slots: unknown[] = [];
  let cursor = 0;
  const effectSlots: Array<{ setup: () => void | (() => void); cleanup?: (() => void) | undefined; dependencies: readonly unknown[] }> = [];
  const pendingEffects: Array<() => void> = [];
  const timers = new Map<number, () => void>();
  const navigation: Array<{ intent?: unknown; mode?: unknown; path?: unknown }> = [];
  let params: { sessionId?: string | string[] } = {};
  let mode: "start" | "active" | "feedback" = "start";
  let timerId = 0;
  const sameDependencies = (left: readonly unknown[], right: readonly unknown[]) => left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
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
      return [cell.value, (value: T) => { cell.value = value; }] as const;
    },
    useMemo: <T>(create: () => T, dependencies: readonly unknown[]) => {
      const index = cursor++;
      const prior = slots[index] as { value: T; dependencies: readonly unknown[] } | undefined;
      if (prior === undefined || !sameDependencies(prior.dependencies, dependencies)) slots[index] = { value: create(), dependencies: Array.from(dependencies) };
      return (slots[index] as { value: T }).value;
    },
    useEffect: (setup: () => void | (() => void), dependencies: readonly unknown[]) => {
      const index = cursor++;
      const prior = slots[index] as typeof effectSlots[number] | undefined;
      if (prior === undefined || !sameDependencies(prior.dependencies, dependencies)) {
        const effect = { setup, dependencies: Array.from(dependencies), cleanup: undefined as (() => void) | undefined };
        slots[index] = effect;
        if (prior === undefined) effectSlots.push(effect);
        pendingEffects.push(() => { prior?.cleanup?.(); effect.cleanup = setup() ?? undefined; });
      }
    },
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => { cursor++; return getSnapshot(); }
  };
  const router = { replace: (path: unknown) => navigation.push({ path }) };
  const dependencies: Record<string, unknown> = {
    react,
    "expo-router": { useRouter: () => router, useLocalSearchParams: () => params },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => h.flowActions },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: h.runtime.getState(), durableState: h.runtime.getDurableState(), getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence }) },
    "../../app/navigation/navigateBloomProductFlow": { navigateBloomProductFlow: (_router: unknown, intent: unknown, mode: unknown) => navigation.push({ intent, mode }) },
    "../../constants/navigation": { routes: { home: "/existing-home" } },
    "../../domain/productPolicy/getMasturbationTrackingAvailability": { getMasturbationTrackingAvailability },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: () => () => undefined },
    "./masturbationSessionController": { createMasturbationSessionController },
    "./masturbationSessionView": { getMasturbationSessionRouteView }
  };
  const module = { exports: {} as Record<string, unknown> };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  class DisplayDate extends Date { static now() { return Date.parse(startedAt); } }
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, Date: DisplayDate,
    require: (name: string) => { assert(name in dependencies, `Unexpected session feature hook dependency ${name}.`); return dependencies[name]; },
    setInterval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearInterval: (id: number) => timers.delete(id)
  });
  type Feature = {
    busy: boolean; locked: boolean; canRetry: boolean; canContinue: boolean;
    actions: {
      start: () => void; startPause: () => void; end: () => void;
      retry: () => void; continueSession: () => void; close: () => void;
    };
  };
  const useFeature = module.exports.useMasturbationSessionFeature as (mode: "start" | "active" | "feedback") => Feature;
  const render = () => {
    cursor = 0;
    const feature = useFeature(mode);
    for (const effect of pendingEffects.splice(0)) effect();
    return feature;
  };
  let feature = render();
  render();
  for (const effect of effectSlots) { effect.cleanup?.(); effect.cleanup = effect.setup() ?? undefined; }
  for (const tick of timers.values()) tick();
  render();
  assert(h.attempts.length === 0 && h.counts().clockCalls === 0 && navigation.length === 0,
    "Actual hook mount, rerender, effect reattachment, and display ticks must never start a mutation or navigate automatically.");
  feature.actions.start();
  feature.actions.start();
  feature = render();
  assert(feature.busy && !feature.canContinue && h.counts().mutationCalls === 1 && navigation.length === 0,
    "Explicit duplicate Start clicks must share one operation and forbid continuation while save acknowledgement is pending.");
  h.attempts[0]!.fail();
  await new Promise<void>((done) => setImmediate(done));
  feature = render();
  assert(feature.locked && feature.canRetry && !feature.canContinue && navigation.length === 0,
    "The actual hook must retain accepted-unsaved recovery feedback and never navigate on failed persistence.");
  const counts = h.counts();
  feature.actions.retry();
  h.attempts[1]!.succeed();
  await new Promise<void>((done) => setImmediate(done));
  feature = render();
  equal(h.counts(), counts, "Hook retry must use the existing persistence-only token path, without regenerating flow facts.");
  const current = h.runtime.getState().masturbationTracking.currentSession;
  assert(current?.status === "active" && !feature.locked && feature.canContinue, "Durable retry completion must recover the existing canonical active session.");
  // The actual hook creates its intent in the VM realm; compare its plain
  // payload independently of that realm's Object prototype.
  equal(JSON.parse(JSON.stringify(navigation)), [{ intent: { flow: "masturbationSession", mode: "resume", sessionId: current.id }, mode: "replace" }],
    "Only successful durable acknowledgement may explicitly request the correct active-session destination.");

  mode = "active";
  params = { sessionId: current.id };
  let activeFeature = render();
  assert(activeFeature.canContinue && !activeFeature.locked, "The retained-handler fixture must begin on a valid actionable active route.");
  const beforePauseNavigation = navigation.length;
  const pauseWrite = h.attempts.length;
  const priorCanonicalSession = h.runtime.getState().masturbationTracking.currentSession;
  activeFeature.actions.startPause();
  assert(h.attempts.length === pauseWrite + 1 && h.runtime.getState().masturbationTracking.currentSession !== priorCanonicalSession,
    "The retained Continue fixture must accept a real session mutation before React rerenders.");
  activeFeature.actions.continueSession();
  assert(navigation.length === beforePauseNavigation,
    "An old same-controller Continue closure must recheck live operation busy state instead of trusting its rendered canContinue=true.");
  h.attempts[pauseWrite]!.succeed();
  await new Promise<void>((done) => setImmediate(done));
  activeFeature.actions.continueSession();
  assert(navigation.length === beforePauseNavigation,
    "After that save settles but before rerender, retained Continue must still reject the stale rendered session object against current canonical state.");
  activeFeature = render();
  assert(activeFeature.canContinue && !activeFeature.locked, "A fresh render must recover continuation for the newly durable current session.");
  const retainedActions = activeFeature.actions;
  params = { sessionId: "different-route-session" };
  render();
  const beforeStaleHandlers = {
    state: h.runtime.getState(), counts: h.counts(), writes: h.attempts.length, navigations: navigation.length
  };
  retainedActions.startPause();
  retainedActions.end();
  retainedActions.continueSession();
  retainedActions.close();
  equal(h.counts(), beforeStaleHandlers.counts, "Callbacks retained from a prior route/controller must not dispatch or generate facts, even when their old session ID still matches canonical state.");
  assert(h.runtime.getState() === beforeStaleHandlers.state && h.attempts.length === beforeStaleHandlers.writes &&
    navigation.length === beforeStaleHandlers.navigations,
  "Stale route-instance callbacks must neither save another operation nor navigate away from the current route.");

  params = { sessionId: current.id };
  const beforeUnmount = render();
  assert(beforeUnmount.canContinue && !beforeUnmount.locked, "Unmount guard must be tested on a valid actionable route.");
  for (const effect of effectSlots) effect.cleanup?.();
  beforeUnmount.actions.startPause();
  beforeUnmount.actions.end();
  beforeUnmount.actions.continueSession();
  beforeUnmount.actions.close();
  equal(h.counts(), beforeStaleHandlers.counts, "Unmounted feature actions must not dispatch commands or regenerate facts.");
  assert(h.runtime.getState() === beforeStaleHandlers.state && h.attempts.length === beforeStaleHandlers.writes &&
    navigation.length === beforeStaleHandlers.navigations,
  "Unmounted action closures must not save state or execute navigation.");
}

function createHarness(initialState = enabledState()) {
  let at = startedAt;
  let clockCalls = 0;
  let idCalls = 0;
  let mutationCalls = 0;
  let routeSessionId: unknown;
  const persisted: Array<{ operation: string; sessionId: string | null }> = [];
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({
    initialState,
    initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({
        state,
        succeed: () => resolve({ status: "persisted", writeId, generation: 0 }),
        fail: () => reject(new Error("Synthetic session feature persistence failure."))
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
    createId: (prefix) => { idCalls++; return `${prefix}-feature-${idCalls}`; }
  });
  const makeController = () => createMasturbationSessionController({
    flowActions,
    getState: runtime.getState,
    getRouteSessionId: () => routeSessionId,
    retryPersistedMutation: runtime.retryPersistence,
    onPersisted: (operation, sessionId) => persisted.push({ operation, sessionId })
  });
  const controller = makeController();
  return {
    initialState, runtime, flowActions, attempts, controller, makeController, persisted,
    setRoute: (value: unknown) => { routeSessionId = value; },
    setTime: (value: string) => { at = value; },
    counts: () => ({ clockCalls, idCalls, mutationCalls })
  };
}

function enabledState() {
  const state = createDefaultBloomState();
  state.masturbationTracking.enabled = true;
  return state;
}

function activeState() {
  const state = enabledState();
  state.masturbationTracking.currentSession = { id: "guard-session", status: "active", startedAt, pauses: [] };
  return state;
}

async function roundTrip(state: BloomLocalState) {
  const storage = new FeatureStorage();
  const now = () => new Date("2026-12-01T12:00:00.000Z");
  await persistBloomLocalState(state, storage, now);
  const loaded = await loadBloomLocalState(storage, now);
  assert(loaded.status === "success" && loaded.source === "current", "Unfinished feature state must reload from current v7 storage.");
  equal(loaded.state, state, "Reload must preserve physical session/feedback facts without automatic lifecycle advancement.");
  return loaded.state;
}

function shift(at: string, milliseconds: number) {
  return new Date(Date.parse(at) + milliseconds).toISOString();
}
function equal(actual: unknown, expected: unknown, message: string) {
  assert(isDeepStrictEqual(actual, expected), message);
}
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
class FeatureStorage implements StorageClient {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
  async getAllKeys() { return [...this.values.keys()]; }
}
