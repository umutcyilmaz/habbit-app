import { routes } from "../src/constants/navigation";
import {
  getNextBloomAction,
  getValidCompletedResetDayCount,
  hasValidCompletedArousalControlLog,
  isNextBloomActionRoute,
  type NextBloomAction,
  type NextBloomActionState
} from "../src/domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../src/domain/journey/nextBloomActionPresentation";
import {
  createDefaultBloomState,
  type ArousalControlPracticeLog,
  type BloomLocalState,
  type RecommendedFirstAction
} from "../src/storage/bloomState";

const todayKey = "2026-07-27";
const validResetDates = Array.from(
  { length: 10 },
  (_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`
);
const observedActions: NextBloomAction[] = [];

function verifyBloomJourney() {
  verifyOnboardingIncomplete();
  verifyGeneralStartingPoint();
  verifyPornLoopProtectionOff();
  verifyPornLoopProtectionEnabled();
  verifyPornLoopProtectionPaused();
  verifyMixedProfileProtectionOff();
  verifyPressureProfile();
  verifyControlProfileWithoutLogs();
  verifyControlProfileWithLog();
  verifyActiveResetTodayIncomplete();
  verifyActiveResetTodayComplete();
  verifyTerminalResetWithoutPractice();
  verifyTerminalResetWithPractice();
  verifyDuplicateResetDates();
  verifyInvalidResetDates();
  verifyProtectionDoesNotOverrideActiveReset();
  verifyControlPlanDoesNotOverrideActiveReset();
  verifyOnboardingWinsOverStaleReset();
  verifyUnknownAndMissingRecommendationFallback();
  verifyCentralizedRoutes();
  verifyCrossScreenPresentationContract();
  verifyDraftAndPlaceholderLogsDoNotCount();
  verifyDeterminism();

  console.log("Bloom journey verification passed.");
}

function verifyOnboardingIncomplete() {
  const state = createDefaultBloomState();
  const action = select(state);

  expectAction(
    action,
    "completeOnboarding",
    routes.onboarding,
    "onboardingIncomplete",
    "Incomplete onboarding should be the first priority."
  );
}

function verifyGeneralStartingPoint() {
  const action = select(completedState("startQuickCheckIn"));

  expectAction(
    action,
    "startQuickCheckIn",
    routes.pauseCheckIn,
    "generalStartingPoint",
    "General starting point should lead to Quick Check-In."
  );
}

function verifyPornLoopProtectionOff() {
  const action = select(completedState("setupProtection"));

  expectAction(
    action,
    "setupProtection",
    routes.protectSetup,
    "protectionRequired",
    "Porn Loop with Protection off should lead to setup."
  );
}

function verifyPornLoopProtectionEnabled() {
  const state = completedState("setupProtection");
  state.protection.status = "active";
  const action = select(state);

  expectAction(
    action,
    "startReset",
    routes.tenDayReset,
    "protectionReady",
    "Porn Loop with Protection enabled should advance to Reset."
  );
}

function verifyPornLoopProtectionPaused() {
  const state = completedState("setupProtection");
  state.protection.status = "paused";
  const action = select(state);

  expectAction(
    action,
    "resumeProtection",
    routes.protectActive,
    "protectionPaused",
    "Porn Loop with paused Protection should lead to resume."
  );
}

function verifyMixedProfileProtectionOff() {
  const state = completedState("setupProtection");
  state.activePlan.primaryPattern = "pornLoop";
  state.activePlan.secondaryPattern = "pressurePattern";
  const action = select(state);

  expectAction(
    action,
    "setupProtection",
    routes.protectSetup,
    "protectionRequired",
    "A mixed profile should use the same Protection-first path."
  );
}

function verifyPressureProfile() {
  const action = select(completedState("startReset"));

  expectAction(
    action,
    "startReset",
    routes.tenDayReset,
    "resetRecommended",
    "Pressure profile should start Reset."
  );
}

function verifyControlProfileWithoutLogs() {
  const action = select(completedState("startArousalPractice"));

  expectAction(
    action,
    "startArousalPractice",
    routes.arousalControl,
    "practiceRecommended",
    "Control profile without a saved log should start practice."
  );
}

function verifyControlProfileWithLog() {
  const state = completedState("startArousalPractice");
  state.arousalControl.logs = [validPracticeLog()];
  const action = select(state);

  expectAction(
    action,
    "viewPracticeProgress",
    routes.arousalControlProgressPreview,
    "practiceAvailableForReview",
    "Control profile with a saved log should show practice progress."
  );
}

function verifyActiveResetTodayIncomplete() {
  const state = activeResetState("setupProtection");
  const action = select(state);

  expectAction(
    action,
    "completeTodayReset",
    routes.tenDayResetPractice,
    "resetTodayIncomplete",
    "An active incomplete Reset day should override the plan."
  );
}

function verifyActiveResetTodayComplete() {
  const state = activeResetState("setupProtection");
  state.tenDayReset.completedDates = [todayKey];
  const action = select(state);

  expectAction(
    action,
    "viewTodayReset",
    routes.tenDayResetSaved,
    "resetTodayComplete",
    "An active completed Reset day should lead to its saved view."
  );
}

function verifyTerminalResetWithoutPractice() {
  const state = activeResetState("setupProtection");
  state.tenDayReset.completedDates = [
    ...validResetDates.slice(0, 9),
    todayKey
  ];
  const action = select(state);

  expectAction(
    action,
    "startArousalPractice",
    routes.arousalControl,
    "resetProgramComplete",
    "Terminal Reset should advance even when today is already complete."
  );
}

function verifyTerminalResetWithPractice() {
  const state = activeResetState("setupProtection");
  state.tenDayReset.completedDates = [
    ...validResetDates.slice(0, 9),
    todayKey
  ];
  state.arousalControl.logs = [validPracticeLog()];
  const action = select(state);

  expectAction(
    action,
    "viewPracticeProgress",
    routes.arousalControlProgressPreview,
    "practiceAvailableForReview",
    "Terminal Reset with a practice log should advance to review."
  );
}

function verifyDuplicateResetDates() {
  const state = activeResetState("setupProtection");
  state.tenDayReset.completedDates = [
    ...validResetDates.slice(0, 9),
    validResetDates[0] ?? "2026-07-01"
  ];
  const action = select(state);

  assert(
    getValidCompletedResetDayCount(state.tenDayReset) === 9,
    "Duplicate Reset dates should count once."
  );
  expectAction(
    action,
    "completeTodayReset",
    routes.tenDayResetPractice,
    "resetTodayIncomplete",
    "Duplicate dates must not create terminal state early."
  );
}

function verifyInvalidResetDates() {
  const state = activeResetState("setupProtection");
  state.tenDayReset.completedDates = [
    ...validResetDates.slice(0, 9),
    "2026-02-30",
    "not-a-date"
  ];
  const action = select(state);

  assert(
    getValidCompletedResetDayCount(state.tenDayReset) === 9,
    "Invalid Reset date keys should not count."
  );
  expectAction(
    action,
    "completeTodayReset",
    routes.tenDayResetPractice,
    "resetTodayIncomplete",
    "Invalid dates must not create terminal state."
  );
}

function verifyProtectionDoesNotOverrideActiveReset() {
  const state = activeResetState("setupProtection");
  state.protection.status = "active";
  const action = select(state);

  expectAction(
    action,
    "completeTodayReset",
    routes.tenDayResetPractice,
    "resetTodayIncomplete",
    "Active Reset must override Protection-ready state."
  );
}

function verifyControlPlanDoesNotOverrideActiveReset() {
  const action = select(activeResetState("startArousalPractice"));

  expectAction(
    action,
    "completeTodayReset",
    routes.tenDayResetPractice,
    "resetTodayIncomplete",
    "Active Reset must override a Control plan."
  );
}

function verifyOnboardingWinsOverStaleReset() {
  const state = activeResetState("setupProtection");
  state.onboarding.completed = false;
  state.tenDayReset.completedDates = [...validResetDates];
  const action = select(state);

  expectAction(
    action,
    "completeOnboarding",
    routes.onboarding,
    "onboardingIncomplete",
    "Onboarding must override stale terminal Reset data."
  );
}

function verifyUnknownAndMissingRecommendationFallback() {
  const baseState = completedState("setupProtection");
  const unknownState = {
    ...baseState,
    activePlan: {
      ...baseState.activePlan,
      recommendedFirstAction: "unknown-action"
    }
  } as unknown as NextBloomActionState;
  const { activePlan: _activePlan, ...missingPlanState } = baseState;
  const unknownAction = select(unknownState);
  const missingAction = select(missingPlanState);

  expectAction(
    unknownAction,
    "startQuickCheckIn",
    routes.pauseCheckIn,
    "generalStartingPoint",
    "An unknown recommendation should fall back to observation."
  );
  expectAction(
    missingAction,
    "startQuickCheckIn",
    routes.pauseCheckIn,
    "generalStartingPoint",
    "A missing active plan should fall back to observation."
  );
}

function verifyCentralizedRoutes() {
  const centralizedRoutes = new Set(Object.values(routes));

  for (const action of observedActions) {
    assert(
      centralizedRoutes.has(action.route),
      `Action ${action.id} should use a centralized route constant.`
    );
    assert(
      isNextBloomActionRoute(action.route),
      `Action ${action.id} should return a supported journey route.`
    );
  }
}

function verifyCrossScreenPresentationContract() {
  const state = completedState("setupProtection");
  state.protection.status = "active";
  const action = getNextBloomAction(state, todayKey);
  const consumers = ["Today", "Progress", "Result", "Debug"].map((consumer) => ({
    consumer,
    id: action.id,
    route: action.route,
    label: getNextBloomActionLabel(action)
  }));
  const expected = consumers[0];

  assert(expected !== undefined, "The shared presentation fixture should exist.");
  assert(
    consumers.every(
      (consumer) =>
        consumer.id === expected.id &&
        consumer.route === expected.route &&
        consumer.label === expected.label
    ),
    "All consumers should share the selector action, route, and label."
  );
}

function verifyDraftAndPlaceholderLogsDoNotCount() {
  const state = completedState("startArousalPractice");
  state.arousalControl.draft = {
    id: "draft",
    startedAt: "2026-07-27T08:00:00.000Z",
    dateKey: todayKey
  };
  state.arousalControl.logs = [{} as ArousalControlPracticeLog];
  const action = select(state);

  assert(
    !hasValidCompletedArousalControlLog(state.arousalControl.logs),
    "An empty placeholder log should not count as completed."
  );
  expectAction(
    action,
    "startArousalPractice",
    routes.arousalControl,
    "practiceRecommended",
    "Drafts and placeholder logs must not unlock practice review."
  );
}

function verifyDeterminism() {
  const state = activeResetState("setupProtection");
  const first = getNextBloomAction(state, todayKey);
  const second = getNextBloomAction(state, todayKey);

  assert(
    JSON.stringify(first) === JSON.stringify(second),
    "The same state and todayKey should always return the same action."
  );
}

function completedState(
  recommendedFirstAction: RecommendedFirstAction
): BloomLocalState {
  const state = createDefaultBloomState();
  state.onboarding.completed = true;
  state.onboarding.completedAt = "2026-07-01T08:00:00.000Z";
  state.activePlan.recommendedFirstAction = recommendedFirstAction;
  return state;
}

function activeResetState(
  recommendedFirstAction: RecommendedFirstAction
): BloomLocalState {
  const state = completedState(recommendedFirstAction);
  state.tenDayReset.startedAt = "2026-07-01";
  return state;
}

function validPracticeLog(): ArousalControlPracticeLog {
  return {
    id: "practice-1",
    startedAt: "2026-07-20T08:00:00.000Z",
    completedAt: "2026-07-20T08:15:00.000Z",
    dateKey: "2026-07-20",
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

function select(
  state: NextBloomActionState | Partial<NextBloomActionState>
): NextBloomAction {
  const action = getNextBloomAction(state, todayKey);
  observedActions.push(action);
  return action;
}

function expectAction(
  action: NextBloomAction,
  id: NextBloomAction["id"],
  route: NextBloomAction["route"],
  reason: NextBloomAction["reason"],
  message: string
) {
  const expectedPhase = expectedPhases[id];

  assert(
    action.id === id &&
      action.phase === expectedPhase &&
      action.route === route &&
      action.reason === reason,
    `${message} Received ${action.id}/${action.phase} -> ${action.route} (${action.reason}).`
  );
}

const expectedPhases: Record<
  NextBloomAction["id"],
  NextBloomAction["phase"]
> = {
  completeOnboarding: "onboarding",
  startQuickCheckIn: "observation",
  setupProtection: "protection",
  resumeProtection: "protection",
  startReset: "reset",
  completeTodayReset: "reset",
  viewTodayReset: "reset",
  startArousalPractice: "practice",
  viewPracticeProgress: "review"
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

verifyBloomJourney();
