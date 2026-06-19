import type { ProgressDashboardData } from "../types";

export const progressMockData: ProgressDashboardData = {
  userName: "Mert",
  periodLabel: "Week 1",
  note: "Progress is awareness, not abstinence.",
  activitySummary: [
    "5 check-ins",
    "3 urges noticed",
    "2 pauses created",
    "1 arousal awareness practice",
    "2 private reflections",
    "no medical red flags"
  ],
  metrics: [
    {
      id: "checkIns",
      label: "Check-ins",
      value: 5
    },
    {
      id: "pauses",
      label: "Pauses",
      value: 2
    },
    {
      id: "reflections",
      label: "Reflections",
      value: 2
    },
    {
      id: "practiceDays",
      label: "Practice days",
      value: 1
    }
  ],
  insights: [
    {
      id: "sensitive-window-evening",
      category: "sensitiveWindow",
      tone: "sensitive",
      title: "Sensitive window",
      copy: "Evenings between 22:00 and 00:00 appear more often in recent logs."
    },
    {
      id: "trigger-boredom",
      category: "trigger",
      tone: "neutral",
      title: "Common trigger",
      copy: "Boredom seems to show up before automatic habits."
    },
    {
      id: "tool-pauses",
      category: "helpfulTool",
      tone: "supportive",
      title: "Helpful tool",
      copy: "Pauses seemed to lower urgency in recent logs."
    },
    {
      id: "rushing-adult-content",
      category: "rushingPattern",
      tone: "neutral",
      title: "Rushing pattern",
      copy: "Rushing sometimes appeared when adult content came first."
    }
  ],
  helpfulTools: [
    {
      id: "ninetySecondPause",
      title: "90-Second Pause",
      copy: "Used twice this week. It may help create space before reacting.",
      ctaLabel: "Start Pause",
      route: "/pause"
    },
    {
      id: "quickCheckIn",
      title: "Quick Check-In",
      copy: "A low-effort way to notice patterns over time.",
      ctaLabel: "Log Check-In",
      route: "/(tabs)/log"
    },
    {
      id: "privateReflection",
      title: "Private Reflection",
      copy: "A short note can help connect triggers with choices.",
      ctaLabel: "Open Log",
      route: "/(tabs)/log"
    }
  ],
  weeklyReview: {
    title: "Weekly review",
    copy: "Your first review is almost ready. A few more check-ins can help make it more useful.",
    primaryCta: "Continue with Today",
    primaryRoute: "/(tabs)/today",
    secondaryCta: "Start Check-In",
    secondaryRoute: "/(tabs)/log"
  },
  lowData: {
    enabled: false,
    copy: "Nothing is wrong. The app just needs more context.",
    ctaLabel: "Start Check-In",
    route: "/(tabs)/log"
  }
};

export const progressLowDataMockData: ProgressDashboardData = {
  ...progressMockData,
  metrics: [],
  insights: [],
  helpfulTools: progressMockData.helpfulTools.slice(0, 2),
  lowData: {
    enabled: true,
    copy: "Nothing is wrong. The app just needs more context.",
    ctaLabel: "Start Check-In",
    route: "/(tabs)/log"
  }
};
