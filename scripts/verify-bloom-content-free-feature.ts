import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext } from "node:vm";

import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { getContentFreeProgress } from "../src/domain/contentFree/getContentFreeProgress";
import type { ContentFreeViolation } from "../src/domain/models/ContentFreeState";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import {
  BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState,
  type BloomStateWriteReceipt
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState } from "./verify-bloom-reset-violations";
import { createContentFreeController } from "../src/features/content-free/contentFreeController";
import {
  getContentFreeFeatureView,
  getLatestManualContentFreeUndoCandidate
} from "../src/features/content-free/contentFreeView";

const activatedAt = "2026-11-01T12:00:00.750Z";
const day = 86400000;
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");

export async function verifyBloomContentFreeFeature() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7",
    "The Content-Free feature must retain the current v7 persistence contract.");
  await verifyLifecycle();
  await verifyAcceptedFailureRetry();
  await verifyStaleHandlers();
  await verifyDomainOwnership();
  verifyViews();
  verifyFeatureWiring();
  await verifyHookWiring();
  console.log("Bloom Content-Free feature verification passed (explicit lifecycle, canonical progress/history, stale-event guards, acknowledged retry without replay, Reset ownership, v7 reloads, and controlled hook/screen wiring).");
}

async function verifyLifecycle() {
  const initial = createPopulatedState();
  initial.contentFree = createDefaultBloomState().contentFree;
  const original = JSON.stringify(initial);
  const h = createHarness(initial);
  const unsubscribe = h.controller.subscribe(() => undefined);
  h.controller.getSnapshot();
  h.controller.getSnapshot();
  unsubscribe();
  h.makeController().getSnapshot();
  equal(h.counts(), { clockCalls: 0, idCalls: 0, mutationCalls: 0 }, "Controller mount, reads, and remount must never prepare or dispatch activation.");
  const activation = h.controller.activate(initial.contentFree);
  assert(activation !== null && h.controller.activate(initial.contentFree) === activation,
    "Duplicate explicit activation presses must share one in-flight acknowledgement.");
  const active = h.runtime.getState();
  assert(active.contentFree.status === "active" && active.contentFree.activatedAt === activatedAt,
    "Activation must delegate identity/time preparation to the existing flow API.");
  assert(h.controller.deactivate(active.contentFree) === null && h.runtime.getDurableState() === initial,
    "Accepted activation must remain distinct from durable state and lock competing operations.");
  equal(h.counts(), { clockCalls: 1, idCalls: 1, mutationCalls: 1 }, "Duplicate activation must not generate extra facts.");
  h.attempts[0]!.succeed();
  assert((await activation).ok, "Activation must become saved only after its persistence receipt.");
  assert(h.controller.activate(initial.contentFree) === null, "A settled stale activation closure must not replay the command.");
  assertUnrelatedReferences(initial, active);
  await roundTrip(active);

  const occurredAt = shift(activatedAt, 2 * day + 999);
  h.setTime(occurredAt);
  const logged = h.controller.recordManualViolation(active.contentFree);
  assert(logged !== null && h.controller.recordManualViolation(active.contentFree) === logged,
    "Duplicate intentional-content confirmations must create only one logical event.");
  const recorded = h.runtime.getState();
  const violation = recorded.contentFree.violations[0];
  assert(recorded.contentFree.status === "active" && violation?.source.kind === "manual" &&
    violation.kind === "intentionalExplicitContent" && violation.status === "recorded",
  "Manual intentional-content use must create its canonical manual event while Content-Free remains active.");
  assert(violation.occurredAt === occurredAt && violation.recordedAt === occurredAt &&
    recorded.contentFree.currentStreakStartedAt === occurredAt && recorded.contentFree.bestStreakSeconds === 172800,
  "The domain transition must reset the current streak and floor the ended streak without feature calculations.");
  assert(h.runtime.getDurableState() === active && h.controller.getSnapshot().busy,
    "An accepted manual event must not be labeled saved before acknowledgement.");
  equal(h.counts(), { clockCalls: 2, idCalls: 3, mutationCalls: 2 }, "One manual event prepares one clock and exactly its event/source IDs.");
  h.attempts[1]!.succeed();
  assert((await logged).ok, "Manual event save must use the existing acknowledgement result.");
  assert(h.controller.recordManualViolation(active.contentFree) === null,
    "A retained settled confirmation must not create a second event against its stale rendered state.");
  assertUnrelatedReferences(active, recorded);
  await roundTrip(recorded);

  h.setTime(shift(occurredAt, 1000));
  const undo = h.controller.undoManualViolation(violation.id, recorded.contentFree);
  assert(undo !== null && h.controller.undoManualViolation(violation.id, recorded.contentFree) === undo &&
    h.controller.undoManualViolation("another-id", recorded.contentFree) === null,
  "Undo must deduplicate the exact target without substituting another event during an in-flight operation.");
  const undone = h.runtime.getState();
  const tombstone = undone.contentFree.violations[0];
  assert(undone.contentFree.status === "active" && undone.contentFree.currentStreakStartedAt === activatedAt &&
    undone.contentFree.bestStreakSeconds === 0 && tombstone?.status === "undone" && tombstone.id === violation.id,
  "The underlying undo transition must restore the prior streak/best and retain the same event as a tombstone.");
  assert(tombstone.source === violation.source, "Undo must preserve the original manual source identity.");
  h.attempts[2]!.succeed();
  assert((await undo).ok && getLatestManualContentFreeUndoCandidate(undone.contentFree) === null,
    "A saved undone tombstone must no longer be offered for manual undo.");
  assertUnrelatedReferences(recorded, undone);
  await roundTrip(undone);

  const endedAt = shift(activatedAt, 3 * day + 1250);
  h.setTime(endedAt);
  const deactivation = h.controller.deactivate(undone.contentFree);
  assert(deactivation !== null && h.controller.deactivate(undone.contentFree) === deactivation,
    "Deactivation must delegate once even under duplicate presses.");
  const inactive = h.runtime.getState();
  assert(inactive.contentFree.status === "inactive" && inactive.contentFree.bestStreakSeconds === 259201 &&
    inactive.contentFree.violations === undone.contentFree.violations,
  "Canonical deactivation must archive the final whole-second best and preserve the violation history.");
  equal(inactive.contentFree.pastActivations, [{ id: active.contentFree.activationId, startedAt: activatedAt, endedAt }],
    "Deactivation must retain the exact activation identity and archive its canonical interval once.");
  h.attempts[3]!.succeed();
  assert((await deactivation).ok && h.controller.getSnapshot().result?.ok === true,
    "Successful deactivation must settle on the saved inactive state.");
  assertUnrelatedReferences(undone, inactive);
  await roundTrip(inactive);
  h.setTime(shift(endedAt, 1000));
  const reactivation = h.controller.activate(inactive.contentFree);
  assert(reactivation !== null, "A new explicit activation must remain possible after deactivation.");
  h.attempts[4]!.succeed();
  assert((await reactivation).ok && h.runtime.getState().contentFree.pastActivations === inactive.contentFree.pastActivations,
    "Reactivation must preserve prior activation history without joining its inactive interval.");
  assert(JSON.stringify(initial) === original, "The entire feature lifecycle must leave its original snapshot immutable.");
}

async function verifyAcceptedFailureRetry() {
  for (const operation of ["activate", "recordManualViolation"] as const) {
    const h = createHarness(operation === "activate" ? createDefaultBloomState() : activeState());
    h.setTime(shift(activatedAt, day + 1000));
    const expected = h.runtime.getState().contentFree;
    const promise = h.controller[operation](expected);
    assert(promise !== null, "The retry fixture must submit its explicit flow operation.");
    const accepted = h.runtime.getState();
    h.attempts[0]!.fail();
    const failure = await promise;
    assert(!failure.ok && failure.accepted && failure.retryable && failure.reason === "persistenceFailed" &&
      h.controller.getSnapshot().result === failure && h.runtime.getDurableState() === h.initialState,
    "A failed receipt must preserve the original accepted failure and durable-state distinction.");
    assert(h.controller.deactivate(accepted.contentFree) === null &&
      h.controller.recordManualViolation(accepted.contentFree) === null,
    "Accepted unsaved work must lock further feature mutations.");
    const counts = h.counts();
    const retry = h.controller.retry();
    assert(retry !== null && h.controller.retry() === retry && h.attempts[1]!.state === accepted,
      "Duplicate retry clicks must share the persistence-only retry of the accepted snapshot.");
    h.attempts[1]!.succeed();
    const success = await retry;
    assert(success.ok && h.controller.getSnapshot().result === success && h.runtime.getDurableState() === accepted,
      "Retry success must acknowledge the same accepted activation/event without another logical operation.");
    equal(h.counts(), counts, "Persistence retry must not replay domain transitions or regenerate any clock/ID facts.");
    assert(h.controller.retry() === null, "A completed retry must not produce another save.");
    await roundTrip(accepted);
  }
}

async function verifyStaleHandlers() {
  for (const change of ["removed", "undone", "session", "manual-source", "activation"] as const) {
    const state = recordedState();
    const target = state.contentFree.violations[0]!;
    const h = createHarness(state);
    const replacement = { ...state.contentFree, violations: state.contentFree.violations.map((record) => ({ ...record })) };
    if (change === "removed") replacement.violations = [];
    if (change === "undone") replacement.violations = [{ ...target, status: "undone", undoneAt: shift(target.recordedAt, 1000) }];
    if (change === "session") replacement.violations = [{ ...target, source: { kind: "masturbationSession", sessionId: "session-source" } }];
    if (change === "manual-source") replacement.violations = [{ ...target, source: { kind: "manual", logActionId: "changed-source" } }];
    if (change === "activation" && replacement.status === "active") replacement.activationId = "changed-activation";
    const external = h.runtime.applyAcknowledgedMutation((current) => ({ ...current, contentFree: replacement }));
    h.attempts[0]!.succeed();
    assert((await external).ok, "Stale-row fixture must replace canonical accepted facts before invoking the old callback.");
    const counts = h.counts();
    assert(h.controller.undoManualViolation(target.id, state.contentFree) === null &&
      h.controller.recordManualViolation(state.contentFree) === null && h.controller.deactivate(state.contentFree) === null,
    "Retained handlers must reject changed canonical identity/status/source/activation before generating or dispatching facts.");
    equal(h.counts(), counts, "The latest accepted getter must protect stale rendered history without a rerender.");
    assert(h.runtime.getState().contentFree === replacement && h.attempts.length === 1,
      "A stale handler must preserve current facts and issue no save.");
  }
  const h = createHarness(recordedState());
  for (const id of [undefined, null, "", " ", [], ["manual-event"], 42, "other-event"]) {
    assert(h.controller.undoManualViolation(id, h.initialState.contentFree) === null,
      "Manual undo must require the exact scalar canonical event ID.");
  }
  for (const source of ["session", "undone", "older"] as const) {
    const state = recordedState();
    const first = state.contentFree.violations[0]!;
    if (source === "session") state.contentFree.violations = [{ ...first, source: { kind: "masturbationSession", sessionId: "session-source" } }];
    if (source === "undone") state.contentFree.violations = [{ ...first, status: "undone", undoneAt: shift(first.recordedAt, 1000) }];
    if (source === "older") state.contentFree.violations.push({ ...first, id: "later-event", source: { kind: "manual", logActionId: "later-log" } });
    const blocked = createHarness(state);
    assert(blocked.controller.undoManualViolation(first.id, state.contentFree) === null && blocked.counts().clockCalls === 0,
      "Session-derived events, tombstones, and older rows must not be passed to the manual undo flow.");
  }
}

async function verifyDomainOwnership() {
  for (const elapsed of [3 * day, 15 * day]) {
    const state = createActiveState(false, true);
    assert(state.resetJourney.status === "active", "An active Reset ownership fixture is required.");
    const h = createHarness(state);
    h.setTime(shift(state.resetJourney.currentAttempt.startedAt, elapsed));
    const command = h.controller.recordManualViolation(state.contentFree);
    assert(command !== null && h.counts().mutationCalls === 1 && h.counts().idCalls === 2,
      "The feature must delegate explicit-content eligibility to the existing flow/domain command.");
    if (elapsed < 15 * day) {
      const result = await command;
      assert(!result.ok && !result.accepted && result.reason === "invalidSession" && h.attempts.length === 0 &&
        h.runtime.getState() === state && h.controller.getSnapshot().message !== null,
      "Restrictive Reset must retain atomic ownership and surface normal unavailable feedback without partial Content-Free changes.");
    } else {
      assert(h.attempts.length === 1, "The elapsed current-attempt boundary must use the existing effective policy.");
      h.attempts[0]!.succeed();
      assert((await command).ok, "Elapsed Reset must not be reinterpreted as a continued Content-Free restriction by React.");
    }
    assert(h.runtime.getState().resetJourney === state.resetJourney,
      "This feature must never restart or auto-complete Reset while handling a standalone event.");
  }
}

function verifyViews() {
  const state = recordedState();
  const original = JSON.stringify(state);
  const at = shift(activatedAt, 3 * day + 1250);
  const view = getContentFreeFeatureView(state.contentFree, at);
  equal(view.progress, getContentFreeProgress(state.contentFree, at), "Feature progress must be exactly the existing selector result.");
  assert(view.activationId === "feature-activation" && view.manualUndoCandidateId === "manual-event" &&
    getLatestManualContentFreeUndoCandidate(state.contentFree) === state.contentFree.violations[0],
  "The view must expose the current recorded manual candidate without recreating its identity.");
  const first = state.contentFree.violations[0]!;
  const later = { ...first, id: "session-event", recordedAt: shift(first.recordedAt, 2000), source: { kind: "masturbationSession" as const, sessionId: "session-source" } };
  const tombstone: ContentFreeViolation = { ...first, id: "undone-event", recordedAt: shift(first.recordedAt, 3000), status: "undone", undoneAt: at };
  state.contentFree.violations = [first, later, tombstone];
  const history = getContentFreeFeatureView(state.contentFree, at);
  equal(history.history.map((record) => record.id), [tombstone.id, later.id, first.id], "Visible history must sort a copy by recording time while retaining source/status facts.");
  assert(history.history !== state.contentFree.violations && history.history[0] === tombstone &&
    history.manualUndoCandidateId === null && getLatestManualContentFreeUndoCandidate(state.contentFree) === null,
  "A later effective session-derived event must not expose an older manual row as the latest undo target; tombstones stay history only.");
  const onlyUndone = { ...state.contentFree, violations: [tombstone] };
  assert(getLatestManualContentFreeUndoCandidate(onlyUndone) === null, "Already-undone records cannot become manual undo candidates.");
  const past = { ...state.contentFree, violations: [{ ...first, activationId: "past-activation" }] };
  assert(getLatestManualContentFreeUndoCandidate(past) === null, "A past-activation event must not be offered as a current manual undo.");
  const inactive = { status: "inactive" as const, bestStreakSeconds: 999, violations: [first], pastActivations: [] };
  const inactiveView = getContentFreeFeatureView(inactive, at);
  assert(inactiveView.activationId === null && inactiveView.manualUndoCandidateId === null && inactiveView.progress?.status === "inactive",
    "Inactive display must retain historical best without inventing a current activation or undo target.");
  assert(getContentFreeFeatureView(state.contentFree, "invalid").progress === null, "Invalid display time must not fabricate progress.");
  const beforeReads = JSON.stringify(state);
  for (const elapsed of [0, 1, day, 20 * day]) getContentFreeFeatureView(state.contentFree, shift(at, elapsed));
  assert(JSON.stringify(state) === beforeReads && JSON.stringify(recordedState()) === original,
    "Display-time reads and sorted history must never persist ticks or mutate their canonical source arrays.");
}

function verifyFeatureWiring() {
  const directory = "src/features/content-free/";
  const screen = readFileSync(`${directory}screens/ContentFreeScreen.tsx`, "utf8");
  const hook = readFileSync(`${directory}useContentFreeFeature.ts`, "utf8");
  const controller = readFileSync(`${directory}contentFreeController.ts`, "utf8");
  const view = readFileSync(`${directory}contentFreeView.ts`, "utf8");
  for (const source of [screen, hook, controller, view]) {
    assert(!/AsyncStorage|persistBloomLocalState|loadBloomLocalState|applyAcknowledgedMutation|bloomContentFreeTransitions|recordActiveResetViolationState|getNextBloomAction/.test(source),
      "Feature modules must not access storage, invoke transitions, or import legacy journey behavior.");
    assert(!/createBloomRecordId|Math\.random|createId\s*\(/.test(source), "Feature code must leave identity generation to the existing flow factory.");
  }
  assert(!/Date\.|new Date|useEffect|setInterval|currentStreakStartedAt\s*:|bestStreakSeconds\s*:/.test(screen),
    "The screen must not create time facts, mount effects, or manually update persisted streak values.");
  assert(hook.includes("getState: getAcceptedState") && hook.includes("useBloomProductFlowActions") &&
    view.includes("getContentFreeProgress(content, now)"),
  "Canonical event-time reads and progress must use the existing provider accessor and domain selector.");
  assert(!/getResetRestrictionStatus|resetJourney|streakBefore/.test(hook + screen + controller),
    "React/controller code must delegate Reset ownership and streak reversal policy to existing transitions.");
  for (const component of ["AppScreen", "AppCard", "AppText", "AppButton"]) {
    assert(screen.includes(`import { ${component} }`), `The feature must use shared ${component} UI.`);
  }
  assert(screen.includes("Accidental exposure doesn’t count") && screen.includes("Record intentional explicit-content use") &&
    screen.includes("From session feedback") && screen.includes('violation.status === "undone"'),
  "History/copy must distinguish intentional manual use, session feedback, and undone entries without an accidental-exposure action.");
  assert(screen.includes("view.manualUndoCandidateId === violation.id") && screen.includes("actions.undoManualViolation(violation.id)"),
    "Only the explicit canonical candidate may expose the manual undo command, using its exact row ID.");
  verifyConfirmationComponent(screen);
}

async function verifyHookWiring() {
  const h = createHarness();
  const hooks = createControlledHooks();
  const timers = new Map<number, () => void>();
  const navigation: unknown[] = [];
  let timerId = 0;
  let displayTime = Date.parse(activatedAt);
  let flows = h.flowActions;
  let hasHydrated = false;
  let hydrationStatus: "loading" | "error" | "ready" = "loading";
  const router = { replace: (path: unknown) => navigation.push(path) };
  const dependencies: Record<string, unknown> = {
    react: hooks.react,
    "expo-router": { useRouter: () => router },
    "../../app/flows/useBloomProductFlowActions": { useBloomProductFlowActions: () => flows },
    "../../app/providers/BloomLocalStateProvider": { useBloomLocalState: () => ({
      state: h.runtime.getState(), durableState: h.runtime.getDurableState(),
      getAcceptedState: h.runtime.getState, retryPersistedMutation: h.runtime.retryPersistence, hasHydrated, hydrationStatus
    }) },
    "../../constants/navigation": { routes: { home: "/existing-home" } },
    "../../shared/navigation/usePersistenceNavigationGuard": { usePersistenceNavigationGuard: () => () => undefined },
    "./contentFreeController": { createContentFreeController },
    "./contentFreeView": { getContentFreeFeatureView }
  };
  const source = readFileSync("src/features/content-free/useContentFreeFeature.ts", "utf8");
  const module = { exports: {} as Record<string, unknown> };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  class DisplayDate extends Date { static now() { return displayTime; } }
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, Date: DisplayDate,
    require: (name: string) => { assert(name in dependencies, `Unexpected Content-Free hook dependency ${name}.`); return dependencies[name]; },
    setInterval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearInterval: (id: number) => timers.delete(id)
  });
  type Feature = {
    view: ReturnType<typeof getContentFreeFeatureView>;
    busy: boolean; locked: boolean; canRetry: boolean; message: string | null;
    saveState: "loading" | "unavailable" | "saving" | "saved" | "unconfirmed";
    actions: { activate: () => void; deactivate: () => void; recordManualViolation: () => void;
      undoManualViolation: (id: string) => void; retry: () => void; close: () => void; };
  };
  const useFeature = module.exports.useContentFreeFeature as () => Feature;
  const render = () => hooks.render(useFeature);
  let feature = render();
  render();
  hooks.reattachEffects();
  displayTime += 12345;
  for (const tick of timers.values()) tick();
  feature = render();
  equal(h.counts(), { clockCalls: 0, idCalls: 0, mutationCalls: 0 }, "Actual hook mount, rerender, effect reattachment, and ticks must never prepare a flow operation.");
  assert(feature.locked && feature.saveState === "loading" && feature.view.progress === null &&
    feature.view.history.length === 0 && feature.view.activationId === null && feature.view.manualUndoCandidateId === null,
  "Pending hydration must hide default inactive/progress/history facts and lock feature controls.");
  hydrationStatus = "error";
  feature = render();
  assert(feature.locked && feature.saveState === "unavailable" && feature.view.progress === null &&
    feature.view.history.length === 0 && feature.view.manualUndoCandidateId === null,
  "Failed hydration must show unavailable state rather than loading forever or presenting unsaved defaults as canonical facts.");
  equal(h.counts(), { clockCalls: 0, idCalls: 0, mutationCalls: 0 }, "Hydration status changes must never initialize Content-Free or perform an implicit recovery write.");
  hydrationStatus = "ready";
  hasHydrated = true;
  feature = render();
  assert(!feature.locked && feature.saveState === "saved", "Successful hydration must reveal the existing saved state without an activation command.");
  assert(h.attempts.length === 0 && navigation.length === 0 && feature.view.progress?.status === "inactive",
    "Opening Content-Free must remain inactive and never save or navigate automatically.");

  feature.actions.activate();
  feature.actions.activate();
  feature = render();
  assert(feature.busy && feature.locked && feature.saveState === "saving" && h.counts().mutationCalls === 1,
    "Only an explicit activation may dispatch, with duplicate presses sharing one pending operation.");
  feature.actions.close();
  assert(navigation.length === 0, "Close must not navigate while a save is pending.");
  h.attempts[0]!.fail();
  await flush();
  feature = render();
  assert(feature.view.progress?.status === "active" && feature.locked && feature.canRetry &&
    feature.saveState === "unconfirmed" && feature.message !== null && navigation.length === 0,
  "Accepted activation must display unconfirmed save/retry state, not optimistic durable success.");
  const activationCounts = h.counts();
  feature.actions.retry();
  feature.actions.retry();
  h.attempts[1]!.succeed();
  await flush();
  feature = render();
  equal(h.counts(), activationCounts, "Actual hook retry must not regenerate activation facts or replay its mutation.");
  assert(feature.saveState === "saved" && !feature.locked && navigation.length === 0,
    "Durable activation must remain on Content-Free rather than trigger navigation from changed status.");
  const beforeTicks = h.runtime.getState();
  const beforeTickCounts = h.counts();
  displayTime = Date.parse(shift(activatedAt, day + 1999));
  for (const tick of timers.values()) tick();
  feature = render();
  equal(feature.view.progress, getContentFreeProgress(beforeTicks.contentFree, new Date(displayTime).toISOString()),
    "The actual hook's display clock must feed canonical selector progress.");
  assert(h.runtime.getState() === beforeTicks, "Display ticks must not create persisted counter updates.");
  equal(h.counts(), beforeTickCounts, "Display clocks must not call the flow clock or mutation runtime.");

  h.setTime(shift(activatedAt, day + 2000));
  feature.actions.recordManualViolation();
  feature.actions.recordManualViolation();
  feature = render();
  const pendingManual = h.runtime.getState();
  const record = pendingManual.contentFree.violations[0];
  assert(record?.source.kind === "manual" && feature.busy && pendingManual.contentFree.status === "active" &&
    Number(h.attempts.length) === 3,
  "The actual manual action must delegate exactly once and keep canonical Content-Free active.");
  h.attempts[2]!.fail();
  await flush();
  feature = render();
  assert(feature.canRetry && feature.locked && feature.saveState === "unconfirmed", "A failed manual save must retain the accepted event and recovery UI.");
  const manualCounts = h.counts();
  feature.actions.retry();
  feature.actions.retry();
  h.attempts[3]!.succeed();
  await flush();
  feature = render();
  equal(h.counts(), manualCounts, "Manual retry through the hook must save the same event without regenerated identities or timestamps.");
  assert(feature.saveState === "saved" && feature.view.manualUndoCandidateId === record.id && navigation.length === 0,
    "Saved manual use must expose only the exact current manual candidate without automatic navigation.");
  hasHydrated = false;
  hydrationStatus = "error";
  feature = render();
  assert(feature.locked && feature.saveState === "unavailable" && feature.view.progress === null &&
    feature.view.history.length === 0 && feature.view.activationId === null && feature.view.manualUndoCandidateId === null,
  "Unavailable hydration must also mask populated cached history and its manual candidate, not only empty defaults.");
  equal(h.counts(), manualCounts, "Masking unavailable history must perform no command or persistence recovery of its own.");
  hasHydrated = true;
  hydrationStatus = "ready";
  feature = render();
  assert(feature.view.manualUndoCandidateId === record.id && feature.saveState === "saved",
    "Ready state must restore the same canonical history candidate without regenerating its event.");

  const oldRowActions = feature.actions;
  h.setTime(shift(activatedAt, day + 3000));
  const externalUndo = h.flowActions.contentFree.undoManualViolation({ violationId: record.id });
  h.attempts[4]!.succeed();
  assert((await externalUndo).ok, "Stale hook handler fixture must change canonical status through a real external domain command.");
  const afterExternalCounts = h.counts();
  oldRowActions.undoManualViolation(record.id);
  oldRowActions.recordManualViolation();
  equal(h.counts(), afterExternalCounts, "A stale hook row/action must re-read accepted state before any dispatch, even before React rerenders.");
  feature = render();
  assert(feature.view.manualUndoCandidateId === null, "The refreshed UI must not offer an undone tombstone for manual undo.");
  h.setTime(shift(activatedAt, 2 * day + 1000));
  feature.actions.deactivate();
  feature.actions.deactivate();
  feature = render();
  assert(feature.view.progress?.status === "inactive" && feature.saveState === "saving" && navigation.length === 0,
    "Accepted deactivation must show saving and remain on this route.");
  h.attempts[5]!.succeed();
  await flush();
  feature = render();
  assert(feature.view.progress?.status === "inactive" && feature.saveState === "saved" && navigation.length === 0,
    "A durable deactivation must leave the executable Content-Free route on its saved inactive state.");

  const retained = feature.actions;
  flows = { ...flows };
  feature = render();
  const prior = { counts: h.counts(), writes: h.attempts.length, navigation: navigation.length };
  retained.activate();
  retained.retry();
  retained.close();
  equal(h.counts(), prior.counts, "Callbacks retained from an earlier controller must not generate facts or dispatch.");
  assert(h.attempts.length === prior.writes && navigation.length === prior.navigation,
    "Stale controller actions must neither save nor navigate.");
  hooks.unmount();
  feature.actions.activate();
  feature.actions.retry();
  feature.actions.close();
  equal(h.counts(), prior.counts, "Unmounted hook actions must not issue commands or regenerate facts.");
  assert(h.attempts.length === prior.writes && navigation.length === prior.navigation,
    "Unmounted actions must neither save nor navigate.");
}

function verifyConfirmationComponent(screen: string) {
  const parsed = ts.createSourceFile("ContentFreeScreen.tsx", screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ManualViolationAction");
  assert(component !== undefined, "The manual event must have an explicit confirmation interaction.");
  const hooks = createControlledHooks();
  let calls = 0;
  type Element = { type: unknown; props: Record<string, unknown> };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const module = { exports: {} as Record<string, unknown> };
  const compiled = ts.transpileModule(`export ${component.getText(parsed)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  });
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, useState: hooks.react.useState, useRef: hooks.react.useRef,
    AppCard: "AppCard", AppText: "AppText", AppButton: "AppButton", styles: {},
    require: (name: string) => { assert(name === "react/jsx-runtime", "The isolated confirmation must use only JSX rendering."); return { jsx, jsxs: jsx, Fragment: "Fragment" }; }
  });
  const renderComponent = module.exports.ManualViolationAction as (props: { locked: boolean; onRecord: () => void }) => Element;
  const render = (locked = false) => hooks.render(() => renderComponent({ locked, onRecord: () => { calls++; } }));
  const find = (node: unknown, id: string): Element | undefined => {
    if (Array.isArray(node)) {
      for (const child of node) { const found = find(child, id); if (found !== undefined) return found; }
    } else if (typeof node === "object" && node !== null && "props" in node) {
      const element = node as Element;
      return element.props.testID === id ? element : find(element.props.children, id);
    }
    return undefined;
  };
  const press = (tree: Element, suffix: string) => {
    const button = find(tree, `bloom.content-free.record${suffix}`);
    assert(button !== undefined && typeof button.props.onPress === "function", "Expected explicit manual-confirmation button.");
    (button.props.onPress as () => void)();
    return button.props.onPress as () => void;
  };
  let tree = render();
  render();
  assert(calls === 0, "Rendering the actual confirmation component must never record an event.");
  press(tree, "");
  tree = render();
  assert(calls === 0, "Opening confirmation must not yet dispatch a manual event.");
  const staleConfirm = press(tree, ".confirm");
  staleConfirm();
  tree = render();
  staleConfirm();
  assert(Number(calls) === 1, "One confirmation must be consumed before dispatch, rejecting repeated presses before and after rerender.");
  press(tree, "");
  tree = render();
  press(tree, ".cancel");
  staleConfirm();
  tree = render();
  assert(Number(calls) === 1, "Cancel must leave no open confirmation that a retained confirm handler can submit.");
  press(tree, "");
  tree = render(true);
  const lockedConfirm = find(tree, "bloom.content-free.record.confirm");
  assert(lockedConfirm?.props.disabled === true, "Saving/locked state must disable confirmation controls.");
  press(tree, ".confirm");
  assert(Number(calls) === 1, "A locked confirmation callback must not dispatch even if called directly.");
  tree = render();
  press(tree, ".confirm");
  assert(Number(calls) === 2, "A distinct explicitly reopened confirmation may represent a later logical event.");
}

// Runs actual hook/component code with controlled dependency lifecycles. This
// verifies feature wiring, not React's renderer or reconciliation internals.
function createControlledHooks() {
  const slots: unknown[] = [];
  let cursor = 0;
  const effects: Array<{ setup: () => void | (() => void); cleanup?: (() => void) | undefined }> = [];
  const pending: Array<() => void> = [];
  const same = (left: readonly unknown[], right: readonly unknown[]) => left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
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
      const previous = slots[index] as { value: T; dependencies: readonly unknown[] } | undefined;
      if (previous === undefined || !same(previous.dependencies, dependencies)) slots[index] = { value: create(), dependencies: Array.from(dependencies) };
      return (slots[index] as { value: T }).value;
    },
    useEffect: (setup: () => void | (() => void), dependencies: readonly unknown[]) => {
      const index = cursor++;
      const previous = slots[index] as { dependencies: readonly unknown[]; cleanup?: () => void } | undefined;
      if (previous === undefined || !same(previous.dependencies, dependencies)) {
        const effect = { setup, dependencies: Array.from(dependencies), cleanup: undefined as (() => void) | undefined };
        slots[index] = effect;
        effects.push(effect);
        pending.push(() => { previous?.cleanup?.(); effect.cleanup = setup() ?? undefined; });
      }
    },
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => { cursor++; return getSnapshot(); }
  };
  return {
    react,
    render: <T>(render: () => T) => { cursor = 0; const result = render(); for (const effect of pending.splice(0)) effect(); return result; },
    reattachEffects: () => { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup() ?? undefined; } },
    unmount: () => { for (const effect of effects) effect.cleanup?.(); }
  };
}

function createHarness(initialState = createDefaultBloomState()) {
  let at = activatedAt;
  let clockCalls = 0;
  let idCalls = 0;
  let mutationCalls = 0;
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({
    initialState,
    initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({
        state,
        succeed: () => resolve({ status: "persisted", writeId, generation: 0 }),
        fail: () => reject(new Error("Synthetic Content-Free feature save failure."))
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
    createId: (prefix) => { idCalls++; return `${prefix}-content-feature-${idCalls}`; }
  });
  const makeController = () => createContentFreeController({
    flowActions,
    getState: runtime.getState,
    retryPersistedMutation: runtime.retryPersistence
  });
  return {
    initialState, runtime, flowActions, attempts, makeController, controller: makeController(),
    setTime: (value: string) => { at = value; },
    counts: () => ({ clockCalls, idCalls, mutationCalls })
  };
}

function recordedState(): BloomLocalState {
  const state = activeState();
  assert(state.contentFree.status === "active", "Recorded fixture requires an active activation.");
  const occurredAt = shift(activatedAt, day);
  state.contentFree.currentStreakStartedAt = occurredAt;
  state.contentFree.bestStreakSeconds = 86400;
  state.contentFree.violations = [{
    id: "manual-event", activationId: state.contentFree.activationId,
    kind: "intentionalExplicitContent", occurredAt, recordedAt: occurredAt,
    source: { kind: "manual", logActionId: "manual-log" }, status: "recorded",
    streakBefore: { currentStreakStartedAt: activatedAt, bestStreakSeconds: 0 }
  }];
  return state;
}

function activeState(): BloomLocalState {
  const state = createDefaultBloomState();
  state.contentFree = {
    status: "active", activationId: "feature-activation", activatedAt,
    currentStreakStartedAt: activatedAt, bestStreakSeconds: 0,
    pastActivations: [], violations: []
  };
  return state;
}

async function roundTrip(state: BloomLocalState) {
  const storage = new FeatureStorage();
  const now = () => new Date("2026-12-01T12:00:00.000Z");
  await persistBloomLocalState(state, storage, now);
  const loaded = await loadBloomLocalState(storage, now);
  assert(loaded.status === "success" && loaded.source === "current", "Feature facts must load from current v7 storage.");
  equal(loaded.state, state, "Hydration must preserve Content-Free history, tombstones, and activation status without ticking or automatic actions.");
  return loaded.state;
}

function assertUnrelatedReferences(before: BloomLocalState, after: BloomLocalState) {
  for (const key of Object.keys(before) as Array<keyof BloomLocalState>) {
    if (key !== "contentFree") assert(before[key] === after[key], `Content-Free must preserve unrelated ${key} by reference.`);
  }
}

function shift(at: string, milliseconds: number) {
  return new Date(Date.parse(at) + milliseconds).toISOString();
}
function flush() { return new Promise<void>((done) => setImmediate(done)); }
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
