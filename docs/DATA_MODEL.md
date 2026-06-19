# Data Model

This is a first draft for the local-first MVP. Types are written in TypeScript style and should be refined once the app scaffold, storage layer, and validation library are selected.

## Shared Types

```ts
type ISODateString = string;
type UUID = string;

type SupportStyle = "gentle" | "balanced" | "direct";
type Source = "onboarding" | "today" | "log" | "pause" | "protect" | "progress" | "settings";
type SyncStatus = "localOnly" | "pending" | "synced" | "error";
```

## User

```ts
interface User {
  id: UUID;
  displayName?: string;
  ageRange?: "18-24" | "25-34" | "35-44" | "45-54" | "55+";
  createdAt: ISODateString;
  updatedAt: ISODateString;
  onboardingCompletedAt?: ISODateString;
  locale?: string;
  timezone?: string;
  supportStyle: SupportStyle;
  privacySettingsId: UUID;
  notificationSettingsId: UUID;
  subscriptionStateId?: UUID;
  syncStatus: SyncStatus;
}
```

## OnboardingAnswers

```ts
interface OnboardingAnswers {
  id: UUID;
  userId: UUID;
  goals: UserGoal[];
  commonMoments: Array<"boredom" | "stress" | "tiredness" | "alone" | "afterSocialMedia" | "other">;
  sensitiveWindows: Array<"morning" | "afternoon" | "evening" | "lateNight">;
  adultContentStartsAutomatically?: "often" | "sometimes" | "rarely" | "preferNotToSay";
  adultContentBeforeRushedMasturbation?: "often" | "sometimes" | "rarely" | "preferNotToSay";
  rushingPresent?: "often" | "sometimes" | "rarely" | "preferNotToSay";
  preferredSupportStyle: SupportStyle;
  medicalRedFlags: "none" | "present" | "preferNotToSay";
  completedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## UserGoal

```ts
type UserGoal =
  | "pauseBeforeAutomaticHabits"
  | "reduceAdultContentLoops"
  | "masturbateMoreMindfully"
  | "reduceRushing"
  | "understandTriggers"
  | "improveArousalAwareness"
  | "buildCalmerRoutines";
```

## DailyCheckIn

```ts
interface DailyCheckIn {
  id: UUID;
  userId: UUID;
  checkedInAt: ISODateString;
  source: Source;
  mood?: "calm" | "bored" | "stressed" | "tired" | "restless" | "neutral" | "other";
  bodyAwareness?: "low" | "medium" | "high" | "preferNotToSay";
  arousalAwareness?: "low" | "medium" | "high" | "preferNotToSay";
  currentMoment?: "boredom" | "stress" | "alone" | "afterSocialMedia" | "evening" | "other";
  intention?: "unclear" | "somewhatIntentional" | "intentional" | "preferNotToSay";
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## LogEntry

```ts
interface LogEntry {
  id: UUID;
  userId: UUID;
  loggedAt: ISODateString;
  source: Source;
  type: "quickCheckIn" | "contentReflection" | "arousalAwareness" | "routineNote";
  momentTags: string[];
  triggerTags: string[];
  adultContentInvolved?: boolean;
  rushingPresent?: boolean;
  masturbationFeltMindful?: "yes" | "somewhat" | "no" | "preferNotToSay";
  intentionBeforeMoment?: "low" | "medium" | "high" | "preferNotToSay";
  feelingAfter?: "calmer" | "same" | "moreActivated" | "unclear" | "preferNotToSay";
  privateNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## PauseSession

```ts
interface PauseSession {
  id: UUID;
  userId: UUID;
  startedAt: ISODateString;
  completedAt?: ISODateString;
  durationSeconds: number;
  source: Source;
  contextTags: string[];
  protectionWindowId?: UUID;
  completed: boolean;
  afterPauseChoice?: "continueIntentionally" | "doSomethingElse" | "reflect" | "skip";
  feelingAfter?: "calmer" | "same" | "moreActivated" | "unclear" | "preferNotToSay";
  linkedLogEntryId?: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## ExerciseSession

```ts
interface ExerciseSession {
  id: UUID;
  userId: UUID;
  exerciseId: string;
  exerciseType: "pause" | "breathing" | "arousalAwareness" | "reflection" | "routine";
  startedAt: ISODateString;
  completedAt?: ISODateString;
  durationSeconds?: number;
  helpfulness?: "notForMe" | "somewhat" | "helpful" | "preferNotToSay";
  privateNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## ProtectionWindow

```ts
interface ProtectionWindow {
  id: UUID;
  userId: UUID;
  label: string;
  daysOfWeek: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  startTimeLocal: string;
  endTimeLocal: string;
  timezone: string;
  enabled: boolean;
  supportStyle: SupportStyle;
  actions: Array<"delayPrompt" | "ninetySecondPause" | "discreetReminder" | "suggestExercise">;
  notificationEnabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## Insight

```ts
interface Insight {
  id: UUID;
  userId: UUID;
  type: "sensitiveWindow" | "commonMoment" | "pauseHelped" | "rushingPattern" | "exercisePattern";
  title: string;
  body: string;
  evidenceRangeStart: ISODateString;
  evidenceRangeEnd: ISODateString;
  relatedRecordIds: UUID[];
  confidence: "low" | "medium" | "high";
  status: "new" | "seen" | "dismissed" | "saved";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## WeeklyReview

```ts
interface WeeklyReview {
  id: UUID;
  userId: UUID;
  weekStart: ISODateString;
  weekEnd: ISODateString;
  completedAt?: ISODateString;
  selectedPatterns: string[];
  helpfulActions: string[];
  nextWeekFocus?: "eveningPause" | "lessRushedRoutine" | "socialMediaTransition" | "arousalAwareness" | "custom";
  customFocus?: string;
  privateNote?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## UserPlan

```ts
interface UserPlan {
  id: UUID;
  userId: UUID;
  activeGoals: UserGoal[];
  supportStyle: SupportStyle;
  startingProfileSummary?: string;
  currentFocus?: string;
  suggestedActions: Array<"quickCheckIn" | "pauseNow" | "dailyLog" | "exercise" | "protectionWindow">;
  protectionWindowIds: UUID[];
  reminderEnabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncStatus: SyncStatus;
}
```

## PrivacySettings

```ts
interface PrivacySettings {
  id: UUID;
  userId: UUID;
  appLockEnabled: boolean;
  biometricUnlockEnabled: boolean;
  analyticsEnabled: boolean;
  crashReportsEnabled: boolean;
  privateNotesEnabled: boolean;
  dataExportAvailable: boolean;
  lastDataDeletionAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## NotificationSettings

```ts
interface NotificationSettings {
  id: UUID;
  userId: UUID;
  remindersEnabled: boolean;
  protectionNotificationsEnabled: boolean;
  weeklyReviewEnabled: boolean;
  discreetWordingEnabled: boolean;
  quietHoursStartLocal?: string;
  quietHoursEndLocal?: string;
  preferredReminderTimeLocal?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## SubscriptionState

```ts
interface SubscriptionState {
  id: UUID;
  userId: UUID;
  tier: "free" | "plus";
  status: "inactive" | "trialing" | "active" | "expired" | "unknown";
  provider?: "apple" | "google" | "stripe" | "none";
  currentPeriodEndsAt?: ISODateString;
  entitlementIds: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

## Local-First Storage Notes

- MVP data should be stored locally by default.
- Structured records should use a repository layer so storage can change without rewriting features.
- App lock and future encryption keys, if used, should be handled separately from general app data.
- Private notes should be optional and clearly described as local app data.
- Avoid collecting exact sensitive content details unless the user explicitly writes them in a private note.

## Future Sync Notes

- Every syncable record includes `userId`, timestamps, and `syncStatus`.
- Future sync should be opt-in or clearly explained.
- Backend sync should not be added in the foundation phase.
- Conflict resolution should prefer preserving user-created records and never silently dropping private reflections.

## Deletion Notes

- Deletion must cover user profile, onboarding answers, logs, pauses, exercises, protection windows, insights, reviews, settings, and local subscription cache.
- Deletion should produce a clear completion state.
- If sync is added later, deletion must include local and remote deletion states with transparent status.

## Analytics Notes

- Sensitive content should not be logged in analytics.
- Private notes should never be logged.
- Analytics events, if added later, should use coarse product interaction names only.
- Notification interactions should avoid sensitive wording.
