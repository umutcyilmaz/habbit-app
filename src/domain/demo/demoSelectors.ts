import type { DemoAppState, DemoSensitiveWindow, ProgressMetric, TodayDashboardData } from "./demoTypes";

export function selectUserDisplayName(state: DemoAppState) {
  return state.user.name;
}

export function selectSuggestedSensitiveWindow(state: DemoAppState): DemoSensitiveWindow {
  return state.protection.sensitiveWindow;
}

export function selectProtectionState(state: DemoAppState) {
  return state.protection;
}

export function selectTodayDashboardData(state: DemoAppState): TodayDashboardData {
  const checkInCount = state.checkIns.length;
  const pauseCount = state.pauseSessions.length;
  const checkInLabel = checkInCount === 1 ? "check-in" : "check-ins";
  const pauseLabel = pauseCount === 1 ? "pause" : "pauses";
  const window = state.protection.sensitiveWindow;

  return {
    userName: selectUserDisplayName(state),
    weekLabel: `Week ${state.user.currentWeek}, day ${state.user.currentDay}`,
    recommendationTitle: "Start with a short pause",
    recommendationBody: `Evenings between ${window.startTime} and ${window.endTime} appear often in recent activity.`,
    weeklyPreview: `${checkInCount} ${checkInLabel} and ${pauseCount} ${pauseLabel} are in this week.`,
    coachInsight: "Recent logs suggest boredom and evenings may be connected."
  };
}

export function selectProgressSummary(state: DemoAppState): readonly ProgressMetric[] {
  return [
    {
      label: "Check-ins",
      value: String(state.checkIns.length),
      detail: "Moments captured for awareness this week."
    },
    {
      label: "Pauses",
      value: String(state.pauseSessions.length),
      detail: "Pauses may help create space before reacting."
    },
    {
      label: "Support window",
      value: `${state.protection.sensitiveWindow.startTime}-${state.protection.sensitiveWindow.endTime}`,
      detail: "A suggested evening support window is available."
    }
  ];
}

export function selectGentleInsights(state: DemoAppState): readonly string[] {
  const hasBoredom = state.checkIns.some((checkIn) => checkIn.moment === "boredom");
  const hasEvening = state.checkIns.some((checkIn) => checkIn.moment === "evening");

  return [
    hasBoredom
      ? "Recent logs suggest boredom may be worth noticing."
      : "Your next check-in can help reveal a pattern.",
    hasEvening
      ? "Evening moments appear often in recent activity."
      : "Sensitive windows can be adjusted as patterns become clearer.",
    "A short pause may help before the next choice."
  ];
}
