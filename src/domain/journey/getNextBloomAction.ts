import { routes } from "../../constants/navigation";
import type { AppRoute } from "../../constants/navigation";
import type { BloomLocalState, TenDayResetState } from "../../storage/bloomState";
import {
  getCompletedResetDates,
  isValidCompletedArousalLog,
  isResetProgramComplete,
  isResetStarted
} from "../../storage/bloomState";
import { isValidBloomDateKey } from "../../storage/bloomValueValidation";

export type NextBloomActionId =
  | "completeOnboarding"
  | "startQuickCheckIn"
  | "setupProtection"
  | "resumeProtection"
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
  | "protectionPaused"
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
      id: "resumeProtection";
      phase: "protection";
      route: typeof routes.protectActive;
      reason: "protectionPaused";
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

  const resetState = {
    startedAt: state.tenDayReset?.startedAt ?? null,
    completedDates: completedResetDates
  };

  if (isResetProgramComplete(resetState)) {
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

  if (isResetStarted(resetState)) {
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
      if (state.protection?.status === "active") {
        return {
          id: "startReset",
          phase: "reset",
          route: routes.tenDayReset,
          reason: "protectionReady"
        };
      }

      if (state.protection?.status === "paused") {
        return {
          id: "resumeProtection",
          phase: "protection",
          route: routes.protectActive,
          reason: "protectionPaused"
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

  return getCompletedResetDates({
    completedDates: resetState.completedDates
  });
}

export function getValidCompletedResetDayCount(
  resetState: Partial<TenDayResetState> | null | undefined
) {
  return getValidCompletedResetDates(resetState).length;
}

export function hasValidCompletedArousalControlLog(logs: unknown): boolean {
  return Array.isArray(logs) && logs.some(isValidCompletedArousalLog);
}

export function isValidCompletedArousalControlLog(
  value: unknown
) {
  return isValidCompletedArousalLog(value);
}

function getSafeFallbackAction(): NextBloomAction {
  return {
    id: "startQuickCheckIn",
    phase: "observation",
    route: routes.pauseCheckIn,
    reason: "generalStartingPoint"
  };
}

export function isNextBloomActionRoute(route: AppRoute) {
  return nextBloomActionRoutes.has(route);
}

const nextBloomActionRoutes = new Set<AppRoute>([
  routes.onboarding,
  routes.pauseCheckIn,
  routes.protectSetup,
  routes.protectActive,
  routes.tenDayReset,
  routes.tenDayResetPractice,
  routes.tenDayResetSaved,
  routes.arousalControl,
  routes.arousalControlProgressPreview
]);
