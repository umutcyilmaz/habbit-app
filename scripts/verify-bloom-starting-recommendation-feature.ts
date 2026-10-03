import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";
import { createBloomProductFlowActions, type BloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import type { OnboardingRecommendation } from "../src/domain/models/OnboardingDimensions";
import { getBloomHomeReadModel } from "../src/domain/home/getBloomHomeReadModel";
import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import { createStartingRecommendationController } from "../src/features/starting-recommendation/startingRecommendationController";
import {
  getStartingRecommendationView, sameStartingRecommendationFacts, isStartingRecommendationSuccessorCurrent,
  type StartingRecommendationView, type AcceptedStartingRecommendation
} from "../src/features/starting-recommendation/startingRecommendationView";
import { acceptProductOnboardingRecommendationState, createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createActiveState } from "./verify-bloom-reset-violations";
import { createTrackingResetRecommendationState } from "./verify-bloom-reset-recommendation-acceptance";

const at = "2026-10-03T12:00:00.000Z";
const plans = ["masturbation_tracking", "content_free", "reset", "reset_and_content_free"] as const;
const relevant = ["productOnboarding", "masturbationTracking", "resetJourney", "contentFree"] as const;
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
type Feature = {
  view: StartingRecommendationView; busy: boolean; locked: boolean; canRetry: boolean; canContinue: boolean; recovery: boolean; canClose: boolean;
  saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed"; message: string | null;
  actions: { accept: () => void; retry: () => void; continueAfterSave: () => void; close: () => void };
};
type Element = { type: unknown; props: Record<string, unknown> };

export async function verifyBloomStartingRecommendationFeature() {
  verifyViews();
  await verifyControllers();
  await verifyConflicts();
  await verifyHooks();
  await verifyRecoveryRaces();
  verifyHomeAcceptance();
  verifyScreen();
  verifySourceBoundaries();
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Starting review must retain v7 persistence.");
  console.log("Bloom Starting recommendation feature verification passed (four historical plans without rescoring, atomic existing acceptance, exact successor retry, all-four-reference stale guards, durable destinations, no-op/conflict recovery, Home priorities, and controlled hook/screen execution).");
}

function verifyViews() {
  equal(getStartingRecommendationView(createDefaultBloomState()), { kind: "unavailable" }, "Uncompleted onboarding has no stored recommendation review.");
  for (const plan of plans) {
    const state = entryState(plan);
    assert(state.productOnboarding.status === "completed", "Stored result required.");
    const stored = state.productOnboarding.result;
    const fresh = scoreBloomOnboarding(stored.answers, stored.completedAt);
    if (plan !== "reset_and_content_free") assert(fresh.recommendation !== plan, "Historical fixture must differ from a current rescore.");
    const before = JSON.stringify(state);
    freeze(state);
    equal(getStartingRecommendationView(state), { kind: "recommendation", recommendation: plan }, "View must return exactly the stored historical recommendation, never rescore it.");
    assert(JSON.stringify(state) === before && state.productOnboarding.result === stored, "Frozen view reads preserve all facts and references.");
    const accepted = acceptProductOnboardingRecommendationState(state, { acceptedAt: at, resetJourneyId: "view-reset", contentFreeActivationId: "view-content" });
    assert(accepted !== state && getStartingRecommendationView(accepted).kind === "unavailable", "Accepted plans disappear from the ordinary review view.");
  }
  for (const malformed of [null, {}, { productOnboarding: null }, { productOnboarding: { status: "completed", planAcceptance: null, result: {} } }]) {
    assert(getStartingRecommendationView(malformed as BloomLocalState).kind === "unavailable", "Malformed stored onboarding must fail safely without inventing a recommendation.");
  }
}

async function verifyControllers() {
  for (const plan of plans) for (const failFirst of [false, true]) {
    const initial = entryState(plan); const before = JSON.stringify(initial); freeze(initial);
    const h = harness(initial);
    const pending = h.controller.accept(initial);
    assert(pending !== null && h.controller.accept(initial) === pending, "Repeated presses must share one pending acceptance command.");
    const accepted = h.runtime.getState();
    assert(h.controller.getSnapshot().acceptedFacts === accepted, "Recovery must retain the exact accepted state, not reconstructed expectations.");
    assertSuccessor(initial, accepted, plan);
    assert(h.attempts.length === 1 && h.attempts[0]!.state === accepted && h.persisted.length === 0, "One atomic complete successor is saved and no success callback runs optimistically.");
    if (failFirst) {
      h.attempts[0]!.fail(); const result = await pending;
      assert(!result.ok && result.accepted && result.retryable, "Accepted failure must retain token recovery.");
      assert(h.controller.accept(initial) === null && h.controller.getSnapshot().acceptedFacts === accepted, "Failed accepted state must block another logical acceptance.");
      const retry = h.controller.retry(); assert(retry !== null, "Retained failure must retry.");
      assert(h.attempts[1]!.state === accepted && h.runtime.getState() === accepted, "Retry must save the identical accepted snapshot.");
      h.attempts[1]!.succeed(); assert((await retry).ok, "Retry acknowledgement required.");
    } else {
      h.attempts[0]!.succeed(); assert((await pending).ok, "Successful acknowledgement required.");
    }
    assert(Number(h.persisted.length) === 1 && h.persisted[0] === accepted && h.runtime.getDurableState() === accepted, "Only durable acceptance reports the actual successor.");
    equal(h.calls, [{ path: "onboarding.acceptRecommendation", args: [] }], "Every plan uses only one existing parameter-free onboarding flow command.");
    equal(h.counts(), { clocks: 1, ids: 2, mutations: 1 }, "Existing flow allocates its two candidates and one Date once; retry generates no facts.");
    assert(JSON.stringify(initial) === before, "Controller and canonical acceptance must not mutate input.");
  }
  for (const key of relevant) {
    const h = harness(); const expected = h.runtime.getState();
    const newer = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, [key]: { ...state[key] } }));
    assert(h.controller.accept(expected) === null && h.calls.length === 0 && h.controller.getSnapshot().message !== null,
      `${key}: changed rendered reference must reject before generating facts or dispatching acceptance.`);
    h.attempts[0]!.succeed(); await newer;
  }
}

async function verifyConflicts() {
  const cases: BloomLocalState[] = [];
  for (const plan of plans) {
    for (const status of ["active", "awaiting_feedback"] as const) {
      const state = entryState(plan);
      state.masturbationTracking.currentSession = status === "active"
        ? { id: "unfinished", status, startedAt: at, pauses: [] }
        : { id: "unfinished", status, startedAt: at, endedAt: at, durationSeconds: 0, pauses: [] };
      cases.push(state);
    }
    const active = entryState(plan); active.resetJourney = createActiveState(false, false).resetJourney; cases.push(active);
    const prepared = entryState(plan); prepared.resetJourney = { ...prepared.resetJourney, status: "baseline_pending", id: "existing" }; cases.push(prepared);
    const malformed = entryState(plan); malformed.masturbationTracking = { ...malformed.masturbationTracking, sessions: [null] } as unknown as BloomLocalState["masturbationTracking"]; cases.push(malformed);
    if (plan !== "masturbation_tracking") { const enabled = entryState(plan); enabled.masturbationTracking.enabled = true; cases.push(enabled); }
    if (plan === "content_free" || plan === "reset_and_content_free") {
      const content = entryState(plan); content.contentFree = createActiveState(false, true).contentFree; cases.push(content);
    }
  }
  for (const state of cases) {
    assert(getStartingRecommendationView(state).kind === "recommendation", "Presentation must not reimplement canonical acceptance conflict rules.");
    const h = harness(state); const ui = hookHarness(h); ui.render().actions.accept(); await flush();
    const feature = ui.render();
    assert(h.calls.length === 1 && h.runtime.getState() === state && h.attempts.length === 0 && !feature.recovery &&
      feature.saveState === "unavailable" && feature.message !== null && ui.navigation.length === 0,
      "The existing authoritative no-op must create no saved claim, partial state, retry, or navigation.");
    ui.hooks.unmount();
  }
  const accepted = acceptProductOnboardingRecommendationState(entryState(), { acceptedAt: at });
  const h = harness(accepted); assert(h.controller.accept(accepted) === null && h.calls.length === 0, "An already accepted plan cannot be submitted again.");
}

async function verifyHooks() {
  for (const plan of plans) for (const failFirst of [false, true]) {
    const h = harness(entryState(plan)); const ui = hookHarness(h);
    ui.setHydrated(false); let feature = ui.render(); feature.actions.accept(); feature.actions.close();
    assert(feature.locked && !feature.canClose && feature.view.kind === "unavailable" && h.calls.length === 0 && ui.navigation.length === 0, "Hydration gates review, acceptance, and exit.");
    ui.setHydrated(true); feature = ui.render(); ui.hooks.reattachEffects(); feature = ui.render();
    assert(h.calls.length === 0 && ui.navigation.length === 0, "Mount and effect reattachment cannot accept or navigate automatically.");
    feature.actions.accept(); feature.actions.accept(); feature = ui.render();
    const accepted = h.runtime.getState();
    assert(feature.recovery && feature.view.kind === "unavailable" && feature.locked && !feature.canClose && ui.blocked(), "Accepted plans retain guarded recovery when their ordinary view disappears.");
    feature.actions.close(); feature.actions.continueAfterSave(); assert(ui.navigation.length === 0, "Pending save cannot be bypassed by exit or Continue.");
    if (failFirst) {
      h.attempts[0]!.fail(); await flush(); feature = ui.render();
      assert(feature.canRetry && !feature.canContinue && !feature.canClose && ui.blocked(), "Failed acceptance must offer token retry and retain exit protection.");
      feature.actions.accept(); feature.actions.close(); feature.actions.retry();
      assert(h.attempts[1]!.state === accepted && Number(h.calls.length) === 1, "Hook retry must use the retained whole successor without logical replay.");
      h.attempts[1]!.succeed();
    } else h.attempts[0]!.succeed();
    await flush(); feature = ui.render();
    equal(ui.navigation, [destination(accepted)], "Durable routing follows the original accepted plan and actual Reset ID, never a URL or generated candidate in React.");
    equal(h.counts(), { clocks: 1, ids: 2, mutations: 1 }, "All four hooks retry without additional facts.");
    assert(feature.canContinue && feature.canClose && !ui.blocked(), "Durable recovery allows explicit fallback continuation.");
    ui.hooks.unmount(); feature.actions.accept(); feature.actions.retry(); feature.actions.close(); feature.actions.continueAfterSave();
    assert(Number(ui.navigation.length) === 1 && Number(h.calls.length) === 1, "Unmounted handlers cannot navigate or mutate.");
  }
  for (const plan of plans) {
    const h = harness(entryState(plan)); const ui = hookHarness(h); ui.render().actions.close();
    equal(ui.navigation, [{ path: "/existing-today" }], "Closing untouched review returns to Today.");
    assert(h.attempts.length === 0 && h.calls.length === 0 && h.runtime.getState() === h.initial, "Close cannot persist acceptance or dismissal."); ui.hooks.unmount();
  }
  const h = harness(entryState("reset")); const ui = hookHarness(h); const old = ui.render();
  const changed = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, productOnboarding: entryState("content_free").productOnboarding }));
  old.actions.accept(); assert(h.calls.length === 0, "A retained handler for plan A must not knowingly accept plan B.");
  h.attempts[0]!.succeed(); await changed;
  equal(ui.render().view, { kind: "recommendation", recommendation: "content_free" }, "The parameter-free route must show latest accepted plan B."); ui.hooks.unmount();
  for (const replace of [false, true]) {
    const h = harness(entryState("reset_and_content_free")); const ui = hookHarness(h); const feature = ui.render(); feature.actions.accept();
    if (replace) { ui.replaceFlow(); ui.render(); } else ui.hooks.unmount();
    h.attempts[0]!.succeed(); await flush(); feature.actions.close();
    assert(ui.navigation.length === 0 && h.calls.length === 1, "Old/unmounted controller callbacks cannot navigate after save."); ui.hooks.unmount();
  }
}

async function verifyRecoveryRaces() {
  for (const key of relevant) {
    const h = harness(entryState("reset_and_content_free")); const ui = hookHarness(h); ui.render().actions.accept();
    const newer = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, [key]: { ...state[key] } }));
    h.attempts[0]!.succeed(); await flush(); let feature = ui.render();
    feature.actions.close(); feature.actions.continueAfterSave();
    assert(ui.navigation.length === 0 && ui.blocked() && !feature.canContinue, "An older successful receipt must not bypass newer relevant undurable state.");
    h.attempts[1]!.succeed(); await newer; feature = ui.render();
    assert(ui.navigation.length === 0 && !ui.blocked(), "Cumulative durability unlocks recovery but never automatically navigates from an old receipt.");
    if (key === "productOnboarding" || key === "resetJourney") {
      assert(!feature.canContinue, "Replaced accepted identity must not navigate the old Reset target."); feature.actions.close();
    } else {
      assert(feature.canContinue, "The same accepted plan/Reset may explicitly continue after newer relevant facts become durable.");
      const staleContinue = feature.actions.continueAfterSave;
      const later = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, contentFree: { ...state.contentFree } }));
      staleContinue(); assert(ui.navigation.length === 0, "A stale Continue closure cannot bypass a new pre-render accepted mutation.");
      h.attempts[2]!.succeed(); await later; ui.render().actions.continueAfterSave();
    }
    assert(Number(ui.navigation.length) === 1, "Recovery must provide one deliberate safe exit."); ui.hooks.unmount();
  }
  const h = harness(entryState("reset_and_content_free")); const ui = hookHarness(h); ui.render().actions.accept();
  const accepted = h.runtime.getState();
  const newer = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, debug: { ...state.debug } }));
  h.attempts[1]!.succeed(); await newer; h.attempts[0]!.fail(); await flush();
  const feature = ui.render();
  assert(!feature.canRetry && feature.canContinue && !ui.blocked() && ui.navigation.length === 0, "Superseded failure must recover through explicit Continue when a cumulative snapshot already saved the plan.");
  feature.actions.continueAfterSave(); equal(ui.navigation, [destination(accepted)], "Superseded recovery retains the original accepted plan/Reset ID."); ui.hooks.unmount();
}

function verifyHomeAcceptance() {
  for (const plan of plans) {
    const state = entryState(plan);
    equal(getBloomHomeReadModel(state, at)?.primaryAction, { id: "reviewStartingRecommendation" }, "Unaccepted starting plan stays a primary action without payload.");
    const accepted = acceptProductOnboardingRecommendationState(state, { acceptedAt: at, resetJourneyId: "home-accepted-reset", contentFreeActivationId: "home-content" });
    const home = getBloomHomeReadModel(accepted, at); assert(home !== null, "Accepted Home facts must be readable.");
    equal(home.primaryAction, plan === "masturbation_tracking" ? { id: "startMasturbationSession" }
      : plan === "content_free" ? { id: "viewContentFree" } : { id: "completeResetBaseline", journeyId: "home-accepted-reset" },
    "After acceptance ordinary resulting state must own Home priority.");
    if (plan === "reset_and_content_free") assert(home.primaryTracker?.kind === "contentFree", "Combined baseline priority must retain Content-Free representation.");
  }
  const state = entryState();
  state.masturbationTracking = { ...createTrackingResetRecommendationState().masturbationTracking, enabled: false };
  const before = getBloomHomeReadModel(state, at);
  assert(before?.trackingResetRecommendation.status === "recommended" && before.resetRecommendationAction === null, "Unresolved starting advice must still suppress Phase2B optional advice.");
  const accepted = acceptProductOnboardingRecommendationState(state, { acceptedAt: at });
  const after = getBloomHomeReadModel(accepted, at);
  equal(after?.resetRecommendationAction, { id: "reviewResetRecommendation" }, "Phase2B optional advice may appear after accepted Tracking onboarding when history supports it.");
  equal(after?.primaryAction, { id: "startMasturbationSession" }, "Optional Reset advice must not replace normal Tracking after acceptance.");
}

function verifyScreen() {
  const h = harness(); const ui = hookHarness(h); let feature = ui.render();
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", StyleSheet: { create: (styles: unknown) => styles } },
    "../../../shared/design-system/theme": { theme: { spacing: { lg: 12 } } },
    "../useStartingRecommendationFeature": { useStartingRecommendationFeature: () => feature }
  };
  for (const name of ["AppScreen", "AppCard", "AppText", "AppButton"]) dependencies[`../../../shared/components/${name}`] = { [name]: name };
  const screen = compileModule(readFileSync("src/features/starting-recommendation/screens/StartingRecommendationScreen.tsx", "utf8"), dependencies).StartingRecommendationScreen as () => Element;
  let accepts = 0;
  for (const plan of plans) {
    feature = { ...feature, view: getStartingRecommendationView(entryState(plan)), actions: { ...feature.actions, accept: () => { accepts++; } } };
    const tree = screen(); required(tree, `bloom.starting-recommendation.plan.${plan}`);
    press(tree, "bloom.starting-recommendation.accept");
  }
  assert(accepts === 4, "Each stored plan renders and wires the same acceptance action.");
  feature = { ...feature, recovery: true, locked: true, canRetry: true, canContinue: false, canClose: false, saveState: "unconfirmed", view: { kind: "unavailable" } };
  const tree = screen(); required(tree, "bloom.starting-recommendation.recovery"); required(tree, "bloom.starting-recommendation.retry");
  assert(required(tree, "bloom.starting-recommendation.close").props.disabled === true && required(tree, "bloom.starting-recommendation.continue").props.disabled === true &&
    element(tree, "bloom.starting-recommendation.accept") === null, "Unavailable ordinary view must retain Retry while blocking duplicate acceptance and exit.");
  ui.hooks.unmount();
}

function verifySourceBoundaries() {
  const prefix = "src/features/starting-recommendation/";
  for (const file of ["startingRecommendationView.ts", "startingRecommendationController.ts", "useStartingRecommendationFeature.ts", "screens/StartingRecommendationScreen.tsx"]) {
    const source = readFileSync(prefix + file, "utf8");
    for (const forbidden of ["scoreBloomOnboarding", "startFromBaseline", "useLocalSearchParams", "productActions.", "createId(", "AsyncStorage", "Date.now", "new Date", "setInterval"]) {
      assert(!source.includes(forbidden), `Starting feature ${file} must not introduce ${forbidden}.`);
    }
  }
  const controller = readFileSync(prefix + "startingRecommendationController.ts", "utf8");
  equal(controller.match(/options\.flowActions\.[\w.]+\(/g), ["options.flowActions.onboarding.acceptRecommendation("], "Only the existing onboarding acceptance flow may be dispatched.");
}

function entryState(recommendation: OnboardingRecommendation = "masturbation_tracking"): BloomLocalState {
  const state = createDefaultBloomState();
  const onboarding = createActiveState(false, false).productOnboarding;
  assert(onboarding.status === "completed", "Existing historical result fixture required.");
  state.productOnboarding = { status: "completed", result: { ...onboarding.result, recommendation }, planAcceptance: null };
  const normalized = validateAndNormalizeBloomState(state);
  assert(normalized.success, "Stored historical plan fixtures must validate without rescoring.");
  return normalized.state;
}

function assertSuccessor(initial: BloomLocalState, accepted: BloomLocalState, plan: OnboardingRecommendation) {
  const onboarding = accepted.productOnboarding;
  assert(onboarding.status === "completed" && onboarding.planAcceptance?.recommendation === plan && onboarding.planAcceptance.acceptedAt === at,
    "Existing transition records the original stored plan and one operation timestamp.");
  assert(initial.productOnboarding.status === "completed" && onboarding.result === initial.productOnboarding.result, "Acceptance must retain historical stored scoring output exactly.");
  const hasReset = plan === "reset" || plan === "reset_and_content_free";
  const hasContent = plan === "content_free" || plan === "reset_and_content_free";
  if (hasReset) {
    equal(accepted.resetJourney, { ...initial.resetJourney, status: "baseline_pending", id: "reset-journey-recommendation-1" }, "Reset acceptance prepares only the existing baseline-pending shape using actual flow identity.");
    assert(!("baseline" in accepted.resetJourney) && !("startedAt" in accepted.resetJourney) && !("currentAttempt" in accepted.resetJourney), "Recommendation acceptance must not start a period or invent baseline answers.");
  } else assert(accepted.resetJourney === initial.resetJourney, "Non-Reset plans preserve Reset reference.");
  if (hasContent) assert(accepted.contentFree.status === "active" && accepted.contentFree.activationId === "content-free-activation-recommendation-2" &&
    accepted.contentFree.activatedAt === at && accepted.contentFree.currentStreakStartedAt === at, "Content-Free activates once from existing flow facts in the same atomic successor.");
  else assert(accepted.contentFree === initial.contentFree, "Other plans preserve Content-Free reference.");
  assert(accepted.masturbationTracking.enabled === (plan === "masturbation_tracking") && accepted.masturbationTracking.currentSession === null &&
    accepted.masturbationTracking.sessions === initial.masturbationTracking.sessions, "Only Tracking plan enables it; no recommendation starts a session or edits history.");
  if (plan !== "masturbation_tracking") assert(accepted.masturbationTracking === initial.masturbationTracking, "Non-Tracking plans preserve the whole Tracking reference.");
  for (const key of Object.keys(initial) as Array<keyof BloomLocalState>) {
    if (!relevant.includes(key as typeof relevant[number])) assert(accepted[key] === initial[key], `${key}: onboarding acceptance must leave unrelated legacy/product facts alone.`);
  }
  assert(validateAndNormalizeBloomState(accepted).success, "Accepted plans remain existing valid v7 shapes.");
}

function destination(accepted: BloomLocalState) {
  assert(accepted.productOnboarding.status === "completed" && accepted.productOnboarding.planAcceptance !== null, "Expected accepted plan destination.");
  const plan = accepted.productOnboarding.planAcceptance.recommendation;
  if (plan === "reset" || plan === "reset_and_content_free") {
    assert(accepted.resetJourney.status === "baseline_pending", "Reset plan must have actual baseline target.");
    return { intent: { flow: "resetBaseline", journeyId: accepted.resetJourney.id }, method: "replace" };
  }
  return { path: "/existing-today" };
}

function freeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
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
  const flow = { ...original, onboarding: { ...original.onboarding, acceptRecommendation: () => { calls.push({ path: "onboarding.acceptRecommendation", args: [] }); return original.onboarding.acceptRecommendation(); } } };
  const persisted: AcceptedStartingRecommendation[] = [];
  const controller = createStartingRecommendationController({ flowActions: flow, getState: runtime.getState,
    retryPersistedMutation: runtime.retryPersistence, onPersisted: (reset) => persisted.push(reset) });
  return { initial, runtime, flow, calls, attempts, persisted, controller, setOperationTime: (value: string) => { operationTime = value; }, counts: () => ({ clocks, ids, mutations }) };
}

function hookHarness(h: ReturnType<typeof harness>) {
  const hooks = controlledHooks(); const navigation: unknown[] = [];
  let hydrated = true, blocked = false, flow: BloomProductFlowActions = h.flow;
  const dependencies: Record<string, unknown> = {
    react: hooks.react, "expo-router": { useRouter: () => ({ replace: (path: unknown) => navigation.push({ path }) }) },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => flow },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: h.runtime.getState(), durableState: h.runtime.getDurableState(),
      getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated: hydrated, hydrationStatus: hydrated ? "ready" : "loading" }) },
    "../../app/navigation/navigateBloomProductFlow": { navigateBloomProductFlow: (_router: unknown, intent: unknown, method: unknown) => { navigation.push({ intent, method }); return true; } },
    "../../constants/navigation": { routes: { home: "/existing-today" } },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: (value: boolean) => { blocked = value; return () => {}; } },
    "./startingRecommendationController": { createStartingRecommendationController },
    "./startingRecommendationView": { getStartingRecommendationView, sameStartingRecommendationFacts, isStartingRecommendationSuccessorCurrent }
  };
  const exported = compileModule(readFileSync("src/features/starting-recommendation/useStartingRecommendationFeature.ts", "utf8"), dependencies);
  const useFeature = exported.useStartingRecommendationFeature as () => Feature;
  return { hooks, navigation, render: () => hooks.render(useFeature), blocked: () => blocked, setHydrated: (value: boolean) => { hydrated = value; },
    replaceFlow: () => { flow = { ...flow }; } };
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
