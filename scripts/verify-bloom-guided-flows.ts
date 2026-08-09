import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { BloomPersistenceRetryToken } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { routes } from "../src/constants/navigation";
import { getNextBloomAction } from "../src/domain/journey/getNextBloomAction";
import {
  formatArousalPauseCount,
  createInitialDurationInputState,
  durationInputReducer,
  mapReflectionPauseCount,
  resolveDurationSubmission,
  type DurationInputAction,
  type DurationInputState
} from "../src/features/arousal-control/practiceSubmission";
import {
  createCheckInSubmission,
  prepareCheckInSubmission,
  updateSavedCheckIn
} from "../src/features/log/checkInSubmission";
import {
  clearCheckInPersistenceFeedback,
  getCheckInFeedbackPresentation,
  resolveCheckInPersistenceFeedback,
  routeCheckInPersistenceFeedback
} from "../src/features/log/checkInFeedback";
import { createProtectionNavigationFocusGuard } from "../src/features/protect/protectionNavigationFocusGuard";
import { resolvePauseAgainUpdate } from "../src/features/pause/pauseSessionAdapters";
import {
  createPauseTimerSessionSnapshot,
  extendPauseTimerRemainingSeconds,
  extendPauseTimerSnapshot,
  getPauseTimerElapsedSeconds,
  getPauseTimerRemainingSeconds,
  reconcilePauseTimerRemainingSeconds
} from "../src/features/pause/pauseTimerState";
import {
  clearAllBloomStorage,
  loadBloomLocalState,
  persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import {
  addPauseSessionDurationState,
  completeArousalSessionState,
  completeNewPauseSessionState,
  completePauseSessionState,
  createDefaultBloomState,
  discardArousalSessionState,
  discardPauseSessionState,
  editCompletedArousalLogState,
  getLatestArousalControlLog,
  getLatestBloomCheckInRecord,
  getLatestPauseRecord,
  getLatestValidArousalLog,
  getPauseSavedRouteState,
  isValidCompletedArousalLog,
  MAX_BLOOM_NOTE_LENGTH,
  saveBloomCheckInRecordState,
  startArousalSessionState,
  startPauseSessionState,
  updateArousalSessionState,
  updatePauseSessionState,
  type ArousalControlDraft,
  type BloomCheckInRecord,
  type BloomLocalState,
  type PauseSessionDraft
} from "../src/storage/bloomState";

const startedAt = "2026-07-27T20:00:00.000Z";
const completedAt = "2026-07-27T20:03:00.000Z";
const dateKey = "2026-07-27";
const fixedNow = () => new Date("2026-07-27T21:00:00.000Z");

async function verifyGuidedFlows() {
  await verifyCheckIns();
  await verifyPauseLifecycle();
  await verifyArousalLifecycle();
  verifyDurationAdapters();
  await verifyCrossStateRules();
  await verifyPersistenceUiRegressions();
  verifyDemoConsumerScan();

  console.log("Bloom guided-flow verification passed.");
}

async function verifyCheckIns() {
  const record: BloomCheckInRecord = {
    id: "check-in-distinct",
    createdAt: startedAt,
    mood: "restless",
    moment: "scrolling",
    eventType: "paused",
    note: "Put the phone down before continuing."
  };
  const saved = saveBloomCheckInRecordState(
    createDefaultBloomState(),
    record
  );

  assert(
    JSON.stringify(getLatestBloomCheckInRecord(saved.checkIns.records)) ===
      JSON.stringify(record),
    "A Check-In should preserve every non-default saved value."
  );

  const reloaded = await reloadState(saved);
  assert(
    JSON.stringify(
      getLatestBloomCheckInRecord(reloaded.checkIns.records)
    ) === JSON.stringify(record),
    "A Check-In should preserve exact values across persistence reload."
  );

  const updated = saveBloomCheckInRecordState(saved, {
    ...record,
    mood: "calm"
  });
  assert(
    updated.checkIns.records.length === 1 &&
      updated.checkIns.records[0]?.mood === "calm",
    "Saving an existing Check-In id should update one record, not append a duplicate."
  );

  const firstSubmission = createCheckInSubmission(
    {
      mood: "bored",
      moment: "alone",
      eventType: "urge"
    },
    { now: fixedNow(), randomValue: 0.1 }
  );
  const secondSubmission = createCheckInSubmission(
    {
      mood: "stressed",
      moment: "stress",
      eventType: "paused"
    },
    {
      now: fixedNow(),
      randomValue: 0.2,
      previousCreatedAt: firstSubmission.createdAt
    }
  );
  const twoCheckIns = saveBloomCheckInRecordState(
    saveBloomCheckInRecordState(
      createDefaultBloomState(),
      firstSubmission
    ),
    secondSubmission
  );
  assert(
    twoCheckIns.checkIns.records.length === 2 &&
      firstSubmission.id !== secondSubmission.id &&
      firstSubmission.createdAt !== secondSubmission.createdAt &&
      Date.parse(secondSubmission.createdAt) >
        Date.parse(firstSubmission.createdAt),
    "Two logical Check-Ins without a remount need distinct ids and monotonic timestamps."
  );

  const firstWithContext = updateSavedCheckIn(firstSubmission, {
    eventType: "both",
    note: "Only the first moment should change."
  });
  const targetedUpdate = saveBloomCheckInRecordState(
    twoCheckIns,
    firstWithContext
  );
  assert(
    targetedUpdate.checkIns.records.length === 2 &&
      targetedUpdate.checkIns.records.find(
        (candidate) => candidate.id === firstSubmission.id
      )?.note === "Only the first moment should change." &&
      targetedUpdate.checkIns.records.find(
        (candidate) => candidate.id === secondSubmission.id
      )?.note === undefined,
    "Adding Check-In detail should update only the deliberately targeted saved id."
  );

  const maximumNote = "n".repeat(MAX_BLOOM_NOTE_LENGTH);
  const oversizedNote = `${maximumNote}n`;
  const acceptedSubmission = prepareCheckInSubmission(
    {
      mood: "neutral",
      moment: "evening",
      noteValue: maximumNote
    },
    { now: fixedNow(), randomValue: 0.3 }
  );
  const rejectedSubmission = prepareCheckInSubmission(
    {
      mood: "neutral",
      moment: "evening",
      noteValue: oversizedNote
    },
    { now: fixedNow(), randomValue: 0.4 }
  );
  assert(
    acceptedSubmission.ok,
    "A 5000-character Check-In note should prepare successfully."
  );
  const noteBoundaryState = saveBloomCheckInRecordState(
    createDefaultBloomState(),
    acceptedSubmission.record
  );
  const previousSavedRecordId = acceptedSubmission.record.id;
  let stateAfterRejectedSubmission = noteBoundaryState;
  let lastSavedRecordIdAfterFailure = previousSavedRecordId;
  let retainedInputAfterFailure = oversizedNote;

  if (rejectedSubmission.ok) {
    stateAfterRejectedSubmission = saveBloomCheckInRecordState(
      stateAfterRejectedSubmission,
      rejectedSubmission.record
    );
    lastSavedRecordIdAfterFailure = rejectedSubmission.record.id;
    retainedInputAfterFailure = "";
  }

  const rejectionPresentation = rejectedSubmission.ok
    ? null
    : getCheckInFeedbackPresentation(rejectedSubmission.feedback);
  assert(
    acceptedSubmission.record.note?.length === MAX_BLOOM_NOTE_LENGTH &&
      !rejectedSubmission.ok &&
      rejectionPresentation?.status === "error" &&
      rejectionPresentation.heading === "Check-in not saved" &&
      noteBoundaryState.checkIns.records.length === 1 &&
      stateAfterRejectedSubmission === noteBoundaryState &&
      lastSavedRecordIdAfterFailure === previousSavedRecordId &&
      retainedInputAfterFailure === oversizedNote,
    "The screen submission adapter must reject 5001 characters without clearing input, creating a record, or replacing the saved id."
  );

  const failedSaveFeedback = resolveCheckInPersistenceFeedback(
    {
      ok: false,
      accepted: true,
      persisted: false,
      sequence: 1,
      reason: "persistenceInvalidated",
      retryable: false
    },
    "Saved.",
    "This moment could not be saved yet.",
    "This moment"
  );
  const failedSavePresentation = getCheckInFeedbackPresentation(
    failedSaveFeedback
  );
  const successfulSaveFeedback = resolveCheckInPersistenceFeedback(
    {
      ok: true,
      accepted: true,
      persisted: true,
      sequence: 2
    },
    "Your recent activity now includes this moment.",
    "This moment could not be saved yet.",
    "This moment"
  );
  const successfulSavePresentation = getCheckInFeedbackPresentation(
    successfulSaveFeedback
  );
  const unknownSaveFeedback = resolveCheckInPersistenceFeedback(
    {
      ok: false,
      accepted: true,
      persisted: false,
      sequence: 3,
      reason: "persistenceUnknown",
      retryable: true,
      retryToken: 3 as BloomPersistenceRetryToken
    },
    "Saved.",
    "This moment could not be saved yet.",
    "This moment"
  );
  const unknownSavePresentation = getCheckInFeedbackPresentation(
    unknownSaveFeedback
  );
  assert(
    failedSaveFeedback.status === "error" &&
      failedSavePresentation.heading === "Check-in not saved" &&
      failedSavePresentation.message ===
        "This moment was updated in this session, but Bloom couldn’t confirm a local save." &&
      successfulSaveFeedback.status === "success" &&
      successfulSavePresentation.heading === "Check-in saved" &&
      unknownSaveFeedback.status === "pending" &&
      unknownSavePresentation.heading === "Save still pending",
    "The production feedback adapter must distinguish failed, pending, and successful Check-In persistence."
  );

  const noteFailureFeedback = resolveCheckInPersistenceFeedback(
    {
      ok: false,
      accepted: true,
      persisted: false,
      sequence: 4,
      reason: "persistenceSuperseded",
      retryable: false
    },
    "Note saved with this check-in.",
    "This note could not be saved yet.",
    "This note"
  );
  const feedbackBeforeNoteSave = {
    checkInFeedback: successfulSaveFeedback,
    reflectionStatus: "Previous reflection feedback."
  };
  const feedbackWhileNoteSaves = clearCheckInPersistenceFeedback(
    feedbackBeforeNoteSave,
    "note"
  );
  const feedbackAfterNoteFailure = routeCheckInPersistenceFeedback(
    feedbackWhileNoteSaves,
    "note",
    noteFailureFeedback
  );
  assert(
    feedbackWhileNoteSaves.checkInFeedback === successfulSaveFeedback &&
      feedbackWhileNoteSaves.reflectionStatus === undefined &&
      feedbackAfterNoteFailure.checkInFeedback === successfulSaveFeedback &&
      feedbackAfterNoteFailure.reflectionStatus ===
        "This note was replaced by a newer change and was not saved by this request.",
    "A note save must clear and update only reflection feedback without replacing the truthful Check-In alert."
  );

  const retrySubmission = prepareCheckInSubmission(
    {
      mood: "calm",
      moment: "evening",
      noteValue: "A shorter note on retry."
    },
    {
      now: fixedNow(),
      randomValue: 0.6,
      previousCreatedAt: acceptedSubmission.record.createdAt
    }
  );
  assert(
    retrySubmission.ok,
    "A valid retry should prepare after an oversized note failure."
  );
  const retryState = saveBloomCheckInRecordState(
    stateAfterRejectedSubmission,
    retrySubmission.record
  );
  const retryMutationResult =
    retryState !== stateAfterRejectedSubmission
      ? ({
          ok: true,
          accepted: true,
          persisted: true,
          sequence: 3
        } as const)
      : ({
          ok: false,
          accepted: false,
          persisted: false,
          sequence: 3,
          reason: "invalidRecord",
          retryable: false
        } as const);
  const retryFeedback = resolveCheckInPersistenceFeedback(
    retryMutationResult,
    "Your recent activity now includes this moment.",
    "This moment could not be saved yet.",
    "This moment"
  );
  const latestRetryRecord = getLatestBloomCheckInRecord(
    retryState.checkIns.records
  );
  assert(
    retryState.checkIns.records.length === 2 &&
      retryFeedback.status === "success" &&
      latestRetryRecord?.id === retrySubmission.record.id &&
      latestRetryRecord.mood === retrySubmission.record.mood &&
      latestRetryRecord.moment === retrySubmission.record.moment &&
      latestRetryRecord.note === retrySubmission.record.note,
    "Retrying valid Check-In input should create exactly one record and replace error feedback with success."
  );

  assert(
    createDefaultBloomState().checkIns.records.length === 0,
    "An empty Check-In history must not contain sample activity."
  );
}

async function verifyPauseLifecycle() {
  const initialTimerSnapshot = createPauseTimerSessionSnapshot({
    id: "pause-timer-screen",
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  });
  const initialRemainingSeconds = getPauseTimerRemainingSeconds(
    initialTimerSnapshot
  );
  const extendedFromStartSnapshot = extendPauseTimerSnapshot(
    initialTimerSnapshot,
    60
  );
  const extendedFromStartRemaining = extendPauseTimerRemainingSeconds(
    initialRemainingSeconds,
    60
  );
  assert(
    initialRemainingSeconds === 90 &&
      extendedFromStartSnapshot.configuredDurationSeconds === 150 &&
      extendedFromStartRemaining === 150,
    "Adding 60 seconds at timer start should produce exactly 150 seconds remaining."
  );

  const remainingAfterTenSeconds = 80;
  const extendedAfterTenSecondsSnapshot = extendPauseTimerSnapshot(
    initialTimerSnapshot,
    60
  );
  const extendedAfterTenSecondsRemaining =
    extendPauseTimerRemainingSeconds(remainingAfterTenSeconds, 60);
  const reconciledFromCanonicalExtension =
    reconcilePauseTimerRemainingSeconds(
      remainingAfterTenSeconds,
      initialTimerSnapshot,
      extendedAfterTenSecondsSnapshot
    );
  const reconciledAfterOptimisticExtension =
    reconcilePauseTimerRemainingSeconds(
      extendedAfterTenSecondsRemaining,
      extendedAfterTenSecondsSnapshot,
      extendedAfterTenSecondsSnapshot
    );
  assert(
    extendedAfterTenSecondsRemaining === 140 &&
      reconciledFromCanonicalExtension === 140 &&
      reconciledAfterOptimisticExtension === 140 &&
      getPauseTimerElapsedSeconds(
        extendedAfterTenSecondsSnapshot,
        extendedAfterTenSecondsRemaining
      ) === 10,
    "Adding time after 10 elapsed seconds must preserve those 10 seconds across provider reconciliation."
  );

  const rapidlyExtendedSnapshot = extendPauseTimerSnapshot(
    extendedAfterTenSecondsSnapshot,
    60
  );
  const rapidlyExtendedRemaining = extendPauseTimerRemainingSeconds(
    extendedAfterTenSecondsRemaining,
    60
  );
  assert(
    rapidlyExtendedSnapshot.configuredDurationSeconds === 210 &&
      rapidlyExtendedRemaining === 200 &&
      getPauseTimerElapsedSeconds(
        rapidlyExtendedSnapshot,
        rapidlyExtendedRemaining
      ) === 10,
    "Two rapid Add 60 operations after 10 elapsed seconds must add exactly 120 without restoring elapsed time."
  );

  const extendedRoundDraft: PauseSessionDraft = {
    id: "pause-extended-screen",
    startedAt,
    phase: "timer",
    triggers: ["stress", "socialMedia"],
    intensityBefore: 8,
    selectedAction: "breathe3",
    timerStartedAt: startedAt,
    timerDurationSeconds:
      extendedAfterTenSecondsSnapshot.configuredDurationSeconds,
    elapsedDurationSeconds: 0
  };
  const extendedRoundElapsed = getPauseTimerElapsedSeconds(
    extendedAfterTenSecondsSnapshot,
    0
  );
  const extendedRoundFinished = updatePauseSessionState(
    startPauseSessionState(createDefaultBloomState(), extendedRoundDraft),
    extendedRoundDraft.id,
    {
      phase: "afterPause",
      elapsedDurationSeconds: extendedRoundElapsed
    }
  );
  const extendedRoundSaved = completePauseSessionState(
    extendedRoundFinished,
    extendedRoundDraft.id,
    {},
    completedAt
  );
  assert(
    extendedRoundElapsed === 150 &&
      getLatestPauseRecord(extendedRoundSaved.pause.records)
        ?.durationSeconds === 150,
    "Completing an extended screen timer should save its actual 150-second elapsed duration."
  );

  const extendedPauseAgainUpdate = resolvePauseAgainUpdate({
    ...extendedRoundDraft,
    phase: "afterPause",
    elapsedDurationSeconds: extendedRoundElapsed
  });
  const extendedPauseAgainSnapshot = createPauseTimerSessionSnapshot({
    ...extendedRoundDraft,
    ...extendedPauseAgainUpdate,
    elapsedDurationSeconds: extendedRoundElapsed
  });
  assert(
    extendedPauseAgainSnapshot.sessionId === extendedRoundDraft.id &&
      extendedPauseAgainSnapshot.configuredDurationSeconds === 240 &&
      extendedPauseAgainSnapshot.elapsedDurationSeconds === 150 &&
      getPauseTimerRemainingSeconds(extendedPauseAgainSnapshot) === 90,
    "Pause Again after an extension should retain the session and begin one coherent 90-second round."
  );

  const firstDraft: PauseSessionDraft = {
    id: "pause-distinct",
    startedAt,
    phase: "timer",
    triggers: ["stress", "socialMedia"],
    intensityBefore: 9,
    selectedAction: "continueMindfully",
    timerStartedAt: startedAt,
    timerDurationSeconds: 150,
    elapsedDurationSeconds: 37
  };
  const started = startPauseSessionState(
    createDefaultBloomState(),
    firstDraft
  );
  assert(
    JSON.stringify(started.pause.activeSession) ===
      JSON.stringify(firstDraft),
    "Pause start should preserve non-default check-in and timer values."
  );

  const updated = updatePauseSessionState(
    started,
    firstDraft.id,
    { elapsedDurationSeconds: 81 }
  );
  const completed = completePauseSessionState(
    updated,
    firstDraft.id,
    {
      intensityAfterChange: "aboutTheSame",
      feltTruth: "stillPulled",
      nextStep: "putPhoneAway"
    },
    completedAt
  );
  const record = getLatestPauseRecord(completed.pause.records);

  assert(
    record?.id === firstDraft.id &&
      record.intensityBefore === 9 &&
      record.intensityAfterChange === "aboutTheSame" &&
      record.triggers.join(",") === "stress,socialMedia" &&
      record.selectedAction === "continueMindfully" &&
      record.feltTruth === "stillPulled" &&
      record.nextStep === "putPhoneAway" &&
      record.durationSeconds === 81,
    "Pause completion should persist exact draft and completion values."
  );

  const repeated = completePauseSessionState(
    completed,
    firstDraft.id,
    { durationSeconds: 1 },
    "2026-07-27T20:04:00.000Z"
  );
  assert(
    repeated.pause.records.length === 1 &&
      repeated.pause.records[0]?.durationSeconds === 81,
    "Completing the same Pause id twice must not duplicate or overwrite it."
  );

  const atomicDraft: PauseSessionDraft = {
    id: "pause-atomic-save-and-close",
    startedAt,
    phase: "checkIn",
    triggers: ["nighttime", "habit"],
    intensityBefore: 6,
    selectedAction: "logAndClose",
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  };
  const atomicCompletion = completeNewPauseSessionState(
    createDefaultBloomState(),
    atomicDraft,
    { durationSeconds: 0 },
    completedAt
  );
  assert(
    atomicCompletion.pause.activeSession === null &&
      atomicCompletion.pause.records.length === 1 &&
      atomicCompletion.pause.records[0]?.id === atomicDraft.id &&
      atomicCompletion.pause.records[0]?.durationSeconds === 0 &&
      atomicCompletion.pause.records[0]?.triggers.join(",") ===
        "nighttime,habit",
    "Pause Save and close should create only one final record without exposing a draft state."
  );
  const repeatedAtomicCompletion = completeNewPauseSessionState(
    atomicCompletion,
    atomicDraft,
    { durationSeconds: 90 },
    "2026-07-27T20:04:00.000Z"
  );
  assert(
    repeatedAtomicCompletion.pause.activeSession === null &&
      repeatedAtomicCompletion.pause.records.length === 1 &&
      repeatedAtomicCompletion.pause.records[0]?.durationSeconds === 0,
    "Repeating atomic Pause Save and close must not duplicate or overwrite its final record."
  );

  const firstRound = startPauseSessionState(
    createDefaultBloomState(),
    {
      id: "pause-again",
      startedAt,
      phase: "afterPause",
      triggers: ["loneliness", "nighttime"],
      intensityBefore: 8,
      selectedAction: "breathe3",
      timerStartedAt: startedAt,
      timerDurationSeconds: 90,
      elapsedDurationSeconds: 90
    }
  );
  const sameSessionRound = updatePauseSessionState(
    firstRound,
    "pause-again",
    resolvePauseAgainUpdate(
      firstRound.pause.activeSession as PauseSessionDraft,
      "2026-07-27T20:01:30.000Z"
    )
  );
  assert(
    sameSessionRound.pause.activeSession?.id === "pause-again" &&
      sameSessionRound.pause.activeSession.startedAt === startedAt &&
      sameSessionRound.pause.activeSession.triggers.join(",") ===
        "loneliness,nighttime" &&
      sameSessionRound.pause.activeSession.intensityBefore === 8 &&
      sameSessionRound.pause.activeSession.selectedAction === "breathe3" &&
      sameSessionRound.pause.activeSession.timerDurationSeconds === 180 &&
      sameSessionRound.pause.activeSession.elapsedDurationSeconds === 90,
    "Pause Again should reset only the timer cycle and preserve the active session."
  );
  const secondRoundFinished = updatePauseSessionState(
    sameSessionRound,
    "pause-again",
    { phase: "afterPause", elapsedDurationSeconds: 180 }
  );
  const pauseAgainCompleted = completePauseSessionState(
    secondRoundFinished,
    "pause-again",
    {
      intensityAfterChange: "lower",
      feltTruth: "calmer",
      nextStep: "savePause"
    },
    completedAt
  );
  const pauseAgainRecord = getLatestPauseRecord(
    pauseAgainCompleted.pause.records
  );
  assert(
    pauseAgainCompleted.pause.records.length === 1 &&
      pauseAgainRecord?.id === "pause-again" &&
      pauseAgainRecord.triggers.join(",") === "loneliness,nighttime" &&
      pauseAgainRecord.intensityBefore === 8 &&
      pauseAgainRecord.selectedAction === "breathe3" &&
      pauseAgainRecord.durationSeconds === 180,
    "Two Pause rounds should save one record with original selections and accumulated duration."
  );

  const incrementStarted = startPauseSessionState(
    createDefaultBloomState(),
    {
      id: "pause-atomic-duration",
      startedAt,
      phase: "timer",
      triggers: ["stress"],
      timerDurationSeconds: 90,
      elapsedDurationSeconds: 0
    }
  );
  const incrementedTwice = addPauseSessionDurationState(
    addPauseSessionDurationState(
      incrementStarted,
      "pause-atomic-duration",
      60
    ),
    "pause-atomic-duration",
    60
  );
  assert(
    incrementedTwice.pause.activeSession?.timerDurationSeconds === 210,
    "Two rapid canonical Add 60 operations should retain the full 120-second increase."
  );
  const incrementFinished = updatePauseSessionState(
    incrementedTwice,
    "pause-atomic-duration",
    { phase: "afterPause", elapsedDurationSeconds: 210 }
  );
  const incrementSaved = completePauseSessionState(
    incrementFinished,
    "pause-atomic-duration",
    {},
    completedAt
  );
  assert(
    getLatestPauseRecord(incrementSaved.pause.records)
      ?.durationSeconds === 210,
    "The saved Pause duration should match the atomically incremented canonical duration."
  );

  assert(
    getPauseSavedRouteState(createDefaultBloomState().pause) ===
      "redirect",
    "Pause Saved without a record should choose a safe redirect."
  );
  assert(
    record !== null &&
      record.durationSeconds === 81 &&
      record.triggers[0] === "stress",
    "Pause Saved summary inputs should come only from the stored record."
  );

  const abandoned = discardPauseSessionState(started, firstDraft.id);
  const secondDraft: PauseSessionDraft = {
    id: "pause-new",
    startedAt: "2026-07-27T21:00:00.000Z",
    phase: "checkIn",
    triggers: [],
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  };
  const restarted = startPauseSessionState(abandoned, secondDraft);
  assert(
    restarted.pause.activeSession?.id === secondDraft.id &&
      restarted.pause.activeSession.intensityBefore === undefined &&
      restarted.pause.activeSession.triggers.length === 0,
    "A new Pause session must not inherit values from an abandoned draft."
  );

  const reloaded = await reloadState(completed);
  assert(
    stableJson(getLatestPauseRecord(reloaded.pause.records)) ===
      stableJson(record),
    "A completed Pause record should preserve exact values across reload."
  );
}

async function verifyArousalLifecycle() {
  const initialDraft: ArousalControlDraft = {
    id: "arousal-distinct",
    startedAt,
    dateKey,
    mode: "practicePlus"
  };
  const started = startArousalSessionState(
    createDefaultBloomState(),
    initialDraft
  );
  assert(
    started.arousalControl.draft?.mode === "practicePlus",
    "Arousal start should preserve the selected non-default mode."
  );

  const checkedIn = updateArousalSessionState(
    started,
    initialDraft.id,
    {
      focus: "reduceRushing",
      adultContent: "yes",
      firmnessPlan: "tryAgain",
      startingArousalLevel: 4,
      currentArousalLevel: 7,
      pauseZoneLevel: 7,
      afterPauseLevel: 3,
      afterPauseNextStep: "finishToday",
      endingChoice: "firmnessDecreased",
      highestArousal: 8,
      pauseCount: 3,
      pauseCountBucket: "3plus",
      controlFeeling: 0,
      anxietyLevel: 7,
      pleasureQuality: 9,
      pressureRushing: "veryHigh",
      firmnessChange: "decreasedDifficult",
      afterwardFeeling: "uneasy",
      reflectionCompleted: true,
      note: "The rise changed quickly."
    }
  );
  assert(
    checkedIn.arousalControl.draft?.focus === "reduceRushing" &&
      checkedIn.arousalControl.draft.controlFeeling === 0 &&
      checkedIn.arousalControl.draft.afterPauseLevel === 3,
    "Arousal draft updates should preserve non-default and zero values."
  );

  const completed = completeArousalSessionState(
    checkedIn,
    initialDraft.id,
    {
      durationPreference: "exact",
      durationSeconds: 783
    },
    completedAt
  );
  const log = getLatestValidArousalLog(completed.arousalControl.logs);
  assert(
    completed.arousalControl.logs.length === 1 &&
      log?.mode === "practicePlus" &&
      log.focus === "reduceRushing" &&
      log.startingArousalLevel === 4 &&
      log.pauseZoneLevel === 7 &&
      log.afterPauseLevel === 3 &&
      log.controlFeeling === 0 &&
      log.durationSeconds === 783 &&
      formatArousalPauseCount(
        log.pauseCount,
        log.pauseCountBucket
      ) === "3+",
    "One full Arousal session should produce one exact, valid completed log."
  );

  const repeated = completeArousalSessionState(
    completed,
    initialDraft.id,
    { durationPreference: "notLogged", durationSeconds: null },
    "2026-07-27T20:05:00.000Z"
  );
  assert(
    repeated.arousalControl.logs.length === 1 &&
      repeated.arousalControl.logs[0]?.durationSeconds === 783,
    "Repeated Arousal completion must not duplicate or mutate the completed log."
  );

  const activeOnly = startArousalSessionState(
    createDefaultBloomState(),
    initialDraft
  );
  assert(
    getLatestValidArousalLog(activeOnly.arousalControl.logs) === null &&
      getLatestArousalControlLog(activeOnly.arousalControl.logs) === null,
    "An active Arousal draft alone must not create terminal Saved data."
  );

  const edited = editCompletedArousalLogState(
    completed,
    initialDraft.id,
    { note: "Updated private note." }
  );
  const ignoredDraftEdit = updateArousalSessionState(
    edited,
    initialDraft.id,
    { highestArousal: 1 }
  );
  assert(
    ignoredDraftEdit.arousalControl.logs.length === 1 &&
      ignoredDraftEdit.arousalControl.logs[0]?.note ===
        "Updated private note." &&
      ignoredDraftEdit.arousalControl.logs[0]?.highestArousal === 8,
    "Post-completion edit/back paths must target the same log and never create a partial one."
  );

  const maximumNoteDraft = updateArousalSessionState(
    activeOnly,
    initialDraft.id,
    { note: "a".repeat(MAX_BLOOM_NOTE_LENGTH) }
  );
  const oversizedNoteDraft = updateArousalSessionState(
    maximumNoteDraft,
    initialDraft.id,
    { note: "a".repeat(MAX_BLOOM_NOTE_LENGTH + 1) }
  );
  assert(
    maximumNoteDraft.arousalControl.draft?.note?.length ===
      MAX_BLOOM_NOTE_LENGTH &&
      oversizedNoteDraft === maximumNoteDraft,
    "Arousal note mutations should persist the boundary value and reject an oversized programmatic value."
  );

  assert(
    getLatestValidArousalLog(
      createDefaultBloomState().arousalControl.logs
    ) === null,
    "Progress Preview without a valid completed log should choose a guard path."
  );

  const abandoned = discardArousalSessionState(
    activeOnly,
    initialDraft.id
  );
  const restarted = startArousalSessionState(abandoned, {
    id: "arousal-new",
    startedAt: "2026-07-27T21:00:00.000Z",
    dateKey,
    mode: "softAwareness"
  });
  assert(
    restarted.arousalControl.draft?.id === "arousal-new" &&
      restarted.arousalControl.draft.mode === "softAwareness" &&
      restarted.arousalControl.draft.focus === undefined,
    "A new Arousal session must not silently reuse an abandoned draft."
  );

  const reloaded = await reloadState(completed);
  assert(
    stableJson(
      getLatestValidArousalLog(reloaded.arousalControl.logs)
    ) === stableJson(log),
    "A completed Arousal log should preserve exact values across reload."
  );
}

function verifyDurationAdapters() {
  const preferNot = resolveDurationSubmission(
    createInitialDurationInputState()
  );
  assert(
    preferNot.ok &&
      preferNot.patch.durationPreference === "notLogged" &&
      preferNot.patch.durationSeconds === null,
    "Prefer not should be the only source of a not-logged duration."
  );

  const exact = applyDurationActions([
    { type: "selectExact" },
    { type: "setMinutes", value: "2" },
    { type: "setSeconds", value: "05" }
  ]);
  const exactSubmission = resolveDurationSubmission(exact);
  assert(
    exactSubmission.ok &&
      exactSubmission.patch.durationPreference === "exact" &&
      exactSubmission.patch.durationSeconds === 125,
    "Exact duration mode should persist only its validated minute and second inputs."
  );

  const range = applyDurationActions([
    { type: "selectRange", range: "fiveToTen" }
  ]);
  const rangeSubmission = resolveDurationSubmission(range);
  assert(
    rangeSubmission.ok &&
      rangeSubmission.patch.durationPreference === "estimated" &&
      rangeSubmission.patch.durationSeconds === 450,
    "Range duration mode should persist only the selected estimate."
  );

  const exactToRange = durationInputReducer(exact, {
    type: "selectRange",
    range: "oneToThree"
  });
  const exactToRangeSubmission =
    resolveDurationSubmission(exactToRange);
  assert(
    exactToRange.minutes === "" &&
      exactToRange.seconds === "" &&
      exactToRangeSubmission.ok &&
      exactToRangeSubmission.patch.durationPreference === "estimated" &&
      exactToRangeSubmission.patch.durationSeconds === 120,
    "Exact to Range should clear and ignore stale exact input."
  );

  const rangeToExact = durationInputReducer(range, {
    type: "selectExact"
  });
  assert(
    rangeToExact.selectedRange === null &&
      !resolveDurationSubmission(rangeToExact).ok,
    "Range to Exact should clear the range and require an exact duration."
  );

  const exactToPreferNot = durationInputReducer(exact, {
    type: "selectPreferNot"
  });
  const exactToPreferNotSubmission =
    resolveDurationSubmission(exactToPreferNot);
  assert(
    exactToPreferNot.minutes === "" &&
      exactToPreferNot.seconds === "" &&
      exactToPreferNotSubmission.ok &&
      exactToPreferNotSubmission.patch.durationPreference ===
        "notLogged" &&
      exactToPreferNotSubmission.patch.durationSeconds === null,
    "Exact to Prefer not should clear and ignore stale exact input."
  );

  const invalidSeconds = applyDurationActions([
    { type: "selectExact" },
    { type: "setSeconds", value: "60" }
  ]);
  const invalidSecondsSubmission =
    resolveDurationSubmission(invalidSeconds);
  assert(
    !invalidSecondsSubmission.ok &&
      invalidSecondsSubmission.reason === "invalidExactDuration",
    "Exact duration should reject seconds outside 0 through 59."
  );

  const threePlus = mapReflectionPauseCount("3plus");
  assert(
    threePlus.pauseCount === 3 &&
      threePlus.pauseCountBucket === "3plus" &&
      formatArousalPauseCount(
        threePlus.pauseCount,
        threePlus.pauseCountBucket
      ) === "3+",
    "The reflection adapter should preserve and display the semantic 3+ pause bucket."
  );
}

async function verifyCrossStateRules() {
  const completedPracticeState = completedArousalState();
  const action = getNextBloomAction(completedPracticeState, dateKey);
  assert(
    action.id === "viewPracticeProgress" &&
      action.route === routes.arousalControlProgressPreview,
    "A valid completed Arousal log should unlock practice progress."
  );

  const draftOnlyState = completedJourneyState();
  draftOnlyState.arousalControl.draft = {
    id: "draft-only",
    startedAt,
    dateKey,
    mode: "onePause"
  };
  const draftAction = getNextBloomAction(draftOnlyState, dateKey);
  assert(
    draftAction.id === "startArousalPractice",
    "An active Arousal draft must not count as completed practice."
  );

  const client = createMemoryStorageClient();
  const populated = completedPracticeState;
  populated.checkIns.records = [
    {
      id: "delete-check-in",
      createdAt: startedAt,
      mood: "calm",
      moment: "evening"
    }
  ];
  populated.pause.activeSession = {
    id: "delete-pause-draft",
    startedAt,
    phase: "timer",
    triggers: [],
    timerDurationSeconds: 90,
    elapsedDurationSeconds: 0
  };
  populated.pause.records = [
    {
      id: "delete-pause-record",
      startedAt,
      completedAt,
      triggers: [],
      durationSeconds: 90
    }
  ];
  await persistBloomLocalState(populated, client, fixedNow);
  await clearAllBloomStorage(client);
  const deletedResult = await loadBloomLocalState(client, fixedNow);
  assert(
    deletedResult.status === "success" &&
      deletedResult.state.checkIns.records.length === 0 &&
      deletedResult.state.pause.activeSession === null &&
      deletedResult.state.pause.records.length === 0 &&
      deletedResult.state.arousalControl.draft === null &&
      deletedResult.state.arousalControl.logs.length === 0,
    "Full local deletion should clear Check-In, Pause, and Arousal state."
  );

  const legacyResult = validateAndNormalizeBloomState({
    checkIns: {
      records: [
        {
          id: "legacy-check-in",
          createdAt: startedAt,
          mood: "calm",
          moment: "evening"
        },
        {
          id: "invalid-check-in",
          createdAt: startedAt,
          mood: "unsupported",
          moment: "evening"
        }
      ]
    },
    pause: {
      records: [
        {
          id: "legacy-pause",
          startedAt,
          completedAt,
          triggers: ["nighttime"],
          durationSeconds: 90
        },
        {
          id: "invalid-pause",
          startedAt,
          completedAt,
          triggers: ["unsupported"],
          durationSeconds: -1
        }
      ]
    },
    arousalControl: {
      draft: {
        startedAt,
        dateKey,
        anxietyLevel: 3
      },
      logs: [
        {
          id: "legacy-completed",
          startedAt,
          completedAt,
          dateKey,
          highestArousal: 7,
          pauseCount: 2,
          controlFeeling: 4,
          pleasureQuality: "8/10",
          pressureRushing: "high",
          firmnessChange: "Decreased, but I could continue",
          afterwardFeeling: "neutral",
          durationPreference: "exact",
          durationSeconds: 600
        },
        {
          id: "legacy-partial",
          startedAt,
          completedAt,
          dateKey,
          pleasureQuality: "7/10",
          firmnessChange: "Slightly decreased"
        },
        {
          id: "invalid-record",
          startedAt: "not-a-date",
          completedAt,
          dateKey
        }
      ]
    }
  });
  assert(
    legacyResult.success &&
      legacyResult.state.arousalControl.draft?.id.startsWith("arousal-") ===
        true &&
      legacyResult.state.arousalControl.logs.length === 2 &&
      legacyResult.state.checkIns.records.length === 1 &&
      legacyResult.state.pause.records.length === 1,
    "Valid and invalid individual guided-flow records should normalize independently."
  );

  if (!legacyResult.success) {
    throw new Error("Legacy guided-flow fixture should normalize.");
  }

  const migratedLegacyLog = legacyResult.state.arousalControl.logs.find(
    (log) => log.id === "legacy-completed"
  );
  const partialLegacyLog = legacyResult.state.arousalControl.logs.find(
    (log) => log.id === "legacy-partial"
  );
  assert(
    migratedLegacyLog?.completionStatus === "legacyCompleted" &&
      isValidCompletedArousalLog(migratedLegacyLog) &&
      migratedLegacyLog.pleasureQuality === 8 &&
      migratedLegacyLog.firmnessChange === "decreasedCouldContinue",
    "A genuine old-flow completion should migrate to valid legacy history."
  );
  assert(
    partialLegacyLog?.completionStatus === undefined &&
      !isValidCompletedArousalLog(partialLegacyLog),
    "A partial legacy terminal-route placeholder must remain invalid."
  );

  const legacyJourney = completedJourneyState();
  legacyJourney.arousalControl.logs = [migratedLegacyLog];
  assert(
    getNextBloomAction(legacyJourney, dateKey).id ===
      "viewPracticeProgress",
    "A migrated genuine legacy completion should count in journey decisions."
  );

  const currentState = completedArousalState();
  const currentLog = currentState.arousalControl.logs[0];
  const normalizedCurrent = validateAndNormalizeBloomState(currentState);
  assert(
    currentLog !== undefined &&
      normalizedCurrent.success &&
      stableJson(normalizedCurrent.state.arousalControl.logs[0]) ===
        stableJson(currentLog),
    "A current completed log should remain unchanged during legacy migration."
  );

  const normalizedAgain = legacyResult.success
    ? validateAndNormalizeBloomState(legacyResult.state)
    : legacyResult;
  assert(
    normalizedAgain.success &&
      !normalizedAgain.wasNormalized &&
      stableJson(normalizedAgain.state) === stableJson(legacyResult.state),
    "Guided-flow normalization should be idempotent."
  );
}

async function verifyPersistenceUiRegressions() {
  const navigationFocusGuard = createProtectionNavigationFocusGuard();
  const endInitialFocus = navigationFocusGuard.beginFocus();
  const initialFocusSequence =
    navigationFocusGuard.captureFocusSequence();
  let settlePersistence!: () => void;
  let navigationCalls = 0;
  const getNavigationCalls = () => navigationCalls;
  const delayedPersistence = new Promise<void>((resolve) => {
    settlePersistence = resolve;
  });
  const delayedNavigation = delayedPersistence.then(() =>
    navigationFocusGuard.runIfFocusUnchanged(
      initialFocusSequence,
      () => {
        navigationCalls += 1;
      }
    )
  );

  endInitialFocus();
  const endRestoredFocus = navigationFocusGuard.beginFocus();
  settlePersistence();
  const navigatedAfterFocusLoss = await delayedNavigation;
  assert(
    !navigatedAfterFocusLoss && getNavigationCalls() === 0,
    "A delayed Protection success must not navigate after the originating tab loses focus."
  );

  const restoredFocusSequence =
    navigationFocusGuard.captureFocusSequence();
  const navigatedWhileFocused =
    navigationFocusGuard.runIfFocusUnchanged(
      restoredFocusSequence,
      () => {
        navigationCalls += 1;
      }
    );
  endRestoredFocus();
  assert(
    navigatedWhileFocused && getNavigationCalls() === 1,
    "A focused Protection success should retain its intended navigation."
  );

  const protectSource = readFileSync(
    join(
      process.cwd(),
      "src/features/protect/screens/ProtectScreen.tsx"
    ),
    "utf8"
  );
  assert(
    protectSource.includes("createProtectionNavigationFocusGuard") &&
      protectSource.includes("navigationFocusGuard.beginFocus()") &&
      protectSource.includes("navigationFocusGuard.captureFocusSequence()") &&
      protectSource.includes("navigationFocusGuard.runIfFocusUnchanged("),
    "ProtectScreen must use the verified focus guard for persisted Resume navigation."
  );

  const logSource = readFileSync(
    join(process.cwd(), "src/features/log/screens/LogScreen.tsx"),
    "utf8"
  );
  assert(
    logSource.includes("routeCheckInPersistenceFeedback(") &&
      logSource.includes("clearCheckInPersistenceFeedback("),
    "LogScreen must use the verified feedback-channel helpers so note status stays out of the Check-In alert."
  );

  const indexSource = readFileSync(
    join(process.cwd(), "app/index.tsx"),
    "utf8"
  );
  assert(
    indexSource.includes("const { durableState } = useBloomLocalState();") &&
      indexSource.includes("if (!durableState.onboarding.completed)") &&
      !indexSource.includes("const { state } = useBloomLocalState();"),
    "The root journey redirect must read durable onboarding state, never accepted-only state."
  );

  const mainPracticeSource = readFileSync(
    join(
      process.cwd(),
      "src/features/arousal-control/screens/MainPracticeScreen.tsx"
    ),
    "utf8"
  );
  const safeExitHandlers = ["startPause", "finishPractice", "closePractice"].map(
    (handlerName) => extractArrowHandlerSource(mainPracticeSource, handlerName)
  );
  assert(
    mainPracticeSource.includes("backDisabled={isNoteSaving}") &&
      mainPracticeSource.includes("closeDisabled={isNoteSaving}") &&
      mainPracticeSource.includes(
        "const notePersistenceLocked = isNoteSaving;"
      ) &&
      safeExitHandlers.every(
        (handlerSource) => !handlerSource.includes("noteRetryTokenRef")
      ),
    "Arousal practice navigation must unlock after a bounded unknown note result even while its retry token remains available."
  );
}

function verifyDemoConsumerScan() {
  const runtimeFiles = [
    "src/features/log/screens/LogScreen.tsx",
    "src/features/pause/screens/PauseIntroScreen.tsx",
    "src/features/pause/screens/PauseCheckInScreen.tsx",
    "src/features/pause/screens/PauseTimerScreen.tsx",
    "src/features/pause/screens/PauseSavedScreen.tsx",
    "src/features/protect/screens/ProtectScreen.tsx"
  ];

  runtimeFiles.forEach((filePath) => {
    const source = readFileSync(join(process.cwd(), filePath), "utf8");
    assert(
      !source.includes("DemoAppStateProvider") &&
        !source.includes("useDemoApp"),
      `${filePath} must not consume Demo state.`
    );
  });

  const progressPreviewSource = readFileSync(
    join(
      process.cwd(),
      "src/features/arousal-control/screens/ProgressPreviewScreen.tsx"
    ),
    "utf8"
  );
  assert(
    progressPreviewSource.includes('"Recorded"') &&
      !progressPreviewSource.includes('"Normal response"'),
    "Firmness-change history should use a neutral Recorded badge."
  );

  const durationScreenSource = readFileSync(
    join(
      process.cwd(),
      "src/features/arousal-control/screens/OptionalDurationScreen.tsx"
    ),
    "utf8"
  );
  assert(
    durationScreenSource.includes("resolveDurationSubmission") &&
      durationScreenSource.includes("submitInFlightRef"),
    "The duration screen should use the verified adapter and a synchronous duplicate-submit guard."
  );

  const pauseCheckInSource = readFileSync(
    join(
      process.cwd(),
      "src/features/pause/screens/PauseCheckInScreen.tsx"
    ),
    "utf8"
  );
  assert(
    pauseCheckInSource.includes("saveAndClosePauseSession(") &&
      pauseCheckInSource.includes(
        "const persistenceNavigationBlocked = isSaving;"
      ) &&
      !pauseCheckInSource.includes(
        'const sessionId = getOrCreateSessionId("checkIn")'
      ),
    "Pause Save and close should be atomic and leave navigation available after a bounded persistence attempt settles."
  );

  const pauseTimerSource = readFileSync(
    join(process.cwd(), "src/features/pause/screens/PauseTimerScreen.tsx"),
    "utf8"
  );
  assert(
    pauseTimerSource.includes("runStableMountMutationOnce(") &&
      pauseTimerSource.includes(
        "const persistenceNavigationBlocked = isSaving;"
      ),
    "Pause timer initialization should be Strict Mode safe and leave navigation available after persistence settles."
  );

  const protectionInterceptSource = readFileSync(
    join(
      process.cwd(),
      "src/features/protect/screens/ProtectionInterceptScreen.tsx"
    ),
    "utf8"
  );
  assert(
    protectionInterceptSource.includes(
      "runStableMountMutationOnce("
    ) &&
      protectionInterceptSource.includes(
        "() => recordProtectionPause().ok"
      ),
    "Protection pause recording should have a per-mount Strict Mode guard that leaves rejected mutations retryable."
  );

  const localStateProviderSource = readFileSync(
    join(
      process.cwd(),
      "src/app/providers/BloomLocalStateProvider.tsx"
    ),
    "utf8"
  );
  assert(
    localStateProviderSource.includes(
      "recordProtectionPause: () => BloomMutationResult;"
    ) &&
      localStateProviderSource.includes(
        "return applyStateMutation((currentState) =>"
      ) &&
      localStateProviderSource.includes(
        "return () => {\n      isMountedRef.current = false;\n    };\n  }, [runHydration]);"
      ),
    "The local-state provider must expose Protection mutation rejection and reuse one in-flight hydration operation across Strict Mode effect replay."
  );

  const localDataLifecycleSource = readFileSync(
    join(
      process.cwd(),
      "src/app/providers/LocalDataLifecycleProvider.tsx"
    ),
    "utf8"
  );
  assert(
    localDataLifecycleSource.includes(
      "retryBloomLocalDataResetNavigation"
    ) &&
      localDataLifecycleSource.includes(
        "hasNavigatedAfterDeletionRef.current = false;"
      ) &&
      !localDataLifecycleSource.includes(
        "catch {\n      finishBloomLocalDataReset();"
      ),
    "Failed post-deletion onboarding navigation must remain retryable without releasing the local-state write block on the old route."
  );

  const hydrationBoundarySource = readFileSync(
    join(
      process.cwd(),
      "src/app/providers/BloomHydrationBoundary.tsx"
    ),
    "utf8"
  );
  assert(
    hydrationBoundarySource.includes(
      'if (deletionStatus === "success")'
    ) &&
      hydrationBoundarySource.includes(
        "retryBloomLocalDataResetNavigation"
      ) &&
      hydrationBoundarySource.includes("Open onboarding"),
    "Successful deletion must replace mutation-bearing routes with a retryable, mutation-free onboarding transition boundary."
  );
}

function completedArousalState() {
  const base = completedJourneyState();
  const started = startArousalSessionState(base, {
    id: "journey-practice",
    startedAt,
    dateKey,
    mode: "onePause",
    focus: "noticeRising",
    adultContent: "no",
    firmnessPlan: "appSuggest",
    endingChoice: "stoppedByChoice",
    reflectionCompleted: true
  });

  return completeArousalSessionState(
    started,
    "journey-practice",
    {
      durationPreference: "notLogged",
      durationSeconds: null
    },
    completedAt
  );
}

function completedJourneyState(): BloomLocalState {
  const state = createDefaultBloomState();
  state.onboarding.completed = true;
  state.onboarding.completedAt = "2026-07-01T08:00:00.000Z";
  state.activePlan.recommendedFirstAction = "startArousalPractice";
  return state;
}

async function reloadState(state: BloomLocalState) {
  const client = createMemoryStorageClient();
  await persistBloomLocalState(state, client, fixedNow);
  const result = await loadBloomLocalState(client, fixedNow);

  assert(result.status === "success", "A persisted state should reload.");
  return result.state;
}

function applyDurationActions(
  actions: readonly DurationInputAction[]
): DurationInputState {
  return actions.reduce(
    durationInputReducer,
    createInitialDurationInputState()
  );
}

function extractArrowHandlerSource(source: string, handlerName: string) {
  const handlerStart = source.indexOf(`const ${handlerName} =`);
  assert(handlerStart >= 0, `Missing production handler: ${handlerName}.`);
  const handlerEnd = source.indexOf("\n  };", handlerStart);
  assert(handlerEnd >= 0, `Could not read production handler: ${handlerName}.`);
  return source.slice(handlerStart, handlerEnd + 5);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

verifyGuidedFlows().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown verification failure.";
  console.error(`Bloom guided-flow verification failed: ${message}`);
  process.exitCode = 1;
});
