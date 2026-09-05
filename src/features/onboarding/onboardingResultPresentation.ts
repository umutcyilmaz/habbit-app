import { routes, type AppRoute } from "../../constants/navigation";
import {
  getNextBloomAction,
  type NextBloomAction
} from "../../domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../../domain/journey/nextBloomActionPresentation";
import type { BloomLocalState, QuizResult } from "../../storage/bloomState";

export type OnboardingFirstStepContent = {
  body: string;
  primary: string;
  route: AppRoute;
};

export type DurableOnboardingResultPresentation = {
  quizResult: QuizResult | null;
  firstStep: OnboardingFirstStepContent;
};

type DurableOnboardingResultPresentationInput = {
  durableState: BloomLocalState;
  durableTodayKey: string;
};

export function getDurableOnboardingResultPresentation({
  durableState,
  durableTodayKey
}: DurableOnboardingResultPresentationInput): DurableOnboardingResultPresentation {
  const quizResult =
    durableState.onboarding.completed === true
      ? durableState.onboarding.quizResult
      : null;
  const action =
    quizResult === null
      ? getIncompleteOnboardingAction()
      : getNextBloomAction(durableState, durableTodayKey);

  return {
    quizResult,
    firstStep: getFirstStepContent(action)
  };
}

export function getFirstStepContent(
  action: NextBloomAction
): OnboardingFirstStepContent {
  const primary = getNextBloomActionLabel(action);

  switch (action.id) {
    case "completeOnboarding":
      return {
        body: "Continue onboarding so Bloom can suggest a simple first path.",
        primary,
        route: action.route
      };
    case "startQuickCheckIn":
      return {
        body: "Start with a simple check-in and notice what is present without needing to label it yet.",
        primary,
        route: action.route
      };
    case "setupProtection":
      return {
        body: "Start by setting up Protection. This gives you a pause before the automatic loop starts.",
        primary,
        route: action.route
      };
    case "resumeProtection":
      return {
        body: "Your Protection settings are saved. Resume the in-app pause plan when it feels useful.",
        primary,
        route: action.route
      };
    case "startReset":
      return {
        body:
          action.reason === "protectionReady"
            ? "Protection is ready. The next step is to begin your 10-Day Reset."
            : "Start with Day 1 of your reset and keep the first goal simple.",
        primary,
        route: action.route
      };
    case "completeTodayReset":
      return {
        body: "Continue with today’s two-minute reset when you are ready.",
        primary,
        route: action.route
      };
    case "viewTodayReset":
      return {
        body: "Today’s reset is saved and ready to review.",
        primary,
        route: action.route
      };
    case "startArousalPractice":
      return {
        body:
          action.reason === "resetProgramComplete"
            ? "Your Reset is complete. Continue with guided practice when you are ready."
            : "Start with a guided practice to notice arousal earlier.",
        primary,
        route: action.route
      };
    case "viewPracticeProgress":
      return {
        body: "Your latest guided practice is saved and ready to review.",
        primary,
        route: action.route
      };
  }
}

function getIncompleteOnboardingAction(): NextBloomAction {
  return {
    id: "completeOnboarding",
    phase: "onboarding",
    route: routes.onboarding,
    reason: "onboardingIncomplete"
  };
}
