import type {
  NextBloomAction,
  NextBloomActionId
} from "./getNextBloomAction";

export function getNextBloomActionLabel(
  action: NextBloomAction | NextBloomActionId
): string {
  const actionId = typeof action === "string" ? action : action.id;

  switch (actionId) {
    case "completeOnboarding":
      return "Continue onboarding";
    case "startQuickCheckIn":
      return "Start a Quick Check-In";
    case "setupProtection":
      return "Set up Protection";
    case "resumeProtection":
      return "Resume Protection";
    case "startReset":
      return "Start 10-Day Reset";
    case "completeTodayReset":
      return "Start today’s reset";
    case "viewTodayReset":
      return "View saved reset";
    case "startArousalPractice":
      return "Start Arousal Control Practice";
    case "viewPracticeProgress":
      return "View practice progress";
  }
}
