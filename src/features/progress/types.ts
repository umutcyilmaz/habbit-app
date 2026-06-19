import type { Insight, WeeklyReview } from "../../domain/models";

export interface ProgressSnapshot {
  insights: Insight[];
  latestWeeklyReview?: WeeklyReview;
}
