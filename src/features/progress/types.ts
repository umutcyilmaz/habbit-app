export type InsightTone = "neutral" | "supportive" | "sensitive";

export type InsightCategory =
  | "sensitiveWindow"
  | "trigger"
  | "helpfulTool"
  | "rushingPattern";

export type ProgressRouteTarget = "/pause" | "/(tabs)/log" | "/(tabs)/today";

export interface ProgressMetric {
  id: "checkIns" | "pauses" | "reflections" | "practiceDays";
  label: string;
  value: number;
}

export interface GentleInsight {
  id: string;
  category: InsightCategory;
  tone: InsightTone;
  title: string;
  copy: string;
}

export interface HelpfulTool {
  id: "ninetySecondPause" | "quickCheckIn" | "privateReflection";
  title: string;
  copy: string;
  ctaLabel: string;
  route: ProgressRouteTarget;
}

export interface WeeklyReviewPreview {
  title: string;
  copy: string;
  primaryCta: string;
  primaryRoute: ProgressRouteTarget;
  secondaryCta: string;
  secondaryRoute: ProgressRouteTarget;
}

export interface ProgressDashboardData {
  userName: string;
  periodLabel: string;
  note: string;
  activitySummary: string[];
  metrics: ProgressMetric[];
  insights: GentleInsight[];
  helpfulTools: HelpfulTool[];
  weeklyReview: WeeklyReviewPreview;
  lowData?: {
    enabled: boolean;
    copy: string;
    ctaLabel: string;
    route: ProgressRouteTarget;
  };
}
