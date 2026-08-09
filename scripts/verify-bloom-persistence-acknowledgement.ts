import {
  BLOOM_PERSISTENCE_PENDING_MESSAGE,
  BLOOM_PERSISTENCE_RETRY_MESSAGE,
  createBloomLocalStateMutationRuntime,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomLocalStateAcknowledgedActions } from "../src/app/providers/bloomLocalStateAcknowledgedActions";
import { createBloomLocalStateProjection } from "../src/app/providers/bloomLocalStateProjection";
import { getDurableOnboardingResultPresentation } from "../src/features/onboarding/onboardingResultPresentation";
import {
  createDebugQuizResult,
  getDebugQuizAnswers
} from "../src/features/onboarding/quiz";
import {
  createArousalSavedCompletionHref,
  getArousalSavedRouteIntent,
  resolveArousalSavedRoute
} from "../src/features/arousal-control/arousalSavedRoute";
import {
  createPauseSavedCompletionHref,
  resolvePauseSavedRoute
} from "../src/features/pause/pauseSavedRoute";
import {
  isBloomLocalDataDeletionPendingError,
  observeBloomLocalDataDeletionSettlement,
  waitForBloomLocalDataDeletion
} from "../src/app/providers/bloomLocalDataDeletionWatchdog";
import {
  getBloomLocalStateHydrationTimeoutRecovery,
  isBloomLocalStateHydrationPendingError,
  waitForBloomLocalStateHydration
} from "../src/app/providers/bloomLocalStateHydrationWatchdog";
import { getNextBloomAction } from "../src/domain/journey/getNextBloomAction";
import { runStableMountMutationOnce } from "../src/shared/runtime/runStableMountMutationOnce";
import {
  completeArousalSessionState,
  completePauseSessionState,
  completeTodayResetState,
  createBloomRecordId,
  createDefaultBloomState,
  getNewestBloomCheckInRecords,
  isValidCompletedArousalLog,
  recordProtectionPauseState,
  saveOnboardingResultState,
  saveBloomCheckInRecordState,
  startArousalSessionState,
  startPauseSessionState,
  updatePauseSessionState,
  type ArousalControlDraft,
  type BloomLocalState,
  type PauseSessionPatch,
  type PauseSessionDraft,
  type ProtectionConfiguration
} from "../src/storage/bloomState";
import {
  BLOOM_STATE_STORAGE_KEY,
  createBloomStatePersistenceCoordinator,
  loadBloomLocalState
} from "../src/storage/bloomStatePersistence";
import {
  readPersistedEnvelope,
  validateAndNormalizeBloomState
} from "../src/storage/bloomStateSchema";
import {
  createWebStorageClient,
  type StorageClient
} from "../src/storage/storageAdapters";

const fixedNow = () => new Date("2026-08-02T12:00:00.000Z");

async function verifyPersistenceAcknowledgement() {
  await verifyDelayedExactAcknowledgement();
  await verifyFailureAndRetry();
  await verifyRapidAcknowledgements();
  await verifySupersededRetryCausality();
  await verifyRetrySupersessionDuringSettlement();
  await verifyObsoleteRetryCannotOverwriteCurrentFeedback();
  await verifyStableRetryTerminalSuccess();
  await verifyDurableProjectionForSavedFeatures();
  await verifyOnboardingCompletionRequiresDurability();
  await verifyUnknownAcknowledgementAndLateSettlement();
  await verifySupersededTimeoutDoesNotPublishPending();
  await verifyUnknownRetryLateSettlementCleanup();
  await verifyUnmountBeforeLateCompletion();
  await verifyStrictModeMountMutationGuards();
  await verifyAtomicPauseSaveAndCloseAcknowledgement();
  await verifyAtomicPauseRejectsPartialCompletion();
  await verifyPauseSavedRequiresExactDurableRecord();
  await verifyArousalSavedRequiresExactDurableLog();
  await verifyCheckInRetryIdempotency();
  await verifyResetRetryIdempotency();
  await verifyPauseRetryIdempotency();
  await verifyArousalRetryIdempotency();
  await verifyProtectionRetryPreservesConfiguration();
  await verifyDeletionInvalidatesPendingAcknowledgement();
  await verifyDeletionInvalidatesPendingRetryWaiter();
  await verifyDeletionPreventsRetryResurrection();
  await verifyFailedDeletionRequeuesCanonicalState();
  await verifyFailedDeletionPreservesRetryToken();
  await verifyFailedDeletionPreservesInFlightRetryToken();
  await verifyFailedDeletionPreservesPendingAcknowledgementToken();
  await verifyFailedDeletionRecoveryUnknownRemainsRetryable();
  await verifyHydrationErrorDeletionFailurePreservesStorage();
  await verifyDeletionWatchdog();
  await verifyHydrationWatchdog();
  await verifyDeletionHydrationTimeoutRecovery();
  await verifyHydrationAndDeletionMutationBlocks();
  await verifyWebStorageUnavailableResult();
  await verifyUnacknowledgedSystemPersistence();

  console.log("Bloom persistence acknowledgement verification passed.");
}

async function verifyDelayedExactAcknowledgement() {
  const harness = createHarness();
  let settled = false;
  const acknowledgement = harness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 1)
  );
  void acknowledgement.then(() => {
    settled = true;
  });

  await waitForWriteAttempts(harness.client, 1);
  await flushMicrotasks();
  assert(
    !settled,
    "1. Acknowledgement must remain pending until the delayed adapter write settles."
  );
  assert(
    readAttemptState(harness.client, 0).debug.dateOffsetDays === 1,
    "2. The queued envelope must contain the exact state produced by the acknowledged mutation."
  );

  harness.client.succeedWrite(0);
  const result = await acknowledgement;
  assertPersisted(result, "2. A successful exact write must resolve persisted success.");
  assert(
    harness.client.completedWrites.length === 1,
    "2. One acknowledged snapshot must produce exactly one successful storage write."
  );
}

async function verifyFailureAndRetry() {
  const harness = createHarness();
  let mutationInvocations = 0;
  const acknowledgement = harness.runtime.applyAcknowledgedMutation(
    (state) => {
      mutationInvocations += 1;
      return stateWithDateOffset(state, 2);
    }
  );

  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const failure = await acknowledgement;
  const retryToken = requireRetryableFailure(
    failure,
    "3. A failed exact write must return a sanitized retryable failure."
  );
  assert(!failure.ok, "3. The failed write must not report persisted success.");
  assert(
    failure.reason === "persistenceFailed",
    "3. A native-style adapter failure must be classified as persistenceFailed."
  );
  assert(
    harness.runtime.getState().debug.dateOffsetDays === 2,
    "3. Canonical in-memory state must remain accepted after persistence failure."
  );
  assert(
    harness.persistenceErrors.at(-1) === BLOOM_PERSISTENCE_RETRY_MESSAGE,
    "15. A persistence failure must publish only the sanitized recoverable message."
  );

  const retry = harness.runtime.retryPersistence(retryToken);
  const duplicateRetry = harness.runtime.retryPersistence(retryToken);
  assert(
    retry === duplicateRetry,
    "4. Concurrent retries for one failed mutation must share one persistence attempt."
  );
  await waitForWriteAttempts(harness.client, 2);
  assert(
    mutationInvocations === 1,
    "4. Retrying persistence must not repeat the domain mutation."
  );
  harness.client.succeedWrite(1);
  assertPersisted(
    await retry,
    "4. A successful retry must resolve persisted success."
  );
  assert(
    mutationInvocations === 1 &&
      readStoredState(harness.client).debug.dateOffsetDays === 2,
    "4. Retry must persist the accepted latest state without rerunning the mutation."
  );
  assert(
    harness.persistenceErrors.at(-1) === null,
    "15. A successful retry must clear the relevant persistence error."
  );
}

async function verifyRapidAcknowledgements() {
  const harness = createHarness();
  const settlementOrder: number[] = [];
  const first = harness.runtime
    .applyAcknowledgedMutation((state) => stateWithDateOffset(state, 3))
    .then((result) => {
      settlementOrder.push(result.sequence);
      return result;
    });
  const second = harness.runtime
    .applyAcknowledgedMutation((state) => stateWithDateOffset(state, 4))
    .then((result) => {
      settlementOrder.push(result.sequence);
      return result;
    });

  await waitForWriteAttempts(harness.client, 1);
  assert(
    readAttemptState(harness.client, 0).debug.dateOffsetDays === 3,
    "5. The first rapid mutation must enqueue its own exact snapshot."
  );
  harness.client.succeedWrite(0);
  await waitForWriteAttempts(harness.client, 2);
  assert(
    readAttemptState(harness.client, 1).debug.dateOffsetDays === 4,
    "5. The second rapid mutation must enqueue its own exact snapshot."
  );
  harness.client.succeedWrite(1);

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert(
    !firstResult.ok &&
      firstResult.accepted &&
      !firstResult.retryable &&
      firstResult.reason === "persistenceSuperseded",
    "5. A conflicting rapid acknowledgement must explicitly supersede the earlier revision."
  );
  assertPersisted(secondResult, "5. The second rapid acknowledgement must succeed.");
  assert(
    firstResult.sequence < secondResult.sequence &&
      settlementOrder[0] === firstResult.sequence &&
      settlementOrder[1] === secondResult.sequence,
    "5. Rapid acknowledged mutations must receive monotonic tokens and settle in serialized order."
  );
}

async function verifySupersededRetryCausality() {
  const pausedState = createDefaultBloomState();
  pausedState.protection = {
    status: "paused",
    setupCompletedAt: "2026-08-01T20:00:00.000Z",
    preferredWindow: "night",
    level: "balanced",
    adultContentPauseEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "07:00",
    lastProtectionPauseAt: "2026-08-02T09:00:00.000Z"
  };
  const harness = createHarness(pausedState);
  const resume = harness.actions.resumeProtection();

  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const resumeToken = requireRetryableFailure(
    await resume,
    "6. A failed Resume must expose a retry token while its revision remains canonical."
  );

  const turnOff = harness.actions.turnOffProtection();
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(await turnOff, "6. A later Turn off action must persist normally.");

  const attemptsBeforeStaleRetry = harness.client.writeAttempts.length;
  const staleRetry = await harness.runtime.retryPersistence(resumeToken);
  assert(
    !staleRetry.ok &&
      staleRetry.accepted &&
      !staleRetry.retryable &&
      staleRetry.reason === "persistenceSuperseded",
    "6. Resume retry must be reported as superseded after a conflicting Turn off mutation."
  );
  assert(
    harness.client.writeAttempts.length === attemptsBeforeStaleRetry &&
      harness.runtime.getState().protection.status === "off" &&
      harness.runtime.getDurableState().protection.status === "off" &&
      readStoredState(harness.client).protection.status === "off" &&
      harness.getAcknowledgedActionMutationCalls() === 2,
    "6. A superseded retry must not rewrite Resume or re-enter either production action."
  );

  const inFlightHarness = createHarness();
  const first = inFlightHarness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 15)
  );
  const second = inFlightHarness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 16)
  );
  await waitForWriteAttempts(inFlightHarness.client, 1);
  inFlightHarness.client.failWrite(0);
  const firstResult = await first;
  assert(
    !firstResult.ok &&
      firstResult.accepted &&
      !firstResult.retryable &&
      firstResult.reason === "persistenceSuperseded",
    "6. A newer accepted revision must supersede an earlier failure even when that failure settles later."
  );
  await waitForWriteAttempts(inFlightHarness.client, 2);
  inFlightHarness.client.succeedWrite(1);
  assertPersisted(await second, "6. The latest in-flight revision must remain independently acknowledgable.");
}

async function verifyRetrySupersessionDuringSettlement() {
  const failureHarness = createHarness();
  const failedMutation = failureHarness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 17)
  );
  await waitForWriteAttempts(failureHarness.client, 1);
  failureHarness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await failedMutation,
    "6. Retry supersession requires an initial retry token."
  );

  const retry = failureHarness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(failureHarness.client, 2);
  const newerMutation = failureHarness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 18)
  );
  failureHarness.client.failWrite(1);
  const supersededFailure = await retry;
  assert(
    !supersededFailure.ok &&
      supersededFailure.accepted &&
      !supersededFailure.retryable &&
      supersededFailure.reason === "persistenceSuperseded",
    "6. A retry superseded while awaiting a failed write must not return its stale retryable failure."
  );
  await waitForWriteAttempts(failureHarness.client, 3);
  failureHarness.client.succeedWrite(2);
  assertPersisted(
    await newerMutation,
    "6. The newer mutation must remain independently acknowledgable after superseding a retry."
  );

  const timeoutHarness = createHarness(createDefaultBloomState(), 5);
  const initialTimeoutMutation =
    timeoutHarness.runtime.applyAcknowledgedMutation((state) =>
      stateWithDateOffset(state, 19)
    );
  await waitForWriteAttempts(timeoutHarness.client, 1);
  timeoutHarness.client.failWrite(0);
  const timeoutToken = requireRetryableFailure(
    await initialTimeoutMutation,
    "6. Retry-timeout supersession requires an initial token."
  );
  const timedRetry = timeoutHarness.runtime.retryPersistence(timeoutToken);
  await waitForWriteAttempts(timeoutHarness.client, 2);
  const latestMutation = timeoutHarness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 20)
  );
  const supersededTimeout = await timedRetry;
  assert(
    !supersededTimeout.ok &&
      supersededTimeout.accepted &&
      !supersededTimeout.retryable &&
      supersededTimeout.reason === "persistenceSuperseded",
    "6. A retry superseded while awaiting timeout must not return a stale persistenceUnknown token."
  );
  timeoutHarness.client.succeedWrite(1);
  await waitForWriteAttempts(timeoutHarness.client, 3);
  timeoutHarness.client.succeedWrite(2);
  assertPersisted(
    await latestMutation,
    "6. A newer mutation must persist after superseding a timed-out retry."
  );

  const coveringHarness = createHarness(createDefaultBloomState(), 5);
  const unresolvedOriginal =
    coveringHarness.runtime.applyAcknowledgedMutation((state) =>
      stateWithDateOffset(state, 33)
    );
  await waitForWriteAttempts(coveringHarness.client, 1);
  const coveringToken = requireRetryableFailure(
    await unresolvedOriginal,
    "6. Covering-attempt supersession requires an unresolved original-write token."
  );
  const coveringRetry =
    coveringHarness.runtime.retryPersistence(coveringToken);
  const coveringNewerMutation =
    coveringHarness.runtime.applyAcknowledgedMutation((state) =>
      stateWithDateOffset(state, 34)
    );
  coveringHarness.client.failWrite(0);
  const supersededCoveringFailure = await coveringRetry;
  assert(
    !supersededCoveringFailure.ok &&
      supersededCoveringFailure.accepted &&
      !supersededCoveringFailure.retryable &&
      supersededCoveringFailure.reason === "persistenceSuperseded",
    "6. A retry superseded while observing its unresolved original write must not return that covering attempt's stale failure."
  );
  await waitForWriteAttempts(coveringHarness.client, 2);
  coveringHarness.client.succeedWrite(1);
  assertPersisted(
    await coveringNewerMutation,
    "6. The newer mutation must persist after superseding a retry that observed its original covering write."
  );
}

async function verifyObsoleteRetryCannotOverwriteCurrentFeedback() {
  const verifyLateSettlement = async (
    settlement: "success" | "failure"
  ) => {
    const harness = createHarness(createDefaultBloomState(), 5);
    const obsoleteMutation =
      harness.runtime.applyAcknowledgedMutation((state) =>
        stateWithDateOffset(state, settlement === "success" ? 36 : 38)
      );
    await waitForWriteAttempts(harness.client, 1);
    harness.client.failWrite(0);
    const obsoleteToken = requireRetryableFailure(
      await obsoleteMutation,
      "2. Obsolete-feedback verification requires an initial retry token."
    );

    const obsoleteRetry =
      harness.runtime.retryPersistence(obsoleteToken);
    await waitForWriteAttempts(harness.client, 2);
    const currentMutation =
      harness.runtime.applyAcknowledgedMutation((state) =>
        stateWithDateOffset(state, settlement === "success" ? 37 : 39)
      );
    const currentResult = await currentMutation;
    const feedbackEventCount = harness.persistenceErrors.length;
    assert(
      !currentResult.ok &&
        currentResult.accepted &&
        currentResult.retryable &&
        currentResult.reason === "persistenceUnknown" &&
        harness.persistenceErrors.at(-1) ===
          BLOOM_PERSISTENCE_PENDING_MESSAGE,
      `2. Mutation B must own pending feedback while obsolete retry A awaits late ${settlement}.`
    );

    if (settlement === "success") {
      harness.client.succeedWrite(1);
    } else {
      harness.client.failWrite(1);
    }

    const obsoleteResult = await obsoleteRetry;
    assert(
      !obsoleteResult.ok &&
        obsoleteResult.accepted &&
        !obsoleteResult.retryable &&
        obsoleteResult.reason === "persistenceSuperseded",
      `2. Obsolete retry A must report superseded after its late ${settlement}.`
    );
    assert(
      harness.persistenceErrors.length === feedbackEventCount &&
        harness.persistenceErrors.at(-1) ===
          BLOOM_PERSISTENCE_PENDING_MESSAGE,
      `2. Obsolete retry A's late ${settlement} must neither clear nor replace mutation B's shared pending feedback.`
    );

    await waitForWriteAttempts(harness.client, 3);
    harness.client.succeedWrite(2);
    await waitForCompletedWrites(
      harness.client,
      settlement === "success" ? 2 : 1
    );
    await flushMicrotasks();
    assert(
      harness.persistenceErrors.at(-1) === null,
      "2. The current mutation may clear its own pending feedback after its exact late persistence succeeds."
    );
  };

  await verifyLateSettlement("success");
  await verifyLateSettlement("failure");
}

async function verifyStableRetryTerminalSuccess() {
  const harness = createHarness();
  const failedMutation = harness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 21)
  );
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const token = requireRetryableFailure(
    await failedMutation,
    "6. Stable retry success requires an initial token."
  );
  const retry = harness.runtime.retryPersistence(token);
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(
    await retry,
    "6. The first successful retry observation must report persisted success."
  );

  const attemptsBeforeRepeatedObservation = harness.client.writeAttempts.length;
  const [repeated, concurrentRepeated] = await Promise.all([
    harness.runtime.retryPersistence(token),
    harness.runtime.retryPersistence(token)
  ]);
  assertPersisted(
    repeated,
    "6. A settled successful retry token must retain a stable terminal success."
  );
  assertPersisted(
    concurrentRepeated,
    "6. Concurrent observers of a settled retry token must receive the same success."
  );
  assert(
    harness.client.writeAttempts.length === attemptsBeforeRepeatedObservation,
    "6. Re-observing terminal retry success must not enqueue another write."
  );
}

async function verifyDurableProjectionForSavedFeatures() {
  const checkInHarness = createHarness();
  const record = {
    id: "check-in-durable-fixed",
    createdAt: "2026-08-02T10:00:00.000Z",
    mood: "calm" as const,
    moment: "evening" as const
  };
  const save = checkInHarness.actions.saveCheckInRecord(record);
  await waitForWriteAttempts(checkInHarness.client, 1);
  assert(
    checkInHarness.runtime.getState().checkIns.records.length === 1 &&
      checkInHarness.runtime.getDurableState().checkIns.records.length === 0 &&
      checkInHarness.projection.getSnapshot().acceptedState.checkIns.records[0]
        ?.id === record.id &&
      checkInHarness.projection.getSnapshot().durableState.checkIns.records
        .length === 0 &&
      getNewestBloomCheckInRecords(
        checkInHarness.projection.getSnapshot().durableState.checkIns.records
      ).length === 0 &&
      checkInHarness.acceptedStates.at(-1)?.checkIns.records[0]?.id ===
        record.id &&
      checkInHarness.durableStates.length === 0,
    "1. Check-In accepted state may advance while Recent Moments' durable projection remains unchanged."
  );
  checkInHarness.client.failWrite(0);
  const token = requireRetryableFailure(
    await save,
    "1. Failed Check-In must remain retryable without entering the durable projection."
  );
  assert(
    checkInHarness.runtime.getDurableState().checkIns.records.length === 0,
    "1. Failed Check-In must not appear in the durable Recent Moments projection."
  );
  const retry = checkInHarness.runtime.retryPersistence(token);
  await waitForWriteAttempts(checkInHarness.client, 2);
  checkInHarness.client.succeedWrite(1);
  assertPersisted(await retry, "1. Check-In retry must persist the accepted record.");
  assert(
    checkInHarness.runtime.getDurableState().checkIns.records[0]?.id === record.id &&
      checkInHarness.durableStates.at(-1)?.checkIns.records[0]?.id === record.id &&
      getNewestBloomCheckInRecords(
        checkInHarness.projection.getSnapshot().durableState.checkIns.records
      )[0]?.id === record.id,
    "1. Recent Moments may expose the Check-In only after its write succeeds."
  );

  const protectionState = createDefaultBloomState();
  protectionState.onboarding.completed = true;
  protectionState.protection = {
    status: "paused",
    setupCompletedAt: "2026-08-01T20:00:00.000Z",
    preferredWindow: "night",
    level: "balanced",
    adultContentPauseEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "07:00",
    lastProtectionPauseAt: null
  };
  const protectionHarness = createHarness(protectionState);
  const protectionResume = protectionHarness.actions.resumeProtection();
  await waitForWriteAttempts(protectionHarness.client, 1);
  const acceptedJourney = getNextBloomAction(
    protectionHarness.projection.getSnapshot().acceptedState,
    "2026-08-02"
  );
  const pendingDurableJourney = getNextBloomAction(
    protectionHarness.projection.getSnapshot().durableState,
    "2026-08-02"
  );
  assert(
    protectionHarness.runtime.getState().protection.status === "active" &&
      protectionHarness.runtime.getDurableState().protection.status === "paused" &&
      protectionHarness.projection.getSnapshot().acceptedState.protection
        .status === "active" &&
      protectionHarness.projection.getSnapshot().durableState.protection
        .status === "paused" &&
      protectionHarness.acceptedStates.at(-1)?.protection.status === "active" &&
      protectionHarness.durableStates.length === 0 &&
      acceptedJourney.id === "startReset" &&
      pendingDurableJourney.id === "resumeProtection",
    "1. Protection flow state may accept Resume while status presentation remains durably paused."
  );
  protectionHarness.client.failWrite(0);
  const protectionToken = requireRetryableFailure(
    await protectionResume,
    "1. Failed Protection Resume must remain retryable without advancing durable journey truth."
  );
  assert(
    protectionHarness.runtime.getDurableState().protection.status === "paused" &&
      getNextBloomAction(
        protectionHarness.projection.getSnapshot().durableState,
        "2026-08-02"
      ).id === "resumeProtection",
    "1. Failed Protection Resume must not leak into durable status or journey readers."
  );
  const protectionRetry =
    protectionHarness.runtime.retryPersistence(protectionToken);
  await waitForWriteAttempts(protectionHarness.client, 2);
  protectionHarness.client.succeedWrite(1);
  assertPersisted(
    await protectionRetry,
    "1. Protection Resume retry must persist the exact accepted state."
  );
  assert(
    protectionHarness.projection.getSnapshot().durableState.protection
      .status === "active" &&
      getNextBloomAction(
        protectionHarness.projection.getSnapshot().durableState,
        "2026-08-02"
      ).id === "startReset",
    "1. Protection status and Today/journey may advance coherently only after durable success."
  );

  const protectionPause = protectionHarness.actions.pauseProtection();
  await waitForWriteAttempts(protectionHarness.client, 3);
  assert(
    protectionHarness.runtime.getState().protection.status === "paused" &&
      protectionHarness.runtime.getDurableState().protection.status ===
        "active",
    "1. The production Pause action must remain accepted-only until its exact write succeeds."
  );
  protectionHarness.client.succeedWrite(2);
  assertPersisted(
    await protectionPause,
    "1. The production Pause action must acknowledge its exact delayed write."
  );
  assert(
    protectionHarness.runtime.getDurableState().protection.status ===
      "paused",
    "1. Protection Pause may update durable status only after persistence."
  );
}

async function verifyOnboardingCompletionRequiresDurability() {
  const harness = createHarness(createDefaultBloomState(), 5);
  const quizAnswers = getDebugQuizAnswers("pornLoop");
  const quizResult = createDebugQuizResult(
    "pornLoop",
    fixedNow().toISOString()
  );
  let transformInvocations = 0;
  let navigationCalls = 0;
  const getNavigationCalls = (): number => navigationCalls;
  const completion = harness.runtime
    .applyAcknowledgedMutation((state) => {
      transformInvocations += 1;
      return saveOnboardingResultState(state, quizAnswers, quizResult);
    })
    .then((result) => {
      if (result.ok) {
        navigationCalls += 1;
      }
      return result;
    });

  await waitForWriteAttempts(harness.client, 1);
  const acceptedPresentation = getDurableOnboardingResultPresentation({
    durableState: harness.runtime.getState(),
    durableTodayKey: "2026-08-02"
  });
  const durablePresentation = getDurableOnboardingResultPresentation({
    durableState: harness.runtime.getDurableState(),
    durableTodayKey: "2026-08-02"
  });
  assert(
    harness.runtime.getState().onboarding.completed &&
      harness.runtime.getState().onboarding.quizResult?.completedAt ===
        quizResult.completedAt &&
      !harness.runtime.getDurableState().onboarding.completed &&
      acceptedPresentation.quizResult !== null &&
      durablePresentation.quizResult === null &&
      durablePresentation.firstStep.route === "/onboarding" &&
      !durablePresentation.firstStep.body.includes("saved") &&
      getNavigationCalls() === 0,
    "1. Accepted onboarding may prepare a result in session, but the production durable presentation must remain onboarding-incomplete and navigation must remain blocked."
  );

  const timedOutResult = await completion;
  const retryToken = requireRetryableFailure(
    timedOutResult,
    "1. Timed-out onboarding persistence must retain an exact retry token."
  );
  assert(
    !timedOutResult.ok &&
      timedOutResult.reason === "persistenceUnknown" &&
      getNavigationCalls() === 0 &&
      getDurableOnboardingResultPresentation({
        durableState: harness.runtime.getDurableState(),
        durableTodayKey: "2026-08-02"
      }).quizResult === null,
    "1. Onboarding timeout must not navigate or expose the accepted result as durably saved."
  );

  const retry = harness.runtime.retryPersistence(retryToken).then((result) => {
    if (result.ok) {
      navigationCalls += 1;
    }
    return result;
  });
  harness.client.succeedWrite(0);
  assertPersisted(
    await retry,
    "1. Retrying the exact onboarding token must acknowledge the original pending snapshot."
  );
  const persistedPresentation = getDurableOnboardingResultPresentation({
    durableState: harness.runtime.getDurableState(),
    durableTodayKey: "2026-08-02"
  });
  assert(
    transformInvocations === 1 &&
      harness.client.writeAttempts.length === 1 &&
      getNavigationCalls() === 1 &&
      persistedPresentation.quizResult?.completedAt === quizResult.completedAt &&
      persistedPresentation.quizResult.resultTitle === quizResult.resultTitle,
    "1. Exact-token retry must not rescore/replay onboarding and may navigate only after that same accepted result becomes durable."
  );

  const inconsistentCompletedState = createDefaultBloomState();
  inconsistentCompletedState.onboarding.completed = true;
  const inconsistentPresentation = getDurableOnboardingResultPresentation({
    durableState: inconsistentCompletedState,
    durableTodayKey: "2026-08-02"
  });
  assert(
    inconsistentPresentation.quizResult === null &&
      inconsistentPresentation.firstStep.route === "/onboarding",
    "1. A legacy/inconsistent completed flag without a durable quiz result must never unlock result or downstream Saved copy."
  );
}

async function verifyUnknownAcknowledgementAndLateSettlement() {
  const harness = createHarness(createDefaultBloomState(), 5);
  let savedClaims = 0;
  let navigationCalls = 0;
  const acknowledgement = harness.runtime
    .applyAcknowledgedMutation((state) => stateWithDateOffset(state, 24))
    .then((result) => {
      if (result.ok) {
        savedClaims += 1;
        navigationCalls += 1;
      }

      return result;
    });
  await waitForWriteAttempts(harness.client, 1);
  const unknown = await acknowledgement;
  const token = requireRetryableFailure(
    unknown,
    "5. A never-settling adapter must produce a bounded retryable unknown result."
  );
  assert(
    !unknown.ok &&
      unknown.reason === "persistenceUnknown" &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 0 &&
      harness.persistenceErrors.at(-1) === BLOOM_PERSISTENCE_PENDING_MESSAGE,
    "5. Watchdog expiry must report pending truthfully and leave durable state unchanged."
  );

  const retry = harness.runtime.retryPersistence(token);
  const duplicateRetry = harness.runtime.retryPersistence(token);
  assert(retry === duplicateRetry, "5. Retry while the original write is unresolved must share one waiter.");
  const retryUnknown = await retry;
  assert(
    !retryUnknown.ok &&
      retryUnknown.retryable &&
      retryUnknown.reason === "persistenceUnknown" &&
      harness.client.writeAttempts.length === 1,
    "5. Retry must not enqueue a duplicate write behind an unresolved original attempt."
  );

  harness.client.succeedWrite(0);
  await waitForCompletedWrites(harness.client, 1);
  await flushMicrotasks();
  assert(
    harness.runtime.getDurableState().debug.dateOffsetDays === 24 &&
      harness.runtime.getRetryEntryCount() === 0,
    "5. A late write may advance durable state and clean retry metadata without changing the already-settled unknown result."
  );
  const [lateObservation, duplicateLateObservation] = await Promise.all([
    harness.runtime.retryPersistence(token),
    harness.runtime.retryPersistence(token)
  ]);
  assertPersisted(
    lateObservation,
    "5. An explicit later retry may acknowledge the exact revision after its original write settles."
  );
  assertPersisted(
    duplicateLateObservation,
    "5. Late terminal success must remain stable for concurrent observers of the exact token."
  );
  assert(
    harness.client.writeAttempts.length === 1 &&
      harness.runtime.getRetryEntryCount() === 0 &&
      savedClaims === 0 &&
      navigationCalls === 0,
    "5. Late success must clean retry metadata without a duplicate write."
  );
}

async function verifySupersededTimeoutDoesNotPublishPending() {
  const harness = createHarness(createDefaultBloomState(), 5);
  const superseded = harness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 27)
  );
  await waitForWriteAttempts(harness.client, 1);
  const current = harness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 28)
  );

  const supersededResult = await superseded;
  assert(
    !supersededResult.ok &&
      supersededResult.accepted &&
      !supersededResult.retryable &&
      supersededResult.reason === "persistenceSuperseded",
    "1/6. An older timed-out acknowledgement must resolve as superseded after a newer accepted mutation."
  );
  assert(
    !harness.persistenceErrors.includes(BLOOM_PERSISTENCE_PENDING_MESSAGE),
    "1/6. A superseded timeout must not publish its stale pending message into the current projection."
  );

  harness.client.succeedWrite(0);
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(
    await current,
    "1/6. The current mutation must persist after the superseded timeout is suppressed."
  );
}

async function verifyUnmountBeforeLateCompletion() {
  const harness = createHarness(createDefaultBloomState(), 5);
  let isMounted = true;
  let savedClaims = 0;
  let navigationCalls = 0;
  let visibleResult: BloomPersistedMutationResult | null = null;
  const acknowledgement = harness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 25)
  );
  const componentCompletion = acknowledgement.then((result) => {
    if (!isMounted) {
      return;
    }

    visibleResult = result;
    if (result.ok) {
      savedClaims += 1;
      navigationCalls += 1;
    }
  });
  await waitForWriteAttempts(harness.client, 1);
  isMounted = false;
  await componentCompletion;
  harness.client.succeedWrite(0);
  await waitForCompletedWrites(harness.client, 1);
  await flushMicrotasks();
  assert(
    visibleResult === null &&
      savedClaims === 0 &&
      navigationCalls === 0 &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 25,
    "5. Unmount before timeout/late completion must suppress stale feedback and navigation while still accepting a late durable write."
  );
}

async function verifyUnknownRetryLateSettlementCleanup() {
  const harness = createHarness(createDefaultBloomState(), 5);
  const initial = harness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 26)
  );
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const token = requireRetryableFailure(
    await initial,
    "5. Retry late-settlement cleanup requires an initial retry token."
  );

  const retry = harness.runtime.retryPersistence(token);
  await waitForWriteAttempts(harness.client, 2);
  const unknownRetry = await retry;
  assert(
    !unknownRetry.ok &&
      unknownRetry.retryable &&
      unknownRetry.reason === "persistenceUnknown" &&
      harness.runtime.getRetryEntryCount() === 1,
    "5. A timed-out retry write must stay explicitly unknown while unresolved."
  );

  harness.client.succeedWrite(1);
  await waitForCompletedWrites(harness.client, 1);
  await flushMicrotasks();
  assert(
    harness.runtime.getRetryEntryCount() === 0 &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 26,
    "5. Late success of a retry write must clean its retry entry and advance durable state."
  );
  assertPersisted(
    await harness.runtime.retryPersistence(token),
    "5. The compact late-success marker must still acknowledge the exact retry token."
  );
  assert(
    harness.client.writeAttempts.length === 2,
    "5. Acknowledging late retry success must not enqueue another write."
  );
}

async function verifyStrictModeMountMutationGuards() {
  const retryableGuard = { current: null as string | null };
  let rejectedGuardCalls = 0;
  const rejectedAttempt = runStableMountMutationOnce(
    retryableGuard,
    "retryable-mount",
    () => {
      rejectedGuardCalls += 1;
      return false;
    }
  );
  const acceptedAttempt = runStableMountMutationOnce(
    retryableGuard,
    "retryable-mount",
    () => {
      rejectedGuardCalls += 1;
      return true;
    }
  );
  const acceptedReplay = runStableMountMutationOnce(
    retryableGuard,
    "retryable-mount",
    () => {
      rejectedGuardCalls += 1;
      return true;
    }
  );
  const legitimateNewKey = runStableMountMutationOnce(
    retryableGuard,
    "later-mount",
    () => {
      rejectedGuardCalls += 1;
      return true;
    }
  );
  assert(
    !rejectedAttempt &&
      acceptedAttempt &&
      !acceptedReplay &&
      legitimateNewKey &&
      rejectedGuardCalls === 3,
    "6. A rejected mount mutation must remain retryable, one accepted key must suppress replay, and a future key must remain legitimate."
  );

  const protectionHarness = createHarness();
  const protectionGuard = { current: null as string | null };
  let protectionMutationCalls = 0;
  const recordPause = () => {
    protectionMutationCalls += 1;
    return protectionHarness.runtime.applyMutation((state) =>
      recordProtectionPauseState(
        state,
        "2026-08-02T11:00:00.000Z"
      )
    ).ok;
  };
  const firstProtectionEffect = runStableMountMutationOnce(
    protectionGuard,
    "protection-intercept",
    recordPause
  );
  const replayedProtectionEffect = runStableMountMutationOnce(
    protectionGuard,
    "protection-intercept",
    recordPause
  );
  await waitForWriteAttempts(protectionHarness.client, 1);
  assert(
    firstProtectionEffect &&
      !replayedProtectionEffect &&
      protectionMutationCalls === 1 &&
      protectionHarness.client.writeAttempts.length === 1,
    "6. Protection intercept Strict Mode replay must produce one logical mutation and one write."
  );
  protectionHarness.client.succeedWrite(0);
  await waitForCompletedWrites(protectionHarness.client, 1);

  const pauseId = "pause-strict-mode-timer";
  const pauseState = startPauseSessionState(createDefaultBloomState(), {
    id: pauseId,
    startedAt: "2026-08-02T11:01:00.000Z",
    phase: "timer",
    triggers: [],
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  });
  const pauseHarness = createHarness(pauseState);
  const timerGuard = { current: null as string | null };
  let timerMutationCalls = 0;
  const initializeTimer = () => {
    timerMutationCalls += 1;
    return pauseHarness.runtime.applyMutation((state) =>
      updatePauseSessionState(state, pauseId, {
        timerStartedAt: "2026-08-02T11:01:01.000Z"
      })
    ).ok;
  };
  const firstTimerEffect = runStableMountMutationOnce(
    timerGuard,
    pauseId,
    initializeTimer
  );
  const replayedTimerEffect = runStableMountMutationOnce(
    timerGuard,
    pauseId,
    initializeTimer
  );
  await waitForWriteAttempts(pauseHarness.client, 1);
  assert(
    firstTimerEffect &&
      !replayedTimerEffect &&
      timerMutationCalls === 1 &&
      pauseHarness.client.writeAttempts.length === 1 &&
      pauseHarness.runtime.getState().pause.activeSession?.timerStartedAt ===
        "2026-08-02T11:01:01.000Z",
    "6. Pause timer Strict Mode replay must initialize one stable session once and write once."
  );
  pauseHarness.client.succeedWrite(0);
  await waitForCompletedWrites(pauseHarness.client, 1);
}

async function verifyAtomicPauseSaveAndCloseAcknowledgement() {
  const sessionPatch = {
    phase: "checkIn",
    triggers: ["nighttime", "habit"],
    intensityBefore: 6,
    selectedAction: "logAndClose",
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  } satisfies PauseSessionPatch;
  const harness = createHarness();
  const expectedRecordId = createBloomRecordId("pause", fixedNow(), 0);
  const completion = harness.actions.saveAndClosePauseSession(
    expectedRecordId,
    sessionPatch,
    { durationSeconds: 0 }
  );
  await waitForWriteAttempts(harness.client, 1);
  const acceptedRecord = harness.runtime.getState().pause.records[0];
  assert(
    harness.getAcknowledgedActionMutationCalls() === 1 &&
      harness.client.writeAttempts.length === 1 &&
      harness.runtime.getState().pause.activeSession === null &&
      harness.runtime.getState().pause.records.length === 1 &&
      acceptedRecord !== undefined &&
      acceptedRecord.id === expectedRecordId &&
      acceptedRecord.startedAt === fixedNow().toISOString() &&
      acceptedRecord.completedAt === fixedNow().toISOString() &&
      acceptedRecord.durationSeconds === 0 &&
      harness.runtime.getDurableState().pause.records.length === 0 &&
      readAttemptState(harness.client, 0).pause.activeSession === null &&
      readAttemptState(harness.client, 0).pause.records[0]?.id ===
        acceptedRecord.id,
    "6. The production Pause Save and close action must enqueue one deterministic final-only snapshot with no transient draft."
  );
  harness.client.succeedWrite(0);
  assertPersisted(
    await completion,
    "6. Atomic Pause Save and close must acknowledge its single durable write."
  );
  assert(
    harness.runtime.getDurableState().pause.records.length === 1 &&
      harness.runtime.getDurableState().pause.records[0]?.id ===
        acceptedRecord.id,
    "6. Atomic Pause completion must become durable coherently after that one write."
  );

  const failureHarness = createHarness();
  const failedExpectedRecordId = "pause-atomic-failure";
  const failedCompletion = failureHarness.actions.saveAndClosePauseSession(
    failedExpectedRecordId,
    sessionPatch,
    { durationSeconds: 0 }
  );
  await waitForWriteAttempts(failureHarness.client, 1);
  const failedRecordId =
    failureHarness.runtime.getState().pause.records[0]?.id;
  failureHarness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await failedCompletion,
    "6. Failed atomic Pause completion must retain an exact retry path."
  );
  assert(
    failureHarness.runtime.getState().pause.activeSession === null &&
      failureHarness.runtime.getState().pause.records.length === 1,
    "6. Failed atomic Pause completion must retain one accepted final record, never an implementation draft."
  );
  const retry = failureHarness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(failureHarness.client, 2);
  failureHarness.client.succeedWrite(1);
  assertPersisted(await retry, "6. Atomic Pause completion retry must persist.");
  assert(
    failureHarness.getAcknowledgedActionMutationCalls() === 1 &&
      failedRecordId !== undefined &&
      failureHarness.runtime.getDurableState().pause.records.length === 1 &&
      failureHarness.runtime.getDurableState().pause.records[0]?.id ===
        failedRecordId,
    "6. Atomic Pause retry must preserve the production action's original ID and record without re-entering it."
  );
}

async function verifyAtomicPauseRejectsPartialCompletion() {
  const sessionPatch = {
    phase: "checkIn",
    triggers: ["stress"],
    intensityBefore: 5,
    selectedAction: "logAndClose",
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  } satisfies PauseSessionPatch;
  const newSessionHarness = createHarness();
  const rejectedNewSession =
    await newSessionHarness.actions.saveAndClosePauseSession(
      "pause-atomic-invalid-new",
      sessionPatch,
      { durationSeconds: -1 }
    );
  assert(
    !rejectedNewSession.ok &&
      !rejectedNewSession.accepted &&
      rejectedNewSession.reason === "invalidSession" &&
      newSessionHarness.runtime.getState().pause.activeSession === null &&
      newSessionHarness.runtime.getState().pause.records.length === 0 &&
      newSessionHarness.client.writeAttempts.length === 0,
    "5. Invalid new-session completion data must reject the entire atomic Pause mutation without persisting a staged draft."
  );

  const existingId = "pause-atomic-invalid-existing";
  const existingState = startPauseSessionState(createDefaultBloomState(), {
    id: existingId,
    startedAt: "2026-08-02T11:15:00.000Z",
    phase: "checkIn",
    triggers: [],
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  });
  const existingSessionHarness = createHarness(existingState);
  const rejectedExistingSession =
    await existingSessionHarness.actions.saveAndClosePauseSession(
      existingId,
      sessionPatch,
      { durationSeconds: -1 }
    );
  assert(
    !rejectedExistingSession.ok &&
      !rejectedExistingSession.accepted &&
      rejectedExistingSession.reason === "invalidSession" &&
      existingSessionHarness.runtime.getState() === existingState &&
      existingSessionHarness.client.writeAttempts.length === 0,
    "5. Invalid existing-session completion data must roll back its staged patch and enqueue no partial Pause snapshot."
  );

  const collisionId = "pause-atomic-record-collision";
  const completedCollisionState = completePauseSessionState(
    startPauseSessionState(createDefaultBloomState(), {
      id: collisionId,
      startedAt: "2026-08-02T11:20:00.000Z",
      phase: "afterPause",
      triggers: ["stress"],
      timerDurationSeconds: 90,
      elapsedDurationSeconds: 90
    }),
    collisionId,
    { durationSeconds: 90 },
    "2026-08-02T11:22:00.000Z"
  );
  const collidingState: BloomLocalState = {
    ...completedCollisionState,
    pause: {
      ...completedCollisionState.pause,
      activeSession: {
        id: collisionId,
        startedAt: "2026-08-02T11:23:00.000Z",
        phase: "afterPause",
        triggers: ["habit"],
        timerDurationSeconds: 90,
        elapsedDurationSeconds: 90
      }
    }
  };
  const collisionHarness = createHarness(collidingState);
  const rejectedCollision =
    await collisionHarness.runtime.applyAcknowledgedMutation((state) =>
      completePauseSessionState(
        state,
        collisionId,
        { durationSeconds: 90 },
        "2026-08-02T11:25:00.000Z"
      )
    );
  assert(
    !rejectedCollision.ok &&
      !rejectedCollision.accepted &&
      rejectedCollision.reason === "invalidSession" &&
      collisionHarness.runtime.getState() === collidingState &&
      collisionHarness.runtime.getState().pause.activeSession?.triggers[0] ===
        "habit" &&
      collisionHarness.runtime.getState().pause.records[0]?.completedAt ===
        "2026-08-02T11:22:00.000Z" &&
      collisionHarness.client.writeAttempts.length === 0,
    "5. Direct Pause completion must reject an active-session/record ID collision without clearing the draft, reusing the old record, or enqueueing a write."
  );
}

async function verifyPauseSavedRequiresExactDurableRecord() {
  const oldRecordId = "pause-durable-old";
  const newRecordId = "pause-accepted-new";
  const initialState = completePauseSessionState(
    startPauseSessionState(createDefaultBloomState(), {
      id: oldRecordId,
      startedAt: "2026-08-01T20:00:00.000Z",
      phase: "afterPause",
      triggers: ["stress"],
      timerDurationSeconds: 90,
      elapsedDurationSeconds: 90
    }),
    oldRecordId,
    { durationSeconds: 90 },
    "2026-08-01T20:02:00.000Z"
  );
  const harness = createHarness(initialState, 5);
  let navigationCalls = 0;
  const completion = harness.actions
    .saveAndClosePauseSession(
      newRecordId,
      {
        phase: "checkIn",
        triggers: ["habit"],
        intensityBefore: 6,
        selectedAction: "logAndClose",
        timerDurationSeconds: 90,
        elapsedDurationSeconds: 0
      },
      { durationSeconds: 0 }
    )
    .then((result) => {
      if (result.ok) {
        navigationCalls += 1;
      }
      return result;
    });

  await waitForWriteAttempts(harness.client, 1);
  const pendingCompletion = resolvePauseSavedRoute(
    harness.runtime.getState().pause,
    harness.runtime.getDurableState().pause,
    { mode: "completion", recordId: newRecordId }
  );
  const pendingDirectEntry = resolvePauseSavedRoute(
    harness.runtime.getState().pause,
    harness.runtime.getDurableState().pause,
    { mode: "history" }
  );
  const completionHref = createPauseSavedCompletionHref(newRecordId);
  assert(
    harness.runtime.getState().pause.records.some(
      (record) => record.id === newRecordId
    ) &&
      harness.runtime.getDurableState().pause.records.some(
        (record) => record.id === oldRecordId
      ) &&
      !harness.runtime.getDurableState().pause.records.some(
        (record) => record.id === newRecordId
      ) &&
      pendingCompletion.status === "unconfirmed" &&
      pendingDirectEntry.status === "unconfirmed" &&
      completionHref.params.recordId === newRecordId &&
      navigationCalls === 0,
    "5. Completion navigation must carry the exact new record ID, and an older durable Pause must not satisfy either exact-completion or direct-entry success while that record is not durable."
  );

  const timedOutResult = await completion;
  assert(
    !timedOutResult.ok &&
      timedOutResult.accepted &&
      timedOutResult.retryable &&
      timedOutResult.reason === "persistenceUnknown" &&
      resolvePauseSavedRoute(
        harness.runtime.getState().pause,
        harness.runtime.getDurableState().pause,
        { mode: "completion", recordId: newRecordId }
      ).status === "unconfirmed" &&
      navigationCalls === 0,
    "5. A timed-out new Pause completion must not navigate or render Saved from an unrelated old durable record."
  );
  harness.client.failWrite(0);
  await flushMicrotasks();

  const historicalResolution = resolvePauseSavedRoute(
    initialState.pause,
    initialState.pause,
    { mode: "history" }
  );
  assert(
    historicalResolution.status === "show-history" &&
      historicalResolution.record.id === oldRecordId,
    "5. Legitimate no-param history entry may still show the latest durable record with non-completion presentation."
  );
}

async function verifyArousalSavedRequiresExactDurableLog() {
  const oldLogId = "arousal-durable-old";
  const newLogId = "arousal-durable-draft-new";
  const oldCompletedState = completeArousalSessionState(
    startArousalSessionState(createDefaultBloomState(), {
      id: oldLogId,
      startedAt: "2026-08-01T20:00:00.000Z",
      dateKey: "2026-08-01",
      mode: "onePause",
      focus: "onePause",
      adultContent: "no",
      firmnessPlan: "finish",
      endingChoice: "stoppedByChoice",
      reflectionCompleted: true,
      pauseCount: 1,
      pauseCountBucket: "1",
      controlFeeling: 6,
      pressureRushing: "low"
    }),
    oldLogId,
    {
      durationPreference: "notLogged",
      durationSeconds: null
    },
    "2026-08-01T20:05:00.000Z"
  );
  const initialState = startArousalSessionState(oldCompletedState, {
    id: newLogId,
    startedAt: "2026-08-02T10:00:00.000Z",
    dateKey: "2026-08-02",
    mode: "onePause",
    focus: "onePause",
    adultContent: "no",
    firmnessPlan: "finish",
    endingChoice: "stoppedByChoice",
    reflectionCompleted: true,
    pauseCount: 2,
    pauseCountBucket: "2",
    controlFeeling: 8,
    pressureRushing: "medium"
  });
  const harness = createHarness(initialState, 5);
  const initialPayload = JSON.stringify({
    version: 2,
    savedAt: fixedNow().toISOString(),
    state: initialState
  });
  harness.client.prime(BLOOM_STATE_STORAGE_KEY, initialPayload);
  let transformInvocations = 0;
  let navigationCalls = 0;
  const getNavigationCalls = (): number => navigationCalls;
  const completion = harness.runtime
    .applyAcknowledgedMutation((state) => {
      transformInvocations += 1;
      return completeArousalSessionState(
        state,
        newLogId,
        {
          durationPreference: "notLogged",
          durationSeconds: null
        },
        "2026-08-02T10:05:00.000Z"
      );
    })
    .then((result) => {
      if (result.ok) {
        navigationCalls += 1;
      }
      return result;
    });

  await waitForWriteAttempts(harness.client, 1);
  const completionResolution = resolveArousalSavedRoute(
    harness.runtime.getState().arousalControl,
    harness.runtime.getDurableState().arousalControl,
    { mode: "completion", logId: newLogId }
  );
  const directResolution = resolveArousalSavedRoute(
    harness.runtime.getState().arousalControl,
    harness.runtime.getDurableState().arousalControl,
    { mode: "history" }
  );
  const completionHref = createArousalSavedCompletionHref(newLogId);
  const completionIntent = getArousalSavedRouteIntent(newLogId);
  const historyIntent = getArousalSavedRouteIntent(undefined);
  const malformedCompletionIntent = getArousalSavedRouteIntent([
    newLogId
  ]);
  assert(
    harness.runtime.getState().arousalControl.draft === null &&
      harness.runtime.getState().arousalControl.logs.some(
        (log) => log.id === newLogId
      ) &&
      harness.runtime.getDurableState().arousalControl.draft?.id === newLogId &&
      harness.runtime.getDurableState().arousalControl.logs.some(
        (log) => log.id === oldLogId
      ) &&
      !harness.runtime.getDurableState().arousalControl.logs.some(
        (log) => log.id === newLogId
      ) &&
      completionResolution.status === "unconfirmed" &&
      directResolution.status === "unconfirmed" &&
      completionHref.params.logId === newLogId &&
      completionIntent.mode === "completion" &&
      completionIntent.logId === newLogId &&
      historyIntent.mode === "history" &&
      malformedCompletionIntent.mode === "completion" &&
      malformedCompletionIntent.logId === null &&
      getNavigationCalls() === 0,
    "B. Arousal completion navigation and route parsing must carry exact L_new, and neither exact nor no-param Saved entry may use durable L_old while L_new is accepted-only."
  );

  const timedOutResult = await completion;
  const retryToken = requireRetryableFailure(
    timedOutResult,
    "B. Timed-out Arousal completion must retain the exact retry token."
  );
  assert(
    !timedOutResult.ok &&
      timedOutResult.reason === "persistenceUnknown" &&
      getNavigationCalls() === 0 &&
      resolveArousalSavedRoute(
        harness.runtime.getState().arousalControl,
        harness.runtime.getDurableState().arousalControl,
        { mode: "completion", logId: newLogId }
      ).status === "unconfirmed",
    "B. A timed-out L_new completion must not navigate or let L_old masquerade as the saved practice."
  );

  harness.client.failWrite(0);
  await flushMicrotasks();
  const reloadResult = await harness.coordinator.load();
  assert(
    reloadResult.status === "success" &&
      reloadResult.state.arousalControl.draft?.id === newLogId &&
      reloadResult.state.arousalControl.logs.some(
        (log) => log.id === oldLogId
      ) &&
      !reloadResult.state.arousalControl.logs.some(
        (log) => log.id === newLogId
      ) &&
      resolveArousalSavedRoute(
        reloadResult.state.arousalControl,
        reloadResult.state.arousalControl,
        { mode: "completion", logId: newLogId }
      ).status === "redirect",
    "B. Reload after failed L_new completion must restore its durable draft and cannot validate the exact completion route."
  );

  const retry = harness.runtime.retryPersistence(retryToken).then((result) => {
    if (result.ok) {
      navigationCalls += 1;
    }
    return result;
  });
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(
    await retry,
    "B. Exact-token Arousal retry must persist the original L_new completion."
  );
  const persistedReload = await harness.coordinator.load();
  const exactPersistedResolution = resolveArousalSavedRoute(
    harness.runtime.getState().arousalControl,
    harness.runtime.getDurableState().arousalControl,
    { mode: "completion", logId: newLogId }
  );
  const historicalResolution = resolveArousalSavedRoute(
    oldCompletedState.arousalControl,
    oldCompletedState.arousalControl,
    { mode: "history" }
  );
  assert(
    transformInvocations === 1 &&
      getNavigationCalls() === 1 &&
      exactPersistedResolution.status === "show-completion" &&
      exactPersistedResolution.log.id === newLogId &&
      persistedReload.status === "success" &&
      persistedReload.state.arousalControl.draft === null &&
      resolveArousalSavedRoute(
        persistedReload.state.arousalControl,
        persistedReload.state.arousalControl,
        { mode: "completion", logId: newLogId }
      ).status === "show-completion" &&
      historicalResolution.status === "show-history" &&
      historicalResolution.log.id === oldLogId,
    "B. Only exact durable L_new may render completion success; no-param L_old remains a distinct historical presentation, and retry must not replay completion."
  );
}

async function verifyCheckInRetryIdempotency() {
  const record = {
    id: "check-in-20260802-fixed",
    createdAt: "2026-08-02T10:00:00.000Z",
    mood: "restless" as const,
    moment: "scrolling" as const,
    eventType: "paused" as const,
    note: "Synthetic verification note."
  };

  const harness = createHarness();
  const mutation = harness.actions.saveCheckInRecord(record);
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await mutation,
    "7. The production Check-In action must expose a retry token after failure."
  );
  assert(
    harness.runtime.getState().checkIns.records.length === 1 &&
      harness.runtime.getState().checkIns.records[0]?.id === record.id,
    "7. Failed production Check-In must retain one accepted record with the original ID."
  );
  const retry = harness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(await retry, "7. Production Check-In retry must persist.");
  assert(
    harness.getAcknowledgedActionMutationCalls() === 1 &&
      readStoredState(harness.client).checkIns.records.length === 1 &&
      readStoredState(harness.client).checkIns.records[0]?.id === record.id,
    "7. Check-In retry must retain one record without re-entering the production action."
  );
}

async function verifyResetRetryIdempotency() {
  await verifyDomainFailureRetry(
    "8. Reset",
    createDefaultBloomState(),
    (state) =>
      completeTodayResetState(
        state,
        "2026-08-02",
        "2026-08-02T10:01:00.000Z"
      ),
    (state) => {
      assert(
        state.tenDayReset.completedDates.length === 1 &&
          state.tenDayReset.completedDates[0] === "2026-08-02",
        "8. Reset retry must retain one completion date."
      );
    }
  );
}

async function verifyPauseRetryIdempotency() {
  const draft: PauseSessionDraft = {
    id: "pause-fixed",
    startedAt: "2026-08-02T10:02:00.000Z",
    phase: "afterPause",
    triggers: ["stress"],
    intensityBefore: 7,
    selectedAction: "pause90",
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 90
  };
  const initialState = startPauseSessionState(createDefaultBloomState(), draft);

  await verifyDomainFailureRetry(
    "9. Pause",
    initialState,
    (state) =>
      completePauseSessionState(
        state,
        draft.id,
        {
          durationSeconds: 90,
          intensityAfterChange: "lower",
          feltTruth: "calmer",
          nextStep: "savePause"
        },
        "2026-08-02T10:04:00.000Z"
      ),
    (state) => {
      assert(
        state.pause.activeSession === null &&
          state.pause.records.length === 1 &&
          state.pause.records[0]?.id === draft.id,
        "9. Pause retry must keep the draft cleared and exactly one completed record."
      );
    }
  );
}

async function verifyArousalRetryIdempotency() {
  const draft: ArousalControlDraft = {
    id: "arousal-fixed",
    startedAt: "2026-08-02T10:05:00.000Z",
    dateKey: "2026-08-02",
    mode: "onePause",
    focus: "onePause",
    adultContent: "no",
    firmnessPlan: "finish",
    endingChoice: "stoppedByChoice",
    reflectionCompleted: true,
    pauseCount: 1,
    pauseCountBucket: "1",
    controlFeeling: 7,
    pressureRushing: "low"
  };
  const initialState = startArousalSessionState(
    createDefaultBloomState(),
    draft
  );

  await verifyDomainFailureRetry(
    "10. Arousal",
    initialState,
    (state) =>
      completeArousalSessionState(
        state,
        draft.id,
        {
          durationPreference: "notLogged",
          durationSeconds: null
        },
        "2026-08-02T10:10:00.000Z"
      ),
    (state) => {
      assert(
        state.arousalControl.draft === null &&
          state.arousalControl.logs.length === 1 &&
          state.arousalControl.logs[0]?.id === draft.id &&
          isValidCompletedArousalLog(state.arousalControl.logs[0]),
        "10. Arousal retry must keep the draft cleared and exactly one valid completed log."
      );
    }
  );
}

async function verifyProtectionRetryPreservesConfiguration() {
  const initialState = createDefaultBloomState();
  initialState.protection = {
    status: "paused",
    setupCompletedAt: "2026-08-01T20:00:00.000Z",
    preferredWindow: "night",
    level: "gentle",
    adultContentPauseEnabled: true,
    nightStartTime: "22:00",
    nightEndTime: "07:00",
    lastProtectionPauseAt: "2026-08-02T09:00:00.000Z"
  };
  const intendedConfiguration: ProtectionConfiguration = {
    preferredWindow: "custom",
    level: "strong",
    adultContentPauseEnabled: false,
    nightStartTime: "21:30",
    nightEndTime: "06:30"
  };

  const harness = createHarness(initialState);
  const mutation = harness.actions.configureProtection(
    intendedConfiguration
  );
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await mutation,
    "11. The production Protection configuration action must expose a retry token."
  );
  const retry = harness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(
    await retry,
    "11. Production Protection configuration retry must persist."
  );
  const state = readStoredState(harness.client);
  assert(
    harness.getAcknowledgedActionMutationCalls() === 1 &&
      state.protection.status === "paused" &&
      state.protection.setupCompletedAt ===
        "2026-08-01T20:00:00.000Z" &&
      state.protection.lastProtectionPauseAt ===
        "2026-08-02T09:00:00.000Z" &&
      state.protection.preferredWindow === "custom" &&
      state.protection.level === "strong" &&
      state.protection.adultContentPauseEnabled === false,
    "11. Production Protection retry must preserve unrelated status/timestamps and the intended configuration without re-entering the action."
  );
}

async function verifyDeletionInvalidatesPendingAcknowledgement() {
  const harness = createHarness();
  const acknowledgement = harness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 9)
  );
  await waitForWriteAttempts(harness.client, 1);

  harness.runtime.beginDeletion();
  const deletion = harness.coordinator.deleteAll();
  const blockedMutation = await harness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 10)
  );
  assert(
    !blockedMutation.ok &&
      blockedMutation.reason === "deletionInProgress" &&
      !blockedMutation.accepted,
    "14. A new acknowledged mutation must be blocked while deletion is active."
  );

  harness.client.succeedWrite(0);
  const retryToken = requireRetryableFailure(
    await acknowledgement,
    "12. Deletion must retain a pending acknowledgement token until durable deletion succeeds."
  );
  assert(
    harness.runtime.getRetryEntryCount() === 1,
    "12. Deletion must retain the exact pending acknowledgement metadata while deletion is unresolved."
  );
  await deletion;
  harness.runtime.completeDeletion(createDefaultBloomState());
  const attemptsBeforeStaleRetry = harness.client.writeAttempts.length;
  const staleRetry = await harness.runtime.retryPersistence(retryToken);
  assert(
    harness.client.peek(BLOOM_STATE_STORAGE_KEY) === null &&
      harness.runtime.getState().debug.dateOffsetDays === 0 &&
      harness.runtime.getRetryEntryCount() === 0 &&
      harness.client.writeAttempts.length === attemptsBeforeStaleRetry &&
      !staleRetry.ok &&
      !staleRetry.retryable &&
      staleRetry.reason === "persistenceInvalidated",
    "12/13. Successful deletion must remove the in-flight snapshot, install default canonical state, and permanently invalidate the retained token without another write."
  );
}

async function verifyDeletionInvalidatesPendingRetryWaiter() {
  const harness = createHarness();
  const failedMutation = harness.runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 20)
  );
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await failedMutation,
    "12. A failed mutation must expose a token before its retry write is invalidated."
  );
  const pendingRetry = harness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(harness.client, 2);
  harness.runtime.beginDeletion();
  const deletion = harness.coordinator.deleteAll();
  harness.client.succeedWrite(1);

  const retryResult = await pendingRetry;
  assert(
    !retryResult.ok &&
      retryResult.accepted &&
      retryResult.retryable &&
      retryResult.reason === "deletionInProgress" &&
      retryResult.retryToken === retryToken &&
      harness.runtime.getRetryEntryCount() === 1,
    "12. Deletion must interrupt an in-flight retry without discarding its token before deletion succeeds."
  );
  await deletion;
  harness.runtime.completeDeletion(createDefaultBloomState());
  assert(
    harness.client.writeAttempts.length === 2 &&
      harness.client.peek(BLOOM_STATE_STORAGE_KEY) === null &&
      harness.runtime.getRetryEntryCount() === 0,
    "12/13. Successful deletion must permanently clear the retained token without enqueueing a post-delete write."
  );
}

async function verifyDeletionPreventsRetryResurrection() {
  const harness = createHarness();
  const acknowledgement = harness.runtime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 11)
  );
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await acknowledgement,
    "13. The pre-deletion mutation must first expose a retry token."
  );

  harness.runtime.beginDeletion();
  await harness.coordinator.deleteAll();
  harness.runtime.completeDeletion(createDefaultBloomState());
  const attemptsBeforeRetry = harness.client.writeAttempts.length;
  const blockedPostDeleteMutation =
    await harness.runtime.applyAcknowledgedMutation((state) =>
      stateWithDateOffset(state, 12)
    );
  assert(
    !blockedPostDeleteMutation.ok &&
      !blockedPostDeleteMutation.accepted &&
      blockedPostDeleteMutation.reason === "deletionInProgress" &&
      harness.client.writeAttempts.length === attemptsBeforeRetry,
    "13. Mutation-bearing old routes must remain unable to recreate storage until onboarding navigation is confirmed."
  );
  const blockedRetry = await harness.runtime.retryPersistence(retryToken);
  assertInvalidatedRetry(blockedRetry, "13. Retry during reset transition must be invalidated.");
  harness.runtime.finishResetNavigation();
  const staleRetry = await harness.runtime.retryPersistence(retryToken);
  assertInvalidatedRetry(staleRetry, "13. A pre-deletion retry token must stay invalid after reset.");
  assert(
    harness.client.writeAttempts.length === attemptsBeforeRetry &&
      harness.client.peek(BLOOM_STATE_STORAGE_KEY) === null &&
      harness.runtime.getState().debug.dateOffsetDays === 0,
    "13. Retry after deletion must not write or resurrect the old snapshot."
  );
}

async function verifyFailedDeletionRequeuesCanonicalState() {
  const checkInId = "check-in-delete-recovery";
  const pauseId = "pause-delete-recovery";
  const arousalId = "arousal-delete-recovery";
  let initialState = saveBloomCheckInRecordState(createDefaultBloomState(), {
    id: checkInId,
    createdAt: "2026-08-02T09:00:00.000Z",
    mood: "neutral",
    moment: "stress"
  });
  initialState = completePauseSessionState(
    startPauseSessionState(initialState, {
      id: pauseId,
      startedAt: "2026-08-02T09:01:00.000Z",
      phase: "afterPause",
      triggers: ["stress"],
      timerDurationSeconds: 90,
      elapsedDurationSeconds: 90
    }),
    pauseId,
    { durationSeconds: 90 },
    "2026-08-02T09:03:00.000Z"
  );
  initialState = completeArousalSessionState(
    startArousalSessionState(initialState, {
      id: arousalId,
      startedAt: "2026-08-02T09:04:00.000Z",
      dateKey: "2026-08-02",
      mode: "onePause",
      focus: "onePause",
      adultContent: "no",
      firmnessPlan: "finish",
      endingChoice: "stoppedByChoice",
      reflectionCompleted: true,
      pauseCount: 1,
      pauseCountBucket: "1",
      controlFeeling: 7,
      pressureRushing: "low"
    }),
    arousalId,
    { durationPreference: "notLogged", durationSeconds: null },
    "2026-08-02T09:10:00.000Z"
  );

  const harness = createHarness(initialState);
  let resetTransformInvocations = 0;
  const resetCompletion = harness.runtime.applyAcknowledgedMutation((state) => {
    resetTransformInvocations += 1;
    return completeTodayResetState(
      state,
      "2026-08-02",
      "2026-08-02T10:00:00.000Z"
    );
  });
  await waitForWriteAttempts(harness.client, 1);

  harness.runtime.beginDeletion();
  harness.client.failNextRemove();
  const deletion = harness.coordinator.deleteAll();
  harness.client.succeedWrite(0);
  const resetRetryToken = requireRetryableFailure(
    await resetCompletion,
    "4. Deletion must retain the queued Reset acknowledgement until deletion settles."
  );
  assert(
    harness.runtime.getRetryEntryCount() === 1,
    "4. Deletion must retain the queued Reset acknowledgement metadata while it owns storage."
  );

  let deletionFailed = false;
  try {
    await deletion;
  } catch {
    deletionFailed = true;
  }
  assert(deletionFailed, "4. The synthetic deletion must fail deterministically.");
  harness.runtime.failDeletion();

  const recoveredAcknowledgement =
    harness.runtime.retryPersistence(resetRetryToken);
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(
    await recoveredAcknowledgement,
    "4. Failed deletion recovery must resolve the retained Reset token from the canonical recovery write."
  );
  await waitForCompletedWrites(harness.client, 2);
  await flushMicrotasks();
  const recoveredState = readStoredState(harness.client);
  assert(
    resetTransformInvocations === 1 &&
      recoveredState.tenDayReset.completedDates.join(",") === "2026-08-02" &&
      recoveredState.checkIns.records.some((record) => record.id === checkInId) &&
      recoveredState.pause.records.some((record) => record.id === pauseId) &&
      recoveredState.arousalControl.logs.some((record) => record.id === arousalId),
    "4. Failed deletion recovery must durably requeue one canonical Reset completion and preserve representative record IDs without rerunning transforms."
  );
}

async function verifyFailedDeletionPreservesRetryToken() {
  const harness = createHarness();
  let transformCalls = 0;
  const mutation = harness.runtime.applyAcknowledgedMutation((state) => {
    transformCalls += 1;
    return stateWithDateOffset(state, 30);
  });
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await mutation,
    "4. The canonical mutation must have retry metadata before deletion begins."
  );
  harness.client.prime(
    BLOOM_STATE_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      savedAt: "2026-08-02T12:00:00.000Z",
      state: createDefaultBloomState()
    })
  );

  harness.runtime.beginDeletion();
  harness.client.failNextRemove();
  let deletionFailed = false;
  try {
    await harness.coordinator.deleteAll();
  } catch {
    deletionFailed = true;
  }
  assert(deletionFailed, "4. Retry-token recovery requires a failed deletion.");
  harness.runtime.failDeletion();

  const retry = harness.runtime.retryPersistence(retryToken);
  const duplicateRetry = harness.runtime.retryPersistence(retryToken);
  assert(
    retry === duplicateRetry,
    "4. A restored retry token must share the automatic canonical recovery write."
  );
  await waitForWriteAttempts(harness.client, 2);
  assert(
    harness.client.writeAttempts.length === 2,
    "4. Retrying after failed deletion must not enqueue behind the automatic recovery write."
  );
  harness.client.succeedWrite(1);
  assertPersisted(
    await retry,
    "4. The original retry token must recover after deletion failure."
  );
  assert(
    transformCalls === 1 &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 30 &&
      readStoredState(harness.client).debug.dateOffsetDays === 30,
    "4. Failed deletion must restore the exact token/state without rerunning its transform."
  );
}

async function verifyFailedDeletionPreservesInFlightRetryToken() {
  const harness = createHarness();
  let transformCalls = 0;
  const mutation = harness.runtime.applyAcknowledgedMutation((state) => {
    transformCalls += 1;
    return stateWithDateOffset(state, 31);
  });
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await mutation,
    "4. The deletion-race fixture must begin with an exact retry token."
  );

  const inFlightRetry = harness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(harness.client, 2);
  harness.runtime.beginDeletion();
  harness.client.failNextRemove();
  const deletion = harness.coordinator.deleteAll();
  harness.client.succeedWrite(1);

  const interruptedRetry = await inFlightRetry;
  assert(
    !interruptedRetry.ok &&
      interruptedRetry.accepted &&
      interruptedRetry.reason === "deletionInProgress" &&
      harness.runtime.getRetryEntryCount() === 1,
    "4. Deletion may interrupt an in-flight retry, but it must retain the exact token until deletion succeeds."
  );

  let deletionFailed = false;
  try {
    await deletion;
  } catch {
    deletionFailed = true;
  }
  assert(
    deletionFailed,
    "4. The in-flight retry recovery fixture requires deletion failure."
  );
  harness.runtime.failDeletion();

  const restoredRetry = harness.runtime.retryPersistence(retryToken);
  const duplicateRetry = harness.runtime.retryPersistence(retryToken);
  assert(
    restoredRetry === duplicateRetry,
    "4. The retained token must share the automatic recovery write after deletion fails."
  );
  await waitForWriteAttempts(harness.client, 3);
  assert(
    harness.client.writeAttempts.length === 3,
    "4. Restoring an interrupted token must not enqueue a duplicate recovery snapshot."
  );
  harness.client.succeedWrite(2);
  assertPersisted(
    await restoredRetry,
    "4. The token interrupted by deletion must remain usable after deletion fails."
  );
  assert(
    transformCalls === 1 &&
      harness.runtime.getRetryEntryCount() === 0 &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 31 &&
      readStoredState(harness.client).debug.dateOffsetDays === 31,
    "4. Failed deletion must recover the exact in-flight retry state without rerunning its transformation."
  );
}

async function verifyFailedDeletionPreservesPendingAcknowledgementToken() {
  const harness = createHarness();
  let transformCalls = 0;
  const mutation = harness.runtime.applyAcknowledgedMutation((state) => {
    transformCalls += 1;
    return stateWithDateOffset(state, 32);
  });
  await waitForWriteAttempts(harness.client, 1);

  harness.runtime.beginDeletion();
  harness.client.removeThenFailNext();
  const deletion = harness.coordinator.deleteAll();
  harness.client.succeedWrite(0);
  const retryToken = requireRetryableFailure(
    await mutation,
    "4. A pending acknowledgement interrupted by deletion must retain its exact retry token."
  );

  let deletionFailed = false;
  try {
    await deletion;
  } catch {
    deletionFailed = true;
  }
  assert(
    deletionFailed &&
      harness.client.peek(BLOOM_STATE_STORAGE_KEY) === null &&
      harness.runtime.getRetryEntryCount() === 1,
    "4. The recovery fixture must remove the active payload before reporting deletion failure while retaining acknowledgement metadata."
  );
  harness.runtime.failDeletion();

  await waitForWriteAttempts(harness.client, 2);
  harness.client.failWrite(1);
  await flushMicrotasks();

  const retry = harness.runtime.retryPersistence(retryToken);
  const duplicateRetry = harness.runtime.retryPersistence(retryToken);
  assert(
    retry === duplicateRetry,
    "4. Explicit recovery after an automatic recovery failure must share one exact retry attempt."
  );
  await waitForWriteAttempts(harness.client, 3);
  harness.client.succeedWrite(2);
  assertPersisted(
    await retry,
    "4. The original pending acknowledgement token must recover after deletion and automatic recovery both fail."
  );
  assert(
    transformCalls === 1 &&
      harness.client.writeAttempts.length === 3 &&
      harness.runtime.getRetryEntryCount() === 0 &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 32 &&
      readStoredState(harness.client).debug.dateOffsetDays === 32,
    "4. Explicit failed-deletion recovery must persist the original accepted snapshot without rerunning its transformation."
  );
}

async function verifyFailedDeletionRecoveryUnknownRemainsRetryable() {
  const harness = createHarness(createDefaultBloomState(), 5);
  let transformCalls = 0;
  const mutation = harness.runtime.applyAcknowledgedMutation((state) => {
    transformCalls += 1;
    return stateWithDateOffset(state, 35);
  });
  await waitForWriteAttempts(harness.client, 1);

  harness.runtime.beginDeletion();
  harness.client.failNextRemove();
  const deletion = harness.coordinator.deleteAll();
  harness.client.succeedWrite(0);
  const retryToken = requireRetryableFailure(
    await mutation,
    "4/5. Failed-deletion recovery timeout requires the original pending acknowledgement token."
  );

  let deletionFailed = false;
  try {
    await deletion;
  } catch {
    deletionFailed = true;
  }
  assert(
    deletionFailed,
    "4/5. The recovery-timeout fixture requires deletion failure."
  );
  harness.runtime.failDeletion();

  await waitForWriteAttempts(harness.client, 2);
  const unknownRecovery = await harness.runtime.retryPersistence(retryToken);
  assert(
    !unknownRecovery.ok &&
      unknownRecovery.accepted &&
      unknownRecovery.retryable &&
      unknownRecovery.retryToken === retryToken &&
      unknownRecovery.reason === "persistenceUnknown" &&
      harness.client.writeAttempts.length === 2 &&
      !harness.runtime.isWritesBlocked(),
    "4/5. A hung automatic recovery write must settle the UI wait as unknown, preserve the exact token, enqueue no duplicate, and leave safe app actions unblocked."
  );

  harness.client.succeedWrite(1);
  await waitForCompletedWrites(harness.client, 2);
  await flushMicrotasks();
  assertPersisted(
    await harness.runtime.retryPersistence(retryToken),
    "4/5. Late automatic-recovery success must remain observable through the original token."
  );
  assert(
    transformCalls === 1 &&
      harness.client.writeAttempts.length === 2 &&
      harness.runtime.getDurableState().debug.dateOffsetDays === 35 &&
      readStoredState(harness.client).debug.dateOffsetDays === 35,
    "4/5. Late failed-deletion recovery must persist the original snapshot without transform replay or a duplicate write."
  );
}

async function verifyHydrationErrorDeletionFailurePreservesStorage() {
  const client = new ControlledStorageClient();
  const preservedPayload = "{future-or-corrupt-payload";
  client.prime(BLOOM_STATE_STORAGE_KEY, preservedPayload);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const runtime = createBloomLocalStateMutationRuntime({
    initialState: createDefaultBloomState(),
    persistState: coordinator.enqueueWrite
  });
  const hydrationOperation = runtime.beginHydration();
  runtime.failHydration(hydrationOperation);
  runtime.beginDeletion();
  runtime.failDeletion();
  await flushMicrotasks();
  assert(
    client.writeAttempts.length === 0 &&
      client.peek(BLOOM_STATE_STORAGE_KEY) === preservedPayload,
    "4. Failed deletion from hydration error must never overwrite preserved corrupt/future storage with default memory state."
  );
}

async function verifyDeletionWatchdog() {
  let resolveDeletion: (() => void) | undefined;
  let deletionOperations = 0;
  const deletionOperation = new Promise<void>((resolve) => {
    deletionOperations += 1;
    resolveDeletion = resolve;
  });
  let lateSuccessNotifications = 0;
  let lateFailureNotifications = 0;
  observeBloomLocalDataDeletionSettlement(
    deletionOperation,
    () => {
      lateSuccessNotifications += 1;
    },
    () => {
      lateFailureNotifications += 1;
    }
  );

  let pendingError: unknown;
  try {
    await waitForBloomLocalDataDeletion(deletionOperation, 5);
  } catch (error) {
    pendingError = error;
  }
  assert(
    isBloomLocalDataDeletionPendingError(pendingError) &&
      deletionOperations === 1,
    "5. A hung deletion must leave bounded UX with a distinct truthful pending result."
  );

  const laterWatcher = waitForBloomLocalDataDeletion(deletionOperation, 50);
  resolveDeletion?.();
  await laterWatcher;
  await flushMicrotasks();
  assert(
    deletionOperations === 1 &&
      lateSuccessNotifications === 1 &&
      lateFailureNotifications === 0,
    "5. Watching a still-running deletion again must not duplicate it, and its late success must remain observable for lifecycle completion."
  );
}

async function verifyHydrationWatchdog() {
  let resolveHydration: (() => void) | undefined;
  let hydrationOperations = 0;
  const hydrationOperation = new Promise<void>((resolve) => {
    hydrationOperations += 1;
    resolveHydration = resolve;
  });

  let pendingError: unknown;
  try {
    await waitForBloomLocalStateHydration(hydrationOperation, 5);
  } catch (error) {
    pendingError = error;
  }
  assert(
    isBloomLocalStateHydrationPendingError(pendingError) &&
      hydrationOperations === 1,
    "5. A hung hydration must become a bounded, distinct pending result."
  );

  const laterWatcher = waitForBloomLocalStateHydration(
    hydrationOperation,
    50
  );
  resolveHydration?.();
  await laterWatcher;
  assert(
    hydrationOperations === 1,
    "5. Rewatching a hung hydration must retain the same underlying load operation."
  );
}

async function verifyDeletionHydrationTimeoutRecovery() {
  const createTimedOutDeletionAndHydrationFixture = async (
    preservedOffset: number
  ) => {
    const client = new ControlledStorageClient();
    const preservedState = stateWithDateOffset(
      createDefaultBloomState(),
      preservedOffset
    );
    const preservedPayload = JSON.stringify({
      version: 2,
      savedAt: fixedNow().toISOString(),
      state: preservedState
    });
    client.prime(BLOOM_STATE_STORAGE_KEY, preservedPayload);
    const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
    const runtime = createBloomLocalStateMutationRuntime({
      initialState: createDefaultBloomState(),
      persistState: coordinator.enqueueWrite
    });
    const initialHydrationOperation = runtime.beginHydration();
    client.failNextGetItem();
    let initialHydrationFailed = false;
    try {
      await coordinator.load();
    } catch {
      initialHydrationFailed = true;
    }
    assert(
      initialHydrationFailed &&
        runtime.failHydration(initialHydrationOperation) &&
        runtime.getHydrationStatus() === "error",
      "3/4. The cross-system fixture must begin in a recoverable hydration error without changing preserved storage."
    );

    client.hangNextGetAllKeys();
    runtime.beginDeletion();
    const deletion = coordinator.deleteAll();
    const providerDeletion = deletion.then(
      () => {
        runtime.completeDeletion(createDefaultBloomState());
      },
      (error: unknown) => {
        runtime.failDeletion();
        throw error;
      }
    );
    void providerDeletion.catch(() => undefined);
    await waitForCondition(
      () => client.getAllKeysCalls === 1,
      "Timed out waiting for the synthetic hung deletion."
    );

    let deletionPendingError: unknown;
    try {
      await waitForBloomLocalDataDeletion(deletion, 5);
    } catch (error) {
      deletionPendingError = error;
    }
    assert(
      isBloomLocalDataDeletionPendingError(deletionPendingError) &&
        runtime.isWritesBlocked() &&
        coordinator.deleteAll() === deletion,
      "3/4. A deletion watchdog timeout must keep the exact deletion in flight and retain its write block."
    );

    const queuedHydrationRuntimeOperation = runtime.beginHydration();
    const queuedLoad = coordinator.load();
    let hydrationRuntimeSettlement: boolean | null = null;
    let hydrationOperation: Promise<void>;
    hydrationOperation = queuedLoad.then(
      (loadResult) => {
        if (loadResult.status !== "success") {
          hydrationRuntimeSettlement = runtime.failHydration(
            queuedHydrationRuntimeOperation
          );
          return;
        }

        hydrationRuntimeSettlement = runtime.completeHydration(
          queuedHydrationRuntimeOperation,
          loadResult.state,
          {
            needsPersist: loadResult.needsPersist,
            persistenceError: loadResult.persistenceError
          }
        );
      },
      () => {
        hydrationRuntimeSettlement = runtime.failHydration(
          queuedHydrationRuntimeOperation
        );
      }
    );

    let hydrationPendingError: unknown;
    try {
      await waitForBloomLocalStateHydration(hydrationOperation, 5);
    } catch (error) {
      hydrationPendingError = error;
    }
    const timeoutRecovery =
      getBloomLocalStateHydrationTimeoutRecovery(hydrationPendingError, {
        isMounted: true,
        isCurrentOperation: true
      });
    assert(
      timeoutRecovery !== null,
      "3/4. The production hydration recovery selector must accept the current mounted watchdog timeout."
    );
    assert(
      runtime.failHydration(queuedHydrationRuntimeOperation) &&
        timeoutRecovery.hydrationStatus === "error" &&
        timeoutRecovery.hydrationError !== null &&
        runtime.getHydrationStatus() === "error" &&
        runtime.isWritesBlocked() &&
        coordinator.deleteAll() === deletion,
      "3/4. Deletion hang -> deletion watchdog -> hydration retry -> hydration watchdog must end in explicit recoverable error, never loading, without unblocking or duplicating deletion."
    );

    return {
      client,
      runtime,
      providerDeletion,
      hydrationOperation,
      preservedPayload,
      getHydrationRuntimeSettlement: () => hydrationRuntimeSettlement
    };
  };

  const successFixture =
    await createTimedOutDeletionAndHydrationFixture(41);
  successFixture.client.hangNextGetItem();
  successFixture.client.succeedHangingGetAllKeys();
  await successFixture.providerDeletion;
  await waitForCondition(
    () => successFixture.client.getItemCalls >= 2,
    "Timed out waiting for stale hydration to remain live after deletion success."
  );
  assert(
    successFixture.getHydrationRuntimeSettlement() === null &&
      successFixture.runtime.getHydrationStatus() === "ready" &&
      successFixture.runtime.getState().debug.dateOffsetDays === 0 &&
      successFixture.runtime.getDurableState().debug.dateOffsetDays === 0 &&
      successFixture.client.peek(BLOOM_STATE_STORAGE_KEY) === null &&
      successFixture.runtime.isWritesBlocked(),
    "3/4. Late deletion success must install authoritative post-delete defaults while the queued hydration remains physically live and writes stay blocked for reset navigation."
  );

  successFixture.runtime.finishResetNavigation();
  let postResetMutationCalls = 0;
  const postResetMutation =
    successFixture.runtime.applyAcknowledgedMutation((state) => {
      postResetMutationCalls += 1;
      return stateWithDateOffset(state, 77);
    });
  await flushMicrotasks();
  assert(
    !successFixture.runtime.isWritesBlocked() &&
      successFixture.runtime.getState().debug.dateOffsetDays === 77 &&
      successFixture.runtime.getDurableState().debug.dateOffsetDays === 0 &&
      successFixture.client.writeAttempts.length === 0 &&
      successFixture.getHydrationRuntimeSettlement() === null,
    "3/4. Reset navigation must permit a new mutation while the stale queued hydration is still alive, with its write queued behind that load."
  );

  successFixture.client.succeedHangingGetItem();
  await successFixture.hydrationOperation;
  assert(
    successFixture.getHydrationRuntimeSettlement() === false &&
      successFixture.runtime.getHydrationStatus() === "ready" &&
      successFixture.runtime.getState().debug.dateOffsetDays === 77 &&
      successFixture.runtime.getDurableState().debug.dateOffsetDays === 0,
    "3/4. A hydration begun during deletion must lose runtime ownership when deletion commits and must not overwrite a newer post-reset mutation when its empty load settles."
  );

  await waitForWriteAttempts(successFixture.client, 1);
  assert(
    readAttemptState(successFixture.client, 0).debug.dateOffsetDays === 77,
    "3/4. The post-reset write queued behind stale hydration must retain the exact new accepted snapshot."
  );
  successFixture.client.succeedWrite(0);
  assertPersisted(
    await postResetMutation,
    "3/4. Stale hydration settlement must not cause the newer post-reset acknowledgement to report superseded."
  );
  assert(
    postResetMutationCalls === 1 &&
      successFixture.runtime.getState().debug.dateOffsetDays === 77 &&
      successFixture.runtime.getDurableState().debug.dateOffsetDays === 77 &&
      readStoredState(successFixture.client).debug.dateOffsetDays === 77,
    "3/4. Post-reset accepted memory, durable projection, and persisted storage must converge after stale hydration is rejected."
  );

  const failureFixture =
    await createTimedOutDeletionAndHydrationFixture(42);
  failureFixture.client.failHangingGetAllKeys();
  const [deletionSettlement, hydrationSettlement] =
    await Promise.allSettled([
      failureFixture.providerDeletion,
      failureFixture.hydrationOperation
    ]);
  assert(
    deletionSettlement.status === "rejected" &&
      hydrationSettlement.status === "fulfilled" &&
      failureFixture.getHydrationRuntimeSettlement() === true &&
      failureFixture.runtime.getHydrationStatus() === "error" &&
      !failureFixture.runtime.isWritesBlocked() &&
      failureFixture.client.peek(BLOOM_STATE_STORAGE_KEY) ===
        failureFixture.preservedPayload,
    "3/4. Late deletion failure must preserve the original payload, release deletion ownership, and leave its still-current hydration explicitly recoverable rather than loading."
  );

  const recoveryHydrationOperation =
    failureFixture.runtime.beginHydration();
  const recoveryLoad = await createBloomStatePersistenceCoordinator(
    failureFixture.client,
    fixedNow
  ).load();
  assert(
    recoveryLoad.status === "success" &&
      failureFixture.runtime.completeHydration(
        recoveryHydrationOperation,
        recoveryLoad.state,
        {
          needsPersist: recoveryLoad.needsPersist,
          persistenceError: recoveryLoad.persistenceError
        }
      ) &&
      failureFixture.runtime.getHydrationStatus() === "ready" &&
      failureFixture.runtime.getState().debug.dateOffsetDays === 42 &&
      failureFixture.runtime.getDurableState().debug.dateOffsetDays === 42 &&
      failureFixture.client.peek(BLOOM_STATE_STORAGE_KEY) ===
        failureFixture.preservedPayload,
    "3/4. After late deletion failure, a real hydration retry must load the preserved payload and return runtime state to ready."
  );
}

async function verifyHydrationAndDeletionMutationBlocks() {
  const client = new ControlledStorageClient();
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const runtime = createBloomLocalStateMutationRuntime({
    initialState: createDefaultBloomState(),
    persistState: coordinator.enqueueWrite
  });
  const hydrationOperation = runtime.beginHydration();
  let acknowledgedTransformCalls = 0;

  const queuedSystemMutation = runtime.applyMutation((state) =>
    stateWithDateOffset(state, state.debug.dateOffsetDays + 1)
  );
  const blockedAcknowledgement = await runtime.applyAcknowledgedMutation(
    (state) => {
      acknowledgedTransformCalls += 1;
      return stateWithDateOffset(state, 20);
    }
  );
  assert(
    queuedSystemMutation.ok &&
      runtime.getPendingMutationCount() === 1 &&
      !blockedAcknowledgement.ok &&
      blockedAcknowledgement.reason === "hydrationPending" &&
      acknowledgedTransformCalls === 0,
    "14. Loading must retain the existing unacknowledged queue while blocking Saved acknowledgements."
  );

  const loadedState = stateWithDateOffset(createDefaultBloomState(), 12);
  runtime.completeHydration(hydrationOperation, loadedState, {
    needsPersist: false,
    persistenceError: null
  });
  await waitForWriteAttempts(client, 1);
  assert(
    runtime.getState().debug.dateOffsetDays === 13 &&
      readAttemptState(client, 0).debug.dateOffsetDays === 13,
    "14. Hydration must apply queued system mutations in order and persist the combined snapshot."
  );
  client.succeedWrite(0);
  await waitForCompletedWrites(client, 1);

  const failedHydrationRuntime = createBloomLocalStateMutationRuntime({
    initialState: createDefaultBloomState(),
    persistState: createBloomStatePersistenceCoordinator(
      new ControlledStorageClient(),
      fixedNow
    ).enqueueWrite
  });
  const failedHydrationOperation =
    failedHydrationRuntime.beginHydration();
  let discardedSystemCalls = 0;
  failedHydrationRuntime.applyMutation((state) => {
    discardedSystemCalls += 1;
    return stateWithDateOffset(state, 30);
  });
  failedHydrationRuntime.failHydration(failedHydrationOperation);
  const unavailable = await failedHydrationRuntime.applyAcknowledgedMutation(
    (state) => stateWithDateOffset(state, 31)
  );
  assert(
    !unavailable.ok &&
      unavailable.reason === "stateUnavailable" &&
      failedHydrationRuntime.getPendingMutationCount() === 0 &&
      discardedSystemCalls === 0,
    "14. Hydration failure must discard queued mutations and block acknowledged writes."
  );
}

async function verifyWebStorageUnavailableResult() {
  const fallback = new FallbackSpyStorageClient();
  const webClient = createWebStorageClient({
    resolveEnvironment: () => ({ status: "unavailable" }),
    nonBrowserFallback: fallback
  });
  const coordinator = createBloomStatePersistenceCoordinator(webClient, fixedNow);
  const runtime = createBloomLocalStateMutationRuntime({
    initialState: createDefaultBloomState(),
    initialHydrationStatus: "ready",
    persistState: coordinator.enqueueWrite
  });

  const result = await runtime.applyAcknowledgedMutation((state) =>
    stateWithDateOffset(state, 14)
  );
  assert(
    !result.ok &&
      result.accepted &&
      result.retryable &&
      result.reason === "storageUnavailable" &&
      runtime.getState().debug.dateOffsetDays === 14,
    "3/14. Web storage unavailability must preserve memory and return a retryable storageUnavailable result."
  );
  assert(
    fallback.writeAttempts === 0,
    "3. An unavailable active web adapter must never hide failure in the memory fallback."
  );
}

async function verifyUnacknowledgedSystemPersistence() {
  const harness = createHarness();
  const draft: PauseSessionDraft = {
    id: "pause-system-draft",
    startedAt: "2026-08-02T11:00:00.000Z",
    phase: "checkIn",
    triggers: [],
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  };
  const result = harness.runtime.applyMutation((state) =>
    startPauseSessionState(state, draft)
  );
  assert(result.ok, "16. A valid unacknowledged system mutation must remain accepted.");
  await waitForWriteAttempts(harness.client, 1);
  assert(
    harness.client.writeAttempts.length === 1,
    "16. An unacknowledged mutation must schedule exactly one write through the shared path."
  );
  harness.client.succeedWrite(0);
  await waitForCompletedWrites(harness.client, 1);
  const reloaded = await loadBloomLocalState(harness.client, fixedNow);
  assert(
    reloaded.status === "success" &&
      reloaded.state.pause.activeSession?.id === draft.id,
    "16. Existing unacknowledged/system state must still persist and hydrate through production modules."
  );
}

async function verifyDomainFailureRetry(
  label: string,
  initialState: BloomLocalState,
  mutation: (state: BloomLocalState) => BloomLocalState,
  assertState: (state: BloomLocalState) => void
) {
  const harness = createHarness(initialState);
  let mutationInvocations = 0;
  const acknowledgement = harness.runtime.applyAcknowledgedMutation(
    (state) => {
      mutationInvocations += 1;
      return mutation(state);
    }
  );
  await waitForWriteAttempts(harness.client, 1);
  harness.client.failWrite(0);
  const retryToken = requireRetryableFailure(
    await acknowledgement,
    `${label} initial write must fail retryably.`
  );
  assertState(harness.runtime.getState());

  const retry = harness.runtime.retryPersistence(retryToken);
  await waitForWriteAttempts(harness.client, 2);
  harness.client.succeedWrite(1);
  assertPersisted(await retry, `${label} retry must resolve persisted success.`);
  assert(
    mutationInvocations === 1,
    `${label} retry must not repeat the production domain mutation.`
  );
  const persistedState = readStoredState(harness.client);
  assertState(persistedState);
}

function createHarness(
  initialState = createDefaultBloomState(),
  acknowledgementTimeoutMs?: number
) {
  const client = new ControlledStorageClient();
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const persistenceErrors: Array<string | null> = [];
  const acceptedStates: BloomLocalState[] = [];
  const durableStates: BloomLocalState[] = [];
  const projection = createBloomLocalStateProjection(initialState);
  let previousProjection = projection.getSnapshot();
  projection.subscribe(() => {
    const nextProjection = projection.getSnapshot();

    if (nextProjection.acceptedState !== previousProjection.acceptedState) {
      acceptedStates.push(nextProjection.acceptedState);
    }
    if (nextProjection.durableState !== previousProjection.durableState) {
      durableStates.push(nextProjection.durableState);
    }
    previousProjection = nextProjection;
  });
  const runtime = createBloomLocalStateMutationRuntime({
    initialState,
    initialHydrationStatus: "ready",
    persistState: coordinator.enqueueWrite,
    ...(acknowledgementTimeoutMs === undefined
      ? {}
      : { acknowledgementTimeoutMs }),
    onStateChange(state) {
      projection.setAcceptedState(state);
    },
    onDurableStateChange(state) {
      projection.setDurableState(state);
    },
    onPersistenceErrorChange(message) {
      persistenceErrors.push(message);
      projection.setPersistenceMessage(message);
    }
  });
  let acknowledgedActionMutationCalls = 0;
  const actions = createBloomLocalStateAcknowledgedActions({
    applyAcknowledgedMutation(mutation) {
      acknowledgedActionMutationCalls += 1;
      return runtime.applyAcknowledgedMutation(mutation);
    },
    rejectAcknowledgedMutation: runtime.rejectAcknowledgedMutation,
    now: fixedNow,
    random: () => 0
  });

  return {
    actions,
    client,
    coordinator,
    runtime,
    persistenceErrors,
    acceptedStates,
    durableStates,
    projection,
    getAcknowledgedActionMutationCalls: () =>
      acknowledgedActionMutationCalls
  };
}

function stateWithDateOffset(
  state: BloomLocalState,
  dateOffsetDays: number
): BloomLocalState {
  return {
    ...state,
    debug: {
      ...state.debug,
      dateOffsetDays
    }
  };
}

function requireRetryableFailure(
  result: BloomPersistedMutationResult,
  message: string
): BloomPersistenceRetryToken {
  assert(
    !result.ok && result.accepted && result.retryable,
    message
  );
  return result.retryToken;
}

function assertPersisted(
  result: BloomPersistedMutationResult,
  message: string
): asserts result is Extract<BloomPersistedMutationResult, { ok: true }> {
  assert(
    result.ok && result.accepted && result.persisted,
    message
  );
}

function assertInvalidatedRetry(
  result: BloomPersistedMutationResult,
  message: string
) {
  assert(
    !result.ok &&
      result.accepted &&
      !result.retryable &&
      result.reason === "persistenceInvalidated",
    message
  );
}

function readAttemptState(
  client: ControlledStorageClient,
  attemptIndex: number
): BloomLocalState {
  const attempt = client.writeAttempts[attemptIndex];
  assert(attempt !== undefined, `Missing synthetic write attempt ${attemptIndex}.`);
  return parseEnvelopeState(attempt.value);
}

function readStoredState(client: ControlledStorageClient): BloomLocalState {
  const payload = client.peek(BLOOM_STATE_STORAGE_KEY);
  assert(payload !== null, "Expected a persisted Bloom envelope.");
  return parseEnvelopeState(payload);
}

function parseEnvelopeState(payload: string): BloomLocalState {
  const envelope = readPersistedEnvelope(JSON.parse(payload) as unknown);
  assert(envelope.status === "current", "Expected a current Bloom v2 envelope.");
  const normalized = validateAndNormalizeBloomState(envelope.envelope.state);
  assert(normalized.success, "Expected the synthetic envelope state to validate.");
  return normalized.state;
}

async function waitForWriteAttempts(
  client: ControlledStorageClient,
  count: number
) {
  await waitForCondition(
    () => client.writeAttempts.length >= count,
    `Timed out waiting for ${count} synthetic storage write attempt(s).`
  );
}

async function waitForCompletedWrites(
  client: ControlledStorageClient,
  count: number
) {
  await waitForCondition(
    () => client.completedWrites.length >= count,
    `Timed out waiting for ${count} completed synthetic storage write(s).`
  );
}

async function waitForCondition(
  condition: () => boolean,
  failureMessage: string
) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(failureMessage);
}

async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type ControlledWriteAttempt = {
  key: string;
  value: string;
  succeed: () => void;
  fail: () => void;
};

class ControlledStorageClient implements StorageClient {
  private readonly values = new Map<string, string>();
  private shouldFailNextRemove = false;
  private shouldRemoveThenFailNextRemove = false;
  private shouldFailNextGetItem = false;
  private getItemGate: ControlledOperationGate | null = null;
  private getAllKeysGate: ControlledOperationGate | null = null;
  getItemCalls = 0;
  getAllKeysCalls = 0;
  readonly writeAttempts: ControlledWriteAttempt[] = [];
  readonly completedWrites: string[] = [];

  async getItem(key: string): Promise<string | null> {
    this.getItemCalls += 1;

    if (this.shouldFailNextGetItem) {
      this.shouldFailNextGetItem = false;
      throw new Error("Synthetic storage read failure.");
    }

    const gate = this.getItemGate;

    if (gate !== null) {
      try {
        await gate.promise;
      } finally {
        if (this.getItemGate === gate) {
          this.getItemGate = null;
        }
      }
    }

    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    let resolveWrite: (() => void) | undefined;
    let rejectWrite: (() => void) | undefined;
    const gate = new Promise<void>((resolve, reject) => {
      resolveWrite = resolve;
      rejectWrite = () => reject(new Error("Synthetic storage write failure."));
    });
    const attempt: ControlledWriteAttempt = {
      key,
      value,
      succeed: () => resolveWrite?.(),
      fail: () => rejectWrite?.()
    };
    this.writeAttempts.push(attempt);
    await gate;
    this.values.set(key, value);
    this.completedWrites.push(value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.shouldRemoveThenFailNextRemove) {
      this.shouldRemoveThenFailNextRemove = false;
      this.values.delete(key);
      throw new Error("Synthetic post-removal deletion failure.");
    }

    if (this.shouldFailNextRemove) {
      this.shouldFailNextRemove = false;
      throw new Error("Synthetic storage deletion failure.");
    }

    this.values.delete(key);
  }

  async getAllKeys(): Promise<readonly string[]> {
    this.getAllKeysCalls += 1;
    const gate = this.getAllKeysGate;

    if (gate !== null) {
      try {
        await gate.promise;
      } finally {
        if (this.getAllKeysGate === gate) {
          this.getAllKeysGate = null;
        }
      }
    }

    return Array.from(this.values.keys());
  }

  succeedWrite(index: number) {
    const attempt = this.writeAttempts[index];
    assert(attempt !== undefined, `Cannot succeed missing write attempt ${index}.`);
    attempt.succeed();
  }

  failWrite(index: number) {
    const attempt = this.writeAttempts[index];
    assert(attempt !== undefined, `Cannot fail missing write attempt ${index}.`);
    attempt.fail();
  }

  failNextRemove() {
    this.shouldFailNextRemove = true;
  }

  removeThenFailNext() {
    this.shouldRemoveThenFailNextRemove = true;
  }

  failNextGetItem() {
    this.shouldFailNextGetItem = true;
  }

  hangNextGetItem() {
    assert(
      this.getItemGate === null,
      "A synthetic getItem operation is already hanging."
    );
    this.getItemGate = createControlledOperationGate();
  }

  succeedHangingGetItem() {
    assert(
      this.getItemGate !== null,
      "Cannot succeed a missing synthetic getItem operation."
    );
    this.getItemGate.succeed();
  }

  failHangingGetItem() {
    assert(
      this.getItemGate !== null,
      "Cannot fail a missing synthetic getItem operation."
    );
    this.getItemGate.fail();
  }

  hangNextGetAllKeys() {
    assert(
      this.getAllKeysGate === null,
      "A synthetic getAllKeys operation is already hanging."
    );
    this.getAllKeysGate = createControlledOperationGate();
  }

  succeedHangingGetAllKeys() {
    assert(
      this.getAllKeysGate !== null,
      "Cannot succeed a missing synthetic getAllKeys operation."
    );
    this.getAllKeysGate.succeed();
  }

  failHangingGetAllKeys() {
    assert(
      this.getAllKeysGate !== null,
      "Cannot fail a missing synthetic getAllKeys operation."
    );
    this.getAllKeysGate.fail();
  }

  peek(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  prime(key: string, value: string) {
    this.values.set(key, value);
  }
}

type ControlledOperationGate = {
  promise: Promise<void>;
  succeed: () => void;
  fail: () => void;
};

function createControlledOperationGate(): ControlledOperationGate {
  let resolveOperation: (() => void) | undefined;
  let rejectOperation: (() => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = () => reject(new Error("Synthetic storage operation failure."));
  });

  return {
    promise,
    succeed: () => resolveOperation?.(),
    fail: () => rejectOperation?.()
  };
}

class FallbackSpyStorageClient implements StorageClient {
  writeAttempts = 0;

  async getItem(): Promise<string | null> {
    return null;
  }

  async setItem(): Promise<void> {
    this.writeAttempts += 1;
  }

  async removeItem(): Promise<void> {}

  async getAllKeys(): Promise<readonly string[]> {
    return [];
  }
}

void verifyPersistenceAcknowledgement().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown verification failure.";
  console.error(
    `Bloom persistence acknowledgement verification failed: ${message}`
  );
  process.exitCode = 1;
});
