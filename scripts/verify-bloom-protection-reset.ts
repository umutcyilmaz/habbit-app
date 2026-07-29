import { routes } from "../src/constants/navigation";
import { createDemoInitialState } from "../src/domain/demo/demoInitialState";
import {
  getNextBloomAction,
  type NextBloomAction
} from "../src/domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../src/domain/journey/nextBloomActionPresentation";
import {
  completeTodayResetState,
  configureProtectionState,
  createDefaultBloomState,
  getCompletedResetDates,
  getCompletedResetDayCount,
  isResetProgramComplete,
  isTodayCompleted,
  pauseProtectionState,
  resumeProtectionState,
  turnOffProtectionState,
  type ArousalControlPracticeLog,
  type BloomLocalState,
  type ProtectionConfiguration,
  type RecommendedFirstAction
} from "../src/storage/bloomState";
import {
  loadBloomLocalState,
  persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";

const todayKey = "2026-07-27";
const setupTimestamp = "2026-07-27T08:00:00.000Z";
const completionTimestamp = "2026-07-27T08:02:00.000Z";
const fixedNow = () => new Date("2026-07-27T12:00:00.000Z");
const resetDates = Array.from(
  { length: 10 },
  (_, index) => `2026-07-${String(index + 18).padStart(2, "0")}`
);
const nightConfiguration: ProtectionConfiguration = {
  preferredWindow: "night",
  level: "strong",
  adultContentPauseEnabled: true,
  nightStartTime: "22:00",
  nightEndTime: "08:00"
};

async function verifyProtectionAndReset() {
  verifyDefaultProtectionState();
  verifyProtectionSetup();
  verifyProtectionPause();
  verifyProtectionResume();
  verifyProtectionTurnOff();
  verifyPausedProtectionReconfiguration();
  await verifyActiveProtectionReload();
  await verifyPausedProtectionReload();
  verifyLegacyEnabledProtectionMigration();
  verifyLegacyContradictoryProtectionMigration();
  verifyDemoProtectionHasNoAuthority();
  verifyFirstResetCompletion();
  verifyDuplicateResetCompletion();
  verifyInvalidResetDateRejected();
  verifyNineResetDaysAreNotTerminal();
  verifyTenthResetDayIsTerminal();
  verifyEleventhResetDayRejected();
  verifyDuplicateTerminalResetDates();
  verifyInvalidTerminalResetDates();
  verifyInvalidResetStartIsNotTerminal();
  verifySavedRouteRequiresToday();
  verifyTerminalResetStartsPractice();
  verifyTerminalResetWithPracticeShowsProgress();
  verifyLegacyResetMigration();
  verifyPausedProtectionJourney();
  verifyActiveProtectionJourney();
  verifyActiveResetPriority();
  verifyTerminalResetPriority();
  verifyCrossFeatureActionContract();
  verifyInvalidProtectionValuesRejected();

  console.log("Bloom Protection and Reset verification passed.");
}

function verifyDefaultProtectionState() {
  const state = completedState("setupProtection");

  assert(
    state.protection.status === "off",
    "Default Protection status should be off."
  );
  expectAction(
    getNextBloomAction(state, todayKey),
    "setupProtection",
    routes.protectSetup,
    "Default Protection should not count as ready."
  );
}

function verifyProtectionSetup() {
  const configuredState = createConfiguredProtectionState();

  assert(
    configuredState.protection.status === "active" &&
      configuredState.protection.setupCompletedAt === setupTimestamp &&
      configuredState.protection.preferredWindow === "night" &&
      configuredState.protection.level === "strong" &&
      configuredState.protection.adultContentPauseEnabled &&
      configuredState.protection.nightStartTime === "22:00" &&
      configuredState.protection.nightEndTime === "08:00",
    "Protection setup should activate and persist every supported selection."
  );
}

function verifyProtectionPause() {
  const configuredState = createConfiguredProtectionState();
  const beforeConfiguration = getProtectionConfigurationSnapshot(configuredState);
  const pausedState = pauseProtectionState(configuredState);

  assert(
    pausedState.protection.status === "paused",
    "Active Protection should transition to paused."
  );
  assert(
    getProtectionConfigurationSnapshot(pausedState) === beforeConfiguration,
    "Pausing Protection should preserve configuration."
  );
}

function verifyProtectionResume() {
  const pausedState = pauseProtectionState(createConfiguredProtectionState());
  const beforeConfiguration = getProtectionConfigurationSnapshot(pausedState);
  const resumedState = resumeProtectionState(pausedState);

  assert(
    resumedState.protection.status === "active",
    "Paused Protection should resume to active."
  );
  assert(
    getProtectionConfigurationSnapshot(resumedState) === beforeConfiguration,
    "Resuming Protection should preserve configuration."
  );
}

function verifyProtectionTurnOff() {
  const configuredState = createConfiguredProtectionState();
  const beforeConfiguration = getProtectionConfigurationSnapshot(configuredState);
  const offState = turnOffProtectionState(configuredState);

  assert(
    offState.protection.status === "off",
    "Turning Protection off should set the authoritative status to off."
  );
  assert(
    getProtectionConfigurationSnapshot(offState) === beforeConfiguration,
    "Turning Protection off may preserve configuration for later reuse."
  );
  expectAction(
    getNextBloomAction(offState, todayKey),
    "setupProtection",
    routes.protectSetup,
    "Off Protection must not count as ready."
  );
}

function verifyPausedProtectionReconfiguration() {
  const pausedState = pauseProtectionState(createConfiguredProtectionState());
  const reconfiguredState = configureProtectionState(
    pausedState,
    {
      preferredWindow: "custom",
      level: "balanced",
      adultContentPauseEnabled: true,
      nightStartTime: "21:30",
      nightEndTime: "07:30"
    },
    "2026-07-27T10:00:00.000Z"
  );

  assert(
    reconfiguredState.protection.status === "paused" &&
      reconfiguredState.protection.preferredWindow === "custom" &&
      reconfiguredState.protection.level === "balanced" &&
      reconfiguredState.protection.setupCompletedAt === setupTimestamp,
    "Reconfiguration should update settings without silently resuming Protection."
  );
}

async function verifyActiveProtectionReload() {
  const reloadedState = await reloadState(createConfiguredProtectionState());

  assert(
    reloadedState.protection.status === "active" &&
      reloadedState.protection.level === "strong" &&
      reloadedState.protection.nightStartTime === "22:00" &&
      reloadedState.protection.nightEndTime === "08:00",
    "Active Protection status and settings should survive reload."
  );
}

async function verifyPausedProtectionReload() {
  const pausedState = pauseProtectionState(createConfiguredProtectionState());
  const reloadedState = await reloadState(pausedState);

  assert(
    reloadedState.protection.status === "paused" &&
      getProtectionConfigurationSnapshot(reloadedState) ===
        getProtectionConfigurationSnapshot(pausedState),
    "Paused Protection and its settings should survive reload."
  );
}

function verifyLegacyEnabledProtectionMigration() {
  const result = validateAndNormalizeBloomState({
    protection: {
      isEnabled: true,
      setupCompletedAt: setupTimestamp,
      preferredWindow: "night",
      adultContentPauseEnabled: true
    }
  });

  assert(result.success, "A valid legacy Protection object should normalize.");
  assert(
    result.state.protection.status === "active" &&
      result.state.protection.preferredWindow === "night" &&
      result.state.protection.nightStartTime === "22:00" &&
      result.state.protection.nightEndTime === "08:00",
    "Legacy isEnabled=true should migrate to canonical active Protection."
  );
  assert(
    !("isEnabled" in result.state.protection),
    "Canonical Protection state should not retain the legacy Boolean authority."
  );
}

function verifyLegacyContradictoryProtectionMigration() {
  const result = validateAndNormalizeBloomState({
    protection: {
      isEnabled: false,
      setupCompletedAt: setupTimestamp,
      preferredWindow: "evening",
      adultContentPauseEnabled: true
    }
  });

  assert(result.success, "A contradictory legacy Protection object should normalize.");
  assert(
    result.state.protection.status === "off" &&
      result.state.protection.adultContentPauseEnabled,
    "Legacy isEnabled=false should remain truthfully off while preserving preferences."
  );
}

function verifyDemoProtectionHasNoAuthority() {
  const bloomState = completedState("setupProtection");
  const demoState = createDemoInitialState();

  assert(
    !("protection" in demoState),
    "Demo state should not retain a second Protection authority."
  );
  expectAction(
    getNextBloomAction(bloomState, todayKey),
    "setupProtection",
    routes.protectSetup,
    "Demo Protection state must not make Bloom Protection ready."
  );
}

function verifyFirstResetCompletion() {
  const state = completedState("startReset");
  const completedStateValue = completeTodayResetState(
    state,
    todayKey,
    completionTimestamp
  );

  assert(
    completedStateValue.tenDayReset.startedAt === todayKey &&
      getCompletedResetDates(completedStateValue.tenDayReset).length === 1 &&
      completedStateValue.tenDayReset.lastCompletedAt === completionTimestamp,
    "The first valid Reset completion should initialize and save one day."
  );
}

function verifyDuplicateResetCompletion() {
  const firstCompletion = completeTodayResetState(
    completedState("startReset"),
    todayKey,
    completionTimestamp
  );
  const duplicateCompletion = completeTodayResetState(
    firstCompletion,
    todayKey,
    "2026-07-27T09:00:00.000Z"
  );

  assert(
    duplicateCompletion === firstCompletion &&
      getCompletedResetDayCount(duplicateCompletion.tenDayReset) === 1,
    "Completing the same Reset date twice should be idempotent."
  );
}

function verifyInvalidResetDateRejected() {
  const state = completedState("startReset");
  const result = completeTodayResetState(
    state,
    "2026-02-30",
    completionTimestamp
  );

  assert(
    result === state && result.tenDayReset.completedDates.length === 0,
    "An invalid Reset date key should be rejected."
  );
}

function verifyNineResetDaysAreNotTerminal() {
  const state = resetStateWithDates(resetDates.slice(0, 9));

  assert(
    getCompletedResetDayCount(state.tenDayReset) === 9 &&
      !isResetProgramComplete(state.tenDayReset),
    "Nine valid Reset dates should not be terminal."
  );
}

function verifyTenthResetDayIsTerminal() {
  const state = resetStateWithDates(resetDates.slice(0, 9));
  const tenthDayState = completeTodayResetState(
    state,
    resetDates[9] ?? todayKey,
    completionTimestamp
  );

  assert(
    getCompletedResetDayCount(tenthDayState.tenDayReset) === 10 &&
      isResetProgramComplete(tenthDayState.tenDayReset),
    "The tenth unique Reset date should create terminal state."
  );
}

function verifyEleventhResetDayRejected() {
  const terminalState = resetStateWithDates(resetDates);
  const result = completeTodayResetState(
    terminalState,
    "2026-07-28",
    "2026-07-28T08:02:00.000Z"
  );

  assert(
    result === terminalState &&
      result.tenDayReset.completedDates.length === 10,
    "A terminal Reset should reject an eleventh completion."
  );
}

function verifyDuplicateTerminalResetDates() {
  const state = resetStateWithDates([
    ...resetDates,
    resetDates[0] ?? "2026-07-18",
    resetDates[1] ?? "2026-07-19"
  ]);

  assert(
    getCompletedResetDayCount(state.tenDayReset) === 10 &&
      isResetProgramComplete(state.tenDayReset),
    "Duplicate Reset dates should count once at terminal state."
  );
}

function verifyInvalidTerminalResetDates() {
  const state = resetStateWithDates([
    ...resetDates,
    "2026-02-30",
    "not-a-date"
  ]);
  const completedDates = getCompletedResetDates(state.tenDayReset);

  assert(
    completedDates.length === 10 &&
      completedDates.every((dateKey) => !dateKey.includes("not")),
    "Invalid Reset dates should not enter the trusted completion set."
  );
}

function verifyInvalidResetStartIsNotTerminal() {
  const state = resetStateWithDates(resetDates);
  state.tenDayReset.startedAt = "not-a-date";

  assert(
    !isResetProgramComplete(state.tenDayReset),
    "Ten dates without a valid Reset start must not create terminal state."
  );
}

function verifySavedRouteRequiresToday() {
  const state = resetStateWithDates(resetDates.slice(0, 3));

  assert(
    !isTodayCompleted(state.tenDayReset, todayKey),
    "Saved success should not render without a valid completion for today."
  );
  expectAction(
    getNextBloomAction(state, todayKey),
    "completeTodayReset",
    routes.tenDayResetPractice,
    "Direct Saved access without today should fall back to the active Reset action."
  );
}

function verifyTerminalResetStartsPractice() {
  const state = resetStateWithDates(resetDates);

  expectAction(
    getNextBloomAction(state, todayKey),
    "startArousalPractice",
    routes.arousalControl,
    "Terminal Reset without a practice log should start guided practice."
  );
}

function verifyTerminalResetWithPracticeShowsProgress() {
  const state = resetStateWithDates(resetDates);
  state.arousalControl.logs = [validPracticeLog()];

  expectAction(
    getNextBloomAction(state, todayKey),
    "viewPracticeProgress",
    routes.arousalControlProgressPreview,
    "Terminal Reset with a valid practice log should show progress."
  );
}

function verifyLegacyResetMigration() {
  const result = validateAndNormalizeBloomState({
    tenDayReset: {
      startedAt: "2026-07-18T08:00:00.000Z",
      completedDates: [
        ...resetDates,
        resetDates[0],
        "2026-02-30",
        "not-a-date",
        "2026-07-28"
      ],
      lastCompletedAt: completionTimestamp
    }
  });

  assert(result.success, "Legacy Reset state should normalize.");
  assert(
    result.state.tenDayReset.startedAt === "2026-07-18" &&
      result.state.tenDayReset.completedDates.length === 10 &&
      isResetProgramComplete(result.state.tenDayReset),
    "Legacy Reset dates should be validated, deduplicated, capped, and terminal."
  );
}

function verifyPausedProtectionJourney() {
  const pausedState = pauseProtectionState(createConfiguredProtectionState());

  expectAction(
    getNextBloomAction(pausedState, todayKey),
    "resumeProtection",
    routes.protectActive,
    "Paused Protection should not advance a Porn profile to Reset."
  );
}

function verifyActiveProtectionJourney() {
  const activeState = createConfiguredProtectionState();

  expectAction(
    getNextBloomAction(activeState, todayKey),
    "startReset",
    routes.tenDayReset,
    "Active Protection should advance a Porn profile to Reset."
  );
}

function verifyActiveResetPriority() {
  const state = createConfiguredProtectionState();
  state.tenDayReset.startedAt = "2026-07-26";

  expectAction(
    getNextBloomAction(state, todayKey),
    "completeTodayReset",
    routes.tenDayResetPractice,
    "An active Reset should override Protection and profile actions."
  );
}

function verifyTerminalResetPriority() {
  const state = resetStateWithDates([
    ...resetDates.slice(0, 9),
    todayKey
  ]);

  expectAction(
    getNextBloomAction(state, todayKey),
    "startArousalPractice",
    routes.arousalControl,
    "Terminal Reset should override the active-today completed state."
  );
}

function verifyCrossFeatureActionContract() {
  const state = pauseProtectionState(createConfiguredProtectionState());
  const action = getNextBloomAction(state, todayKey);
  const consumers = ["Today", "Result", "Progress", "Debug"].map(
    (consumer) => ({
      consumer,
      id: action.id,
      route: action.route,
      label: getNextBloomActionLabel(action)
    })
  );
  const expected = consumers[0];

  assert(expected !== undefined, "A shared journey action fixture should exist.");
  assert(
    consumers.every(
      (consumer) =>
        consumer.id === expected.id &&
        consumer.route === expected.route &&
        consumer.label === expected.label
    ),
    "All consumers should share the canonical action, route, and label."
  );
}

function verifyInvalidProtectionValuesRejected() {
  const invalidStatus = validateAndNormalizeBloomState({
    protection: { status: "running" }
  });
  const invalidLevel = validateAndNormalizeBloomState({
    protection: { status: "active", level: "maximum" }
  });
  const invalidTime = validateAndNormalizeBloomState({
    protection: {
      status: "active",
      preferredWindow: "night",
      nightStartTime: "25:00"
    }
  });
  const state = completedState("setupProtection");
  const invalidMutation = configureProtectionState(
    state,
    {
      ...nightConfiguration,
      level: "maximum"
    } as unknown as ProtectionConfiguration,
    setupTimestamp
  );

  assert(
    !invalidStatus.success &&
      !invalidLevel.success &&
      !invalidTime.success &&
      invalidMutation === state,
    "Invalid Protection status, level, and time values must be rejected."
  );
}

function createConfiguredProtectionState() {
  return configureProtectionState(
    completedState("setupProtection"),
    nightConfiguration,
    setupTimestamp
  );
}

function completedState(
  recommendedFirstAction: RecommendedFirstAction
): BloomLocalState {
  const state = createDefaultBloomState();
  state.onboarding.completed = true;
  state.onboarding.completedAt = setupTimestamp;
  state.activePlan.recommendedFirstAction = recommendedFirstAction;
  return state;
}

function resetStateWithDates(dates: string[]): BloomLocalState {
  const state = completedState("setupProtection");
  state.tenDayReset.startedAt = resetDates[0] ?? "2026-07-18";
  state.tenDayReset.completedDates = [...dates];
  state.tenDayReset.lastCompletedAt = completionTimestamp;
  return state;
}

function validPracticeLog(): ArousalControlPracticeLog {
  return {
    id: "practice-1",
    startedAt: "2026-07-27T09:00:00.000Z",
    completedAt: "2026-07-27T09:10:00.000Z",
    dateKey: todayKey,
    completionStatus: "completed",
    mode: "onePause",
    focus: "noticeRising",
    adultContent: "no",
    firmnessPlan: "appSuggest",
    endingChoice: "stoppedByChoice",
    reflectionCompleted: true,
    durationPreference: "notLogged"
  };
}

function getProtectionConfigurationSnapshot(state: BloomLocalState) {
  const protection = state.protection;

  return JSON.stringify({
    setupCompletedAt: protection.setupCompletedAt,
    preferredWindow: protection.preferredWindow,
    level: protection.level,
    adultContentPauseEnabled: protection.adultContentPauseEnabled,
    nightStartTime: protection.nightStartTime,
    nightEndTime: protection.nightEndTime
  });
}

async function reloadState(state: BloomLocalState): Promise<BloomLocalState> {
  const client = createMemoryStorageClient();
  await persistBloomLocalState(state, client, fixedNow);
  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "Persisted Bloom state should reload.");
  return result.state;
}

function expectAction(
  action: NextBloomAction,
  id: NextBloomAction["id"],
  route: NextBloomAction["route"],
  message: string
) {
  assert(
    action.id === id && action.route === route,
    `${message} Received ${action.id} -> ${action.route}.`
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

verifyProtectionAndReset().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown verification failure.";
  console.error(`Bloom Protection and Reset verification failed: ${message}`);
  process.exitCode = 1;
});
