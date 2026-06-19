import type {
  DemoAppState,
  DemoProtectionState,
  DemoSensitiveWindow,
  ProgressSummaryData,
  TodayDashboardData
} from "./demoTypes";

export function selectUserDisplayName(state: DemoAppState) {
  return state.user.name;
}

export function selectSuggestedSensitiveWindow(state: DemoAppState): DemoSensitiveWindow {
  return state.protection.sensitiveWindow;
}

export function selectProtectionState(state: DemoAppState): DemoProtectionState {
  return state.protection;
}

export function selectTodayDashboardData(state: DemoAppState): TodayDashboardData {
  const checkInCount = state.checkIns.length;
  const pauseCount = state.pauseSessions.length;
  const sensitiveWindow = state.protection.sensitiveWindow;
  const checkInLabel = checkInCount === 1 ? "check-in" : "check-ins";
  const pauseLabel = pauseCount === 1 ? "pause session" : "pause sessions";

  return {
    userName: selectUserDisplayName(state),
    currentWeek: state.user.currentWeek,
    currentDay: state.user.currentDay,
    recommendationTitle: "Start with a short pause",
    recommendationBody: `Evenings between ${sensitiveWindow.startTime} and ${sensitiveWindow.endTime} appear often in demo activity.`,
    weeklyPreview: `${checkInCount} ${checkInLabel} and ${pauseCount} ${pauseLabel} are in this demo week.`,
    coachInsight: "Recent logs suggest boredom and evenings may be connected."
  };
}

export function selectProgressSummary(state: DemoAppState): ProgressSummaryData {
  return {
    metrics: [
      {
        label: "Check-ins",
        value: String(state.checkIns.length),
        detail: "Moments captured for awareness this demo week."
      },
      {
        label: "Pauses",
        value: String(state.pauseSessions.length),
        detail: "Short pauses may help create space before reacting."
      },
      {
        label: "Support window",
        value: `${state.protection.sensitiveWindow.startTime}-${state.protection.sensitiveWindow.endTime}`,
        detail: "Evenings appear often in the shared demo state."
      }
    ],
    helpfulTools: state.exercises.map(
      (exercise) => `${exercise.title}: ${exercise.completedCount} demo completion`
    )
  };
}

export function selectGentleInsights(state: DemoAppState): readonly string[] {
  const hasBoredom = state.checkIns.some((checkIn) => checkIn.momentTag === "boredom");
  const hasEvening = state.checkIns.some((checkIn) => checkIn.momentTag === "evening");

  return [
    hasBoredom
      ? "Recent logs suggest boredom may be worth noticing."
      : "Your next check-in can help reveal a pattern.",
    hasEvening
      ? "Evening moments appear often in demo activity."
      : "Sensitive windows can be adjusted as patterns become clearer.",
    "Pauses may help create space before the next choice."
  ];
}
