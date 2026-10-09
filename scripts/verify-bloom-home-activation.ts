import { isDeepStrictEqual } from "node:util";

import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { getBloomHomeReadModel } from "../src/domain/home/getBloomHomeReadModel";
import { createHomeTrackingActivationController } from "../src/features/home/homeTrackingActivationController";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import { loadBloomLocalState, persistBloomLocalState, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createActiveState } from "./verify-bloom-reset-violations";

const at = "2026-09-04T12:00:00.000Z";

export async function verifyBloomHomeActivation() {
  const initial = createActiveState(false, true);
  initial.resetJourney = createDefaultBloomState().resetJourney;
  initial.urgeControl = createDefaultBloomState().urgeControl;
  initial.masturbationTracking.enabled = false;
  initial.masturbationTracking.sessions = [{
    id: "historical-session", status: "completed", startedAt: "2026-08-01T10:00:00.000Z",
    endedAt: "2026-08-01T10:05:00.000Z", durationSeconds: 300, pauses: [],
    erectionQuality: 7, usedExplicitContent: false, endingReason: "climaxed"
  }];
  const onboarding = initial.productOnboarding;
  assert(onboarding.status === "completed", "Accepted onboarding fixture required.");
  initial.productOnboarding = { ...onboarding, result: { ...onboarding.result, recommendation: "content_free" },
    planAcceptance: { acceptedAt: onboarding.planAcceptance!.acceptedAt, recommendation: "content_free" } };
  const contentBefore = JSON.parse(JSON.stringify(initial.contentFree));
  const onboardingBefore = JSON.parse(JSON.stringify(initial.productOnboarding));
  const sessionsBefore = JSON.parse(JSON.stringify(initial.masturbationTracking.sessions));
  const storage = createMemoryStorageClient();
  await persistBloomLocalState(initial, storage, () => new Date(at));

  const attempts: Array<{ state: BloomLocalState; succeed: () => Promise<void>; fail: () => void }> = [];
  let mutationCalls = 0;
  const runtime = createBloomLocalStateMutationRuntime({
    initialState: initial, initialHydrationStatus: "ready",
    persistState(state) {
      return new Promise<BloomStateWriteReceipt>((resolve, reject) => {
        const writeId = attempts.length + 1;
        attempts.push({ state,
          succeed: async () => {
            await persistBloomLocalState(state, storage, () => new Date(at));
            resolve({ status: "persisted", writeId, generation: 0 });
          },
          fail: () => reject(new Error("Synthetic save failure"))
        });
      });
    }
  });
  const productActions = createBloomProductAcknowledgedActions({
    applyAcknowledgedMutation: (mutation) => runtime.applyAcknowledgedMutation((state) => {
      mutationCalls += 1;
      return mutation(state);
    })
  });
  const flowActions = createBloomProductFlowActions({ productActions });
  const controller = createHomeTrackingActivationController({
    flowActions, getState: runtime.getState, retryPersistedMutation: runtime.retryPersistence
  });

  const before = getBloomHomeReadModel(runtime.getDurableState(), at);
  assert(before?.trackingAvailability.canEnableTracking && before.primaryAction?.id === "viewContentFree",
    "Accepted Content-Free keeps its primary action and offers optional Tracking activation.");
  const first = controller.enable(initial.masturbationTracking);
  assert(first !== null && controller.enable(initial.masturbationTracking) === first && attempts.length === 1 && mutationCalls === 1,
    "Repeated presses coalesce into one canonical enable mutation.");
  assert(runtime.getState().masturbationTracking.enabled && !runtime.getDurableState().masturbationTracking.enabled &&
    !getBloomHomeReadModel(runtime.getDurableState(), at)?.trackingAvailability.enabled,
    "Accepted activation must not render as enabled before durable persistence.");
  attempts[0]!.fail();
  const failure = await first;
  assert(!failure.ok && failure.accepted && failure.retryable && controller.getSnapshot().message !== null,
    "A failed save remains unconfirmed and provides a retry token.");
  assert(controller.enable(initial.masturbationTracking) === null && mutationCalls === 1 && attempts.length === 1,
    "An accepted failure cannot replay enable or create a duplicate write.");
  const retry = controller.retry();
  assert(retry !== null && controller.retry() === retry && mutationCalls === 1 && Number(attempts.length) === 2 &&
    attempts[1]!.state === runtime.getState(), "Retry persists the same accepted snapshot without rerunning enable.");
  await attempts[1]!.succeed();
  assert((await retry).ok && runtime.getDurableState().masturbationTracking.enabled &&
    runtime.getDurableState().masturbationTracking.currentSession === null,
    "Acknowledged retry enables Tracking durably without creating a session.");
  assert(controller.enable(initial.masturbationTracking) === null && mutationCalls === 1,
    "A successful activation cannot be dispatched again from a stale card.");
  const durable = runtime.getDurableState();
  assert(isDeepStrictEqual(durable.contentFree, contentBefore) && isDeepStrictEqual(durable.productOnboarding, onboardingBefore) &&
    isDeepStrictEqual(durable.masturbationTracking.sessions, sessionsBefore),
    "Enable preserves Content-Free streak and history, onboarding acceptance, and prior Tracking sessions.");
  const after = getBloomHomeReadModel(durable, at);
  assert(after?.trackingAvailability.enabled && after.primaryTracker?.kind === "masturbationTracking" &&
    after.primaryAction?.id === "startMasturbationSession" && after.secondaryTracker?.kind === "contentFree",
    "Durable enable restores the existing Tracking metrics and new-session action alongside Content-Free.");
  const restarted = await loadBloomLocalState(storage, () => new Date(at));
  assert(restarted.status === "success" && restarted.state.masturbationTracking.enabled &&
    restarted.state.masturbationTracking.currentSession === null && isDeepStrictEqual(restarted.state.contentFree, contentBefore) &&
    isDeepStrictEqual(restarted.state.productOnboarding, onboardingBefore) &&
    isDeepStrictEqual(restarted.state.masturbationTracking.sessions, sessionsBefore),
    "Restart retains enabled Tracking and all independent historical facts.");

  const reset = createActiveState(false, true);
  reset.masturbationTracking.enabled = false;
  const resetHome = getBloomHomeReadModel(reset, at);
  assert(resetHome !== null && !resetHome.trackingAvailability.canEnableTracking && !resetHome.trackingAvailability.canStartSession,
    "Active Reset offers neither activation nor a new Tracking session.");
  console.log("Bloom Home activation verification passed (accepted Content-Free, acknowledged retry, no duplicate or auto-session, restart, preserved history, and Reset restriction).");
}

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
