import type { DemoMode } from "./demoModes";

export type DemoProtectionStatus = "suggested" | "setup" | "active" | "paused" | "off";
export type DemoSupportLevel = "gentle" | "balanced" | "strong";
export type DemoMood = "calm" | "bored" | "stressed" | "tired" | "restless" | "neutral";
export type DemoMoment = "boredom" | "evening" | "alone" | "stress" | "scrolling";

export interface DemoSensitiveWindow {
  label: string;
  startTime: string;
  endTime: string;
}

export interface DemoCheckIn {
  id: string;
  createdAt: string;
  mood: DemoMood;
  moment: DemoMoment;
}

export interface DemoPauseSession {
  id: string;
  completedAt: string;
  durationSeconds: number;
  nextChoice: string;
}

export interface DemoAppState {
  demoMode: DemoMode;
  isOfflinePreview: boolean;
  user: {
    name: string;
    currentWeek: number;
    currentDay: number;
  };
  checkIns: readonly DemoCheckIn[];
  pauseSessions: readonly DemoPauseSession[];
  protection: {
    status: DemoProtectionStatus;
    level: DemoSupportLevel;
    sensitiveWindow: DemoSensitiveWindow;
  };
  settings: {
    personalizationEnabled: boolean;
    notificationsPaused: boolean;
    useDiscreetNotifications: boolean;
  };
}

export interface TodayDashboardData {
  userName: string;
  weekLabel: string;
  recommendationTitle: string;
  recommendationBody: string;
  weeklyPreview: string;
  coachInsight: string;
}

export interface ProgressMetric {
  label: string;
  value: string;
  detail: string;
}
