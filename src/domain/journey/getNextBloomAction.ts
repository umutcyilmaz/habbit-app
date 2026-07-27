import { routes } from "../../constants/navigation";
import type { AppRoute } from "../../constants/navigation";
import type {
  ArousalControlPracticeLog,
  BloomLocalState,
  TenDayResetState
} from "../../storage/bloomState";
import {
  isValidBloomDateKey,
  isValidBloomIsoTimestamp
} from "../../storage/bloomStateSchema";

export type NextBloomActionId =
  | "completeOnboarding"
  | "startQuickCheckIn"
  | "setupProtection"
  | "startReset"
  | "completeTodayReset"
  | "viewTodayReset"
  | "startArousalPractice"
  | "viewPracticeProgress";

export type NextBloomActionPhase =
  | "onboarding"
  | "observation"
  | "protection"
  | "reset"
  | "practice"
  | "review";

export type NextBloomActionReason =
  | "onboardingIncomplete"
  | "generalStartingPoint"
  | "protectionRequired"
  | "protectionReady"
  | "resetRecommended"
  | "resetTodayIncomplete"
  | "resetTodayComplete"
  | "resetProgramComplete"
  | "practiceRecommended"
  | "practiceAvailableForReview";

export type NextBloomAction =
  | {
      id: "completeOnboarding";
      phase: "onboarding";
      route: typeof routes.onboarding;
      reason: "onboardingIncomplete";
    }
  | {
      id: "startQuickCheckIn";
      phase: "observation";
      route: typeof routes.pauseCheckIn;
      reason: "generalStartingPoint";
    }
  | {
      id: "setupProtection";
      phase: "protection";
      route: typeof routes.protectSetup;
      reason: "protectionRequired";
    }
  | {
      id: "startReset";
      phase: "reset";
      route: typeof routes.tenDayReset;
      reason: "protectionReady" | "resetRecommended";
    }
  | {
      id: "completeTodayReset";
      phase: "reset";
      route: typeof routes.tenDayResetPractice;
      reason: "resetTodayIncomplete";
    }
  | {
      id: "viewTodayReset";
      phase: "reset";
      route: typeof routes.tenDayResetSaved;
      reason: "resetTodayComplete";
    }
  | {
      id: "startArousalPractice";
      phase: "practice";
      route: typeof routes.arousalControl;
      reason: "resetProgramComplete" | "practiceRecommended";
    }
  | {
      id: "viewPracticeProgress";
      phase: "review";
      route: typeof routes.arousalControlProgressPreview;
      reason: "practiceAvailableForReview";
    };

export type NextBloomActionState = Pick<
  BloomLocalState,
  "onboarding" | "activePlan" | "protection" | "tenDayReset" | "arousalControl"
>;

export function getNextBloomAction(
  state: NextBloomActionState | Partial<NextBloomActionState>,
  todayKey: string
): NextBloomAction {
  if (state.onboarding?.completed !== true) {
    return {
      id: "completeOnboarding",
      phase: "onboarding",
      route: routes.onboarding,
      reason: "onboardingIncomplete"
    };
  }

  const completedResetDates = getValidCompletedResetDates(state.tenDayReset);
  const hasCompletedPractice = hasValidCompletedArousalControlLog(
    state.arousalControl?.logs
  );

  if (completedResetDates.length >= 10) {
    if (hasCompletedPractice) {
      return {
        id: "viewPracticeProgress",
        phase: "review",
        route: routes.arousalControlProgressPreview,
        reason: "practiceAvailableForReview"
      };
    }

    return {
      id: "startArousalPractice",
      phase: "practice",
      route: routes.arousalControl,
      reason: "resetProgramComplete"
    };
  }

  if (isResetStarted(state.tenDayReset?.startedAt)) {
    if (isValidBloomDateKey(todayKey) && completedResetDates.includes(todayKey)) {
      return {
        id: "viewTodayReset",
        phase: "reset",
        route: routes.tenDayResetSaved,
        reason: "resetTodayComplete"
      };
    }

    return {
      id: "completeTodayReset",
      phase: "reset",
      route: routes.tenDayResetPractice,
      reason: "resetTodayIncomplete"
    };
  }

  const recommendation = state.activePlan?.recommendedFirstAction;

  switch (recommendation) {
    case "startQuickCheckIn":
      return {
        id: "startQuickCheckIn",
        phase: "observation",
        route: routes.pauseCheckIn,
        reason: "generalStartingPoint"
      };
    case "setupProtection":
      if (state.protection?.isEnabled === true) {
        return {
          id: "startReset",
          phase: "reset",
          route: routes.tenDayReset,
          reason: "protectionReady"
        };
      }

      return {
        id: "setupProtection",
        phase: "protection",
        route: routes.protectSetup,
        reason: "protectionRequired"
      };
    case "startReset":
      return {
        id: "startReset",
        phase: "reset",
        route: routes.tenDayReset,
        reason: "resetRecommended"
      };
    case "startArousalPractice":
      if (hasCompletedPractice) {
        return {
          id: "viewPracticeProgress",
          phase: "review",
          route: routes.arousalControlProgressPreview,
          reason: "practiceAvailableForReview"
        };
      }

      return {
        id: "startArousalPractice",
        phase: "practice",
        route: routes.arousalControl,
        reason: "practiceRecommended"
      };
    default:
      return getSafeFallbackAction();
  }
}

export function getValidCompletedResetDates(
  resetState: Partial<TenDayResetState> | null | undefined
): string[] {
  if (!Array.isArray(resetState?.completedDates)) {
    return [];
  }

  return Array.from(
    new Set(resetState.completedDates.filter(isValidBloomDateKey))
  )
    .sort()
    .slice(0, 10);
}

export function getValidCompletedResetDayCount(
  resetState: Partial<TenDayResetState> | null | undefined
) {
  return getValidCompletedResetDates(resetState).length;
}

export function hasValidCompletedArousalControlLog(logs: unknown): boolean {
  return Array.isArray(logs) && logs.some(isValidCompletedArousalControlLog);
}

export function isValidCompletedArousalControlLog(
  value: unknown
): value is ArousalControlPracticeLog {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 1000 &&
    isValidBloomIsoTimestamp(value.startedAt) &&
    isValidBloomIsoTimestamp(value.completedAt) &&
    isValidBloomDateKey(value.dateKey)
  );
}

function isResetStarted(value: unknown) {
  return isValidBloomDateKey(value) || isValidBloomIsoTimestamp(value);
}

function getSafeFallbackAction(): NextBloomAction {
  return {
    id: "startQuickCheckIn",
    phase: "observation",
    route: routes.pauseCheckIn,
    reason: "generalStartingPoint"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNextBloomActionRoute(route: AppRoute) {
  return nextBloomActionRoutes.has(route);
}

const nextBloomActionRoutes = new Set<AppRoute>([
  routes.onboarding,
  routes.pauseCheckIn,
  routes.protectSetup,
  routes.tenDayReset,
  routes.tenDayResetPractice,
  routes.tenDayResetSaved,
  routes.arousalControl,
  routes.arousalControlProgressPreview
]);
