import { deepStrictEqual } from "node:assert";
import { createPhase10QaSession, createPhase10StorageClient, phase10Scenarios, PHASE10_STORAGE_PREFIX } from "../src/features/debug/phase10/phase10QaSession";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { BLOOM_STATE_STORAGE_KEY } from "../src/storage/bloomStatePersistence";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { getContentFreeProgress } from "../src/domain/contentFree/getContentFreeProgress";
import { getResetContentFreeContinuationOffer } from "../src/domain/contentFree/getResetContentFreeCredit";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";

export async function verifyBloomPhase10Qa() {
  const storage = createMemoryStorageClient();
  const canonical = "existing normal/E2E bytes must remain untouched";
  await storage.setItem(BLOOM_STATE_STORAGE_KEY, canonical);
  await storage.setItem("bloom.localState.v6", "legacy sentinel");
  await storage.setItem("bloom.localState.corrupt.sentinel", "backup sentinel");
  const originalTime = Date.now;
  const session = createPhase10QaSession(storage);
  for (const scenario of phase10Scenarios) {
    const state = await session.prepareScenario(scenario.id);
    const observation = session.runtime.now().toISOString();
    const progress = getResetProgress(state.resetJourney, observation);
    const content = getContentFreeProgress(state.contentFree, observation);
    const offer = getResetContentFreeContinuationOffer(state, state);
    assert(state.resetJourney.status === (scenario.days === 9 ? "active" : "completed"), `Actual Reset status for ${scenario.id}`);
    if (scenario.days === 9) assert(progress?.currentDay === 10 && progress.completedDays === 9, "Day 10 means nine complete days");
    if (scenario.id === "day10-credit") assert(content?.status === "active" && content.currentCompletedDays === 9 && state.contentFree.status === "active" && state.contentFree.resetCredit !== undefined, "Day 10 earned credit uses production activation");
    if (scenario.id === "completed-pending") assert(offer?.completedDays === 15 && state.contentFree.status === "inactive", "Durable completion exposes canonical 15-day offer");
    if (scenario.id === "continuation-accepted") assert(offer === null && content?.status === "active" && content.currentCompletedDays === 15 && state.resetJourney.status === "completed" && state.resetJourney.contentFreeContinuation?.decision === "accepted", "Accepted decision and credit saved atomically");
    if (scenario.id === "continuation-declined") assert(offer === null && content?.status === "inactive" && state.resetJourney.status === "completed" && state.resetJourney.contentFreeContinuation?.decision === "declined", "Decline keeps tracker inactive");
    if (scenario.id === "completed-existing") assert(offer === null && content?.status === "active" && content.currentCompletedDays === 20 && state.contentFree.status === "active" && !state.contentFree.resetCredit && state.resetJourney.status === "completed" && !state.resetJourney.contentFreeContinuation, "Existing pre-Reset streak preserved without duplicate offer/credit");
    const reloaded = createPhase10QaSession(storage);
    await reloaded.restoreClock();
    assert(reloaded.runtime.now().toISOString() === observation, "Injected clock survives app restart");
    const loaded = await reloaded.runtime.load();
    assert(loaded.status === "success", "Scenario survives real v7 validation");
    deepStrictEqual(loaded.state, state, "Scenario survives real v7 serialization and hydration");
    assert(await storage.getItem(BLOOM_STATE_STORAGE_KEY) === canonical, "Canonical storage never read/replaced by fixtures");
  }
  const elapsed = await session.prepareScenario("completed-pending", true);
  const elapsedProgress = getResetProgress(elapsed.resetJourney, session.runtime.now().toISOString());
  assert(elapsed.resetJourney.status === "active" && elapsedProgress?.isPeriodComplete === true &&
    getResetContentFreeContinuationOffer(elapsed, elapsed) === null, "Before-completion preparation leaves the real explicit completion action pending");
  const elapsedLoaded = await session.runtime.load();
  assert(elapsedLoaded.status === "success", "Elapsed active fixture passes production v7 validation");
  deepStrictEqual(elapsedLoaded.state, elapsed);
  const completionRuntime = createBloomLocalStateMutationRuntime({ initialState: elapsed, persistState: session.runtime.save });
  completionRuntime.completeHydration(completionRuntime.beginHydration(), elapsed, { needsPersist: false, persistenceError: null });
  const completionActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: completionRuntime.applyAcknowledgedMutation });
  const completionFlow = createBloomProductFlowActions({ productActions: completionActions, now: session.runtime.now });
  session.failNextSave();
  const completionFailed = await completionFlow.reset.completeElapsed();
  assert(!completionFailed.ok && completionFailed.accepted && completionFailed.retryable &&
    getResetContentFreeContinuationOffer(completionRuntime.getState(), completionRuntime.getDurableState()) === null,
  "Failed actual completion cannot expose a continuation offer before acknowledgement");
  const completedSuccessor = completionRuntime.getState();
  assert((await completionRuntime.retryPersistence(completionFailed.retryToken)).ok &&
    completionRuntime.getDurableState() === completedSuccessor &&
    getResetContentFreeContinuationOffer(completedSuccessor, completedSuccessor)?.completedDays === 15,
  "Completion retry saves the same successor and unlocks the canonical offer");
  const pending = await session.prepareScenario("completed-pending");
  deepStrictEqual(pending, completedSuccessor, "Scenario 3 shortcut matches the acknowledged real completion action");
  const runtime = createBloomLocalStateMutationRuntime({ initialState: pending, persistState: session.runtime.save });
  runtime.completeHydration(runtime.beginHydration(), pending, { needsPersist: false, persistenceError: null });
  const productActions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: runtime.applyAcknowledgedMutation });
  const flow = createBloomProductFlowActions({ productActions, now: session.runtime.now });
  session.failNextSave();
  const failed = await flow.reset.decideContentFreeContinuation("accepted");
  assert(!failed.ok && failed.accepted && failed.retryable, "Injected actual write failure returns the real retry receipt");
  assert(runtime.getDurableState() === pending && getResetContentFreeContinuationOffer(runtime.getState(), runtime.getDurableState()) === null, "Failed acceptance cannot expose a durable success");
  const exactSuccessor = runtime.getState();
  assert((await runtime.retryPersistence(failed.retryToken)).ok && runtime.getDurableState() === exactSuccessor, "Real retry persists exact accepted successor");
  const loaded = await session.runtime.load();
  assert(loaded.status === "success" && loaded.state.contentFree.status === "active", "Acknowledged acceptance actually rehydrates");
  await session.runtime.deleteAll();
  assert(await storage.getItem(BLOOM_STATE_STORAGE_KEY) === canonical && await storage.getItem("bloom.localState.v6") === "legacy sentinel" && await storage.getItem("bloom.localState.corrupt.sentinel") === "backup sentinel", "Isolated deletion protects canonical/legacy/corruption data");
  assert((await createPhase10StorageClient(storage).getAllKeys()).every((key) => !key.startsWith(PHASE10_STORAGE_PREFIX)), "Namespace enumeration translates keys once");
  assert(Date.now === originalTime, "Device/system clock never overridden");
  console.log("Bloom Phase 10 Simulator QA verification passed.");
}
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }
