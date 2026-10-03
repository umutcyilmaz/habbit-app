import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";
import { createBloomProductFlowActions, type BloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime, type BloomPersistedMutationResult } from "../src/app/providers/bloomLocalStateMutationRuntime";
import type { CompletedMasturbationSession } from "../src/domain/models/MasturbationTrackingState";
import { getTrackingResetRecommendation } from "../src/domain/reset/getTrackingResetRecommendation";
import { createResetRecommendationController, type AcceptedResetRecommendation } from "../src/features/reset-recommendation/resetRecommendationController";
import { getResetRecommendationView, sameResetRecommendationFacts, type ResetRecommendationView } from "../src/features/reset-recommendation/resetRecommendationView";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import type { BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { createActiveState } from "./verify-bloom-reset-violations";

const at = "2026-10-03T12:00:00.000Z";
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
type Feature = {
  view: ResetRecommendationView; busy: boolean; locked: boolean; canRetry: boolean; canContinue: boolean; recovery: boolean;
  saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed"; message: string | null;
  actions: { accept: () => void; retry: () => void; continueAfterSave: () => void; close: () => void };
};
type Element = { type: unknown; props: Record<string, unknown> };

export async function verifyBloomResetRecommendationFeature() {
  verifyViews();
  await verifyControllers();
  await verifyHooks();
  verifyScreen();
  verifySourceBoundaries();
  console.log("Bloom Reset recommendation feature verification passed (derived/compatibility views, authoritative no-op, stale references, one-command acceptance, retained successor retry, durable actual-ID navigation, superseded saves, close isolation, and controlled hook/screen execution).");
}

function verifyViews() {
  const state = entryState();
  const before = JSON.stringify(state);
  const view = getResetRecommendationView(state, at);
  assert(view.kind === "trackingRecommendation", "Recommended Tracking must expose the derived review view.");
  equal(view.recommendation, getTrackingResetRecommendation(state.masturbationTracking, at), "Evidence must come directly from Phase 2A.");
  assert(JSON.stringify(state) === before && state.resetJourney.status === "inactive", "Reading advice must not materialize a recommended Reset.");
  for (const enabled of [true, false]) for (const activeContent of [true, false]) {
    const candidate = entryState();
    candidate.masturbationTracking.enabled = enabled;
    if (activeContent) candidate.contentFree = createActiveState(false, true).contentFree;
    equal(getResetRecommendationView(candidate, at), view, "Tracking preference and Content-Free cannot affect recommendation presentation.");
  }
  const noTrend = entryState();
  noTrend.masturbationTracking.sessions = noTrend.masturbationTracking.sessions.map((session) => ({ ...session, erectionQuality: 8 }));
  assert(getResetRecommendationView(noTrend, at).kind === "unavailable", "No current advice must not offer acceptance.");
  const short = entryState(); short.masturbationTracking.sessions.pop();
  assert(getResetRecommendationView(short, at).kind === "unavailable" && getResetRecommendationView(state, "invalid").kind === "unavailable", "Insufficient or invalid evidence cannot offer acceptance.");
  const persisted = persistedState();
  equal(getResetRecommendationView(persisted, at), { kind: "persistedRecommendation" }, "Persisted recommendation must work without invented evidence.");
  assert(getResetRecommendationView(persisted, "invalid").kind === "unavailable", "Malformed display time must safely fail for compatibility advice too.");
  for (const candidate of [state, persisted]) {
    for (const status of ["active", "awaiting_feedback"] as const) {
      const blocked = { ...candidate, masturbationTracking: { ...candidate.masturbationTracking,
        currentSession: status === "active" ? { id: "unfinished", status, startedAt: at, pauses: [] }
          : { id: "unfinished", status, startedAt: at, endedAt: at, durationSeconds: 0, pauses: [] } } };
      assert(getResetRecommendationView(blocked, at).kind === "unavailable", "Unfinished Tracking must block both recommendation cases.");
    }
    const unresolved = { ...candidate, productOnboarding: { status: "completed", planAcceptance: null, result: {} } } as BloomLocalState;
    assert(getResetRecommendationView(unresolved, at).kind === "unavailable", "Unresolved Starting Recommendation must block review acceptance.");
  }
  for (const status of ["baseline_pending", "active", "completed"] as const) {
    const candidate = { ...state, resetJourney: { ...state.resetJourney, status, id: "other" } } as BloomLocalState;
    assert(getResetRecommendationView(candidate, at).kind === "unavailable", "Existing baseline/active/completed Reset cannot prepare another journey.");
  }
}

async function verifyControllers() {
  for (const initial of [entryState(), persistedState()]) {
    const h = harness(initial);
    const pending = h.controller.accept(initial);
    assert(pending !== null && h.controller.accept(initial) === pending, "Duplicate acceptance must share one command and pending receipt.");
    const accepted = h.runtime.getState();
    assert(accepted.resetJourney.status === "baseline_pending" && h.controller.getSnapshot().acceptedReset === accepted.resetJourney,
      "Controller must retain the actual accepted successor independently of its unavailable ordinary view.");
    assert(accepted.resetJourney.id === (initial.resetJourney.status === "recommended" ? initial.resetJourney.id : "reset-journey-recommendation-1"),
      "Compatibility acceptance must reuse the persisted journey ID, not the candidate ID.");
    equal(h.calls, [{ path: "reset.acceptRecommendation", args: [] }], "Acceptance must call only the parameter-free flow command.");
    for (const key of Object.keys(initial) as Array<keyof BloomLocalState>) if (key !== "resetJourney") {
      assert(accepted[key] === initial[key], `Acceptance must preserve ${key} identity.`);
    }
    assert(!("baseline" in accepted.resetJourney) && !("currentAttempt" in accepted.resetJourney) && !("startedAt" in accepted.resetJourney), "Acceptance must not start Reset or answer baseline.");
    assert(h.persisted.length === 0, "Optimistic acceptance cannot trigger navigation.");
    h.attempts[0]!.fail(); const failed = await pending;
    assert(!failed.ok && failed.accepted && failed.retryable && h.controller.getSnapshot().message !== null, "Failed accepted save must remain recoverable.");
    assert(h.controller.accept(accepted) === null, "Accepted failed save must lock duplicate acceptance.");
    const retry = h.controller.retry();
    assert(retry !== null && h.controller.retry() === retry && h.attempts[1]!.state === accepted, "Retry must save the retained successor and coalesce duplicate presses.");
    h.attempts[1]!.succeed(); assert((await retry).ok, "Retry should confirm durability.");
    assert(h.persisted[0] === accepted.resetJourney, "Durable callback must use the actual accepted Reset.");
    equal(h.counts(), { clocks: 1, ids: 1, mutations: 1 }, "Retry must not repeat command, time, candidate ID, or transition.");
  }
  for (const key of ["resetJourney", "masturbationTracking", "productOnboarding"] as const) {
    const h = harness();
    const changed = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, [key]: { ...state[key] } }));
    assert(h.controller.accept(h.initial) === null && h.calls.length === 0 && h.controller.getSnapshot().message !== null,
      "Known stale rendered Reset/Tracking/onboarding references must reject before dispatch.");
    h.attempts[0]!.succeed(); await changed;
  }
  const cutoff = harness();
  cutoff.setOperationTime("2026-01-05T12:00:00.000Z");
  const noOp = await cutoff.controller.accept(cutoff.initial);
  assert(noOp !== null && !noOp.ok && !noOp.accepted && cutoff.runtime.getState() === cutoff.initial &&
    cutoff.controller.getSnapshot().acceptedReset === null && cutoff.controller.getSnapshot().message !== null && cutoff.persisted.length === 0,
  "Authoritative operation-time revalidation must reject an apparently visible recommendation whose sixth session is still future-ended.");
  assert(cutoff.attempts.length === 0, "An authoritative no-op must not fabricate a persisted successor.");
}

async function verifyHooks() {
  for (const initial of [entryState(), persistedState()]) {
    const h = harness(initial); const ui = hookHarness(h);
    ui.setHydrated(false); let feature = ui.render(); feature.actions.accept();
    assert(feature.locked && feature.view.kind === "unavailable" && h.calls.length === 0, "Hydration must gate cached views and commands.");
    ui.setHydrated(true); feature = ui.render(); ui.hooks.reattachEffects(); ui.tick(); feature = ui.render();
    assert(!feature.locked && h.calls.length === 0 && ui.navigation.length === 0, "Mount, effects, and evidence clocks must remain read-only.");
    const stale = feature.actions;
    feature.actions.accept(); stale.accept(); feature = ui.render();
    assert(feature.busy && feature.locked && feature.recovery && feature.view.kind === "unavailable" && ui.blocked(), "Accepted baseline must retain guarded recovery after advice disappears.");
    feature.actions.close(); feature.actions.continueAfterSave();
    assert(ui.navigation.length === 0 && Number(h.calls.length) === 1, "Pending acceptance must neither leave nor dispatch twice.");
    h.attempts[0]!.fail(); await flush(); feature = ui.render();
    assert(feature.canRetry && !feature.canContinue && feature.locked && ui.blocked(), "Failed accepted save must offer token retry and protect navigation.");
    feature.actions.accept(); stale.accept(); feature.actions.close();
    assert(Number(h.calls.length) === 1 && ui.navigation.length === 0, "Failed acceptance cannot be replayed or bypassed by Close.");
    feature.actions.retry(); h.attempts[1]!.succeed(); await flush(); feature = ui.render();
    const journeyId = initial.resetJourney.status === "recommended" ? initial.resetJourney.id : "reset-journey-recommendation-1";
    equal(ui.navigation, [{ intent: { flow: "resetBaseline", journeyId }, method: "replace" }], "Durable retry must replace to baseline with the actual accepted journey ID.");
    equal(h.counts(), { clocks: 1, ids: 1, mutations: 1 }, "Hook retry must generate no second ID/time or acceptance.");
    assert(feature.canContinue && !ui.blocked(), "Durable recovery must allow deliberate fallback continuation.");
    ui.hooks.unmount(); feature.actions.accept(); feature.actions.retry(); feature.actions.close(); feature.actions.continueAfterSave();
    assert(Number(ui.navigation.length) === 1 && Number(h.calls.length) === 1, "Unmounted handlers must not navigate or mutate.");
  }
  const closing = harness(); const closingUi = hookHarness(closing); closingUi.render().actions.close();
  equal(closingUi.navigation, [{ path: "/existing-today" }], "Close must return to existing Today.");
  assert(closing.calls.length === 0 && closing.attempts.length === 0 && closing.runtime.getState() === closing.initial, "Close must not persist acceptance, dismissal, or decline.");
  closingUi.hooks.unmount();
  const stale = harness(); const staleUi = hookHarness(stale); const old = staleUi.render();
  const correction = stale.runtime.applyAcknowledgedMutation((state) => ({ ...state, masturbationTracking: { ...state.masturbationTracking,
    sessions: state.masturbationTracking.sessions.map((session) => ({ ...session, usedExplicitContent: false })) } }));
  old.actions.accept(); assert(stale.calls.length === 0, "Hook must pass rendered facts to guard corrected feedback before submission.");
  stale.attempts[0]!.succeed(); await correction;
  assert(staleUi.render().view.kind === "unavailable", "Canonical feedback correction must immediately remove derived advice.");
  staleUi.hooks.unmount();
  const rejected = harness(); rejected.setOperationTime("2026-01-05T12:00:00.000Z");
  const rejectedUi = hookHarness(rejected); rejectedUi.render().actions.accept(); await flush();
  const rejectedFeature = rejectedUi.render();
  assert(!rejectedFeature.recovery && !rejectedFeature.canContinue && rejectedFeature.message !== null && rejectedFeature.saveState === "unavailable" && rejectedUi.navigation.length === 0,
    "A transition no-op must report safe unavailable feedback without fake saved acceptance or navigation.");
  rejectedUi.hooks.unmount();
  for (const key of ["masturbationTracking", "productOnboarding"] as const) {
    const h = harness(); const ui = hookHarness(h); ui.render().actions.accept();
    const newer = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, [key]: { ...state[key] } }));
    h.attempts[0]!.succeed(); await flush();
    let feature = ui.render();
    assert(feature.saveState === "unconfirmed" && ui.blocked() && !feature.canContinue && ui.navigation.length === 0,
      "Original acceptance success cannot navigate while newer relevant facts remain undurable.");
    feature.actions.close(); feature.actions.continueAfterSave();
    assert(ui.navigation.length === 0, "Relevant pending changes must protect all navigation actions.");
    h.attempts[1]!.succeed(); await newer; feature = ui.render();
    assert(feature.canContinue && ui.navigation.length === 0, "A newer relevant durable save enables explicit recovery, never delayed auto-navigation.");
    const staleContinue = feature.actions.continueAfterSave;
    const newest = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, [key]: { ...state[key] } }));
    staleContinue(); assert(ui.navigation.length === 0, "A retained Continue closure must reject newer relevant accepted references before a rerender.");
    h.attempts[2]!.succeed(); await newest; ui.render().actions.continueAfterSave();
    assert(Number(ui.navigation.length) === 1, "Current durable facts must permit deliberate baseline continuation.");
    ui.hooks.unmount();
  }
  for (const replaceController of [false, true]) {
    const h = harness(); const ui = hookHarness(h); const feature = ui.render(); feature.actions.accept();
    if (replaceController) { ui.replaceFlow(); ui.render(); } else ui.hooks.unmount();
    feature.actions.accept(); feature.actions.retry(); h.attempts[0]!.succeed(); await flush();
    assert(ui.navigation.length === 0 && h.calls.length === 1, "Unmounted or replaced controller callbacks must not navigate or replay.");
    ui.hooks.unmount();
  }
  // An unrelated newer save can supersede the original receipt while retaining
  // the same accepted Reset. Its acknowledgement permits deliberate recovery.
  for (const replaceReset of [false, true]) {
    const h = harness(); const ui = hookHarness(h); ui.render().actions.accept();
    const newer = h.runtime.applyAcknowledgedMutation((state) => replaceReset
      ? { ...state, resetJourney: createDefaultBloomState().resetJourney }
      : { ...state, contentFree: { ...state.contentFree } });
    h.attempts[1]!.succeed(); await newer; h.attempts[0]!.succeed(); await flush();
    const feature = ui.render();
    assert(!feature.canRetry && !ui.blocked() && ui.navigation.length === 0, "Superseded receipts must neither auto-navigate nor trap a later durable state.");
    assert(feature.canContinue === !replaceReset, "Only the same durable accepted Reset can continue to baseline.");
    if (replaceReset) { feature.actions.continueAfterSave(); assert(ui.navigation.length === 0, "Replaced Reset cannot navigate an old accepted ID."); feature.actions.close(); }
    else feature.actions.continueAfterSave();
    equal(ui.navigation, replaceReset ? [{ path: "/existing-today" }] : [{ intent: { flow: "resetBaseline", journeyId: "reset-journey-recommendation-1" }, method: "replace" }],
      "Recovery must use explicit Continue for same-Reset durability or safe Close for a different durable state.");
    ui.hooks.unmount();
  }
}

function verifyScreen() {
  const h = harness(); const ui = hookHarness(h); let feature = ui.render();
  const source = readFileSync("src/features/reset-recommendation/screens/ResetRecommendationScreen.tsx", "utf8");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", StyleSheet: { create: (styles: unknown) => styles } },
    "../../../shared/design-system/theme": { theme: { spacing: { lg: 12 } } },
    "../useResetRecommendationFeature": { useResetRecommendationFeature: () => feature }
  };
  for (const name of ["AppScreen", "AppCard", "AppText", "AppButton"]) dependencies[`../../../shared/components/${name}`] = { [name]: name };
  const screen = compileModule(source, dependencies).ResetRecommendationScreen as () => Element;
  let tree = screen();
  for (const part of ["evidence", "previous-quality", "recent-quality", "explicit-ratio", "interval", "signal.erectionQualityDownwardTrend", "signal.recentExplicitContentPattern", "accept", "close"]) {
    required(tree, `bloom.reset-recommendation.${part}`);
  }
  assert(element(tree, "bloom.reset-recommendation.persisted") === null, "Tracking evidence screen must not claim a persisted recommendation.");
  let accepts = 0;
  feature = { ...feature, actions: { ...feature.actions, accept: () => { accepts++; } } };
  press(screen(), "bloom.reset-recommendation.accept"); assert(accepts === 1, "CTA must wire only the feature acceptance action.");
  feature = { ...feature, view: getResetRecommendationView(persistedState(), at) }; tree = screen();
  required(tree, "bloom.reset-recommendation.persisted");
  assert(element(tree, "bloom.reset-recommendation.evidence") === null, "Compatibility screen must fabricate no Tracking evidence.");
  feature = { ...feature, recovery: true, locked: true, canRetry: true, canContinue: false, view: { kind: "unavailable" }, saveState: "unconfirmed" }; tree = screen();
  required(tree, "bloom.reset-recommendation.recovery"); required(tree, "bloom.reset-recommendation.retry");
  assert(required(tree, "bloom.reset-recommendation.continue").props.disabled === true && required(tree, "bloom.reset-recommendation.close").props.disabled === true &&
    element(tree, "bloom.reset-recommendation.accept") === null, "Accepted failed save must retain retry and disable exit without another acceptance CTA.");
  ui.hooks.unmount();
}

function verifySourceBoundaries() {
  const prefix = "src/features/reset-recommendation/";
  for (const file of ["resetRecommendationView.ts", "resetRecommendationController.ts", "useResetRecommendationFeature.ts", "screens/ResetRecommendationScreen.tsx"]) {
    const source = readFileSync(prefix + file, "utf8");
    for (const forbidden of ["startFromBaseline", "useLocalSearchParams", "productActions.", "createId(", "AsyncStorage", "recommendedAt"]) {
      assert(!source.includes(forbidden), `Feature ${file} must not introduce ${forbidden}.`);
    }
  }
  const screen = readFileSync(prefix + "screens/ResetRecommendationScreen.tsx", "utf8");
  assert(!/getTrackingResetRecommendation\s*\(/.test(screen) && !screen.includes("flowActions"), "Screen must not own evidence rules or mutation commands.");
}

function entryState(): BloomLocalState {
  const state = createDefaultBloomState();
  const origin = Date.parse("2026-01-01T12:00:00.000Z");
  const sessions: CompletedMasturbationSession[] = Array.from({ length: 6 }, (_, index) => ({
    id: `history-${index}`, status: "completed", startedAt: new Date(origin + index * 86400000).toISOString(),
    endedAt: new Date(origin + index * 86400000 + 60000).toISOString(), durationSeconds: 60, pauses: [],
    erectionQuality: index < 3 ? 8 : 6, usedExplicitContent: index >= 4, endingReason: "climaxed"
  }));
  return { ...state, masturbationTracking: { ...state.masturbationTracking, enabled: true, sessions } };
}
function persistedState(): BloomLocalState {
  const state = createDefaultBloomState();
  return { ...state, resetJourney: { ...state.resetJourney, status: "recommended", id: "existing-recommended-id" } };
}
function harness(initial = entryState()) {
  let operationTime = at;
  let clocks = 0, ids = 0, mutations = 0;
  const calls: Array<{ path: string; args: unknown[] }> = [];
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState: initial, initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolveReceipt, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({ state, succeed: () => resolveReceipt({ status: "persisted", writeId, generation: 0 }), fail: () => reject(new Error("Synthetic recommendation save failure")) });
    })
  });
  const productActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: (mutation) => runtime.applyAcknowledgedMutation((state) => { mutations++; return mutation(state); }) });
  const original = createBloomProductFlowActions({ productActions, now: () => { clocks++; return new Date(operationTime); }, createId: (prefix) => `${prefix}-recommendation-${++ids}` });
  const flow = { ...original, reset: { ...original.reset, acceptRecommendation: () => { calls.push({ path: "reset.acceptRecommendation", args: [] }); return original.reset.acceptRecommendation(); } } };
  const persisted: AcceptedResetRecommendation[] = [];
  const controller = createResetRecommendationController({ flowActions: flow, getState: runtime.getState, getDisplayTime: () => at,
    retryPersistedMutation: runtime.retryPersistence, onPersisted: (reset) => persisted.push(reset) });
  return { initial, runtime, flow, calls, attempts, persisted, controller, setOperationTime: (value: string) => { operationTime = value; }, counts: () => ({ clocks, ids, mutations }) };
}

function hookHarness(h: ReturnType<typeof harness>) {
  const hooks = controlledHooks(); const navigation: unknown[] = [];
  let hydrated = true, blocked = false, flow: BloomProductFlowActions = h.flow;
  const timers = new Map<number, () => void>(); let timerId = 0;
  const dependencies: Record<string, unknown> = {
    react: hooks.react, "expo-router": { useRouter: () => ({ replace: (path: unknown) => navigation.push({ path }) }) },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => flow },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: h.runtime.getState(), durableState: h.runtime.getDurableState(),
      getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated: hydrated, hydrationStatus: hydrated ? "ready" : "loading" }) },
    "../../app/navigation/navigateBloomProductFlow": { navigateBloomProductFlow: (_router: unknown, intent: unknown, method: unknown) => { navigation.push({ intent, method }); return true; } },
    "../../constants/navigation": { routes: { home: "/existing-today" } },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: (value: boolean) => { blocked = value; return () => {}; } },
    "./resetRecommendationController": { createResetRecommendationController },
    "./resetRecommendationView": { getResetRecommendationView, sameResetRecommendationFacts }
  };
  class DisplayDate extends Date { static now() { return Date.parse(at); } }
  const exported = compileModule(readFileSync("src/features/reset-recommendation/useResetRecommendationFeature.ts", "utf8"), dependencies, { Date: DisplayDate,
    setInterval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; }, clearInterval: (id: number) => timers.delete(id) });
  const useFeature = exported.useResetRecommendationFeature as () => Feature;
  return { hooks, navigation, render: () => hooks.render(useFeature), blocked: () => blocked, setHydrated: (value: boolean) => { hydrated = value; },
    replaceFlow: () => { flow = { ...flow }; }, tick: () => { timers.forEach((callback) => callback()); } };
}

function compileModule(source: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, unknown> };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  runInNewContext(compiled.outputText, { module, exports: module.exports, ...globals,
    require: (name: string) => { assert(name in dependencies, `Unexpected Reset recommendation dependency ${name}.`); return dependencies[name]; } });
  return module.exports;
}
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const item = node as Element; return [item, ...elements(item.props.children)];
}
function element(tree: Element, id: string) { return elements(tree).find((item) => item.props.testID === id) ?? null; }
function required(tree: Element, id: string) { const found = element(tree, id); assert(found !== null, `Expected Reset recommendation control ${id}.`); return found; }
function press(tree: Element, id: string) { const handler = required(tree, id).props.onPress; assert(typeof handler === "function", `Expected handler ${id}.`); handler(); return handler as () => void; }
function controlledHooks() {
  const slots: unknown[] = []; let cursor = 0;
  const effects: Array<{ setup: () => void | (() => void); cleanup: (() => void) | undefined }> = [];
  const pending: Array<() => void> = [];
  const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const react = {
    useRef: <T>(initial: T) => { const index = cursor++; if (slots[index] === undefined) slots[index] = { current: initial }; return slots[index] as { current: T }; },
    useState: <T>(initial: T | (() => T)) => {
      const index = cursor++; if (slots[index] === undefined) slots[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial };
      const cell = slots[index] as { value: T }; return [cell.value, (value: T) => { cell.value = value; }] as const;
    },
    useMemo: <T>(create: () => T, dependencies: readonly unknown[]) => {
      const index = cursor++; const old = slots[index] as { value: T; dependencies: readonly unknown[] } | undefined;
      if (old === undefined || !same(old.dependencies, dependencies)) slots[index] = { value: create(), dependencies: Array.from(dependencies) };
      return (slots[index] as { value: T }).value;
    },
    useEffect: (setup: () => void | (() => void), dependencies: readonly unknown[]) => {
      const index = cursor++; const old = slots[index] as { dependencies: readonly unknown[]; cleanup?: () => void } | undefined;
      if (old === undefined || !same(old.dependencies, dependencies)) {
        const effect = { setup, dependencies: Array.from(dependencies), cleanup: undefined as (() => void) | undefined };
        slots[index] = effect; effects.push(effect); pending.push(() => { old?.cleanup?.(); effect.cleanup = setup() ?? undefined; });
      }
    },
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => { cursor++; return get(); }
  };
  return { react, render: <T>(render: () => T) => { cursor = 0; const result = render(); pending.splice(0).forEach((effect) => effect()); return result; },
    reattachEffects: () => { effects.forEach((effect) => { effect.cleanup?.(); effect.cleanup = effect.setup() ?? undefined; }); },
    unmount: () => { effects.forEach((effect) => effect.cleanup?.()); } };
}
function flush() { return new Promise<void>((done) => setImmediate(done)); }
function equal(actual: unknown, expected: unknown, message: string) {
  assert(isDeepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected))), message);
}
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
