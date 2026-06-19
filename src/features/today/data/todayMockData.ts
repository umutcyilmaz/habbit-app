import type { TodayDashboardData } from "../types";

export const todayMockData: TodayDashboardData = {
  userName: "Mert",
  periodLabel: "Week 1 • Day 3",
  planNote: "Your plan is adjusting gently.",
  recentActivity: ["2 check-ins", "1 paused moment", "1 reflection day", "no medical red flags"],
  recommendation: {
    goal: "Prepare for your sensitive hours.",
    reason: "Recent logs suggest boredom and evenings may be linked to automatic loops.",
    recommendedTool: "Night Protection",
    primaryCta: "Set Up Night Protection",
    primaryRoute: "/(tabs)/protect",
    secondaryCta: "Start Check-In",
    secondaryRoute: "/(tabs)/log"
  },
  quickActions: [
    {
      id: "pauseNow",
      label: "Pause Now",
      route: "/(tabs)/exercises"
    },
    {
      id: "checkIn",
      label: "Check-In",
      route: "/(tabs)/log"
    },
    {
      id: "logToday",
      label: "Log Today",
      route: "/(tabs)/log"
    },
    {
      id: "exercises",
      label: "Exercises",
      route: "/(tabs)/exercises"
    },
    {
      id: "protect",
      label: "Protect",
      route: "/(tabs)/protect"
    }
  ],
  weeklyProgress: [
    {
      id: "checkIns",
      label: "Check-ins",
      current: 2,
      target: 3
    },
    {
      id: "pauses",
      label: "Pauses",
      current: 1,
      target: 2
    },
    {
      id: "reflections",
      label: "Reflections",
      current: 1,
      target: 1
    }
  ],
  coachInsight: {
    title: "Gentle observation",
    copy: "A pattern may be emerging: evenings and boredom seem connected in recent logs.",
    ctaLabel: "View Progress",
    route: "/(tabs)/progress"
  },
  firstUse: {
    enabled: false,
    copy: "No pattern yet. A few check-ins will help personalize this space."
  }
};

export const todayFirstUseMockData: TodayDashboardData = {
  ...todayMockData,
  recentActivity: [],
  firstUse: {
    enabled: true,
    copy: "No pattern yet. A few check-ins will help personalize this space."
  }
};
