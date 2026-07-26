import {
  createDefaultBloomState,
  type BloomLocalState,
  type QuizResult
} from "../src/storage/bloomState";
import {
  BLOOM_CORRUPT_BACKUP_PREFIX,
  BLOOM_LEGACY_STATE_STORAGE_KEYS,
  BLOOM_STATE_STORAGE_KEY,
  createBloomStateWriteQueue,
  loadBloomLocalState,
  persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import type { StorageClient } from "../src/storage/storageClient";

const fixedNow = () => new Date("2026-07-22T10:00:00.000Z");

async function verifyBloomPersistence() {
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

  console.log("Bloom persistence verification passed.");
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

  assert(result.status === "success", "A version 2 envelope should load.");
  assert(result.source === "current", "A version 2 envelope should report current source.");
  assert(!result.needsPersist, "A canonical version 2 envelope should not migrate again.");
  assert(result.state.debug.dateOffsetDays === 3, "Current values should survive hydration.");
}

async function verifyPartialCurrentNormalization() {
  const client = new TestStorageClient();
  await client.setItem(
    BLOOM_STATE_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      savedAt: fixedNow().toISOString(),
      state: { onboarding: { completed: true } }
    })
  );

  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "A partial version 2 state should normalize safely.");
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
  assert(result.state.protection.isEnabled, "Protection enabled state should survive.");
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

  await Promise.all([enqueueWrite(firstState), enqueueWrite(latestState)]);

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
  readonly failWritesFor = new Set<string>();
  readonly writeDelays: number[] = [];
  readonly completedWrites: string[] = [];

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const delay = this.writeDelays.shift() ?? 0;

    if (delay > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
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
    this.values.delete(key);
  }
}

void verifyBloomPersistence();
