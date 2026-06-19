export type DemoSupportStyle = "gentle" | "balanced" | "strong";

export type DemoProtectionStatus = "suggested" | "setup" | "active" | "paused" | "off";

export type DemoMood = "calm" | "bored" | "stressed" | "tired" | "restless" | "neutral";

export type DemoMomentTag = "boredom" | "evening" | "alone" | "stress" | "scrolling" | "unclear";

export type DemoPauseChoice = "continueMindfully" | "doSomethingElse" | "reflect" | "skip";

export type DemoNotificationPreference = "notificationsPaused" | "useDiscreetNotifications";

export type DemoProtectionLevel = DemoSupportStyle;

export interface DemoUserState {
  name: string;
  currentWeek: number;
  currentDay: number;
}

export interface DemoSensitiveWindow {
  label: string;
  startTime: string;
  endTime: string;
}

export interface DemoOnboardingState {
  selectedGoals: readonly string[];
  supportStyle: DemoSupportStyle;
  suggestedSensitiveWindow: DemoSensitiveWindow;
}

export interface DemoCheckIn {
  id: string;
  createdAt: string;
  mood: DemoMood;
  momentTag: DemoMomentTag;
  intention: "pause" | "reflect" | "continueMindfully";
}

export interface DemoPauseSession {
  id: string;
  completedAt: string;
  durationSeconds: number;
  choice: DemoPauseChoice;
}

export interface DemoLogEntry {
  id: string;
  loggedAt: string;
  title: string;
  body: string;
  tags: readonly DemoMomentTag[];
}

export interface DemoExerciseUsage {
  exerciseId: string;
  title: string;
  completedCount: number;
}

export interface DemoProtectionState {
  status: DemoProtectionStatus;
  sensitiveWindow: DemoSensitiveWindow;
  level: DemoProtectionLevel;
}

export interface DemoSettingsState {
  personalizationEnabled: boolean;
  notificationsPaused: boolean;
  useDiscreetNotifications: boolean;
}

export interface DemoAppState {
  user: DemoUserState;
  onboarding: DemoOnboardingState;
  checkIns: readonly DemoCheckIn[];
  pauseSessions: readonly DemoPauseSession[];
  logs: readonly DemoLogEntry[];
  exercises: readonly DemoExerciseUsage[];
  protection: DemoProtectionState;
  settings: DemoSettingsState;
}

export interface TodayDashboardData {
  userName: string;
  currentWeek: number;
  currentDay: number;
  recommendationTitle: string;
  recommendationBody: string;
  weeklyPreview: string;
  coachInsight: string;
}

export interface ProgressSummaryMetric {
  label: string;
  value: string;
  detail: string;
}

export interface ProgressSummaryData {
  metrics: readonly ProgressSummaryMetric[];
  helpfulTools: readonly string[];
}
