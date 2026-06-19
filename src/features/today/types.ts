export type TodayRouteTarget =
  | "/(tabs)/log"
  | "/(tabs)/exercises"
  | "/(tabs)/progress"
  | "/(tabs)/protect";

export interface TodayRecommendation {
  goal: string;
  reason: string;
  recommendedTool: string;
  primaryCta: string;
  primaryRoute: TodayRouteTarget;
  secondaryCta: string;
  secondaryRoute: TodayRouteTarget;
}

export interface TodayQuickAction {
  id: "pauseNow" | "checkIn" | "logToday" | "exercises" | "protect";
  label: string;
  route: TodayRouteTarget;
}

export interface WeeklyProgressItem {
  id: "checkIns" | "pauses" | "reflections";
  label: string;
  current: number;
  target: number;
}

export interface CoachInsight {
  title: string;
  copy: string;
  ctaLabel: string;
  route: TodayRouteTarget;
}

export interface TodayDashboardData {
  userName: string;
  periodLabel: string;
  planNote: string;
  recentActivity: string[];
  recommendation: TodayRecommendation;
  quickActions: TodayQuickAction[];
  weeklyProgress: WeeklyProgressItem[];
  coachInsight: CoachInsight;
  firstUse?: {
    enabled: boolean;
    copy: string;
  };
}
