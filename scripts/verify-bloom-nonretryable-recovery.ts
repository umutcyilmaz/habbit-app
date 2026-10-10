import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { getBloomContentFreeEntryIntent } from "../src/app/flows/getBloomContentFreeEntryIntent";
import { getResetContentFreeContinuationOffer } from "../src/domain/contentFree/getResetContentFreeCredit";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { getMasturbationTrackingAvailability } from "../src/domain/productPolicy/getMasturbationTrackingAvailability";
import { createContentFreeController } from "../src/features/content-free/contentFreeController";
import { getContentFreeFeatureView } from "../src/features/content-free/contentFreeView";
import { createResetController } from "../src/features/reset/resetController";
import { getResetRouteView } from "../src/features/reset/resetView";
import { createMasturbationSessionController } from "../src/features/masturbation-tracking/masturbationSessionController";
import { getMasturbationSessionRouteView } from "../src/features/masturbation-tracking/masturbationSessionView";
import { getBloomPersistenceRecovery } from "../src/shared/navigation/bloomPersistenceRecovery";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import type { BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { createResetContinuityFixture } from "./fixtures/resetContinuity";

const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
const flush = () => new Promise<void>((done) => setImmediate(done));
type Feature = {
  busy: boolean; locked: boolean; navigationBlocked: boolean; canRetry: boolean;
  canConfirmCurrentSave: boolean; recoveryGuidance: string | null;
  actions: { activate: () => void; start: () => void; completeElapsed: () => void;
    close: () => void; retry: () => void; confirmCurrentSave: () => void; };
};

export async function verifyBloomNonretryableRecovery() {
  for (const feature of ["content-free", "reset", "masturbation-tracking"] as const) {
    for (const scenario of ["superseded-saved", "superseded-unsaved", "invalidated-unsaved", "deleted"] as const) {
      const h = createHarness(feature);
      let screen = h.render();
      const oldClose = screen.actions.close;
      const submit = feature === "content-free" ? screen.actions.activate : feature === "reset" ? screen.actions.completeElapsed : screen.actions.start;
      submit();
      const originalAccepted = h.runtime.getState();
      let newSave: Promise<unknown> | null = null;
      if (scenario.startsWith("superseded")) {
        // Only another slice changes: per-feature slice equality is insufficient.
        newSave = h.runtime.applyAcknowledgedMutation((state) => ({ ...state, debug: { ...state.debug, dateOffsetDays: 1 } }));
        if (scenario === "superseded-saved") { h.attempts[1]!.succeed(); await newSave; }
        h.attempts[0]!.succeed();
      } else if (scenario === "deleted") {
        h.attempts[0]!.fail(); await flush();
        h.runtime.beginDeletion(); h.runtime.completeDeletion(createDefaultBloomState()); h.runtime.finishResetNavigation();
        screen = h.render(); screen.actions.retry();
      } else h.attempts[0]!.invalidate();
      await flush(); screen = h.render();
      const obsolete = h.controller().getSnapshot().result;
      assert(obsolete !== null && !obsolete.ok && obsolete.accepted && !obsolete.retryable,
        `${feature}/${scenario} must reproduce an actual accepted, nonretryable runtime result.`);
      assert(!screen.canRetry && screen.locked, "An obsolete controller must not replay old domain operations.");
      const counts = h.counts();
      const writes = h.attempts.length;
      const current = h.runtime.getState();
      const revision = h.runtime.getStateRevision();
      oldClose();
      if (scenario === "superseded-saved" || scenario === "deleted") {
        assert(!screen.navigationBlocked && !screen.canConfirmCurrentSave && h.navigations.length === 1,
          "A discarded receipt can exit only when full authoritative state is already durable, including stale Close handlers.");
        assert(screen.recoveryGuidance?.includes("Kapatıp") === true, "A safe exit must have accurate recovery guidance.");
        assert(h.runtime.getState() === current && h.attempts.length === writes, "Safe exit must not restore discarded old data or create a write.");
      } else {
        assert(screen.navigationBlocked && screen.canConfirmCurrentSave && h.navigations.length === 0,
          "An obsolete receipt with authoritative unsaved data must offer current-save recovery instead of unsafe Close.");
        screen.actions.confirmCurrentSave(); screen.actions.confirmCurrentSave();
        if (newSave !== null) {
          assert(h.attempts.length === writes, "Current recovery must await a covering write without duplicating it.");
          h.attempts[1]!.fail(); await newSave; await flush();
        }
        assert(h.attempts.length === writes + 1 && h.attempts[writes]!.state === current,
          "Recovery must persist the exact current authoritative snapshot, never the superseded successor.");
        h.attempts[writes]!.fail(); await flush(); screen = h.render();
        assert(screen.canRetry && screen.navigationBlocked && !screen.canConfirmCurrentSave,
          "If current-save recovery fails, retain its new exact receipt and ordinary Retry, never a dead end.");
        // Review persistent storage failure separately: repeated failure preserves memory.
        screen.actions.retry(); h.attempts[writes + 1]!.fail(); await flush(); screen = h.render();
        screen.actions.close();
        assert(screen.canRetry && screen.navigationBlocked && h.navigations.length === 0 && h.runtime.getState() === current,
          "Repeated storage failure must preserve authoritative data, retain Retry, and never silently discard/unlock.");
        screen.actions.retry(); h.attempts[writes + 2]!.succeed(); await flush(); screen = h.render();
        assert(!screen.navigationBlocked && !screen.canRetry && h.runtime.getDurableState() === current && h.navigations.length === 0,
          "Current confirmation must not run the obsolete operation's success navigation.");
        screen.actions.close();
        assert(Number(h.navigations.length) === 1, "Explicit Close after current confirmation must work, including stale Reset URLs.");
      }
      assert(h.counts() === counts && h.runtime.getStateRevision() === revision && h.runtime.getState() === current,
        "Recovery/exit must not replay transitions, generate domain IDs/timestamps or mutate current facts.");
      if (scenario === "superseded-unsaved") assert(current !== originalAccepted, "Superseded recovery uses current state, not the former accepted snapshot.");
      h.unmount();
    }
  }
  await verifyCurrentRecoveryLifecycle();
  console.log("Bloom nonretryable recovery verification passed (12 actual-hook/runtime cases; durable-only exit, whole-state mismatch, current exact-save recovery, deletion, repeated failure, and no domain replay).");
}

async function verifyCurrentRecoveryLifecycle() {
  const initial = createDefaultBloomState();
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState: initial, initialHydrationStatus: "ready", persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
    const writeId = attempts.length + 1;
    attempts.push({ state, succeed: () => resolve({ status: "persisted", writeId, generation: 0 }), fail: () => reject(new Error("Synthetic lifecycle failure")) });
  }) });
  runtime.applyMutation((state) => ({ ...state, debug: { ...state.debug, dateOffsetDays: 1 } }));
  const firstRecovery = runtime.confirmCurrentPersistence();
  assert(attempts.length === 1, "A recovery for an unacknowledged current write waits for its existing attempt.");
  runtime.applyMutation((state) => ({ ...state, debug: { ...state.debug, dateOffsetDays: 2 } }));
  const newer = runtime.getState();
  attempts[0]!.succeed();
  const obsoleteRecovery = await firstRecovery;
  assert(!obsoleteRecovery.ok && obsoleteRecovery.accepted && !obsoleteRecovery.retryable && obsoleteRecovery.reason === "persistenceSuperseded" && runtime.getState() === newer,
    "A newer revision during recovery invalidates the exact recovery; it must never claim the current state saved.");
  attempts[1]!.fail(); await flush();
  const secondRecovery = runtime.confirmCurrentPersistence();
  assert(attempts[2]!.state === newer, "A new explicit recovery saves current truth without another state revision.");
  runtime.beginDeletion(); const fresh = createDefaultBloomState(); runtime.completeDeletion(fresh); runtime.finishResetNavigation();
  attempts[2]!.succeed();
  const deletedRecovery = await secondRecovery;
  assert(!deletedRecovery.ok && deletedRecovery.accepted && !deletedRecovery.retryable && deletedRecovery.reason === "persistenceInvalidated" && runtime.getState() === fresh && runtime.getDurableState() === fresh,
    "Lifecycle invalidation during current recovery must not resurrect deleted state or falsely acknowledge its receipt.");
  assert((await runtime.confirmCurrentPersistence()).ok && Number(attempts.length) === 3,
    "Confirming current durable truth acknowledges it without another storage write.");
}

function createHarness(feature: "content-free" | "reset" | "masturbation-tracking") {
  const fixture = createResetContinuityFixture();
  const at = fixture.observeDays(15);
  const initial = feature === "reset" ? fixture.state : createDefaultBloomState();
  if (feature === "masturbation-tracking") initial.masturbationTracking.enabled = true;
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void; invalidate: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState: initial, initialHydrationStatus: "ready", persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
    const writeId = attempts.length + 1;
    attempts.push({ state, succeed: () => resolve({ status: "persisted", writeId, generation: 0 }),
      fail: () => reject(new Error("Synthetic persistent failure")), invalidate: () => resolve({ status: "invalidated", writeId, generation: 0 }) });
  }) });
  let factCalls = 0;
  const productActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: runtime.applyAcknowledgedMutation });
  const flowActions = createBloomProductFlowActions({ productActions, now: () => { factCalls++; return new Date(at); }, createId: (prefix) => `${prefix}-recovery-${++factCalls}` });
  const hooks = controlledHooks();
  const navigations: unknown[] = [];
  let controller: { getSnapshot: () => { result: import("../src/app/providers/bloomLocalStateMutationRuntime").BloomPersistedMutationResult | null } };
  const capture = <T extends typeof controller>(value: T) => { controller = value; return value; };
  const dependencies: Record<string, unknown> = {
    react: hooks.react,
    "expo-router": { useRouter: () => ({ replace: (route: unknown) => navigations.push(route) }), useLocalSearchParams: () => ({ journeyId: "continuity-reset", attemptId: "continuity-attempt" }) },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => flowActions },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({ state: runtime.getState(), durableState: runtime.getDurableState(), getAcceptedState: runtime.getState,
      getDurableState: runtime.getDurableState, retryPersistedMutation: runtime.retryPersistence, confirmCurrentPersistence: runtime.confirmCurrentPersistence, hasHydrated: true, hydrationStatus: "ready" }) },
    "../../app/navigation/navigateBloomProductFlow": { navigateBloomProductFlow: (_router: unknown, route: unknown) => { navigations.push(route); return true; } },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: () => () => {} },
    "../../shared/navigation/bloomPersistenceRecovery": { getBloomPersistenceRecovery },
    "../../constants/navigation": { routes: { home: "/today" } },
    "../../app/flows/getBloomContentFreeEntryIntent": { getBloomContentFreeEntryIntent },
    "../../domain/contentFree/getResetContentFreeCredit": { getResetContentFreeContinuationOffer },
    "../../domain/reset/getResetProgress": { getResetProgress },
    "../../domain/productPolicy/getMasturbationTrackingAvailability": { getMasturbationTrackingAvailability },
    "./contentFreeController": { createContentFreeController: (options: Parameters<typeof createContentFreeController>[0]) => capture(createContentFreeController(options)) },
    "./contentFreeView": { getContentFreeFeatureView },
    "./resetController": { createResetController: (options: Parameters<typeof createResetController>[0]) => capture(createResetController(options)) },
    "./resetView": { getResetRouteView },
    "./masturbationSessionController": { createMasturbationSessionController: (options: Parameters<typeof createMasturbationSessionController>[0]) => capture(createMasturbationSessionController(options)) },
    "./masturbationSessionView": { getMasturbationSessionRouteView }
  };
  const name = feature === "content-free" ? "useContentFreeFeature" : feature === "reset" ? "useResetFeature" : "useMasturbationSessionFeature";
  const module = { exports: {} as Record<string, unknown> };
  const compiled = ts.transpileModule(readFileSync(`src/features/${feature}/${name}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  class DisplayDate extends Date { static now() { return Date.parse(at); } }
  runInNewContext(compiled.outputText, { module, exports: module.exports, Date: DisplayDate,
    require: (name: string) => { assert(name in dependencies, `Unknown hook dependency ${name}`); return dependencies[name]; }, setInterval: () => 1, clearInterval: () => {} });
  const useFeature = module.exports[name] as (mode?: string) => Feature;
  return { runtime, attempts, navigations, counts: () => factCalls, controller: () => controller!, unmount: hooks.unmount,
    render: () => hooks.render(() => useFeature(feature === "reset" ? "completion" : "start")) };
}

// Same controlled hook pattern used by the existing feature verification scripts.
function controlledHooks() {
  let cursor = 0;
  const slots: any[] = [];
  const effects: Array<{ setup: () => void | (() => void); cleanup?: (() => void) | undefined }> = [];
  const pending: Array<() => void> = [];
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useRef: (value: unknown) => slots[cursor++] ?? (slots[cursor - 1] = { current: value }),
    useState: (initial: unknown) => { const i = cursor++; const cell = slots[i] ?? (slots[i] = { value: typeof initial === "function" ? initial() : initial }); return [cell.value, (value: unknown) => { cell.value = value; }]; },
    useMemo: (create: () => unknown, deps: unknown[]) => { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: create(), deps }; return slots[i].value; },
    useEffect: (setup: () => void | (() => void), deps: unknown[]) => { const i = cursor++; const prior = slots[i]; if (!prior || !same(prior.deps, deps)) { const effect = { setup, deps, cleanup: undefined as (() => void) | undefined }; slots[i] = effect; effects.push(effect); pending.push(() => { prior?.cleanup?.(); effect.cleanup = setup() ?? undefined; }); } },
    useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => { cursor++; return read(); }
  };
  return { react, render: <T>(render: () => T) => { cursor = 0; const value = render(); pending.splice(0).forEach((effect) => effect()); return value; }, unmount: () => effects.forEach((effect) => effect.cleanup?.()) };
}
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
