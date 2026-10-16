import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";
import type { NavigationAction } from "@react-navigation/routers";
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
const { StackActions, StackRouter }: typeof import("@react-navigation/routers") = createRequire(resolve("package.json"))("@react-navigation/routers");
type Harness = ReturnType<typeof harness>;
type Feature = {
  view: ReturnType<typeof getUrgeControlRouteView>;
  locked: boolean; busy: boolean; canRetry: boolean; canContinue: boolean; terminalReceipt: boolean; exerciseExitFailed: boolean;
  saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed"; message: string | null;
  actions: {
    completeInterrupt: () => void; selectTechnique: (value: UrgeControlTechnique) => void;
    startPhoneAway: () => void; endPhoneAway: () => void; recordOutcome: (value: UrgeControlOutcome) => void;
    recordTrigger: (value: LegacyUrgeControlTrigger) => void; recordTriggers: (value: CurrentUrgeControlTrigger[]) => void;
    complete: () => void; discardActive: () => void; retry: () => void; exitExercise: () => boolean;
    continueAfterSave: () => void; closeUnavailable: () => void;
  };
};
const currentTriggers = ["boredom", "stress", "loneliness", "fatigue", "explicitContentCue", "habitAutomatic", "specificSituation", "other"];

export async function verifyBloomUrgeControlFeature() {
  verifyRouteViews();
  await verifyControllerLifecycles();
  await verifyIdentityAndLegacySafety();
  await verifyHookRecovery();
  verifyScreensAndDraft();
  await verifyLegacyScreenProgression();
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
  for (const current of [true, false]) for (const eventId of [undefined, null, "", " ", ["urge-feature"], ["urge-feature", "urge-feature"], "stale", 42]) {
    const h = harness(initial(current)); h.setRoute(eventId);
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
  assert(feature.view.kind === "current" && feature.view.progress.stage === "interrupt", "Accepted-undurable interrupt completion cannot reveal outcome early.");
  external.attempts[0]!.succeed(); await externalCommand; assert(!e.render().locked, "Durable external facts release the guard."); e.hooks.unmount();

  const exiting = harness(); const x = hookHarness(exiting); feature = x.render();
  const activeBeforeExit = exiting.runtime.getState().urgeControl.activeEvent;
  x.failNavigation(); assert(!feature.actions.exitExercise(), "A thrown exercise exit navigation must remain on screen.");
  feature = x.render(); assert(feature.exerciseExitFailed && feature.message !== null && x.navigation.length === 0,
    "A failed exercise exit must expose recoverable presentation state.");
  assert(feature.actions.exitExercise(), "A failed exercise exit must allow an explicit retry.");
  equal(x.navigation, ["/(tabs)/today"], "Exercise exit retry replaces with existing Today.");
  assert(exiting.runtime.getState().urgeControl.activeEvent === activeBeforeExit && exiting.counts().mutations === 0,
    "Exercise exit must preserve the active event and dispatch no domain command.");
  x.hooks.unmount();

  const pendingExit = harness(); const px = hookHarness(pendingExit); feature = px.render();
  feature.actions.completeInterrupt(); feature = px.render();
  assert(feature.view.kind === "current" && feature.view.progress.stage === "interrupt" && !feature.actions.exitExercise() && px.navigation.length === 0,
    "Pending interrupt persistence must keep the exercise visible and block exit navigation.");
  pendingExit.attempts[0]!.succeed(); await flush();
  feature = px.render(); assert(feature.view.kind === "current" && feature.view.progress.stage === "outcome",
    "Outcome becomes available only after the interrupt transition is durable.");
  px.hooks.unmount();

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

function hookHarness(h: Harness, overrides: { hooks?: ReturnType<typeof controlledHooks>; navigation?: unknown; guard?: unknown } = {}) {
  const hooks = overrides.hooks ?? controlledHooks();
  const navigation: unknown[] = []; let guard = false; let throwNavigation = false;
  let hasHydrated = true; let hydrationStatus: "loading" | "error" | "ready" = "ready";
  let params: { eventId?: string | string[]; stage?: string | string[] } = { eventId: "urge-feature", stage: "interrupt" };
  const timers = new Set<() => void>();
  const dependencies: Record<string, unknown> = {
    react: hooks.react,
    "expo-router": { useRouter: () => ({ replace: (route: unknown) => { if (throwNavigation) { throwNavigation = false; throw new Error("Navigation failed"); } navigation.push(route); } }), useLocalSearchParams: () => params,
      useNavigation: () => overrides.navigation ?? {
        getState: () => ({key:"root",index:0,routes:navigation.length ? [{key:"home",name:"(tabs)"}] : [{key:"urge",name:"bloom/urge-control/resume"}]}),
        isFocused: () => true,
        dispatch: () => { if (throwNavigation) { throwNavigation = false; throw new Error("Navigation failed"); } navigation.push("/(tabs)/today"); }
      } },
    "@react-navigation/native": { StackActions },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => h.flowActions },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: h.runtime.getState(), durableState: h.runtime.getDurableState(), getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated, hydrationStatus }) },
    "../../constants/navigation": { routes: { home: "/(tabs)/today" } },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: overrides.guard ?? ((blocked: boolean) => { guard = blocked; return () => {}; }) },
    "./urgeControlController": { createUrgeControlController }, "./urgeControlView": { getUrgeControlRouteView }
  };
  class DisplayDate extends Date { static now() { return Date.parse(at); } }
  const exports = compile("src/features/urge-control/useUrgeControlFeature.ts", dependencies, { Date: DisplayDate, setInterval: (fn: () => void) => { timers.add(fn); return fn; }, clearInterval: (fn: () => void) => timers.delete(fn) });
  const useFeature = exports.useUrgeControlFeature as () => Feature;
  return { hooks, navigation, render: () => hooks.render(useFeature), blocked: () => guard, tick: () => timers.forEach((fn) => fn()), failNavigation: () => { throwNavigation = true; },
    setParams: (value: typeof params) => { params = value; }, setHydration: (ready: boolean, status: typeof hydrationStatus) => { hasHydrated = ready; hydrationStatus = status; } };
}

type Element = { type: unknown; props: Record<string, unknown> };

// Execute both application guards with the installed StackRouter and its actual
// beforeRemove/usePreventRemove implementation. Only native surfaces and React
// scheduling are controlled; guard callbacks and router rejection stay real.
export async function verifyBloomUrgeNavigationGuards() {
  for (const childFirst of [false, true]) for (const pendingScenario of [false, true]) {
    const h = harness(), featureHooks = controlledHooks(), exerciseHooks = controlledHooks();
    const listeners = new Set<(event: { data: { action: NavigationAction }; preventDefault: () => void }) => void>();
    const prevented: Record<string, { preventRemove:boolean }> = {};
    const options = { routeNames:["(tabs)", "bloom/urge-control/resume"], routeParamList:{}, routeGetIdList:{} };
    const stack = StackRouter({ initialRouteName:"(tabs)" });
    let navState = stack.getRehydratedState({ stale:true, index:1, routes:[{key:"home",name:"(tabs)"},{key:"urge",name:"bloom/urge-control/resume"}] }, options);
    let gesture = true, now = 0, guardId = 0;
    let writeOwner = "", feature!: Feature, tree: unknown;
    const writes: Array<{ owner:string; value:boolean }> = [];
    const createBoundary = compile("src/shared/navigation/guardBloomNavigation.ts",{}).createBloomRouterBoundary as
      (router:unknown, getPrevented:()=>unknown, hasUnconfirmed:()=>boolean)=>{getStateForAction:(state:typeof navState, action:NavigationAction, config:typeof options)=>typeof navState|null};
    const boundary = createBoundary(stack, () => ({urge:{preventRemove:Object.values(prevented).some(value => value.preventRemove)}}),
      () => h.runtime.getState() !== h.runtime.getDurableState());
    const shouldPreventRemove = compile("node_modules/@react-navigation/core/src/useOnPreventRemove.tsx", {
      react:{}, "./NavigationBuilderContext":{}, "./NavigationProvider":{}
    }).shouldPreventRemove as (emitter: unknown, children: unknown, before: unknown, after: unknown, action: NavigationAction) => boolean;
    const emitter = { emit: (data: {data:{action:NavigationAction}}) => {
      let defaultPrevented = false;
      listeners.forEach(listener => listener({data:data.data,preventDefault:()=>{defaultPrevented=true;}}));
      return {defaultPrevented};
    } };
    const navigation = {
      getState: () => navState, isFocused: () => true,
      setOptions: (value: {gestureEnabled:boolean}) => { gesture=value.gestureEnabled; writes.push({owner:writeOwner,value:gesture}); },
      addListener: (_: string, listener: typeof listeners extends Set<infer T> ? T : never) => {listeners.add(listener); return () => {listeners.delete(listener);};},
      dispatch: (action: NavigationAction) => {
        const next = boundary.getStateForAction!(navState, action, options);
        if (next !== null && next !== navState && !shouldPreventRemove(emitter, {}, navState.routes, next.routes, action)) navState=next;
      }
    };
    function preventRemoveHook(hooks: ReturnType<typeof controlledHooks>) {
      const native = compile("node_modules/@react-navigation/core/src/usePreventRemove.tsx", {
        react:hooks.react, "nanoid/non-secure":{nanoid:()=>String(++guardId)},
        "use-latest-callback": {default:(callback: (...args: never[]) => unknown) => {
          const ref=hooks.react.useRef(callback); ref.current=callback;
          return hooks.react.useMemo(() => (...args: never[]) => ref.current(...args), []);
        }},
        "./useNavigation":{useNavigation:()=>navigation}, "./useRoute":{useRoute:()=>({key:"urge"})},
        "./usePreventRemoveContext":{usePreventRemoveContext:()=>({setPreventRemove:(id:string,_route:string,value:boolean)=>{prevented[id]={preventRemove:value};}})}
      });
      return native.usePreventRemove;
    }
    const backListeners = new Set<() => boolean>();
    const native = { View:"View", Text:"Text", Pressable:"Pressable", ScrollView:"ScrollView", Modal:"Modal", Platform:{OS:"ios"},
      StyleSheet:{create:(value:unknown)=>value,flatten:(values:unknown[])=>Object.assign({},...values)},
      AppState:{currentState:"active",addEventListener:()=>({remove:()=>{}})},
      BackHandler:{addEventListener:(_event:string,listener:()=>boolean)=>{backListeners.add(listener);return {remove:()=>backListeners.delete(listener)};}},
      AccessibilityInfo:{announceForAccessibility:()=>{}},useWindowDimensions:()=>({width:402,height:874,fontScale:1}) };
    const guard = compile("src/shared/navigation/usePersistenceNavigationGuard.ts", {
      react:featureHooks.react,"expo-router":{useNavigation:()=>navigation},"react-native":native,
      "@react-navigation/native":{usePreventRemove:preventRemoveHook(featureHooks)}
    }, {setTimeout:()=>{throw new Error("Exercise exit cannot depend on a timeout");},clearTimeout:()=>{}}).usePersistenceNavigationGuard;
    const hook = hookHarness(h,{hooks:featureHooks,navigation,guard});
    const model = compile("src/features/urge-control/exercise/urgeExerciseTimer.ts",{});
    const intervals = new Set<() => void>();
    const jsx=(type:unknown,props:Record<string,unknown>)=>({type,props});
    const exercise = compile("src/features/urge-control/exercise/UrgeExercise.tsx",{
      react:exerciseHooks.react,"react/jsx-runtime":{jsx,jsxs:jsx,Fragment:"Fragment"},"react-native":native,
      "@react-navigation/native":{useIsFocused:()=>true,usePreventRemove:preventRemoveHook(exerciseHooks)},
      "expo-router":{useNavigation:()=>navigation},"expo-status-bar":{StatusBar:"StatusBar"},
      "react-native-safe-area-context":{useSafeAreaInsets:()=>({top:62,bottom:34})},
      "./UrgeExerciseVisuals":{UrgeExerciseAtmosphere:"Atmosphere",UrgeExerciseLCD:"LCD"},
      "./useUrgeExerciseReducedMotion":{useUrgeExerciseReducedMotion:()=>false},"./urgeExerciseTimer":model
    },{performance:{now:()=>now},setInterval:(tick:()=>void)=>{intervals.add(tick);return tick;},clearInterval:(tick:()=>void)=>intervals.delete(tick)}).UrgeExercise as (props:Record<string,unknown>)=>unknown;
    const renderFeature=()=>{writeOwner="persistence";feature=hook.render();};
    const renderExercise=()=>{writeOwner="exercise";tree=exerciseHooks.render(()=>expand(exercise({
      testIDPrefix:"bloom.urge.exercise", confirmExitWhenIdle:true, manageGestures:false,
      interactionDisabled:feature.locked,onExitConfirmed:feature.actions.exitExercise,
      evaluationAction:{label:"Durum kontrolüne geç",onPress:feature.actions.completeInterrupt}
    })));};
    const render=()=>{for(let i=0;i<3;i++){if(childFirst && feature !== undefined){renderExercise();renderFeature();}else{renderFeature();renderExercise();}}};
    const tap=(suffix:string)=>{now+=400;press(tree,`bloom.urge.exercise.${suffix}`);render();};
    const dialog=()=>nodes(tree).some(node=>node.type==="Modal" && node.props.visible===true);
    render();
    assert(!gesture && writes.every(write=>write.owner==="persistence" && !write.value), "Ready production gesture policy has one owner regardless of effect order.");
    tap("start"); assert(!gesture,"Running cannot enable swipe-back.");
    tap("pause"); assert(!gesture,"Paused cannot enable swipe-back.");
    [...backListeners].reverse().some(listener=>listener()); render();
    assert(dialog(),"Hardware Back opens the exercise confirmation with both guards mounted.");
    tap("exit.keep"); assert(!dialog() && !gesture,"Cancel stays protected on the exercise.");
    tap("resume"); now+=600_000; intervals.forEach(tick=>tick()); render();
    assert(ids(tree,"bloom.urge.exercise.completed").length===1 && !gesture,"Completed exercise retains the same disabled gesture policy.");
    if (pendingScenario) {
      tap("evaluate");
      assert(feature.locked && !gesture,"Pending evaluation cannot enable gestures.");
      [...backListeners].reverse().some(listener=>listener()); render();
      assert(dialog(),"Hardware Back still opens confirmation while persistence is pending.");
      tap("exit.confirm");
      navigation.dispatch(StackActions.replace("(tabs)",{screen:"today"}));
      assert(navState.routes.some(route=>route.key==="urge") && !gesture,"Neither confirmed exit nor raw navigation can bypass a pending write.");
      h.attempts[0]!.succeed(); await flush(); renderFeature(); exerciseHooks.unmount();
      assert(feature.view.kind==="current" && feature.view.progress.stage==="outcome" && gesture,
        "The same authoritative owner restores downstream navigation only once the transition is durable.");
      featureHooks.unmount();
      continue;
    }
    // A real root boundary silently rejects navigation while a different slice
    // has a pending write, even though the Urge slice itself is durable.
    const external=h.runtime.applyAcknowledgedMutation(state=>({...state,debug:{...state.debug,dateOffsetDays:1}}));
    tap("exit"); tap("exit.confirm");
    assert(navState.routes.some(route=>route.key==="urge") && dialog() && feature.exerciseExitFailed && !gesture,
      "Silent boundary rejection restores the modal/guard and exposes explicit retry.");
    assert(Object.values(prevented).some(value=>value.preventRemove),"Rejected exit cannot leave removal protection released.");
    h.attempts[0]!.succeed(); await external; render();
    const cancel=(event:{preventDefault:()=>void})=>event.preventDefault(); listeners.add(cancel);
    tap("exit.confirm"); listeners.delete(cancel);
    assert(dialog() && feature.exerciseExitFailed && !gesture,"A real beforeRemove cancellation must also restore a retryable modal.");
    const originalEvent=h.runtime.getState().urgeControl.activeEvent;
    tap("exit.confirm");
    assert(!navState.routes.some(route=>route.key==="urge") && h.runtime.getState().urgeControl.activeEvent===originalEvent && h.counts().mutations===0,
      "Retry reaches Home without discarding or completing the event.");
    exerciseHooks.unmount(); featureHooks.unmount();
  }
  console.log("Combined Urge navigation guards passed: both effect orders, ready/running/paused/completed, one gesture owner, hardware Back/cancel, pending protection, durable downstream release, real root-boundary rejection, real beforeRemove cancellation, retry and preserved event.");
}

function screenRenderer(getFeature: () => unknown, getViewport = () => ({ width: 402, height: 874, fontScale: 1 })) {
  const hooks = controlledHooks();
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  const dependencies: Record<string, unknown> = { react: hooks.react, "react-native": { View: "View", useWindowDimensions: getViewport, StyleSheet: { create: (value: unknown) => value } },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "../../../shared/design-system/v4/theme": { theme: { spacing: {}, radius: {}, colors: { bg: {} } } },
    "../useUrgeControlFeature": { useUrgeControlFeature: getFeature }, "../exercise/UrgeExercise": { UrgeExercise: "UrgeExercise" } };
  for (const name of ["AppButton", "AppCard", "AppScreen", "AppText"]) dependencies[`../../../shared/components/v4/${name}`] = { [name]: name };
  const module = compile("src/features/urge-control/screens/UrgeControlResumeScreen.tsx", dependencies);
  return () => hooks.render(() => expand((module.UrgeControlResumeScreen as () => Element)()));
}

async function verifyLegacyScreenProgression() {
  const h = harness(initial(false)), hook = hookHarness(h);
  let feature = hook.render();
  const render = screenRenderer(() => feature = hook.render());
  const original = h.runtime.getState();
  const commands = ["interrupt.complete", "technique.urgeSurfing", "phone-away.start", "phone-away.end", "outcome.reduced", "trigger.stress", "complete"];
  const stages = ["interrupt", "technique", "phoneAwayReady", "phoneAwayActive", "outcome", "trigger", "readyToComplete"];
  for (const [index, command] of commands.entries()) {
    const tree = render();
    assert(feature.view.kind === "legacy" && feature.view.progress.stage === stages[index], "Production legacy UI must expose every canonical step after acknowledgement.");
    assert(!nodes(tree).some(node => node.type === "UrgeExercise"), "No legacy step may mount the current exercise.");
    const id = `bloom.urge.${command}`;
    assert(nodes(tree).find(node => node.props.testID === id)?.props.disabled === false, "Saved legacy action must be enabled.");
    if (index === 0) {
      const counts = h.counts();
      press(tree, "bloom.urge.interrupt.breathe"); press(tree, "bloom.urge.interrupt.notice");
      equal(h.counts(), counts, "Legacy attention selections are local UI only.");
    }
    press(tree, id); press(tree, id);
    assert(h.counts().mutations === index + 1, "Double press from the actual screen must dispatch one logical command.");
    const accepted = h.runtime.getState();
    if (index === 0) {
      h.attempts[h.attempts.length - 1]!.fail(); await flush();
      const failedTree = render();
      assert(feature.locked && feature.canRetry && hook.blocked(), "Failed legacy write must lock progression and navigation until acknowledged retry.");
      const counts = h.counts(); press(failedTree, "bloom.urge.retry");
      equal(h.counts(), counts, "Screen retry must not regenerate event facts.");
    }
    h.attempts[h.attempts.length - 1]!.succeed(); await flush();
    assert(h.runtime.getDurableState() === accepted, "Screen progression requires the original accepted snapshot to become durable.");
    const event = accepted.urgeControl.activeEvent ?? accepted.urgeControl.records[accepted.urgeControl.records.length - 1];
    assert(event?.id === "urge-feature" && event.startedAt === at && event.flowVersion === undefined, "Legacy UI must preserve identity, existing start time and version.");
    unrelated(original, accepted);
  }
  assert(h.runtime.getDurableState().urgeControl.activeEvent === null && hook.navigation.length === 1, "Completed legacy screen journey navigates only after durable completion.");
  hook.hooks.unmount();
  console.log("Legacy production screen progression passed: all seven explicit actions, acknowledged completion, failed write/retry, double presses, local-only attention, unchanged identity/time/version.");
}

function verifyScreensAndDraft() {
  const submitted: unknown[] = []; const actions: Record<string, (...values: unknown[]) => void> = {};
  for (const name of ["completeInterrupt", "selectTechnique", "startPhoneAway", "endPhoneAway", "recordOutcome", "recordTrigger", "complete", "discardActive", "retry", "continueAfterSave", "closeUnavailable"]) actions[name] = (...values) => { submitted.push([name, ...values]); };
  actions.exitExercise = () => true;
  actions.recordTriggers = (values) => { submitted.push(values); };
  let urge = initial().urgeControl;
  urge = { ...urge, activeEvent: { id: "urge-feature", flowVersion: 2, status: "active", startedAt: at, interruptCompletedAt: at, outcome: "reduced" } };
  let feature = { view: getUrgeControlRouteView(urge, "urge-feature", at), actions, locked: false, busy: false, saveState: "saved", message: null, canRetry: false, canContinue: false, terminalReceipt: false, exerciseExitFailed: false };
  let viewport = { width: 402, height: 874, fontScale: 1 };
  const render = screenRenderer(() => feature, () => viewport);
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
  const exercise = nodes(tree).find((node) => node.type === "UrgeExercise");
  assert(exercise?.props.testIDPrefix === "bloom.urge.exercise" && exercise.props.confirmExitWhenIdle === true && exercise.props.interactionDisabled === false && exercise.props.manageGestures === false,
    "Current interrupt must directly render the reusable production exercise.");
  assert(!ids(tree, "bloom.urge.interrupt.").length && !nodes(tree).some((node) => node.type === "AppText" && node.props.children === "Şunu bitir"),
    "The former interrupt card must not remain beside the native exercise.");
  const evaluation = exercise?.props.evaluationAction as { label: string; onPress: () => void } | undefined;
  assert(evaluation?.label === "Durum kontrolüne geç", "Production exercise must expose explicit evaluation in its adapter.");
  evaluation?.onPress(); equal(submitted[4], ["completeInterrupt"], "Exercise evaluation invokes only the existing completion command.");
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
  // Phase 11.8.2C gap: controller lifecycle coverage alone cannot prove that
  // a legacy user can invoke the first canonical step from the real screen.
  urge = initial(false).urgeControl;
  const legacyInterrupt = getUrgeControlRouteView(urge, "urge-feature", at);
  assert(legacyInterrupt.kind === "legacy" && legacyInterrupt.progress.stage === "interrupt",
    "The existing legacy fixture must resolve to its canonical interrupt stage.");
  feature = { ...feature, view: legacyInterrupt, locked: false, busy: false, saveState: "saved", canRetry: false };
  tree = render();
  assert(!nodes(tree).some((node) => node.type === "UrgeExercise"), "Legacy interrupt must not render the current native exercise.");
  const legacyContinue = nodes(tree).find((node) => node.type === "AppButton" && node.props.onPress === actions.completeInterrupt && node.props.disabled !== true);
  const visibleLegacyActions = nodes(tree).filter((node) => node.type === "AppButton").map((node) => String(node.props.testID));
  assert(legacyContinue !== undefined,
    `Legacy interrupt must expose an enabled completeInterrupt action; rendered actions: ${visibleLegacyActions.join(", ")}.`);
  const beforeLegacyContinue = submitted.length;
  (legacyContinue.props.onPress as () => void)();
  equal(submitted[beforeLegacyContinue], ["completeInterrupt"], "Legacy Continue must invoke only its existing interrupt command.");
  assert(legacyContinue.props.testID === "bloom.urge.interrupt.complete" && nodes(tree).some(node => node.props.children === "Şunu bitir"), "Legacy interrupt restores the original guidance and stable CTA identity.");
  feature = { ...feature, locked: true, saveState: "unconfirmed" }; tree = render();
  assert(nodes(tree).find(node => node.props.testID === "bloom.urge.interrupt.complete")?.props.disabled === true, "Pending legacy interrupt must disable Continue.");
  for (const [stage, extra, expected] of [
    ["technique", { interruptCompletedAt: at }, ["changeEnvironment", "grounding54321", "cognitiveTask", "urgeSurfing", "personalReminder"]],
    ["trigger", { interruptCompletedAt: at, selectedTechnique: "urgeSurfing", phoneAwayStartedAt: at, phoneAwayEndedAt: at, outcome: "reduced" }, ["boredom", "stress", "loneliness", "sleeplessnessNighttime", "sexualDesire", "habitAutomatic", "notSure"]]
  ] as const) {
    urge = { activeEvent: { id: "urge-feature", status: "active", startedAt: at, ...extra }, records: [] };
    feature = { ...feature, view: getUrgeControlRouteView(urge, "urge-feature", at) }; tree = render();
    equal(ids(tree, `bloom.urge.${stage}.`), expected.map((value) => `bloom.urge.${stage}.${value}`), "Legacy screen must preserve its exact semantic option set.");
    assert(ids(tree, "bloom.urge.triggers.").length === 0, "Legacy presentation never exposes current arrays.");
  }
  // Native pixel fit is verified on Simulator. This executable regression
  // checks live font-size changes, retained local selections and removal of
  // the fixed geometry that previously clipped the legacy labels.
  feature = { ...feature, view: legacyInterrupt, locked: false, saveState: "saved" };
  tree = render();
  const beforeAttention = submitted.length;
  press(tree, "bloom.urge.interrupt.breathe");
  const flatten = (style: unknown): Record<string, unknown> => Array.isArray(style)
    ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {};
  for (const fontScale of [3.571, 1.35, 1]) {
    viewport = { width: 375, height: 812, fontScale }; tree = render();
    const breathe = nodes(tree).find(node => node.props.testID === "bloom.urge.interrupt.breathe")!;
    const notice = nodes(tree).find(node => node.props.testID === "bloom.urge.interrupt.notice")!;
    const choices = nodes(tree).find(node => node.type === "View" && Array.isArray(node.props.children)
      && node.props.children.some(child => child?.props?.testID === "bloom.urge.interrupt.breathe"));
    assert(choices !== undefined && flatten(choices.props.style).flexDirection === (fontScale === 1 ? "row" : "column"),
      "Legacy controls retain their normal horizontal layout and stack at accessibility sizes.");
    assert(breathe.props.label === "Nefes al" && notice.props.label === "Çevrene bak" && breathe.props.variant === "primary",
      "Resizing must preserve complete legacy labels and the local attention selection.");
    for (const button of [breathe, notice]) {
      const style = flatten(button.props.style);
      if (fontScale > 1) assert(style.aspectRatio === undefined && style.height === undefined && style.maxHeight === undefined && style.maxWidth === undefined,
        "Large-text legacy controls must grow naturally without the former fixed circle bounds.");
      else assert(style.aspectRatio === 1 && style.maxWidth === 116, "Normal legacy presentation retains its circle geometry.");
    }
  }
  assert(submitted.length === beforeAttention, "Resizing and attention selection cannot submit domain facts.");
  for (const current of [true, false]) for (const [outcome, label] of [["reduced", "Azaldı"], ["stillStrong", "Hâlâ güçlü"], ["stronger", "Daha güçlü"], ["unchanged", "Değişmedi"]] as const) {
    urge = { activeEvent: { id: "urge-feature", status: "active", startedAt: at, interruptCompletedAt: at, outcome,
      ...(current ? { flowVersion: 2, triggers: [] } : { selectedTechnique: "urgeSurfing", phoneAwayStartedAt: at, phoneAwayEndedAt: at, trigger: "stress" }) }, records: [] };
    feature = { ...feature, view: getUrgeControlRouteView(urge, "urge-feature", at) };
    for (const fontScale of [1, 3.571]) {
      viewport = { width: 375, height: 812, fontScale }; tree = render();
      const row = nodes(tree).find(node => node.type === "View" && Array.isArray(node.props.children)
        && node.props.children.some(child => child?.type === "AppText" && child.props.children === "Şu an"));
      assert(row !== undefined && flatten(row.props.style).flexDirection === (fontScale === 1 ? "row" : "column"),
        "Both current and legacy maximum-text summaries must give the outcome its own line.");
      assert(nodes(row.props.children).some(node => node.type === "AppText" && node.props.children === label && node.props.numberOfLines === undefined),
        "All four canonical outcome labels remain complete and unrestricted in both summary versions.");
    }
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
    useCallback: <T>(callback:T) => { cursor++; return callback; },
    useRef: <T>(initial: T) => { const index = cursor++; if (slots[index] === undefined) slots[index] = { current: initial }; return slots[index] as { current: T }; },
    useState: <T>(initial: T | (() => T)) => { const index = cursor++; if (slots[index] === undefined) slots[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial }; const cell = slots[index] as { value: T }; return [cell.value, (value: T | ((old: T) => T)) => { cell.value = typeof value === "function" ? (value as (old: T) => T)(cell.value) : value; }] as const; },
    useMemo: <T>(create: () => T, dependencies: readonly unknown[]) => { const index = cursor++; const previous = slots[index] as { value: T; dependencies: readonly unknown[] } | undefined; if (previous === undefined || !same(previous.dependencies, dependencies)) slots[index] = { value: create(), dependencies: [...dependencies] }; return (slots[index] as { value: T }).value; },
    useEffect: (setup: () => void | (() => void), dependencies?: readonly unknown[]) => { const index = cursor++; const old = slots[index] as { dependencies: readonly unknown[]; cleanup?: () => void } | undefined; if (old === undefined || dependencies === undefined || !same(old.dependencies, dependencies)) { const effect = { setup, dependencies: [...(dependencies ?? [])], cleanup: undefined as (() => void) | undefined }; slots[index] = effect; if (old !== undefined) effects.delete(old as never); effects.add(effect); pending.push(() => { old?.cleanup?.(); effect.cleanup = setup() ?? undefined; }); } },
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
