import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import {
  createBloomLocalStateMutationRuntime,
  type BloomMutationRuntimeHydrationStatus,
  type BloomPersistedMutationResult
} from "../src/app/providers/bloomLocalStateMutationRuntime";
import {
  createDefaultBloomState,
  type BloomLocalState
} from "../src/storage/bloomState";
import {
  BLOOM_STATE_STORAGE_KEY,
  type BloomStateWriteReceipt
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";

const sessionInput = {
  sessionId: "product-runtime-session",
  startedAt: "2026-09-12T09:00:00.000Z"
};

export async function verifyBloomProductActionsRuntime() {
  await verifyAcceptedAndDurableState();
  await verifyFailureAndRetry();
  await verifyNoOpAndRuntimeBlocks();
  await verifyLatestAcceptedState();
  verifyProviderIntegration();
  assert(
    BLOOM_PERSISTENCE_VERSION === 7 &&
      BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7",
    "Application commands must keep the existing v7 persistence contract."
  );
  console.log(
    "Bloom product actions runtime verification passed (accepted/durable state, retry without replay, no-op and lifecycle blocks, latest-state commands, and provider wiring)."
  );
}

async function verifyAcceptedAndDurableState() {
  const harness = createHarness();
  let settled = false;
  const acknowledgement = harness.actions.tracking.enable().then((result) => {
    settled = true;
    return result;
  });
  const accepted = harness.runtime.getState();
  assert(
    accepted.masturbationTracking.enabled &&
      harness.acceptedStates[0] === accepted,
    "A facade command must expose accepted state immediately through the real mutation runtime."
  );
  assert(
    harness.runtime.getDurableState() === harness.initialState &&
      harness.durableStates.length === 0,
    "The durable projection must remain unchanged before a persistence receipt."
  );
  await Promise.resolve();
  assert(
    !settled &&
      harness.attempts.length === 1 &&
      harness.attempts[0]!.state === accepted,
    "A product command must wait for persistence acknowledgement of its exact accepted snapshot."
  );
  harness.attempts[0]!.succeed();
  assertPersisted(
    await acknowledgement,
    "A persisted receipt must resolve the product command with the runtime success result."
  );
  assert(
    harness.runtime.getDurableState() === accepted &&
      harness.durableStates[0] === accepted,
    "Only receipt success advances the durable projection to the accepted product state."
  );
}

async function verifyFailureAndRetry() {
  const initialState = createDefaultBloomState();
  initialState.masturbationTracking.enabled = true;
  const harness = createHarness(initialState);
  const acknowledgement = harness.actions.tracking.session.start(sessionInput);
  const accepted = harness.runtime.getState();
  harness.attempts[0]!.fail();
  const failure = await acknowledgement;
  assert(
    !failure.ok &&
      failure.accepted &&
      failure.retryable &&
      failure.reason === "persistenceFailed",
    "A failed write must keep accepted product truth and expose the existing retry token."
  );
  assert(
    harness.runtime.getState() === accepted &&
      harness.runtime.getDurableState() === initialState,
    "Persistence failure must not roll back accepted state or falsely advance durable state."
  );
  const retry = harness.runtime.retryPersistence(failure.retryToken);
  assert(
    harness.attempts.length === 2 && harness.attempts[1]!.state === accepted,
    "Retry must persist the same accepted snapshot through the existing runtime path."
  );
  harness.attempts[1]!.succeed();
  assertPersisted(
    await retry,
    "An existing runtime retry must acknowledge the product command's accepted state."
  );
  assert(
    harness.mutationCalls() === 1 &&
      harness.acceptedStates.length === 1 &&
      harness.runtime.getState().masturbationTracking.currentSession?.id ===
        sessionInput.sessionId &&
      harness.runtime.getState().masturbationTracking.currentSession?.startedAt ===
        sessionInput.startedAt,
    "Persistence retry must not replay the transition or replace caller-supplied identity/time facts."
  );
  assertPersisted(
    await harness.runtime.retryPersistence(failure.retryToken),
    "A settled retry token retains the runtime's idempotent acknowledgement."
  );
  assert(
    harness.attempts.length === 2 && harness.mutationCalls() === 1,
    "Repeated retry acknowledgement must not create another write or rerun the product mutation."
  );
}

async function verifyNoOpAndRuntimeBlocks() {
  const noOp = createHarness();
  const result = await noOp.actions.tracking.disable();
  assertRejected(
    result,
    "invalidSession",
    "Domain no-op must preserve the runtime's existing invalidSession result."
  );
  assert(
    noOp.runtime.getState() === noOp.initialState &&
      noOp.attempts.length === 0 &&
      noOp.acceptedStates.length === 0,
    "A no-op must not force a persistence write, state projection, or fabricated success."
  );

  for (const status of ["loading", "error", "ready"] as const) {
    const harness = createHarness(createDefaultBloomState(), status);
    if (status === "ready") harness.runtime.beginDeletion();
    const blocked = await harness.actions.tracking.enable();
    const expected = status === "loading"
      ? "hydrationPending"
      : status === "error"
        ? "stateUnavailable"
        : "deletionInProgress";
    assertRejected(
      blocked,
      expected,
      "Product actions must inherit hydration/deletion rejection from the existing runtime."
    );
    assert(
      harness.mutationCalls() === 0 &&
        harness.attempts.length === 0 &&
        harness.runtime.getState() === harness.initialState &&
        harness.runtime.getPendingMutationCount() === 0,
      "Blocked acknowledged commands must neither execute nor queue their domain transitions."
    );
    if (status === "loading") {
      const operation = harness.runtime.beginHydration();
      assert(
        harness.runtime.completeHydration(operation, harness.initialState, {
          needsPersist: false,
          persistenceError: null
        }),
        "A blocked product command must not interfere with normal hydration completion."
      );
      assert(
        !harness.runtime.getState().masturbationTracking.enabled &&
          harness.attempts.length === 0,
        "Hydration must not replay the earlier blocked acknowledged command."
      );
    }
  }
}

async function verifyLatestAcceptedState() {
  const harness = createHarness();
  const enable = harness.actions.tracking.enable();
  const start = harness.actions.tracking.session.start(sessionInput);
  const latest = harness.runtime.getState();
  assert(
    latest.masturbationTracking.enabled &&
      latest.masturbationTracking.currentSession?.id === sessionInput.sessionId &&
      harness.attempts.length === 2 &&
      harness.mutationCalls() === 2,
    "Rapid commands must use the latest accepted runtime state even while an earlier save is pending."
  );
  assert(
    harness.attempts[0]!.state.masturbationTracking.currentSession === null &&
      harness.attempts[1]!.state === latest,
    "Each accepted command must submit its own cumulative snapshot, without a captured React state."
  );
  harness.attempts[1]!.succeed();
  assertPersisted(
    await start,
    "The latest sequential command must acknowledge its cumulative product state."
  );
  harness.attempts[0]!.succeed();
  const earlier = await enable;
  assert(
    !earlier.ok &&
      earlier.accepted &&
      earlier.reason === "persistenceSuperseded" &&
      !earlier.retryable,
    "An earlier acknowledgement must retain the runtime's superseded semantics."
  );
  assert(
    harness.runtime.getState() === latest &&
      harness.runtime.getDurableState() === latest,
    "A late older receipt must not regress accepted or durable product state."
  );
}

function verifyProviderIntegration() {
  const source = readFileSync(
    resolve("src/app/providers/BloomLocalStateProvider.tsx"),
    "utf8"
  );
  const context = source.match(
    /type BloomLocalStateContextValue\s*=\s*\{([\s\S]*?)\n\};/
  )?.[1];
  const value = source.match(
    /const value\s*=\s*useMemo\(\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\),\s*\[([\s\S]*?)\]\s*\)/
  );
  assert(
    context !== undefined && value !== null,
    "The existing provider context and memoized value must remain available."
  );
  assert(
    /productActions\s*:\s*BloomProductAcknowledgedActions\s*;/.test(context),
    "Provider context must use the factory's application-level type rather than duplicate its signatures."
  );
  assert(
    (source.match(/createBloomProductAcknowledgedActions\s*\(/g) ?? []).length === 1 &&
      /const productActions\s*=\s*useMemo\(\s*\(\)\s*=>\s*createBloomProductAcknowledgedActions\(\{\s*applyAcknowledgedMutation\s*:\s*applyAcknowledgedStateMutation\s*,?\s*\}\),\s*\[applyAcknowledgedStateMutation\]\s*\)/.test(source),
    "One memoized productActions factory must depend only on the stable acknowledged runtime callback."
  );
  assert(
    /const applyAcknowledgedStateMutation\s*=\s*useCallback\([\s\S]*?mutationRuntime\.applyAcknowledgedMutation\(mutation\),\s*\[mutationRuntime\]\s*\)/.test(source),
    "Product commands must inherit the provider's stable runtime dependency."
  );
  assert(
    /\bproductActions\b/.test(value[1]!) && /\bproductActions\b/.test(value[2]!),
    "Provider must expose productActions and include it in the context memo dependencies."
  );
  for (const name of [
    "state",
    "durableState",
    "retryHydration",
    "retryPersistedMutation",
    "deleteAllBloomLocalData",
    "finishBloomLocalDataReset",
    "saveOnboardingResult",
    "saveOnboardingResultForFreshJourney",
    "clearOnboardingResult",
    "startTenDayReset",
    "completeTodayReset",
    "simulateNextDay",
    "simulatePreviousDay",
    "configureProtection",
    "pauseProtection",
    "resumeProtection",
    "turnOffProtection",
    "recordProtectionPause",
    "saveCheckInRecord",
    "startPauseSession",
    "updatePauseSession",
    "addPauseSessionDuration",
    "completePauseSession",
    "saveAndClosePauseSession",
    "discardPauseSession",
    "startArousalSession",
    "resumeArousalSession",
    "updateArousalSession",
    "updateArousalSessionAndPersist",
    "discardArousalSession",
    "completeArousalSession",
    "editCompletedArousalLog"
  ]) {
    assert(
      new RegExp(`\\b${name}\\s*:`).test(context) &&
        new RegExp(`\\b${name}\\b`).test(value[1]!),
      `The provider's existing ${name} API must remain exposed alongside productActions.`
    );
  }
  assert(
    /const state\s*=\s*projectionSnapshot\.acceptedState/.test(source) &&
      /const durableState\s*=\s*projectionSnapshot\.durableState/.test(source),
    "The provider must retain separate accepted and durable projections."
  );
  assert(
    /retryPersistedMutation\s*:\s*\(\s*token:\s*BloomPersistenceRetryToken\s*\)\s*=>\s*Promise<BloomPersistedMutationResult>/.test(context) &&
      /const retryPersistedMutation\s*=\s*useCallback\([\s\S]*?mutationRuntime\.retryPersistence\(token\),\s*\[mutationRuntime\]\s*\)/.test(source),
    "Persistence retries must keep their existing token type and direct runtime delegation."
  );
  assert(
    /createBloomLocalStateAcknowledgedActions\s*\(/.test(source),
    "The legacy acknowledged-action factory must remain separate."
  );
  assert(
    !/getBloomHomeReadModel|setInterval\s*\(/.test(source),
    "Provider must not evaluate time-dependent Home queries or introduce ticking state."
  );
}

function createHarness(
  initialState = createDefaultBloomState(),
  initialHydrationStatus: BloomMutationRuntimeHydrationStatus = "ready"
) {
  const attempts: Array<{
    state: BloomLocalState;
    succeed: () => void;
    fail: () => void
  }> = [];
  const acceptedStates: BloomLocalState[] = [];
  const durableStates: BloomLocalState[] = [];
  const runtime = createBloomLocalStateMutationRuntime({
    initialState,
    initialHydrationStatus,
    persistState(state) {
      return new Promise<BloomStateWriteReceipt>((resolveReceipt, reject) => {
        const writeId = attempts.length + 1;
        attempts.push({
          state,
          succeed: () => resolveReceipt({
            status: "persisted",
            writeId,
            generation: 0
          }),
          fail: () => reject(
            new Error("Synthetic product-action persistence failure.")
          )
        });
      });
    },
    onStateChange: (state) => acceptedStates.push(state),
    onDurableStateChange: (state) => durableStates.push(state)
  });
  let mutationCalls = 0;
  const actions = createBloomProductAcknowledgedActions({
    applyAcknowledgedMutation: (mutation) =>
      runtime.applyAcknowledgedMutation((state) => {
        mutationCalls += 1;
        return mutation(state);
      })
  });
  return {
    initialState,
    actions,
    runtime,
    attempts,
    acceptedStates,
    durableStates,
    mutationCalls: () => mutationCalls
  };
}

function assertRejected(
  result: BloomPersistedMutationResult,
  reason: string,
  message: string
) {
  assert(
    !result.ok &&
      !result.accepted &&
      !result.persisted &&
      !result.retryable &&
      result.reason === reason,
    message
  );
}

function assertPersisted(result: BloomPersistedMutationResult, message: string) {
  assert(result.ok && result.accepted && result.persisted, message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
