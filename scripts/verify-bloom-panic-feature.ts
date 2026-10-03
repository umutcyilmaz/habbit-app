import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";

import { createBloomProductFlowActions, type BloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime, type BloomPersistedMutationResult } from "../src/app/providers/bloomLocalStateMutationRuntime";
import type { BehaviorSlipReason } from "../src/domain/models/BehaviorSlip";
import { getBehaviorSlipImpact } from "../src/domain/productPolicy/getBehaviorSlipImpact";
import { getUrgeControlProgress } from "../src/domain/urgeControl/getUrgeControlProgress";
import { createPanicController } from "../src/features/panic/panicController";
import { getPanicView, samePanicFacts, type PanicView } from "../src/features/panic/panicView";
import { createDefaultBloomState, discardActiveUrgeControlEventState, type BloomLocalState } from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import { createActiveState } from "./verify-bloom-reset-violations";

const at = "2026-09-03T12:00:00.123Z";
const reasons = ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const;
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
type Feature = {
  view: PanicView; busy: boolean; locked: boolean; canRetry: boolean;
  saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed";
  recoveryTarget: "urge" | "today" | null; canContinue: boolean; message: string | null;
  actions: { startUrge: () => void; recordSlip: () => void; retry: () => void;
    continueAfterSave: () => void; continueExisting: () => void; close: () => void };
};

export async function verifyBloomPanicFeature() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Panic must retain v7 persistence.");
  verifyViews();
  await verifyControllers();
  await verifyHook();
  verifyScreen();
  verifySourceBoundaries();
  console.log("Bloom Panic feature verification passed (independent branches, current/legacy resume, canonical impact previews, one-command slip/start, stale-state guards, durable navigation, failed-save retry, obsolete receipt escape, and controlled hook/screen wiring).");
}

function verifyViews() {
  for (const resetActive of [false, true]) for (const contentActive of [false, true]) for (const reason of reasons) {
    const state = entryState(resetActive, contentActive);
    const before = JSON.stringify(state);
    const view = getPanicView(state, reason, at);
    const impact = getBehaviorSlipImpact(state, reason, at);
    assert(view.kind === "choices", "No active Urge event must expose both entry branches.");
    equal(view.impact, impact, "Slip preview must use the canonical semantic impact without reproducing policy.");
    assert(view.canConfirmSlip === (impact !== null && (impact.reset === "restart" || impact.contentFree === "resetStreak")),
      "Only a valid preview with an affected tracker can confirm a slip.");
    assert(JSON.stringify(state) === before, "Preview must not mutate any product facts.");
  }
  const neither = getPanicView(entryState(false, false), "masturbation", at);
  const invalid = getPanicView(entryState(), "intentionalExplicitContent", "bad-time");
  const missing = getPanicView(entryState(), null, at);
  assert(neither.kind === "choices" && !neither.canConfirmSlip && invalid.kind === "choices" && invalid.impact === null &&
    !invalid.canConfirmSlip && missing.kind === "choices" && missing.impact === null && !missing.canConfirmSlip,
  "Neither, null, and unanswered previews must block confirmation.");
  for (const current of [true, false]) {
    const state = entryState();
    state.urgeControl.activeEvent = current
      ? { id: "existing-current", flowVersion: 2, status: "active", startedAt: at, interruptCompletedAt: at }
      : { id: "existing-legacy", status: "active", startedAt: at, interruptCompletedAt: at };
    const view = getPanicView(state, null, at);
    assert(view.kind === "resume" && view.eventId === state.urgeControl.activeEvent.id &&
      view.progress.stage === (current ? "outcome" : "technique"), "Both event versions must continue with canonical identity and progress.");
    equal(view.progress, getUrgeControlProgress(state.urgeControl, at), "Panic resume must reuse the canonical progress selector.");
  }
}

async function verifyControllers() {
  const start = harness();
  const pending = start.controller.startUrge(start.initial);
  assert(pending !== null && start.controller.startUrge(start.initial) === pending, "Duplicate start presses must share one in-flight command.");
  const accepted = start.runtime.getState();
  equal(accepted.urgeControl.activeEvent, { id: "urge-control-event-panic-1", flowVersion: 2, status: "active", startedAt: at },
    "Triggered entry must create exactly the flow's current event identity/time.");
  equal(start.calls.map((call) => call.path), ["urgeControl.start"], "Triggered entry must call only Urge start.");
  untouched(start.initial, accepted, ["urgeControl"]);
  assert(start.persisted.length === 0, "Accepted start must not navigate before durable save.");
  await failAndRetry(start, pending);
  assert(start.persisted[0]?.state === accepted && start.persisted[0]?.operation === "startUrge", "Durable retry must retain the exact started event.");
  equal(start.counts(), { clocks: 1, ids: 1, mutations: 1 }, "Start retry must not generate new facts or events.");

  for (const reason of reasons) {
    const h = harness();
    const recording = h.controller.recordSlip(reason, h.initial);
    assert(recording !== null && h.controller.recordSlip(reason, h.initial) === recording,
      "Duplicate same-reason confirmation must remain one pending logical slip.");
    const successor = h.runtime.getState();
    equal(h.calls, [{ path: "behaviorSlip.record", args: [reason] }], "Confirmation must call only the coordinator with its semantic reason and no occurrence timestamp.");
    untouched(h.initial, successor, reason === "masturbation" ? ["resetJourney"] : ["resetJourney", "contentFree"]);
    assert(successor.urgeControl === h.initial.urgeControl && h.persisted.length === 0,
      "A slip must create no Urge event or navigation before persistence.");
    await failAndRetry(h, recording);
    assert(h.persisted[0]?.operation === "recordSlip" && h.persisted[0]?.state === successor,
      "Only durable slip completion may signal return to Today.");
    equal(h.counts(), { clocks: 1, ids: 4, mutations: 1 }, "Slip retry must preserve one shared source and its candidate IDs without replay.");
  }
  for (const current of [true, false]) {
    const state = entryState();
    state.urgeControl.activeEvent = current ? { id: "current", flowVersion: 2, status: "active", startedAt: at }
      : { id: "legacy", status: "active", startedAt: at };
    const h = harness(state);
    assert(h.controller.startUrge(state) === null && h.controller.recordSlip("masturbation", state) === null && Number(h.calls.length) === 0,
      "An existing current or legacy active event must not permit another start or an unseen slip form.");
  }
  for (const selected of ["resetJourney", "contentFree", "urgeControl"] as const) {
    const h = harness();
    const changed = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, [selected]: { ...state[selected] } }));
    assert(h.controller.recordSlip("intentionalExplicitContent", h.initial) === null && Number(h.calls.length) === 0,
      "A retained slip confirmation must reject changed rendered accepted slice references before invoking the coordinator.");
    h.attempts[0]!.succeed();
    await changed;
  }
  const neither = harness(entryState(false, false));
  assert(neither.controller.recordSlip("masturbation", neither.initial) === null && neither.calls.length === 0,
    "No affected tracker must not create a generic slip history or command.");
  const invalid = harness(); invalid.setTime("invalid");
  assert(invalid.controller.recordSlip("intentionalExplicitContent", invalid.initial) === null && invalid.calls.length === 0,
    "An unavailable preview must block confirmation without generating facts.");
  const noOp = harness();
  const denied = createPanicController({ flowActions: { ...noOp.flow,
    behaviorSlip: { record: async () => ({ ok: false, accepted: false, persisted: false, sequence: 1, reason: "invalidSession", retryable: false }) }
  }, getState: noOp.runtime.getState, getDisplayTime: () => at, retryPersistedMutation: noOp.runtime.retryPersistence });
  const result = await denied.recordSlip("masturbation", noOp.initial);
  assert(result !== null && !result.ok && denied.getSnapshot().message !== null && denied.getSnapshot().acceptedState === null,
    "Authoritative no-op at press time must show unavailable feedback instead of a fabricated saved receipt.");
}

async function failAndRetry(h: ReturnType<typeof harness>, pending: Promise<BloomPersistedMutationResult>) {
  const accepted = h.runtime.getState();
  h.attempts[0]!.fail();
  const failed = await pending;
  assert(!failed.ok && failed.accepted && failed.retryable && h.controller.getSnapshot().message !== null && h.persisted.length === 0,
    "Accepted failed saves must remain recoverable and never signal navigation.");
  assert(h.controller.startUrge(accepted) === null && h.controller.recordSlip("masturbation", accepted) === null,
    "Accepted failed snapshots must lock all conflicting branch commands.");
  const before = h.counts();
  const retry = h.controller.retry();
  assert(retry !== null && h.controller.retry() === retry && h.attempts[1]!.state === accepted,
    "Retry must persist the same accepted snapshot and coalesce duplicate retries.");
  h.attempts[1]!.succeed();
  assert((await retry).ok && h.runtime.getDurableState() === accepted, "Retry receipt must acknowledge the original successor.");
  equal(h.counts(), before, "Retry must not replay any flow command, mutation, clock, or ID.");
}

async function verifyHook() {
  const h = harness();
  const ui = hookHarness(h);
  ui.setHydrated(false);
  let feature = ui.render();
  feature.actions.startUrge();
  assert(feature.locked && feature.view.kind === "unavailable" && Number(h.calls.length) === 0, "Unhydrated Panic must hide cached work and not dispatch.");
  ui.setHydrated(true);
  feature = ui.render(); ui.hooks.reattachEffects(); ui.tick(); feature = ui.render();
  assert(feature.view.kind === "choices" && !feature.locked && Number(h.calls.length) === 0, "Mount/effects/display clocks must not write or navigate.");
  const retained = feature.actions;
  feature.actions.startUrge(); retained.startUrge();
  feature = ui.render();
  assert(feature.busy && feature.locked && feature.recoveryTarget === "urge" && feature.view.kind === "resume" && ui.blocked(),
    "Optimistic active state must keep start recovery visible and navigation guarded.");
  feature.actions.continueExisting(); feature.actions.close();
  assert(ui.navigation.length === 0 && Number(h.calls.length) === 1, "Neither active Continue nor Close may bypass a pending save.");
  h.attempts[0]!.fail(); await flush(); feature = ui.render();
  assert(feature.canRetry && feature.locked && !feature.canContinue && ui.blocked(), "Failed accepted start must stay recoverable and guarded.");
  feature.actions.startUrge(); retained.startUrge(); feature.actions.continueExisting(); feature.actions.close();
  assert(Number(h.calls.length) === 1 && ui.navigation.length === 0, "Failed start must not create another event or leave via current active view.");
  feature.actions.retry(); h.attempts[1]!.succeed(); await flush(); feature = ui.render();
  equal(ui.navigation, [{ intent: { flow: "urgeControl", mode: "resume", eventId: "urge-control-event-panic-1", stage: "interrupt" }, method: "replace" }],
    "Only durable start/retry may replace to the exact accepted event and canonical stage.");
  equal(h.counts(), { clocks: 1, ids: 1, mutations: 1 }, "Hook retry must call only the runtime token API.");
  assert(feature.canContinue && !ui.blocked(), "Saved recovery must permit fallback continuation if navigation failed.");
  ui.hooks.unmount();
  const count = ui.navigation.length;
  feature.actions.continueAfterSave(); feature.actions.retry(); feature.actions.close();
  assert(ui.navigation.length === count && Number(h.calls.length) === 1, "Unmounted handlers must neither mutate nor navigate.");

  for (const current of [true, false]) {
    const state = entryState();
    state.urgeControl.activeEvent = current ? { id: "resume-current", flowVersion: 2, status: "active", startedAt: at, interruptCompletedAt: at }
      : { id: "resume-legacy", status: "active", startedAt: at, interruptCompletedAt: at };
    const active = harness(state); const activeUi = hookHarness(active); const shown = activeUi.render();
    shown.actions.startUrge(); shown.actions.continueExisting();
    equal(activeUi.navigation, [{ intent: { flow: "urgeControl", mode: "resume", eventId: state.urgeControl.activeEvent.id,
      stage: current ? "outcome" : "technique" }, method: "replace" }], "Existing current/legacy continuation must navigate canonical facts without starting a new event.");
    assert(active.calls.length === 0, "Continuing an active event must not generate IDs or mutations.");
    activeUi.hooks.unmount();
  }
  const slip = harness(); const slipUi = hookHarness(slip, "intentionalExplicitContent");
  let slipFeature = slipUi.render();
  slipFeature.actions.recordSlip(); slipFeature = slipUi.render();
  assert(slipFeature.recoveryTarget === "today" && slipFeature.busy && slipUi.navigation.length === 0,
    "Accepted slip must retain Today recovery without optimistic navigation.");
  slip.attempts[0]!.fail(); await flush(); slipFeature = slipUi.render();
  slipFeature.actions.recordSlip(); slipFeature.actions.close();
  assert(slip.calls.length === 1 && slipUi.navigation.length === 0 && slipFeature.canRetry,
    "A failed slip must lock duplicate confirmation and Close while offering retry.");
  slipFeature.actions.retry(); slip.attempts[1]!.succeed(); await flush(); slipUi.render();
  equal(slipUi.navigation, [{ path: "/existing-today" }], "Only durable behavior-slip success may replace to Today.");
  equal(slip.counts(), { clocks: 1, ids: 4, mutations: 1 }, "Slip hook retry must not replay source or violation creation.");
  slipUi.hooks.unmount();

  const replaced = harness(); const replacedUi = hookHarness(replaced); const oldFeature = replacedUi.render();
  oldFeature.actions.startUrge(); replacedUi.replaceFlow(); replacedUi.render();
  oldFeature.actions.retry(); oldFeature.actions.startUrge(); replaced.attempts[0]!.succeed(); await flush();
  assert(replacedUi.navigation.length === 0 && replaced.calls.length === 1, "Callbacks from a replaced controller must not mutate or navigate after their save settles.");
  replacedUi.hooks.unmount();
  const unmounted = harness(); const unmountedUi = hookHarness(unmounted); const leaving = unmountedUi.render();
  leaving.actions.startUrge(); unmountedUi.hooks.unmount(); unmounted.attempts[0]!.succeed(); await flush();
  assert(unmountedUi.navigation.length === 0, "An unmounted pending start callback must never navigate.");

  const stale = harness(); const staleUi = hookHarness(stale, "intentionalExplicitContent"); const staleFeature = staleUi.render();
  const update = stale.runtime.applyAcknowledgedMutation((state) => ({ ...state, contentFree: { ...state.contentFree } }));
  staleFeature.actions.recordSlip();
  assert(stale.calls.length === 0, "The real hook must submit rendered references so stale slip confirmation is rejected.");
  stale.attempts[0]!.succeed(); await update; staleUi.hooks.unmount();

  for (const invalidated of [false, true]) {
    const obsolete = harness(); const obsoleteUi = hookHarness(obsolete); obsoleteUi.render().actions.startUrge();
    if (invalidated) {
      obsolete.runtime.beginDeletion(); obsolete.runtime.completeDeletion(createDefaultBloomState());
    } else {
      const newer = obsolete.runtime.applyAcknowledgedMutation(discardActiveUrgeControlEventState);
      obsolete.attempts[1]!.succeed(); await newer;
    }
    obsolete.attempts[0]!.succeed(); await flush();
    const recovered = obsoleteUi.render();
    assert(!recovered.canRetry && !obsoleteUi.blocked() && !recovered.canContinue,
      "A superseded or invalidated receipt must not trap a newer durable state behind an impossible retry.");
    recovered.actions.close();
    equal(obsoleteUi.navigation, [{ path: "/existing-today" }], "Obsolete durable recovery must allow safe Close without navigating the old started event.");
    obsoleteUi.hooks.unmount();
  }
}

function verifyScreen() {
  const source = readFileSync("src/features/panic/screens/PanicScreen.tsx", "utf8");
  for (const reason of reasons) {
    const hooks = controlledHooks();
    const actions: string[] = [];
    let locked = false;
    const renderFeature = (selection: BehaviorSlipReason | null): Feature => ({
      view: getPanicView(entryState(), selection, at), locked, busy: false, canRetry: false,
      saveState: "saved", recoveryTarget: null, canContinue: false, message: null,
      actions: { startUrge: () => { actions.push("start"); }, recordSlip: () => { actions.push(selection ?? "missing"); },
        retry: () => {}, continueAfterSave: () => {}, continueExisting: () => {}, close: () => {} }
    });
    const screen = compileScreen(source, hooks, renderFeature);
    const render = () => hooks.render(screen);
    let tree = render();
    assert(element(tree, "bloom.panic.triggered") !== null && element(tree, "bloom.panic.slip") !== null && Number(actions.length) === 0,
      "Empty Panic must offer both branches without dispatching on mount.");
    const oldStart = press(tree, "bloom.panic.triggered");
    equal(actions, ["start"], "Triggered button must dispatch only the start branch.");
    press(tree, "bloom.panic.slip"); tree = render(); oldStart();
    assert(Number(actions.length) === 1 && required(tree, "bloom.panic.slip.confirm").props.disabled === true,
      "Opening slip must disable unanswered confirmation and invalidate a retained triggered handler.");
    equal(elements(tree).filter((item) => item.props.accessibilityRole === "radio").map((item) => [item.props.testID, item.props.children]), [
      ["bloom.panic.slip.reason.masturbation", "Mastürbasyon"],
      ["bloom.panic.slip.reason.intentionalExplicitContent", "Açık içerik"],
      ["bloom.panic.slip.reason.masturbationWithExplicitContent", "İkisi de"]
    ], "Slip choices must expose exactly the existing semantic reasons and labels.");
    press(tree, `bloom.panic.slip.reason.${reason}`); tree = render();
    assert(required(tree, "bloom.panic.slip.confirm").props.disabled === false, "An affected canonical preview must permit explicit confirmation.");
    const oldConfirm = press(tree, "bloom.panic.slip.confirm");
    equal(actions, ["start", reason], "Slip confirmation must submit its selected semantic reason only.");
    const other = reason === "masturbation" ? "intentionalExplicitContent" : "masturbation";
    press(tree, `bloom.panic.slip.reason.${other}`); tree = render(); oldConfirm();
    assert(Number(actions.length) === 2, "A retained confirmation cannot submit a replaced local reason.");
    const canceledConfirm = required(tree, "bloom.panic.slip.confirm").props.onPress as () => void;
    press(tree, "bloom.panic.slip.cancel"); tree = render(); canceledConfirm();
    assert(Number(actions.length) === 2, "Cancel must invalidate retained slip confirmation callbacks.");
    locked = true; tree = render(); press(tree, "bloom.panic.triggered"); press(tree, "bloom.panic.slip");
    assert(Number(actions.length) === 2, "Locked branch handlers must not dispatch even if called directly.");
  }
  for (const view of [getPanicView(entryState(false, false), "masturbation", at), getPanicView(entryState(), "masturbation", "invalid")]) {
    const hooks = controlledHooks(); let confirmations = 0;
    const screen = compileScreen(source, hooks, () => ({ view, locked: false, busy: false, canRetry: false, saveState: "saved",
      recoveryTarget: null, canContinue: false, message: null,
      actions: { startUrge: () => {}, recordSlip: () => { confirmations++; }, retry: () => {}, continueAfterSave: () => {}, continueExisting: () => {}, close: () => {} }
    }));
    let tree = hooks.render(screen); press(tree, "bloom.panic.slip"); tree = hooks.render(screen);
    press(tree, "bloom.panic.slip.reason.masturbation"); tree = hooks.render(screen);
    assert(required(tree, "bloom.panic.slip.confirm").props.disabled === true, "Null and neither previews must disable confirmation in the executable screen.");
    press(tree, "bloom.panic.slip.confirm"); assert(confirmations === 0, "Unavailable previews must reject direct callbacks too.");
  }
  for (const current of [true, false]) {
    const state = entryState();
    state.urgeControl.activeEvent = current ? { id: "screen-current", flowVersion: 2, status: "active", startedAt: at }
      : { id: "screen-legacy", status: "active", startedAt: at };
    const hooks = controlledHooks(); const actions: string[] = [];
    let recovering = false;
    const screen = compileScreen(source, hooks, () => ({
      view: getPanicView(state, null, at), locked: recovering, busy: false, canRetry: recovering,
      saveState: recovering ? "unconfirmed" : "saved", recoveryTarget: recovering ? "urge" : null, canContinue: false,
      message: recovering ? "Kaydetme doğrulanmadı." : null,
      actions: { startUrge: () => { actions.push("start"); }, recordSlip: () => { actions.push("slip"); },
        retry: () => { actions.push("retry"); }, continueAfterSave: () => {},
        continueExisting: () => { actions.push("continue"); }, close: () => {} }
    }));
    let tree = hooks.render(screen);
    assert(element(tree, "bloom.panic.triggered") === null && element(tree, "bloom.panic.slip") === null &&
      element(tree, "bloom.panic.close") === null, "An existing active event must show only its Continue entry, without new branches or a normal Close that abandons its entry UX.");
    press(tree, "bloom.panic.continue-existing"); equal(actions, ["continue"], "Both current and legacy active screens must use the existing event continuation.");
    recovering = true; tree = hooks.render(screen);
    assert(element(tree, "bloom.panic.recovery") !== null && element(tree, "bloom.panic.continue-existing") === null &&
      required(tree, "bloom.panic.continue").props.disabled === true && required(tree, "bloom.panic.close").props.disabled === true,
    "An accepted failed start must show receipt recovery ahead of optimistic active Continue and disable premature navigation.");
    press(tree, "bloom.panic.retry"); equal(actions, ["continue", "retry"], "Failed start presentation must offer only the persistence retry operation.");
  }
}

function verifySourceBoundaries() {
  const files = ["panicController.ts", "panicView.ts", "usePanicFeature.ts", "screens/PanicScreen.tsx"];
  for (const file of files) {
    const source = readFileSync(`src/features/panic/${file}`, "utf8");
    assert(!/AsyncStorage|persistBloomLocalState|applyAcknowledgedMutation|recordActiveResetViolationState|recordManualContentFreeViolationState|recordBehaviorSlipState|getNextBloomAction|flowActions\.reset|flowActions\.contentFree/.test(source),
      "Panic features must not bypass the shared coordinator or directly access storage/domain mutation APIs.");
    assert(!/Math\.random|createId\s*\(|flowVersion\s*:/.test(source), "Panic must not construct mutation identity or current event facts.");
  }
  const screen = readFileSync("src/features/panic/screens/PanicScreen.tsx", "utf8");
  assert(!/Date\.|new Date|useEffect|setInterval|getBehaviorSlipImpact|getUrgeControlProgress/.test(screen),
    "The Panic screen must own only rendering and local selections, not clocks or policy.");
  for (const component of ["AppScreen", "AppCard", "AppText", "AppButton"]) assert(screen.includes(`import { ${component} }`), "Panic must retain the shared simple component architecture.");
}

function entryState(resetActive = true, contentActive = true): BloomLocalState {
  const state = createActiveState(false, contentActive);
  if (!resetActive) state.resetJourney = createDefaultBloomState().resetJourney;
  state.urgeControl = { ...state.urgeControl, activeEvent: null };
  return state;
}
function harness(initial = entryState()) {
  let time = at;
  let clocks = 0, ids = 0, mutations = 0;
  const calls: Array<{ path: string; args: unknown[] }> = [];
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState: initial, initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolveReceipt, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({ state, succeed: () => resolveReceipt({ status: "persisted", writeId, generation: 0 }), fail: () => reject(new Error("Synthetic Panic save failure")) });
    })
  });
  const productActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: (mutation) => runtime.applyAcknowledgedMutation((state) => { mutations++; return mutation(state); }) });
  const original = createBloomProductFlowActions({ productActions, now: () => { clocks++; return new Date(time); }, createId: (prefix) => `${prefix}-panic-${++ids}` });
  const wrap = (value: unknown, path = ""): unknown => typeof value === "function"
    ? (...args: unknown[]) => { calls.push({ path, args }); return value(...args); }
    : Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, wrap(nested, path ? `${path}.${key}` : key)]));
  const flow = wrap(original) as BloomProductFlowActions;
  const persisted: Array<{ operation: string; state: BloomLocalState }> = [];
  const controller = createPanicController({ flowActions: flow, getState: runtime.getState, getDisplayTime: () => time,
    retryPersistedMutation: runtime.retryPersistence, onPersisted: (operation, state) => persisted.push({ operation, state }) });
  return { initial, runtime, flow, calls, attempts, persisted, controller, setTime: (value: string) => { time = value; }, counts: () => ({ clocks, ids, mutations }) };
}

function hookHarness(h: ReturnType<typeof harness>, reason: BehaviorSlipReason | null = null) {
  const hooks = controlledHooks();
  const navigation: unknown[] = [];
  let hydrated = true, blocked = false, flow = h.flow;
  const timers = new Map<number, () => void>(); let timerId = 0;
  const dependencies: Record<string, unknown> = {
    react: hooks.react, "expo-router": { useRouter: () => ({ replace: (path: unknown) => navigation.push({ path }) }) },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => flow },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: h.runtime.getState(), durableState: h.runtime.getDurableState(),
      getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated: hydrated, hydrationStatus: hydrated ? "ready" : "loading" }) },
    "../../app/navigation/navigateBloomProductFlow": { navigateBloomProductFlow: (_router: unknown, intent: unknown, method: unknown) => { navigation.push({ intent, method }); return true; } },
    "../../constants/navigation": { routes: { home: "/existing-today" } },
    "../../domain/urgeControl/getUrgeControlProgress": { getUrgeControlProgress },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: (value: boolean) => { blocked = value; return () => {}; } },
    "./panicController": { createPanicController }, "./panicView": { getPanicView, samePanicFacts }
  };
  class DisplayDate extends Date { static now() { return Date.parse(at); } }
  const exported = compileModule(readFileSync("src/features/panic/usePanicFeature.ts", "utf8"), dependencies, { Date: DisplayDate,
    setInterval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; }, clearInterval: (id: number) => timers.delete(id) });
  const useFeature = exported.usePanicFeature as (reason: BehaviorSlipReason | null) => Feature;
  return { hooks, navigation, render: () => hooks.render(() => useFeature(reason)), blocked: () => blocked,
    setHydrated: (value: boolean) => { hydrated = value; }, replaceFlow: () => { flow = { ...flow }; }, tick: () => { timers.forEach((callback) => callback()); } };
}

type Element = { type: unknown; props: Record<string, unknown> };
function compileScreen(source: string, hooks: ReturnType<typeof controlledHooks>, useFeature: (reason: BehaviorSlipReason | null) => Feature) {
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const dependencies: Record<string, unknown> = {
    react: hooks.react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { View: "View", StyleSheet: { create: (styles: unknown) => styles } },
    "../../../shared/design-system/theme": { theme: { spacing: { lg: 12 } } },
    "../usePanicFeature": { usePanicFeature: useFeature }
  };
  for (const name of ["AppScreen", "AppCard", "AppText", "AppButton"]) dependencies[`../../../shared/components/${name}`] = { [name]: name };
  return compileModule(source, dependencies).PanicScreen as () => Element;
}
function compileModule(source: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, unknown> };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  runInNewContext(compiled.outputText, { module, exports: module.exports, ...globals,
    require: (name: string) => { assert(name in dependencies, `Unexpected Panic dependency ${name}.`); return dependencies[name]; } });
  return module.exports;
}
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const item = node as Element; return [item, ...elements(item.props.children)];
}
function element(tree: Element, id: string) { return elements(tree).find((item) => item.props.testID === id) ?? null; }
function required(tree: Element, id: string) { const found = element(tree, id); assert(found !== null, `Expected Panic control ${id}.`); return found; }
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
function untouched(before: BloomLocalState, after: BloomLocalState, changed: Array<keyof BloomLocalState>) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) if (!changed.includes(key)) assert(before[key] === after[key], `Panic must preserve unrelated ${key}.`);
}
function flush() { return new Promise<void>((done) => setImmediate(done)); }
function equal(actual: unknown, expected: unknown, message: string) {
  assert(isDeepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected))), message);
}
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
