import {
  createDefaultBloomState,
  type BloomLocalState,
  type QuizResult
} from "../src/storage/bloomState";
import {
  BLOOM_CORRUPT_BACKUP_PREFIX,
  BLOOM_LEGACY_STATE_STORAGE_KEYS,
  BLOOM_STATE_STORAGE_KEY,
  createBloomStatePersistenceCoordinator,
  createBloomStateWriteQueue,
  isBloomStateLifecycleInvalidatedError,
  loadBloomLocalState,
  persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import {
  BLOOM_PERSISTENCE_VERSION,
  isValidBloomDateKey,
  isValidBloomIsoTimestamp,
  readPersistedEnvelope,
  validateAndNormalizeBloomState
} from "../src/storage/bloomStateSchema";
import {
  createMemoryStorageClient,
  createWebStorageClient,
  isStorageUnavailableError,
  resolveWebStorageEnvironment,
  type StorageClient,
  type WebStorage,
  type WebStorageWindow
} from "../src/storage/storageAdapters";
import { verifyBloomProductPersistence } from "./verify-bloom-product-persistence";
import { verifyBloomOnboardingPersistence } from "./verify-bloom-onboarding-persistence";

const fixedNow = () => new Date("2026-07-22T10:00:00.000Z");

async function verifyBloomPersistence() {
  await verifyAvailableWebStorage();
  await verifyUnavailableWebStorage();
  await verifyWebStorageMethodFailure();
  await verifyExplicitMemoryStorage();
  await verifyNonBrowserMemoryFallback();
  verifyStrictDateKeys();
  verifyStrictIsoTimestamps();
  verifyDateValidationIntegration();
  await verifyEmptyState();
  await verifyCurrentEnvelope();
  await verifyPartialCurrentNormalization();
  await verifyPartialLegacyMigration();
  await verifyPlanDerivation();
  await verifyFeatureStatePreservation();
  await verifyCorruptPayloadPreservation();
  await verifyMalformedNestedStatePreservation();
  await verifyUnsupportedVersionPreservation();
  await verifyFailedMigrationKeepsLegacyPayload();
  await verifyWriteOrdering();
  await verifyQueuedSnapshotCapture();
  await verifyScopedDeletion();
  await verifyWriteDeleteRace();
  await verifyDeletionInvalidatesDelayedLoad();
  await verifyDeletionDrainsDelayedMigration();
  await verifyDeletionDrainsDelayedLegacyCleanup();
  await verifyDeletionDrainsDelayedQuarantine();
  await verifyDeletionDrainsExistingQuarantineLookup();
  await verifyRemountLoadWaitsForDelayedEnumeration();
  await verifyRemountLoadWaitsForDeletion();
  await verifyConcurrentRemountLoadsStaySerialized();
  await verifyRemountLoadAbortsAfterFailedDeletion();
  await verifyConcurrentDeletionDeduplication();
  await verifyFailedDeletionPreservesActiveState();
  await verifyEarlyDeletionFailureKeepsCurrentEnvelope();
  await verifyBloomProductPersistence();
  await verifyBloomOnboardingPersistence();
}

async function verifyAvailableWebStorage() {
  const webStorage = new TestWebStorage();
  const nonBrowserFallback = new TestStorageClient();
  const client = createWebStorageClient({
    resolveEnvironment: () => ({ status: "available", storage: webStorage }),
    nonBrowserFallback
  });
  const state = stateWithDateOffset(7);

  await persistBloomLocalState(state, client, fixedNow);
  const result = await loadBloomLocalState(client, fixedNow);

  assert(
    result.status === "success" &&
      result.source === "current" &&
      result.state.debug.dateOffsetDays === 7,
    "Available web storage should save and load the current envelope."
  );
  assert(
    nonBrowserFallback.getAttempts.length === 0 &&
      nonBrowserFallback.values.size === 0,
    "Available localStorage must not use the non-browser memory fallback."
  );
}

async function verifyUnavailableWebStorage() {
  const webStorage = new TestWebStorage();
  webStorage.setItem(BLOOM_STATE_STORAGE_KEY, "existing-persisted-state");
  const browserWindow: WebStorageWindow = {
    get localStorage(): WebStorage {
      throw new Error("Synthetic localStorage access failure.");
    }
  };
  const nonBrowserFallback = new TestStorageClient();
  const client = createWebStorageClient({
    resolveEnvironment: () => resolveWebStorageEnvironment(browserWindow),
    nonBrowserFallback
  });
  let loadWasClassifiedAsEmpty = false;
  let caughtError: unknown;

  try {
    const result = await loadBloomLocalState(client, fixedNow);
    loadWasClassifiedAsEmpty =
      result.status === "success" && result.source === "empty";
  } catch (error) {
    caughtError = error;
  }

  assert(
    isStorageUnavailableError(caughtError),
    "A browser localStorage access failure should throw storage-unavailable."
  );
  assert(
    !loadWasClassifiedAsEmpty,
    "Unavailable browser storage must not be classified as empty."
  );
  assert(
    nonBrowserFallback.getAttempts.length === 0 &&
      nonBrowserFallback.values.size === 0,
    "Unavailable browser storage must not read or write the memory fallback."
  );
  assert(
    webStorage.getItem(BLOOM_STATE_STORAGE_KEY) === "existing-persisted-state",
    "Unavailable browser storage must not overwrite the inaccessible active value."
  );
}

async function verifyExplicitMemoryStorage() {
  const client = createMemoryStorageClient();

  await client.setItem("test-key", "test-value");

  assert(
    (await client.getItem("test-key")) === "test-value",
    "The explicit memory adapter should remain available for safe tests."
  );
}

async function verifyWebStorageMethodFailure() {
  const webStorage = new TestWebStorage();
  webStorage.throwOnGet = true;
  const nonBrowserFallback = new TestStorageClient();
  const client = createWebStorageClient({
    resolveEnvironment: () => ({ status: "available", storage: webStorage }),
    nonBrowserFallback
  });
  let caughtError: unknown;

  try {
    await loadBloomLocalState(client, fixedNow);
  } catch (error) {
    caughtError = error;
  }

  assert(
    isStorageUnavailableError(caughtError),
    "A localStorage method failure should throw storage-unavailable."
  );
  assert(
    nonBrowserFallback.getAttempts.length === 0,
    "A localStorage method failure must not switch to memory."
  );
}

async function verifyNonBrowserMemoryFallback() {
  const nonBrowserFallback = createMemoryStorageClient();
  const client = createWebStorageClient({
    resolveEnvironment: () => ({ status: "non-browser" }),
    nonBrowserFallback
  });

  await client.setItem("non-browser-key", "non-browser-value");

  assert(
    (await client.getItem("non-browser-key")) === "non-browser-value",
    "A genuine non-browser environment may use its explicit memory fallback."
  );
}

function verifyStrictDateKeys() {
  const validDateKeys = ["2026-07-26", "2028-02-29"] as const;
  const invalidDateKeys = [
    "2026-02-30",
    "2027-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "26-07-2026",
    "2026-07-26T00:00:00.000Z"
  ] as const;

  for (const dateKey of validDateKeys) {
    assert(
      isValidBloomDateKey(dateKey),
      `${dateKey} should be accepted as a valid Bloom date key.`
    );
  }

  for (const dateKey of invalidDateKeys) {
    assert(
      !isValidBloomDateKey(dateKey),
      `${dateKey} should be rejected as a Bloom date key.`
    );
  }
}

function verifyStrictIsoTimestamps() {
  const validTimestamp = new Date(
    "2026-07-26T12:34:56.789Z"
  ).toISOString();
  const invalidTimestamps = [
    "2026-02-30T12:34:56.789Z",
    "2026-07-26T12:34:56.789",
    "2026-07-26T12:34:56.789+00:00",
    "2026-07-26T12:34:56Z",
    "2026-07-26T12:34:56.78Z",
    "2026-07-26T12:34:56.7890Z",
    "2026-07-26",
    "July 26, 2026 12:34:56 UTC"
  ] as const;

  assert(
    isValidBloomIsoTimestamp(validTimestamp),
    "A canonical toISOString timestamp should be accepted."
  );
  assert(
    readPersistedEnvelope({
      version: BLOOM_PERSISTENCE_VERSION,
      savedAt: validTimestamp,
      state: createDefaultBloomState()
    }).status === "current",
    "A canonical savedAt timestamp should produce a current envelope."
  );

  for (const timestamp of invalidTimestamps) {
    assert(
      !isValidBloomIsoTimestamp(timestamp),
      `${timestamp} should be rejected as a Bloom timestamp.`
    );
    assert(
      readPersistedEnvelope({
        version: BLOOM_PERSISTENCE_VERSION,
        savedAt: timestamp,
        state: createDefaultBloomState()
      }).status === "invalid",
      `${timestamp} should invalidate a current envelope.`
    );
  }
}

function verifyDateValidationIntegration() {
  const canonicalTimestamp = "2026-07-26T12:34:56.789Z";
  const validState = createDefaultBloomState();
  validState.tenDayReset = {
    startedAt: canonicalTimestamp,
    completedDates: ["2028-02-29"],
    lastCompletedAt: canonicalTimestamp
  };
  const validResult = validateAndNormalizeBloomState(validState);

  assert(
    validResult.success,
    "Canonical timestamps and a real leap-day key should validate in persisted state."
  );

  const invalidDateState = createDefaultBloomState();
  invalidDateState.tenDayReset.completedDates = ["2026-02-30"];
  const invalidDateResult = validateAndNormalizeBloomState(invalidDateState);
  assert(
    invalidDateResult.success &&
      invalidDateResult.state.tenDayReset.completedDates.length === 0,
    "Impossible legacy Reset date keys should be discarded during normalization."
  );

  const invalidTimestampState = createDefaultBloomState();
  invalidTimestampState.protection.setupCompletedAt =
    "2026-07-26T12:34:56+00:00";
  assert(
    !validateAndNormalizeBloomState(invalidTimestampState).success,
    "A non-canonical persisted timestamp should invalidate state."
  );
}

async function verifyEmptyState() {
  const client = new TestStorageClient();
  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "Empty storage should hydrate successfully.");
  assert(result.source === "empty", "Empty storage should report an empty source.");
  assert(!result.state.onboarding.completed, "Empty storage should use onboarding defaults.");
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null,
    "Empty hydration should not immediately persist defaults."
  );
}

async function verifyCurrentEnvelope() {
  const client = new TestStorageClient();
  const state = createDefaultBloomState();
  state.debug.dateOffsetDays = 3;

  await persistBloomLocalState(state, client, fixedNow);
  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "A current envelope should load.");
  assert(result.source === "current", "A current envelope should report current source.");
  assert(!result.needsPersist, "A canonical current envelope should not migrate again.");
  assert(result.state.debug.dateOffsetDays === 3, "Current values should survive hydration.");
}

async function verifyPartialCurrentNormalization() {
  const client = new TestStorageClient();
  const defaults = createDefaultBloomState();
  await client.setItem(
    BLOOM_STATE_STORAGE_KEY,
    JSON.stringify({
      version: BLOOM_PERSISTENCE_VERSION,
      savedAt: fixedNow().toISOString(),
      state: {
        onboarding: { completed: true },
        productOnboarding: defaults.productOnboarding,
        masturbationTracking: defaults.masturbationTracking,
        contentFree: defaults.contentFree,
        resetJourney: defaults.resetJourney,
        urgeControl: defaults.urgeControl
      }
    })
  );

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "Partial legacy slices in current state should normalize safely.");
  assert(result.state.onboarding.completed, "Valid partial current data should survive.");
  assert(result.needsPersist, "Normalized current data should request a canonical rewrite.");
}

async function verifyPartialLegacyMigration() {
  const client = new TestStorageClient();
  const legacyKey = BLOOM_LEGACY_STATE_STORAGE_KEYS[0];
  await client.setItem(
    legacyKey,
    JSON.stringify({
      onboarding: { completed: true },
      tenDayReset: { completedDates: ["2026-07-20", "2026-07-20"] },
      debug: { dateOffsetDays: 2 }
    })
  );

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "A partial legacy state should migrate.");
  assert(result.source === "legacy", "Legacy migration should report its source.");
  assert(result.state.onboarding.completed, "Valid partial onboarding data should survive.");
  assert(result.state.debug.dateOffsetDays === 2, "Valid debug state should survive.");
  assert(
    result.state.tenDayReset.completedDates.length === 1,
    "Legacy reset dates should be deduplicated."
  );
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) !== null,
    "Legacy migration should write the current envelope."
  );
  assert(
    (await client.getItem(legacyKey)) === null,
    "Legacy data should be removed only after the current write succeeds."
  );

  const reloadedResult = await loadBloomLocalState(client, fixedNow);
  assert(
    reloadedResult.status === "success" &&
      reloadedResult.source === "current" &&
      !reloadedResult.needsPersist,
    "A migrated envelope should reload without repeating migration."
  );
}

async function verifyPlanDerivation() {
  const client = new TestStorageClient();
  const quizResult = createControlTimingQuizResult();
  const conflictingState = {
    activePlan: {
      primaryPattern: "pornLoop",
      secondaryPattern: "pressurePattern",
      planName: "Conflicting plan",
      resultTitle: "Conflicting result",
      recommendedFirstAction: "setupProtection"
    },
    onboarding: {
      completed: true,
      quizAnswers: {},
      quizResult,
      completedAt: quizResult.completedAt
    }
  };
  await client.setItem(
    BLOOM_LEGACY_STATE_STORAGE_KEYS[0],
    JSON.stringify(conflictingState)
  );

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "A valid quiz result should migrate.");
  assert(
    result.state.activePlan.primaryPattern === "controlTiming",
    "The active plan should be derived from the valid quiz result."
  );
  assert(
    result.state.activePlan.recommendedFirstAction === "startArousalPractice",
    "The derived active plan should preserve current product mapping."
  );
}

async function verifyFeatureStatePreservation() {
  const client = new TestStorageClient();
  const firstLog = {
    id: "practice-1",
    startedAt: "2026-07-21T09:00:00.000Z",
    completedAt: "2026-07-21T09:10:00.000Z",
    dateKey: "2026-07-21",
    highestArousal: 8,
    pauseCount: 2,
    controlFeeling: 6,
    pressureRushing: "medium",
    durationPreference: "estimated",
    durationSeconds: 600
  };
  await client.setItem(
    BLOOM_LEGACY_STATE_STORAGE_KEYS[0],
    JSON.stringify({
      protection: {
        isEnabled: true,
        setupCompletedAt: "2026-07-20T20:00:00.000Z",
        preferredWindow: "night",
        adultContentPauseEnabled: true,
        lastProtectionPauseAt: null
      },
      arousalControl: {
        draft: {
          id: "practice-2",
          startedAt: "2026-07-22T09:00:00.000Z",
          dateKey: "2026-07-22",
          anxietyLevel: 3
        },
        logs: [firstLog, { ...firstLog, pauseCount: 3 }]
      }
    })
  );

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "Valid feature state should migrate.");
  assert(
    result.state.protection.status === "active",
    "Protection active state should survive."
  );
  assert(
    result.state.protection.preferredWindow === "night",
    "Protection window should survive."
  );
  assert(
    result.state.arousalControl.draft?.anxietyLevel === 3,
    "A valid Arousal draft should survive."
  );
  assert(
    result.state.arousalControl.logs.length === 1 &&
      result.state.arousalControl.logs[0]?.pauseCount === 3,
    "Arousal logs should preserve values and deduplicate identifiers."
  );
}

async function verifyCorruptPayloadPreservation() {
  const client = new TestStorageClient();
  const rawPayload = "{not-valid-json";
  await client.setItem(BLOOM_STATE_STORAGE_KEY, rawPayload);

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "corrupt", "Invalid JSON should report corrupt hydration.");
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === rawPayload,
    "Invalid JSON must remain untouched at the active key."
  );
  assert(
    result.backupKey?.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX) === true,
    "Invalid JSON should receive a quarantine key."
  );
  assert(
    result.backupKey !== null && (await client.getItem(result.backupKey)) !== null,
    "The quarantine record should preserve the original payload."
  );

  const repeatedResult = await loadBloomLocalState(client, fixedNow);
  assert(
    repeatedResult.status === "corrupt" && repeatedResult.backupKey === result.backupKey,
    "Repeated corrupt hydration should reuse the stable backup key."
  );
}

async function verifyMalformedNestedStatePreservation() {
  const client = new TestStorageClient();
  const rawPayload = JSON.stringify({ onboarding: { quizResult: {} } });
  await client.setItem(BLOOM_LEGACY_STATE_STORAGE_KEYS[0], rawPayload);

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "corrupt", "Malformed nested state should not crash or load.");
  assert(
    (await client.getItem(BLOOM_LEGACY_STATE_STORAGE_KEYS[0])) === rawPayload,
    "Malformed legacy state must not be overwritten with defaults."
  );
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null,
    "Malformed legacy state must not create a default current envelope."
  );
}

async function verifyUnsupportedVersionPreservation() {
  const client = new TestStorageClient();
  const rawPayload = JSON.stringify({
    version: 99,
    savedAt: fixedNow().toISOString(),
    state: createDefaultBloomState()
  });
  await client.setItem(BLOOM_STATE_STORAGE_KEY, rawPayload);

  const result = await loadBloomLocalState(client, fixedNow);

  assert(
    result.status === "unsupported-version" && result.version === 99,
    "Future versions should report an unsupported-version error."
  );
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === rawPayload,
    "Future-version data must remain untouched."
  );
}

async function verifyFailedMigrationKeepsLegacyPayload() {
  const client = new TestStorageClient();
  const legacyKey = BLOOM_LEGACY_STATE_STORAGE_KEYS[0];
  const rawPayload = JSON.stringify({ onboarding: { completed: true } });
  await client.setItem(legacyKey, rawPayload);
  client.failWritesFor.add(BLOOM_STATE_STORAGE_KEY);

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "Valid legacy data should remain usable after write failure.");
  assert(result.needsPersist, "A failed migration write should request a later retry.");
  assert(
    (await client.getItem(legacyKey)) === rawPayload,
    "A failed current write must not remove the legacy payload."
  );
}

async function verifyWriteOrdering() {
  const client = new TestStorageClient();
  client.writeDelays.push(30, 0);
  const enqueueWrite = createBloomStateWriteQueue(client, fixedNow);
  const firstState = stateWithDateOffset(1);
  const latestState = stateWithDateOffset(2);

  const [firstReceipt, latestReceipt] = await Promise.all([
    enqueueWrite(firstState),
    enqueueWrite(latestState)
  ]);

  const finalPayload = await client.getItem(BLOOM_STATE_STORAGE_KEY);
  assert(finalPayload !== null, "Queued writes should produce a current envelope.");
  const parsed = JSON.parse(finalPayload) as {
    state?: { debug?: { dateOffsetDays?: number } };
  };
  assert(
    parsed.state?.debug?.dateOffsetDays === 2,
    "The latest queued mutation must be the final stored state."
  );
  assert(
    client.completedWrites.length === 2,
    "Both queued writes should complete without being dropped."
  );
  assert(
    firstReceipt.status === "persisted" &&
      latestReceipt.status === "persisted" &&
      firstReceipt.writeId < latestReceipt.writeId,
    "Serialized writes should return monotonic persisted receipts for their exact snapshots."
  );
}

async function verifyQueuedSnapshotCapture() {
  const client = new TestStorageClient();
  client.writeDelays.push(30, 0);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const firstState = stateWithDateOffset(1);
  const queuedState = stateWithDateOffset(2);
  const firstWrite = coordinator.enqueueWrite(firstState);
  const queuedWrite = coordinator.enqueueWrite(queuedState);

  queuedState.debug.dateOffsetDays = 99;
  await Promise.all([firstWrite, queuedWrite]);

  const queuedPayload = client.completedWrites[1];
  assert(
    queuedPayload !== undefined,
    "The queued exact-snapshot check must complete its second write."
  );
  const parsed = JSON.parse(queuedPayload) as {
    state?: { debug?: { dateOffsetDays?: number } };
  };
  assert(
    parsed.state?.debug?.dateOffsetDays === 2,
    "A queued write must serialize its exact snapshot at enqueue time, before caller-owned references can change."
  );
}

async function verifyScopedDeletion() {
  const client = new TestStorageClient();
  const legacyKey = BLOOM_LEGACY_STATE_STORAGE_KEYS[0];
  const firstCorruptKey = `${BLOOM_CORRUPT_BACKUP_PREFIX}first`;
  const secondCorruptKey = `${BLOOM_CORRUPT_BACKUP_PREFIX}second`;
  const unrelatedKey = "another-library.state";

  await client.setItem(BLOOM_STATE_STORAGE_KEY, "current");
  await client.setItem(legacyKey, "legacy");
  await client.setItem(firstCorruptKey, "corrupt-one");
  await client.setItem(secondCorruptKey, "corrupt-two");
  await client.setItem(unrelatedKey, "keep-me");

  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  await coordinator.deleteAll();

  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null,
    "Full deletion should remove the current Bloom envelope."
  );
  assert(
    (await client.getItem(legacyKey)) === null,
    "Full deletion should remove known legacy Bloom state."
  );
  assert(
    (await client.getItem(firstCorruptKey)) === null &&
      (await client.getItem(secondCorruptKey)) === null,
    "Full deletion should remove Bloom quarantine backups."
  );
  assert(
    (await client.getItem(unrelatedKey)) === "keep-me",
    "Full deletion must preserve unrelated storage keys."
  );
}

async function verifyWriteDeleteRace() {
  const client = new TestStorageClient();
  client.writeDelays.push(30);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const inFlightWrite = coordinator.enqueueWrite(stateWithDateOffset(1));

  await client.waitForCurrentWriteStart();

  const queuedWrite = coordinator.enqueueWrite(stateWithDateOffset(2));
  const deletion = coordinator.deleteAll();

  const [inFlightReceipt, queuedReceipt] = await Promise.all([
    inFlightWrite,
    queuedWrite,
    deletion
  ]);

  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null,
    "Deletion should run after an in-flight write and leave no current envelope."
  );
  assert(
    client.completedWrites.length === 1,
    "Deletion should drain the in-flight write and invalidate the stale queued write."
  );
  assert(
    inFlightReceipt.status === "invalidated" &&
      queuedReceipt.status === "invalidated",
    "Deletion must report both pending pre-delete acknowledgements as invalidated."
  );

  const postDeleteReceipt = await coordinator.enqueueWrite(
    stateWithDateOffset(3)
  );
  assert(
    postDeleteReceipt.status === "persisted",
    "A post-delete write should receive a persisted receipt in the new generation."
  );
  const postDeletePayload = await client.getItem(BLOOM_STATE_STORAGE_KEY);
  assert(
    postDeletePayload !== null,
    "A real mutation after deletion should be allowed to create a new envelope."
  );
  const parsed = JSON.parse(postDeletePayload) as {
    state?: { debug?: { dateOffsetDays?: number } };
  };
  assert(
    parsed.state?.debug?.dateOffsetDays === 3,
    "Post-delete writes should use the new persistence generation."
  );
}

async function verifyDeletionInvalidatesDelayedLoad() {
  const client = new TestStorageClient();
  await persistBloomLocalState(stateWithDateOffset(8), client, fixedNow);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedGetsFor.add(BLOOM_STATE_STORAGE_KEY);

  const delayedLoad = coordinator.load();
  await client.waitForGetStart(BLOOM_STATE_STORAGE_KEY);
  const deletion = coordinator.deleteAll();
  client.releaseBlockedGet(BLOOM_STATE_STORAGE_KEY);

  const loadError = await delayedLoad.then(
    () => null,
    (error: unknown) => error
  );
  await deletion;

  assert(
    isBloomStateLifecycleInvalidatedError(loadError),
    "Deletion should invalidate a load that began in an older lifecycle generation."
  );
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null,
    "A delayed pre-delete load must not leave the active envelope behind."
  );
}

async function verifyDeletionDrainsDelayedMigration() {
  const client = new TestStorageClient();
  const legacyKey = BLOOM_LEGACY_STATE_STORAGE_KEYS[0];
  await client.setItem(
    legacyKey,
    JSON.stringify({ onboarding: { completed: true } })
  );
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedSetPrefixes.add(BLOOM_STATE_STORAGE_KEY);

  const delayedMigration = coordinator.load();
  await client.waitForSetStart(BLOOM_STATE_STORAGE_KEY);
  const deletion = coordinator.deleteAll();
  client.releaseBlockedSet(BLOOM_STATE_STORAGE_KEY);

  const loadError = await delayedMigration.then(
    () => null,
    (error: unknown) => error
  );
  await deletion;

  assert(
    isBloomStateLifecycleInvalidatedError(loadError),
    "Deletion should invalidate hydration whose legacy migration was still writing."
  );
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null &&
      (await client.getItem(legacyKey)) === null,
    "Deletion must wait for a delayed migration and then remove both current and legacy keys."
  );
}

async function verifyDeletionDrainsDelayedLegacyCleanup() {
  const client = new TestStorageClient();
  const legacyKey = BLOOM_LEGACY_STATE_STORAGE_KEYS[0];
  await client.setItem(
    legacyKey,
    JSON.stringify({ onboarding: { completed: true } })
  );
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedRemovalsFor.add(legacyKey);

  const delayedCleanup = coordinator.load();
  await client.waitForRemovalStart(legacyKey);
  const deletion = coordinator.deleteAll();
  client.releaseBlockedRemoval(legacyKey);

  const loadError = await delayedCleanup.then(
    () => null,
    (error: unknown) => error
  );
  await deletion;

  assert(
    isBloomStateLifecycleInvalidatedError(loadError),
    "Deletion should invalidate hydration whose migrated legacy-key cleanup was still running."
  );
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === null &&
      (await client.getItem(legacyKey)) === null,
    "Deletion must drain delayed legacy cleanup and remove the migrated current envelope."
  );
}

async function verifyDeletionDrainsDelayedQuarantine() {
  const client = new TestStorageClient();
  await client.setItem(BLOOM_STATE_STORAGE_KEY, "{not-valid-json");
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedSetPrefixes.add(BLOOM_CORRUPT_BACKUP_PREFIX);

  const delayedQuarantine = coordinator.load();
  await client.waitForSetStart(BLOOM_CORRUPT_BACKUP_PREFIX);
  const deletion = coordinator.deleteAll();
  client.releaseBlockedSet(BLOOM_CORRUPT_BACKUP_PREFIX);

  const loadError = await delayedQuarantine.then(
    () => null,
    (error: unknown) => error
  );
  await deletion;

  assert(
    isBloomStateLifecycleInvalidatedError(loadError),
    "Deletion should invalidate hydration whose quarantine backup was still writing."
  );
  assert(
    (await client.getAllKeys()).every(
      (key) =>
        key !== BLOOM_STATE_STORAGE_KEY &&
        !key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX)
    ),
    "Deletion must drain and remove a late quarantine backup without resurrecting Bloom data."
  );
}

async function verifyDeletionDrainsExistingQuarantineLookup() {
  const client = new TestStorageClient();
  const rawPayload = "{not-valid-json";
  await client.setItem(BLOOM_STATE_STORAGE_KEY, rawPayload);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const firstLoad = await coordinator.load();
  assert(
    firstLoad.status === "corrupt" && firstLoad.backupKey !== null,
    "The delayed existing-quarantine regression requires a preserved backup."
  );
  const backupKey = firstLoad.backupKey;
  client.getAttempts.length = 0;
  client.blockedGetsFor.add(backupKey);

  const delayedLookup = coordinator.load();
  await client.waitForGetStart(backupKey);
  const deletion = coordinator.deleteAll();
  client.releaseBlockedGet(backupKey);

  const loadError = await delayedLookup.then(
    () => null,
    (error: unknown) => error
  );
  await deletion;

  assert(
    isBloomStateLifecycleInvalidatedError(loadError),
    "Deletion should invalidate a delayed lookup of an existing quarantine backup."
  );
  assert(
    (await client.getAllKeys()).every(
      (key) =>
        key !== BLOOM_STATE_STORAGE_KEY &&
        !key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX)
    ),
    "Deletion must remove both the active corrupt payload and its existing delayed backup."
  );
}

async function verifyRemountLoadWaitsForDelayedEnumeration() {
  const client = new TestStorageClient();
  await persistBloomLocalState(stateWithDateOffset(7), client, fixedNow);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockAllKeysReads = true;

  const deletion = coordinator.deleteAll();
  await client.waitForAllKeysReadStart();
  const remountLoad = coordinator.load();
  const writeDuringDeletion = await coordinator.enqueueWrite(
    stateWithDateOffset(99)
  );
  await Promise.resolve();

  assert(
    client.getAttempts.length === 0 &&
      writeDuringDeletion.status === "invalidated",
    "Delayed deletion enumeration must block remount reads and invalidate new writes."
  );

  client.releaseBlockedAllKeysRead();
  await deletion;
  const remountResult = await remountLoad;
  assert(
    remountResult.status === "success" && remountResult.source === "empty",
    "A remount load must wait for delayed key enumeration and observe post-delete storage."
  );
}

async function verifyRemountLoadWaitsForDeletion() {
  const client = new TestStorageClient();
  await client.setItem(BLOOM_STATE_STORAGE_KEY, "current");
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedRemovalsFor.add(BLOOM_STATE_STORAGE_KEY);

  const deletion = coordinator.deleteAll();
  await client.waitForRemovalStart(BLOOM_STATE_STORAGE_KEY);
  const remountLoad = coordinator.load();
  client.releaseBlockedRemoval(BLOOM_STATE_STORAGE_KEY);

  await deletion;
  const remountResult = await remountLoad;

  assert(
    remountResult.status === "success" && remountResult.source === "empty",
    "A remount load requested during deletion must wait and observe empty post-delete storage."
  );
}

async function verifyConcurrentRemountLoadsStaySerialized() {
  const client = new TestStorageClient();
  await persistBloomLocalState(stateWithDateOffset(6), client, fixedNow);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedRemovalsFor.add(BLOOM_STATE_STORAGE_KEY);

  const deletion = coordinator.deleteAll();
  await client.waitForRemovalStart(BLOOM_STATE_STORAGE_KEY);
  client.blockedGetsFor.add(BLOOM_STATE_STORAGE_KEY);
  const firstRemountLoad = coordinator.load();
  const secondRemountLoad = coordinator.load();
  client.releaseBlockedRemoval(BLOOM_STATE_STORAGE_KEY);
  await deletion;
  await client.waitForGetStart(BLOOM_STATE_STORAGE_KEY);
  await Promise.resolve();
  await Promise.resolve();

  assert(
    client.getAttempts.filter((key) => key === BLOOM_STATE_STORAGE_KEY)
      .length === 1,
    "Concurrent remount loads must remain serialized after their shared deletion barrier."
  );

  client.releaseBlockedGet(BLOOM_STATE_STORAGE_KEY);
  const [firstResult, secondResult] = await Promise.all([
    firstRemountLoad,
    secondRemountLoad
  ]);
  assert(
    firstResult.status === "success" &&
      firstResult.source === "empty" &&
      secondResult.status === "success" &&
      secondResult.source === "empty" &&
      client.getAttempts.filter((key) => key === BLOOM_STATE_STORAGE_KEY)
        .length === 2,
    "Serialized remount loads should each observe the same empty post-delete state."
  );
}

async function verifyRemountLoadAbortsAfterFailedDeletion() {
  const client = new TestStorageClient();
  await persistBloomLocalState(stateWithDateOffset(8), client, fixedNow);
  const corruptKey = `${BLOOM_CORRUPT_BACKUP_PREFIX}removed-before-failure`;
  await client.setItem(corruptKey, "quarantined-payload");
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  client.blockedRemovalsFor.add(BLOOM_STATE_STORAGE_KEY);

  const deletion = coordinator.deleteAll();
  await client.waitForRemovalStart(BLOOM_STATE_STORAGE_KEY);
  const remountLoad = coordinator.load();
  client.failRemovalsFor.add(BLOOM_STATE_STORAGE_KEY);
  client.releaseBlockedRemoval(BLOOM_STATE_STORAGE_KEY);

  const [deletionError, loadError] = await Promise.all([
    deletion.then(
      () => null,
      (error: unknown) => error
    ),
    remountLoad.then(
      () => null,
      (error: unknown) => error
    )
  ]);
  assert(
    deletionError instanceof Error &&
      loadError === deletionError &&
      client.getAttempts.length === 0 &&
      !client.values.has(corruptKey) &&
      client.values.has(BLOOM_STATE_STORAGE_KEY),
    "A remount load queued during failed deletion must abort without reading partial storage."
  );

  client.failRemovalsFor.clear();
  await coordinator.enqueueWrite(stateWithDateOffset(9));
  const recoveredLoad = await coordinator.load();
  assert(
    recoveredLoad.status === "success" &&
      recoveredLoad.state.debug.dateOffsetDays === 9,
    "Hydration retry after failed-deletion recovery must observe the requeued canonical state."
  );
}

async function verifyConcurrentDeletionDeduplication() {
  const client = new TestStorageClient();
  await client.setItem(BLOOM_STATE_STORAGE_KEY, "current");
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  const firstDeletion = coordinator.deleteAll();
  const secondDeletion = coordinator.deleteAll();

  assert(
    firstDeletion === secondDeletion,
    "Concurrent deletion requests should share one operation."
  );

  await Promise.all([firstDeletion, secondDeletion]);

  assert(
    client.removeAttempts.filter((key) => key === BLOOM_STATE_STORAGE_KEY)
      .length === 1,
    "Concurrent deletion should remove the current key only once."
  );
}

async function verifyFailedDeletionPreservesActiveState() {
  const client = new TestStorageClient();
  const unrelatedKey = "another-library.state";
  await client.setItem(BLOOM_STATE_STORAGE_KEY, "current");
  await client.setItem(unrelatedKey, "keep-me");
  client.failRemovalsFor.add(BLOOM_STATE_STORAGE_KEY);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  let deletionFailed = false;

  try {
    await coordinator.deleteAll();
  } catch {
    deletionFailed = true;
  }

  assert(deletionFailed, "A storage removal failure should reject deletion.");
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === "current",
    "A failed current-key removal should preserve active data."
  );
  assert(
    (await client.getItem(unrelatedKey)) === "keep-me",
    "A failed deletion must not touch unrelated data."
  );

  client.failRemovalsFor.clear();
  await coordinator.enqueueWrite(stateWithDateOffset(4));

  const finalPayload = await client.getItem(BLOOM_STATE_STORAGE_KEY);
  assert(finalPayload !== null, "Writes should recover after a failed deletion.");
  const parsed = JSON.parse(finalPayload) as {
    state?: { debug?: { dateOffsetDays?: number } };
  };
  assert(
    parsed.state?.debug?.dateOffsetDays === 4,
    "A post-failure write should use the current persistence generation."
  );
}

async function verifyEarlyDeletionFailureKeepsCurrentEnvelope() {
  const client = new TestStorageClient();
  const corruptKey = `${BLOOM_CORRUPT_BACKUP_PREFIX}cannot-remove`;
  await client.setItem(BLOOM_STATE_STORAGE_KEY, "current");
  await client.setItem(corruptKey, "corrupt");
  client.failRemovalsFor.add(corruptKey);
  const coordinator = createBloomStatePersistenceCoordinator(client, fixedNow);
  let deletionFailed = false;

  try {
    await coordinator.deleteAll();
  } catch {
    deletionFailed = true;
  }

  assert(deletionFailed, "A quarantine removal failure should reject deletion.");
  assert(
    (await client.getItem(BLOOM_STATE_STORAGE_KEY)) === "current",
    "The active envelope should remain when an earlier scoped removal fails."
  );
  assert(
    !client.removeAttempts.includes(BLOOM_STATE_STORAGE_KEY),
    "The active envelope should be removed last."
  );
}

function createControlTimingQuizResult(): QuizResult {
  return {
    scores: { PL: 0, PP: 1, CT: 9, FC: 0 },
    normalizedScores: { PL: 0, PP: 0.0588, CT: 1, FC: 0 },
    primaryPattern: "controlTiming",
    secondaryPattern: null,
    flags: {
      eveningWindow: false,
      emptyMoments: false,
      boredom: false,
      aloneTime: false,
      stressTrigger: false,
      phoneLoop: false,
      firmnessConcern: false
    },
    resultTitle: "Control and timing practice",
    resultBody: "A valid persisted result.",
    planName: "Control and timing practice",
    recommendedFirstAction: "startArousalPractice",
    firstPlanSteps: [],
    chips: ["Control awareness"],
    completedAt: fixedNow().toISOString()
  };
}

function stateWithDateOffset(dateOffsetDays: number): BloomLocalState {
  const state = createDefaultBloomState();
  state.debug.dateOffsetDays = dateOffsetDays;
  return state;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class TestStorageClient implements StorageClient {
  readonly values = new Map<string, string>();
  readonly getAttempts: string[] = [];
  readonly failWritesFor = new Set<string>();
  readonly failRemovalsFor = new Set<string>();
  readonly blockedGetsFor = new Set<string>();
  readonly blockedSetPrefixes = new Set<string>();
  readonly blockedRemovalsFor = new Set<string>();
  blockAllKeysReads = false;
  allKeysReadAttempts = 0;
  readonly writeDelays: number[] = [];
  readonly setAttempts: string[] = [];
  readonly startedWrites: string[] = [];
  readonly completedWrites: string[] = [];
  readonly removeAttempts: string[] = [];
  private readonly writeStartWaiters: Array<() => void> = [];
  private readonly getStartWaiters = new Map<string, Array<() => void>>();
  private readonly setStartWaiters: Array<{
    prefix: string;
    resolve: () => void;
  }> = [];
  private readonly removalStartWaiters = new Map<
    string,
    Array<() => void>
  >();
  private readonly blockedGetReleases = new Map<string, () => void>();
  private readonly blockedSetReleases = new Map<string, () => void>();
  private readonly blockedRemovalReleases = new Map<string, () => void>();
  private readonly allKeysReadStartWaiters: Array<() => void> = [];
  private blockedAllKeysReadRelease: (() => void) | null = null;

  async getItem(key: string): Promise<string | null> {
    this.getAttempts.push(key);
    this.resolveKeyWaiters(this.getStartWaiters, key);

    if (this.blockedGetsFor.has(key)) {
      await new Promise<void>((resolve) => {
        this.blockedGetReleases.set(key, resolve);
      });
    }

    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const delay = this.writeDelays.shift() ?? 0;
    this.setAttempts.push(key);
    this.resolvePrefixWaiters(this.setStartWaiters, key);

    if (key === BLOOM_STATE_STORAGE_KEY) {
      this.startedWrites.push(value);
      const waiters = this.writeStartWaiters.splice(0);

      for (const resolve of waiters) {
        resolve();
      }
    }

    if (delay > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
    }

    const blockedPrefix = Array.from(this.blockedSetPrefixes).find((prefix) =>
      key.startsWith(prefix)
    );

    if (blockedPrefix !== undefined) {
      await new Promise<void>((resolve) => {
        this.blockedSetReleases.set(key, resolve);
      });
    }

    if (this.failWritesFor.has(key)) {
      throw new Error("Synthetic storage failure.");
    }

    this.values.set(key, value);

    if (key === BLOOM_STATE_STORAGE_KEY) {
      this.completedWrites.push(value);
    }
  }

  async removeItem(key: string): Promise<void> {
    this.removeAttempts.push(key);
    this.resolveKeyWaiters(this.removalStartWaiters, key);

    if (this.blockedRemovalsFor.has(key)) {
      await new Promise<void>((resolve) => {
        this.blockedRemovalReleases.set(key, resolve);
      });
    }

    if (this.failRemovalsFor.has(key)) {
      throw new Error("Synthetic storage removal failure.");
    }

    this.values.delete(key);
  }

  async getAllKeys(): Promise<readonly string[]> {
    this.allKeysReadAttempts += 1;
    const waiters = this.allKeysReadStartWaiters.splice(0);

    for (const resolve of waiters) {
      resolve();
    }

    if (this.blockAllKeysReads) {
      await new Promise<void>((resolve) => {
        this.blockedAllKeysReadRelease = resolve;
      });
    }

    return Array.from(this.values.keys());
  }

  waitForCurrentWriteStart(): Promise<void> {
    if (this.startedWrites.length > 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.writeStartWaiters.push(resolve);
    });
  }

  waitForGetStart(key: string): Promise<void> {
    if (this.getAttempts.includes(key)) {
      return Promise.resolve();
    }

    return this.waitForKey(this.getStartWaiters, key);
  }

  waitForSetStart(prefix: string): Promise<void> {
    if (this.setAttempts.some((key) => key.startsWith(prefix))) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.setStartWaiters.push({ prefix, resolve });
    });
  }

  waitForRemovalStart(key: string): Promise<void> {
    if (this.removeAttempts.includes(key)) {
      return Promise.resolve();
    }

    return this.waitForKey(this.removalStartWaiters, key);
  }

  waitForAllKeysReadStart(): Promise<void> {
    if (this.allKeysReadAttempts > 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.allKeysReadStartWaiters.push(resolve);
    });
  }

  releaseBlockedGet(key: string): void {
    const release = this.blockedGetReleases.get(key);
    assert(release !== undefined, `No blocked get exists for ${key}.`);
    this.blockedGetsFor.delete(key);
    this.blockedGetReleases.delete(key);
    release();
  }

  releaseBlockedSet(prefix: string): void {
    const entry = Array.from(this.blockedSetReleases.entries()).find(([key]) =>
      key.startsWith(prefix)
    );
    assert(entry !== undefined, `No blocked set exists for ${prefix}.`);
    this.blockedSetPrefixes.delete(prefix);
    this.blockedSetReleases.delete(entry[0]);
    entry[1]();
  }

  releaseBlockedRemoval(key: string): void {
    const release = this.blockedRemovalReleases.get(key);
    assert(release !== undefined, `No blocked removal exists for ${key}.`);
    this.blockedRemovalsFor.delete(key);
    this.blockedRemovalReleases.delete(key);
    release();
  }

  releaseBlockedAllKeysRead(): void {
    const release = this.blockedAllKeysReadRelease;
    assert(release !== null, "No blocked all-keys read exists.");
    this.blockAllKeysReads = false;
    this.blockedAllKeysReadRelease = null;
    release();
  }

  private waitForKey(
    waiters: Map<string, Array<() => void>>,
    key: string
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const keyWaiters = waiters.get(key) ?? [];
      keyWaiters.push(resolve);
      waiters.set(key, keyWaiters);
    });
  }

  private resolveKeyWaiters(
    waiters: Map<string, Array<() => void>>,
    key: string
  ): void {
    const keyWaiters = waiters.get(key) ?? [];
    waiters.delete(key);

    for (const resolve of keyWaiters) {
      resolve();
    }
  }

  private resolvePrefixWaiters(
    waiters: Array<{ prefix: string; resolve: () => void }>,
    key: string
  ): void {
    const matchingWaiters = waiters.filter(({ prefix }) =>
      key.startsWith(prefix)
    );

    for (const waiter of matchingWaiters) {
      const index = waiters.indexOf(waiter);

      if (index >= 0) {
        waiters.splice(index, 1);
      }

      waiter.resolve();
    }
  }
}

class TestWebStorage implements WebStorage {
  readonly values = new Map<string, string>();
  throwOnGet = false;

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error("Synthetic localStorage method failure.");
    }

    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }
}

void verifyBloomPersistence()
  .then(() => {
    console.log("Bloom persistence verification passed.");
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown verification failure.";
    console.error(`Bloom persistence verification failed: ${message}`);
    process.exitCode = 1;
  });
