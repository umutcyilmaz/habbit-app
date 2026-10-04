import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";
import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime, type BloomPersistedMutationResult } from "../src/app/providers/bloomLocalStateMutationRuntime";
import type { CurrentUrgeControlTrigger, LegacyUrgeControlTrigger, UrgeControlOutcome, UrgeControlTechnique, UrgeControlState } from "../src/domain/models";
import { getUrgeControlProgress } from "../src/domain/urgeControl/getUrgeControlProgress";
import { createUrgeControlController, type UrgeControlOperation } from "../src/features/urge-control/urgeControlController";
import { getUrgeControlRouteView } from "../src/features/urge-control/urgeControlView";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createActiveState } from "./verify-bloom-reset-violations";
import { createPopulatedState } from "./verify-bloom-product-persistence";

const at = "2026-11-01T12:00:00.000Z";
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
type Harness = ReturnType<typeof harness>;
type Feature = {
  view: ReturnType<typeof getUrgeControlRouteView>;
  locked: boolean; busy: boolean; canRetry: boolean; canContinue: boolean; terminalReceipt: boolean;
  saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed"; message: string | null;
  actions: {
    completeInterrupt: () => void; selectTechnique: (value: UrgeControlTechnique) => void;
    startPhoneAway: () => void; endPhoneAway: () => void; recordOutcome: (value: UrgeControlOutcome) => void;
    recordTrigger: (value: LegacyUrgeControlTrigger) => void; recordTriggers: (value: CurrentUrgeControlTrigger[]) => void;
    complete: () => void; discardActive: () => void; retry: () => void; continueAfterSave: () => void; closeUnavailable: () => void;
  };
};
const currentTriggers = ["boredom", "stress", "loneliness", "fatigue", "explicitContentCue", "habitAutomatic", "specificSituation", "other"];

export async function verifyBloomUrgeControlFeature() {
  verifyRouteViews();
  await verifyControllerLifecycles();
  await verifyIdentityAndLegacySafety();
  await verifyHookRecovery();
  verifyScreensAndDraft();
  verifyFeatureBoundary();
  console.log("Bloom Urge Control feature verification passed (current/legacy executable steps, every-step failure/retry, strict identity, stale stage/handlers, immutable cue isolation, guarded terminal recovery, durable Today navigation, legacy safety, and controlled screen drafts).");
}

function verifyRouteViews() {
  for (const current of [true, false]) {
    const state = initial(current);
    const before = JSON.stringify(state);
    for (const id of [undefined, null]) equal(getUrgeControlRouteView(state.urgeControl, id, at), { kind: "missing" }, "Absent identity must never select active work.");
    for (const id of ["", " ", [], ["urge-feature"], ["urge-feature", "urge-feature"], 42, {}]) {
      equal(getUrgeControlRouteView(state.urgeControl, id, at), { kind: "invalid" }, "Malformed or duplicated route identity must fail safely.");
    }
    equal(getUrgeControlRouteView(state.urgeControl, "wrong", at), { kind: "mismatch" }, "Another event ID cannot target the current active event.");
    equal(getUrgeControlRouteView(state.urgeControl, "urge-feature", "invalid"), { kind: "unavailable" }, "Invalid display time must not create progress.");
    const view = getUrgeControlRouteView(state.urgeControl, "urge-feature", at);
    assert(view.kind === (current ? "current" : "legacy"), "Version-specific route view must reflect persisted facts.");
    assert(view.kind === "current" || view.kind === "legacy", "Active route view required.");
    assert(view.event === state.urgeControl.activeEvent, "View must retain the exact accepted event identity.");
    equal(view.progress, getUrgeControlProgress(state.urgeControl, at), "Stage and timing must come from canonical Urge progress.");
    equal(getUrgeControlRouteView(state.urgeControl, "urge-feature", at), view, "Route view must be deterministic.");
    assert(JSON.stringify(state) === before, "Route reads must mutate nothing.");
  }
  const completed = createPopulatedState().urgeControl;
  assert(completed.records[0] !== undefined, "Historical fixture required.");
  equal(getUrgeControlRouteView({ ...completed, activeEvent: null }, completed.records[0].id, at), { kind: "mismatch" }, "Historical completed events cannot be resumed.");
}

async function verifyControllerLifecycles() {
  for (const current of [true, false]) {
    const h = harness(initial(current));
    const original = h.runtime.getState();
    const stages = current ? ["interrupt", "outcome", "triggers", "readyToComplete"] : ["interrupt", "technique", "phoneAwayReady", "phoneAwayActive", "outcome", "trigger", "readyToComplete"];
    for (const stage of stages) {
      const urge = h.runtime.getState().urgeControl;
      const view = getUrgeControlRouteView(urge, "urge-feature", at);
      assert((view.kind === "current" || view.kind === "legacy") && view.progress.stage === stage, "Accepted state must own each executable stage.");
      const selection: CurrentUrgeControlTrigger[] = ["explicitContentCue", "stress"];
      const dispatch = () => step(h, stage, urge, selection);
      const pending = dispatch();
      assert(pending !== null && dispatch() === pending, "Duplicate presses must share one in-flight logical step.");
      const accepted = h.runtime.getState();
      assert(accepted !== original && h.persisted.length === stages.indexOf(stage), "Accepted progress cannot publish a durable receipt before saving.");
      unrelated(original, accepted);
      equal(selection, ["explicitContentCue", "stress"], "Trigger submission must preserve the local draft.");
      if (stage === "triggers") {
        selection.push("other");
        equal(accepted.urgeControl.activeEvent?.triggers, ["explicitContentCue", "stress"], "Accepted selections must be detached from later draft changes.");
      }
      await failAndRetry(h, pending);
      assert(h.runtime.getDurableState() === accepted && h.persisted[h.persisted.length - 1]?.urge === accepted.urgeControl, "Retry receipt must belong to the same accepted snapshot.");
      if (!current) {
        const event = accepted.urgeControl.activeEvent ?? accepted.urgeControl.records[accepted.urgeControl.records.length - 1];
        assert(event !== undefined && !("flowVersion" in event) && !("triggers" in event), "Legacy feature steps must never upgrade or map historical facts.");
      }
      await roundTrip(accepted);
    }
    assert(h.runtime.getState().urgeControl.activeEvent === null && h.persisted[h.persisted.length - 1]?.operation === "complete", "Completion must retain a terminal receipt after activeEvent disappears.");
    equal(h.counts(), { clocks: current ? 2 : 4, ids: 0, mutations: stages.length }, "Resume steps may generate only their canonical operation times, once each, and no IDs.");
  }
  for (const current of [true, false]) {
    const h = harness(initial(current));
    const original = h.runtime.getState();
    const pending = h.controller.discardActive(original.urgeControl);
    assert(pending !== null && h.runtime.getState().urgeControl.activeEvent === null && h.persisted.length === 0, "Explicit discard accepts only the active slot and awaits durable receipt.");
    await failAndRetry(h, pending);
    assert(h.persisted[0]?.operation === "discardActive" && h.runtime.getState().urgeControl.records === original.urgeControl.records, "Durable discard preserves completed history and its explicit operation identity.");
    unrelated(original, h.runtime.getState());
  }
}

async function failAndRetry(h: Harness, pending: Promise<BloomPersistedMutationResult>) {
  const accepted = h.runtime.getState();
  const callbacks = h.persisted.length;
  h.attempts[h.attempts.length - 1]!.fail();
  const failed = await pending;
  assert(!failed.ok && failed.accepted && failed.retryable && h.persisted.length === callbacks, "Every accepted save failure must retain retry recovery without a success callback.");
  assert(h.controller.discardActive(accepted.urgeControl) === null && h.controller.completeInterrupt(accepted.urgeControl) === null, "Accepted failure locks all conflicting commands.");
  const counts = h.counts();
  const retry = h.controller.retry();
  assert(retry !== null && h.controller.retry() === retry && h.attempts[h.attempts.length - 1]!.state === accepted, "Retry must persist precisely the same snapshot and deduplicate retry presses.");
  h.attempts[h.attempts.length - 1]!.succeed();
  assert((await retry).ok && h.persisted.length === callbacks + 1 && h.controller.retry() === null, "Retry success publishes one receipt, without logical replay.");
  equal(h.counts(), counts, "Retry must not regenerate times/IDs or repeat any logical step.");
}

async function verifyIdentityAndLegacySafety() {
  for (const eventId of [undefined, null, "", " ", ["urge-feature"], ["urge-feature", "urge-feature"], "stale", 42]) {
    const h = harness(); h.setRoute(eventId);
    assert(h.controller.completeInterrupt(h.runtime.getState().urgeControl) === null && h.controller.discardActive(h.runtime.getState().urgeControl) === null, "Invalid route identity cannot mutate or discard another event.");
    equal(h.counts(), { clocks: 0, ids: 0, mutations: 0 }, "Invalid routes generate no mutation facts.");
  }
  const h = harness();
  const displayed = h.runtime.getState().urgeControl;
  const first = h.controller.completeInterrupt(displayed);
  assert(first !== null, "First current step required.");
  h.attempts[0]!.succeed(); await first;
  const counts = h.counts();
  assert(h.controller.recordOutcome("reduced", displayed) === null, "A stale rendered slice cannot submit against a newer accepted event.");
  equal(h.counts(), counts, "Stale handlers generate no IDs/times or commands.");
  assert(h.controller.selectTechnique("urgeSurfing", h.runtime.getState().urgeControl) === null, "Current views never dispatch legacy-only operations.");

  const legacy = createPopulatedState();
  const old = legacy.urgeControl.activeEvent;
  assert(old !== null && old.phoneAwayStartedAt !== undefined && old.phoneAwayEndedAt === undefined, "Recoverable historical unordered fixture required.");
  const recovering = harness(legacy); recovering.setRoute(old.id);
  const recovered = recovering.controller.endPhoneAway(legacy.urgeControl);
  assert(recovered !== null && recovering.runtime.getState().urgeControl.activeEvent?.phoneAwayEndedAt === at, "Legacy phone-away stage must recover through its canonical operation.");
  await failAndRetry(recovering, recovered);
  const unsafe = initial(false);
  unsafe.urgeControl.activeEvent = { id: "urge-feature", status: "active", startedAt: at, selectedTechnique: "urgeSurfing", phoneAwayStartedAt: at };
  const blocked = harness(unsafe); blocked.setTime("2026-11-01T12:01:00.000Z");
  const rejection = blocked.controller.completeInterrupt(unsafe.urgeControl);
  assert(rejection !== null && !(await rejection).ok && blocked.runtime.getState() === unsafe && blocked.attempts.length === 0,
    "Historical chronology that cannot safely accept a present-time step must remain unchanged with a rejected receipt.");
  assert(blocked.controller.getSnapshot().message !== null, "Unsafe historical resume must show sanitized unavailability.");
  const discarded = blocked.controller.discardActive(unsafe.urgeControl);
  assert(discarded !== null, "Valid but blocked historical events remain explicitly discardable.");
  blocked.attempts[0]!.succeed(); await discarded;
}

async function verifyHookRecovery() {
  for (const current of [true, false]) {
    const h = harness(initial(current));
    const hook = hookHarness(h);
    let feature = hook.render();
    assert(!feature.locked && feature.saveState === "saved", "Hydrated identity-matched resume begins available.");
    const initialCounts = h.counts();
    hook.tick(); hook.render(); hook.hooks.reattachEffects(); hook.render();
    equal(h.counts(), initialCounts, "Rendering/effect reattachment/display clocks must cause no persisted action.");
    const stages = current ? ["interrupt", "outcome", "triggers", "readyToComplete"] : ["interrupt", "technique", "phoneAwayReady", "phoneAwayActive", "outcome", "trigger", "readyToComplete"];
    for (const stage of stages) {
      feature = hook.render();
      assert((feature.view.kind === "current" || feature.view.kind === "legacy") && feature.view.progress.stage === stage, "Hook must derive current stage despite stale URL stage=interrupt.");
      const before = h.counts();
      invokeStage(feature, stage);
      feature = hook.render();
      assert(feature.busy && feature.locked && hook.blocked() && hook.navigation.length === 0, "Every accepted step blocks navigation until persistence settles.");
      if (stage === "readyToComplete") assert(feature.terminalReceipt && feature.view.kind === "mismatch", "Terminal optimistic completion must retain recovery after the active route disappears.");
      h.attempts[h.attempts.length - 1]!.fail(); await flush();
      feature = hook.render();
      assert(!feature.busy && feature.locked && feature.canRetry && hook.blocked() && feature.saveState === "unconfirmed", "Failed accepted step must remain guarded, locked, and retryable.");
      const count = h.counts();
      feature.actions.discardActive(); feature.actions.complete();
      equal(h.counts(), count, "Failed accepted mutation cannot be followed by a conflicting command.");
      feature.actions.retry();
      h.attempts[h.attempts.length - 1]!.succeed(); await flush();
      equal(h.counts(), count, "Hook retry must never replay the stage or regenerate facts.");
      feature = hook.render();
      if (stage !== "readyToComplete") assert(!feature.locked && !hook.blocked() && hook.navigation.length === 0, "Durable internal step stays on the same route without forced URL stage changes.");
      assert(h.counts().mutations === before.mutations + 1, "One press is one acknowledged logical command.");
    }
    equal(hook.navigation, ["/(tabs)/today"], "Only durable completion replaces with existing Today.");
    hook.hooks.unmount();
  }

  const h = harness(); const hook = hookHarness(h);
  hook.setHydration(false, "loading");
  let feature = hook.render();
  assert(feature.locked && feature.saveState === "loading" && feature.view.kind === "unavailable", "Loading hides cached active facts and disables mutations.");
  feature.actions.completeInterrupt(); assert(h.attempts.length === 0, "Unhydrated actions cannot dispatch.");
  hook.setHydration(false, "error"); assert(hook.render().saveState === "unavailable", "Hydration failure stays unavailable.");
  hook.setHydration(true, "ready"); feature = hook.render();
  const old = feature.actions;
  hook.setParams({ eventId: "replacement", stage: "readyToComplete" }); hook.render();
  old.completeInterrupt(); old.discardActive();
  assert(h.attempts.length === 0, "Callbacks from replaced controllers must not dispatch.");
  hook.setParams({ eventId: "urge-feature", stage: ["nonsense", "trigger"] }); feature = hook.render();
  assert((feature.view.kind === "current" || feature.view.kind === "legacy") && feature.view.progress.stage === "interrupt", "Malformed stage hints never override actual progress.");
  feature.actions.discardActive(); const accepted = h.runtime.getState();
  hook.failNavigation(); h.attempts[0]!.succeed(); await flush(); feature = hook.render();
  assert(feature.canContinue && feature.terminalReceipt && feature.message !== null && accepted.urgeControl.activeEvent === null, "Saved discard retains Continue recovery if navigation throws.");
  hook.setHydration(false, "error"); const unavailableReceipt = hook.render();
  assert(!unavailableReceipt.canContinue && unavailableReceipt.locked, "Terminal recovery must not navigate while local state is unavailable.");
  unavailableReceipt.actions.continueAfterSave(); assert(hook.navigation.length === 0, "Unavailable receipt callbacks cannot leave using cached saved facts.");
  hook.setHydration(true, "ready"); feature = hook.render();
  feature.actions.continueAfterSave(); equal(hook.navigation, ["/(tabs)/today"], "Continue opens Today without rediscarding.");
  const counts = h.counts(); hook.hooks.unmount(); feature.actions.retry(); feature.actions.continueAfterSave(); old.completeInterrupt();
  equal(h.counts(), counts, "Unmounted handlers perform no commands.");
  assert(Number(hook.navigation.length) === 1, "Unmounted handlers never navigate.");

  const pending = harness(); const p = hookHarness(pending); let stale = p.render();
  stale.actions.discardActive(); p.hooks.unmount(); pending.attempts[0]!.succeed(); await flush();
  assert(p.navigation.length === 0, "A pending completion callback cannot navigate after unmount.");

  const replaced = harness(); const r = hookHarness(replaced); stale = r.render();
  stale.actions.discardActive(); r.setParams({ eventId: "new-route" }); r.render();
  replaced.attempts[0]!.succeed(); await flush(); assert(r.navigation.length === 0, "A replaced route cannot receive old success navigation.");
  r.hooks.unmount();

  const external = harness(); const e = hookHarness(external); e.render();
  const externalCommand = external.flowActions.urgeControl.completeInterrupt();
  feature = e.render(); assert(feature.locked && e.blocked() && feature.saveState === "unconfirmed", "Externally accepted-undurable Urge facts remain protected even without a local receipt.");
  external.attempts[0]!.succeed(); await externalCommand; assert(!e.render().locked, "Durable external facts release the guard."); e.hooks.unmount();

  const superseded = harness(); const s = hookHarness(superseded); feature = s.render();
  feature.actions.discardActive(); const newEvent = superseded.flowActions.urgeControl.start();
  superseded.attempts[0]!.fail(); await flush(); superseded.attempts[1]!.succeed(); await newEvent; await flush();
  feature = s.render();
  assert(!feature.locked && !feature.canRetry && !s.blocked() && feature.view.kind === "mismatch", "A stale failed receipt must not trap the user after a different accepted event is durable.");
  feature.actions.closeUnavailable(); equal(s.navigation, ["/(tabs)/today"], "Stale receipt permits safe exit once latest accepted facts are durable."); s.hooks.unmount();

  for (const terminal of [false, true]) {
    const cumulative = harness(); const c = hookHarness(cumulative); feature = c.render();
    if (terminal) feature.actions.discardActive(); else feature.actions.completeInterrupt();
    const acceptedUrge = cumulative.runtime.getState().urgeControl;
    const later = cumulative.runtime.applyAcknowledgedMutation((state) => ({ ...state, debug: { ...state.debug, dateOffsetDays: state.debug.dateOffsetDays + 1 } }));
    cumulative.attempts[1]!.succeed(); await later;
    cumulative.attempts[0]!.succeed(); await flush(); feature = c.render();
    assert(cumulative.runtime.getState().urgeControl === acceptedUrge && cumulative.runtime.getDurableState().urgeControl === acceptedUrge,
      "A cumulative later snapshot may durably preserve the same Urge slice while superseding the original receipt.");
    assert(!feature.locked && !c.blocked() && !feature.canRetry && c.navigation.length === 0,
      "Same-slice supersession must release durable recovery without automatically navigating on a failed receipt.");
    if (terminal) {
      assert(feature.canContinue, "Durable terminal truth permits explicit Continue after receipt supersession.");
      feature.actions.continueAfterSave(); equal(c.navigation, ["/(tabs)/today"], "Explicit same-slice durable recovery can leave safely.");
    } else {
      feature.actions.recordOutcome("reduced");
      assert(cumulative.runtime.getState().urgeControl.activeEvent?.outcome === "reduced", "An active same-slice superseded receipt must not permanently block the next canonical command.");
      cumulative.attempts[2]!.succeed(); await flush();
    }
    c.hooks.unmount();
  }
}

function invokeStage(feature: Feature, stage: string) {
  switch (stage) {
    case "interrupt": return feature.actions.completeInterrupt();
    case "technique": return feature.actions.selectTechnique("urgeSurfing");
    case "phoneAwayReady": return feature.actions.startPhoneAway();
    case "phoneAwayActive": return feature.actions.endPhoneAway();
    case "outcome": return feature.actions.recordOutcome("stronger");
    case "trigger": return feature.actions.recordTrigger("notSure");
    case "triggers": return feature.actions.recordTriggers([]);
    default: return feature.actions.complete();
  }
}

function step(h: Harness, stage: string, urge: UrgeControlState, selection: CurrentUrgeControlTrigger[]) {
  switch (stage) {
    case "interrupt": return h.controller.completeInterrupt(urge);
    case "technique": return h.controller.selectTechnique("urgeSurfing", urge);
    case "phoneAwayReady": return h.controller.startPhoneAway(urge);
    case "phoneAwayActive": return h.controller.endPhoneAway(urge);
    case "outcome": return h.controller.recordOutcome("stronger", urge);
    case "trigger": return h.controller.recordTrigger("notSure", urge);
    case "triggers": return h.controller.recordTriggers(selection, urge);
    default: return h.controller.complete(urge);
  }
}

function initial(current = true): BloomLocalState {
  const state = createActiveState(true, true);
  state.urgeControl = { activeEvent: { id: "urge-feature", status: "active", startedAt: at, ...(current ? { flowVersion: 2 as const } : {}) }, records: [] };
  return state;
}

function harness(initialState = initial()) {
  let time = at; let eventId: unknown = "urge-feature";
  let clocks = 0; let ids = 0; let mutations = 0;
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const persisted: Array<{ operation: UrgeControlOperation; urge: UrgeControlState }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState, initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({ state, succeed: () => resolve({ status: "persisted", writeId, generation: 0 }), fail: () => reject(new Error("Private synthetic storage error must not appear in presentation.")) });
    }) });
  const productActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: (mutation) => runtime.applyAcknowledgedMutation((state) => { mutations++; return mutation(state); }) });
  const flowActions = createBloomProductFlowActions({ productActions, now: () => { clocks++; return new Date(time); }, createId: (prefix) => { ids++; return `${prefix}-urge-feature-${ids}`; } });
  const controller = createUrgeControlController({ flowActions, getState: runtime.getState, getDurableState: runtime.getDurableState, getRouteEventId: () => eventId,
    getDisplayTime: () => time, retryPersistedMutation: runtime.retryPersistence,
    onPersisted: (operation, urge) => persisted.push({ operation, urge }) });
  return { runtime, controller, flowActions, attempts, persisted, setTime: (value: string) => { time = value; }, setRoute: (value: unknown) => { eventId = value; }, counts: () => ({ clocks, ids, mutations }) };
}

function hookHarness(h: Harness) {
  const hooks = controlledHooks();
  const navigation: unknown[] = []; let guard = false; let throwNavigation = false;
  let hasHydrated = true; let hydrationStatus: "loading" | "error" | "ready" = "ready";
  let params: { eventId?: string | string[]; stage?: string | string[] } = { eventId: "urge-feature", stage: "interrupt" };
  const timers = new Set<() => void>();
  const dependencies: Record<string, unknown> = {
    react: hooks.react,
    "expo-router": { useRouter: () => ({ replace: (route: unknown) => { if (throwNavigation) { throwNavigation = false; throw new Error("Navigation failed"); } navigation.push(route); } }), useLocalSearchParams: () => params },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => h.flowActions },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: h.runtime.getState(), durableState: h.runtime.getDurableState(), getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated, hydrationStatus }) },
    "../../constants/navigation": { routes: { home: "/(tabs)/today" } },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: (blocked: boolean) => { guard = blocked; return () => {}; } },
    "./urgeControlController": { createUrgeControlController }, "./urgeControlView": { getUrgeControlRouteView }
  };
  class DisplayDate extends Date { static now() { return Date.parse(at); } }
  const exports = compile("src/features/urge-control/useUrgeControlFeature.ts", dependencies, { Date: DisplayDate, setInterval: (fn: () => void) => { timers.add(fn); return fn; }, clearInterval: (fn: () => void) => timers.delete(fn) });
  const useFeature = exports.useUrgeControlFeature as () => Feature;
  return { hooks, navigation, render: () => hooks.render(useFeature), blocked: () => guard, tick: () => timers.forEach((fn) => fn()), failNavigation: () => { throwNavigation = true; },
    setParams: (value: typeof params) => { params = value; }, setHydration: (ready: boolean, status: typeof hydrationStatus) => { hasHydrated = ready; hydrationStatus = status; } };
}

type Element = { type: unknown; props: Record<string, unknown> };
function verifyScreensAndDraft() {
  const hooks = controlledHooks(); const submitted: unknown[] = []; const actions: Record<string, (...values: unknown[]) => void> = {};
  for (const name of ["completeInterrupt", "selectTechnique", "startPhoneAway", "endPhoneAway", "recordOutcome", "recordTrigger", "complete", "discardActive", "retry", "continueAfterSave", "closeUnavailable"]) actions[name] = (...values) => { submitted.push([name, ...values]); };
  actions.recordTriggers = (values) => { submitted.push(values); };
  let urge = initial().urgeControl;
  urge = { ...urge, activeEvent: { id: "urge-feature", flowVersion: 2, status: "active", startedAt: at, interruptCompletedAt: at, outcome: "reduced" } };
  let feature = { view: getUrgeControlRouteView(urge, "urge-feature", at), actions, locked: false, busy: false, saveState: "saved", message: null, canRetry: false, canContinue: false, terminalReceipt: false };
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  const dependencies: Record<string, unknown> = { react: hooks.react, "react-native": { View: "View", StyleSheet: { create: (value: unknown) => value } },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "../../../shared/design-system/v4/theme": { theme: {
      spacing: { xl2: 32, xl3: 48, xs: 8, lg: 20, md: 16, sm: 12 },
      radius: { lg: 14, pill: 9999 }, colors: { bg: { surface: "surface" } }
    } }, "../useUrgeControlFeature": { useUrgeControlFeature: () => feature } };
  for (const name of ["AppButton", "AppCard", "AppScreen", "AppText"]) dependencies[`../../../shared/components/v4/${name}`] = { [name]: name };
  const module = compile("src/features/urge-control/screens/UrgeControlResumeScreen.tsx", dependencies);
  const render = () => hooks.render(() => expand((module.UrgeControlResumeScreen as () => Element)()));
  let tree = render();
  equal(ids(tree, "bloom.urge.triggers.").filter((id) => !id.endsWith("save") && !id.endsWith("skip")), currentTriggers.map((value) => `bloom.urge.triggers.${value}`), "Current screen must offer exactly the eight current trigger options.");
  press(tree, "bloom.urge.triggers.explicitContentCue"); press(tree, "bloom.urge.triggers.stress");
  assert(submitted.length === 0, "Local checkbox toggles cannot persist trigger facts.");
  tree = render(); press(tree, "bloom.urge.triggers.save"); equal(submitted[0], ["explicitContentCue", "stress"], "Save sends selected values in interaction order.");
  // Simulate an unaccepted rejection that leaves this stage mounted.
  tree = render(); press(tree, "bloom.urge.triggers.save"); assert(Number(submitted.length) === 2, "Unaccepted trigger rejection must leave the form usable instead of latching it closed.");
  feature = { ...feature, locked: true, saveState: "unconfirmed", canRetry: true };
  tree = render(); press(tree, "bloom.urge.triggers.skip"); press(tree, "bloom.urge.triggers.other");
  assert(Number(submitted.length) === 2, "Accepted failed save locks draft edits and conflicting trigger submissions.");
  feature = { ...feature, locked: false, canRetry: false }; tree = render(); press(tree, "bloom.urge.triggers.skip"); equal(submitted[2], [], "Explicit skip always submits an empty trigger array.");
  urge = { activeEvent: { id: "urge-feature", flowVersion: 2, status: "active", startedAt: at, interruptCompletedAt: at }, records: [] };
  feature = { ...feature, view: getUrgeControlRouteView(urge, "urge-feature", at) }; tree = render();
  equal(ids(tree, "bloom.urge.outcome."), ["reduced", "stillStrong", "stronger", "unchanged"].map((value) => `bloom.urge.outcome.${value}`), "Current outcome UI exposes exactly the four established outcomes.");
  press(tree, "bloom.urge.outcome.stronger"); equal(submitted[3], ["recordOutcome", "stronger"], "Outcome choice sends only the existing semantic value.");
  feature = { ...feature, view: getUrgeControlRouteView(initial().urgeControl, "urge-feature", at) }; tree = render();
  const interruptButton = nodes(tree).find((node) => node.props.testID === "bloom.urge.interrupt.complete");
  assert(interruptButton?.props.disabled === false, "Interrupt completion is available immediately without a 60-second UI lock.");
  assert(ids(tree, "bloom.urge.interrupt.").includes("bloom.urge.interrupt.breathe") &&
    ids(tree, "bloom.urge.interrupt.").includes("bloom.urge.interrupt.notice") &&
    !nodes(tree).some((node) => node.type === "AppText" && /\d+\s*(?:\/\s*60|saniye)/.test(String(node.props.children))),
  "Current interrupt must offer both local touch targets without a visible seconds target.");
  press(tree, "bloom.urge.interrupt.complete"); equal(submitted[4], ["completeInterrupt"], "Interrupt screen invokes only the existing completion command.");
  urge = { activeEvent: { id: "urge-feature", flowVersion: 2, status: "active", startedAt: at,
    interruptCompletedAt: at, outcome: "reduced", triggers: ["stress", "fatigue"] }, records: [] };
  feature = { ...feature, view: getUrgeControlRouteView(urge, "urge-feature", at) }; tree = render();
  const reviewText = nodes(tree).filter((node) => node.type === "AppText").map((node) => node.props.children);
  assert(reviewText.includes("Dalga geçti") && reviewText.includes("Azaldı") && reviewText.includes("Stres, Yorgunluk"),
    "Current final review must display the canonical outcome and selected trigger labels.");
  press(tree, "bloom.urge.complete"); equal(submitted[5], ["complete"], "Final CTA invokes only the existing completion command.");
  urge = { activeEvent: { id: "urge-feature", flowVersion: 2, status: "active", startedAt: at,
    interruptCompletedAt: at, outcome: "reduced", triggers: [] }, records: [] };
  feature = { ...feature, view: getUrgeControlRouteView(urge, "urge-feature", at) }; tree = render();
  assert(nodes(tree).some((node) => node.type === "AppText" && node.props.children === "Tetikleyici seçilmedi"),
    "An explicitly skipped trigger question must not invent a trigger on final review.");
  for (const [stage, extra, expected] of [
    ["technique", { interruptCompletedAt: at }, ["changeEnvironment", "grounding54321", "cognitiveTask", "urgeSurfing", "personalReminder"]],
    ["trigger", { interruptCompletedAt: at, selectedTechnique: "urgeSurfing", phoneAwayStartedAt: at, phoneAwayEndedAt: at, outcome: "reduced" }, ["boredom", "stress", "loneliness", "sleeplessnessNighttime", "sexualDesire", "habitAutomatic", "notSure"]]
  ] as const) {
    urge = { activeEvent: { id: "urge-feature", status: "active", startedAt: at, ...extra }, records: [] };
    feature = { ...feature, view: getUrgeControlRouteView(urge, "urge-feature", at) }; tree = render();
    equal(ids(tree, `bloom.urge.${stage}.`), expected.map((value) => `bloom.urge.${stage}.${value}`), "Legacy screen must preserve its exact semantic option set.");
    assert(ids(tree, "bloom.urge.triggers.").length === 0, "Legacy presentation never exposes current arrays.");
  }
}

function verifyFeatureBoundary() {
  for (const file of ["urgeControlController.ts", "urgeControlView.ts", "useUrgeControlFeature.ts", "screens/UrgeControlResumeScreen.tsx"]) {
    const source = readFileSync(`src/features/urge-control/${file}`, "utf8");
    assert(!/bloomUrgeControlTransitions|bloomBehaviorSlipTransitions|AsyncStorage|persistBloom|flowActions\.(behaviorSlip|reset|contentFree|tracking)|\.flowVersion\s*=(?!=)/.test(source), "Urge feature must use existing flow actions without storage writes, version rewrites, or tracker/Behavior Slip commands.");
  }
}

function compile(file: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(output.outputText, { module, exports: module.exports, ...globals, require: (name: string) => { assert(name in dependencies, `Unexpected feature dependency ${name}.`); return dependencies[name]; } });
  return module.exports;
}

function controlledHooks() {
  const slots: unknown[] = []; let cursor = 0;
  const effects = new Set<{ setup: () => void | (() => void); cleanup?: (() => void) | undefined }>();
  const pending: Array<() => void> = [];
  const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useRef: <T>(initial: T) => { const index = cursor++; if (slots[index] === undefined) slots[index] = { current: initial }; return slots[index] as { current: T }; },
    useState: <T>(initial: T | (() => T)) => { const index = cursor++; if (slots[index] === undefined) slots[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial }; const cell = slots[index] as { value: T }; return [cell.value, (value: T | ((old: T) => T)) => { cell.value = typeof value === "function" ? (value as (old: T) => T)(cell.value) : value; }] as const; },
    useMemo: <T>(create: () => T, dependencies: readonly unknown[]) => { const index = cursor++; const previous = slots[index] as { value: T; dependencies: readonly unknown[] } | undefined; if (previous === undefined || !same(previous.dependencies, dependencies)) slots[index] = { value: create(), dependencies: [...dependencies] }; return (slots[index] as { value: T }).value; },
    useEffect: (setup: () => void | (() => void), dependencies: readonly unknown[]) => { const index = cursor++; const old = slots[index] as { dependencies: readonly unknown[]; cleanup?: () => void } | undefined; if (old === undefined || !same(old.dependencies, dependencies)) { const effect = { setup, dependencies: [...dependencies], cleanup: undefined as (() => void) | undefined }; slots[index] = effect; if (old !== undefined) effects.delete(old as never); effects.add(effect); pending.push(() => { old?.cleanup?.(); effect.cleanup = setup() ?? undefined; }); } },
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => { cursor++; return get(); }
  };
  return { react, render: <T>(fn: () => T) => { cursor = 0; const value = fn(); pending.splice(0).forEach((effect) => effect()); return value; },
    reattachEffects: () => effects.forEach((effect) => { effect.cleanup?.(); effect.cleanup = effect.setup() ?? undefined; }), unmount: () => effects.forEach((effect) => effect.cleanup?.()) };
}

function expand(value: unknown): unknown { if (Array.isArray(value)) return value.map(expand); if (value === null || typeof value !== "object") return value; const node = value as Element; if (typeof node.type === "function") return expand((node.type as (props: Record<string, unknown>) => unknown)(node.props)); return { ...node, props: { ...node.props, children: expand(node.props?.children) } }; }
function nodes(value: unknown): Element[] { if (Array.isArray(value)) return value.flatMap(nodes); if (value === null || typeof value !== "object") return []; const node = value as Element; return [node, ...nodes(node.props?.children)]; }
function ids(tree: unknown, prefix: string) { return nodes(tree).map((node) => node.props.testID).filter((id): id is string => typeof id === "string" && id.startsWith(prefix)); }
function press(tree: unknown, id: string) { const button = nodes(tree).find((node) => node.props.testID === id); assert(button !== undefined && typeof button.props.onPress === "function", `Expected interactive ${id}.`); (button.props.onPress as () => void)(); }
async function roundTrip(state: BloomLocalState) { const client = createMemoryStorageClient(); await persistBloomLocalState(state, client, () => new Date(at)); const loaded = await loadBloomLocalState(client, () => new Date(at)); assert(loaded.status === "success" && loaded.source === "current", "Feature facts must retain v7 hydration."); equal(loaded.state, state, "Roundtrip must preserve versions, arrays, legacy facts, and unrelated slices."); equal(await client.getAllKeys(), [BLOOM_STATE_STORAGE_KEY], "Feature must use the unchanged v7 key only."); }
function unrelated(before: BloomLocalState, after: BloomLocalState) { for (const key of Object.keys(before) as Array<keyof BloomLocalState>) if (key !== "urgeControl") assert(before[key] === after[key], `Urge feature cannot mutate ${key}, including cue observations.`); }
function equal(a: unknown, b: unknown, message: string) { const plain = (value: unknown) => value === undefined ? undefined : JSON.parse(JSON.stringify(value)); assert(isDeepStrictEqual(plain(a), plain(b)), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
function flush() { return new Promise<void>((done) => setImmediate(done)); }
