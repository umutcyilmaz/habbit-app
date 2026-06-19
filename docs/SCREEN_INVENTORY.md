# Screen Inventory

## Inventory

| Screen | Purpose | Entry Point | Primary Action | Secondary Actions | Data Read | Data Written | MVP Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Welcome | Introduce Bloom's purpose and core message. | First launch | Get Started | View privacy summary | None | None | Must |
| Safety Note | Set product boundaries and safety expectations. | Onboarding | Continue | Learn more | None | Safety acknowledgment timestamp | Must |
| Privacy / Trust | Explain local-first approach, discreet notifications, and deletion basics. | Onboarding, Settings | Continue | Open Privacy Overview | PrivacySettings | Privacy acknowledgment timestamp | Must |
| Goal Selection | Capture user goals in neutral language. | Onboarding | Continue | Skip | UserGoal options | OnboardingAnswers.goals | Must |
| Adaptive Questions | Collect optional starting context and support preferences. | Onboarding | Continue | Skip question, skip all | Existing OnboardingAnswers | OnboardingAnswers | Must |
| Starting Profile | Summarize starting pattern without judgment. | Onboarding | Accept Profile | Edit answers | OnboardingAnswers | UserPlan.startingProfile | Must |
| Starting Plan | Present an editable first plan. | Onboarding | Start Using Bloom | Edit plan, skip reminders | UserPlan draft | UserPlan, NotificationSettings | Must |
| Today Dashboard | Home base for daily actions, reflections, and timely suggestions. | Bottom tab: Today, post-onboarding | Quick Check-In | Pause Now, Add Log, Start Exercise, Settings | User, UserPlan, DailyCheckIn, LogEntry, PauseSession, Insight | None directly | Must |
| Quick Check-In | Capture a lightweight current-state reflection. | Today, Log | Save Check-In | Skip, add note | UserPlan | DailyCheckIn | Must |
| Pause Now | Start a pause before an automatic loop. | Today, Protect, notification, delay prompt | Start Pause | Choose context, skip context | ProtectionWindow, UserPlan | PauseSession started | Must |
| 90-Second Pause | Guide a brief pause practice. | Pause Now | Complete Pause | End early | PauseSession | PauseSession completed | Must |
| After Pause Check-In | Reflect after a pause and choose next step. | 90-Second Pause | Save Reflection | Skip, add log | PauseSession | PauseSession, optional LogEntry | Must |
| Daily Log Selector | Choose log type. | Bottom tab: Log, Today | Select Log Type | View history | LogEntry summary | None | Must |
| Content Reflection | Reflect on adult-content loops and context. | Daily Log Selector, After Pause | Save Reflection | Skip fields, add note | UserGoal, UserPlan | LogEntry | Should |
| Exercises Library | Browse basic exercises. | Bottom tab: Exercises, Today suggestion | Start Exercise | Filter, favorite later | Exercise metadata, ExerciseSession history | None | Must |
| Progress Overview | Show awareness-based summaries. | Bottom tab: Progress | View Insight | Start weekly review | DailyCheckIn, LogEntry, PauseSession, ExerciseSession, WeeklyReview | None | Must |
| Insights | Explain simple observed patterns. | Progress Overview, Today card | Choose Focus | Dismiss, save for later | Insight, LogEntry, PauseSession | UserPlan focus, Insight status | Should |
| Protection Center | Manage gentle support settings. | Bottom tab: Protect | Add Sensitive Window | Edit window, pause now, disable support | ProtectionWindow, NotificationSettings | ProtectionWindow | Must |
| Sensitive Window Setup | Configure days, times, and support style. | Protection Center, Starting Plan | Save Window | Cancel, choose suggestion | UserPlan, Insight | ProtectionWindow | Should |
| Protected Window Delay | Offer a pause during a sensitive window. | Notification, protection trigger, app open during window | Start 90-Second Pause | Continue, change settings | ProtectionWindow, UserPlan | PauseSession, optional LogEntry | Should |
| Account & Settings | Central access for profile, privacy, notifications, app lock, and subscription. | Header/settings button | Open Privacy | Notification preferences, data controls, app lock, subscription | User, PrivacySettings, NotificationSettings, SubscriptionState | None | Must |
| Privacy Overview | Explain data handling and trust controls. | Account & Settings, onboarding | Open Data Controls | Notification privacy, app lock | PrivacySettings, NotificationSettings | PrivacySettings updates | Must |
| Data Controls | Export or delete app data. | Privacy Overview, Account & Settings | Delete Data | Export data, review categories | User, all local user records | Deletion request, export record later | Must |
| Notification Preferences | Configure discreet reminders. | Account & Settings, Starting Plan | Save Preferences | Disable reminders, preview wording | NotificationSettings, ProtectionWindow | NotificationSettings | Must |
| Bloom Plus | Present optional paid features later without paywalling trust basics. | Account & Settings, premium feature entry | Continue | Restore purchases later, close | SubscriptionState | Subscription intent later | Later |
| Empty States | Provide first-use and no-data states across tabs. | Any feature with no data | Start relevant action | Learn more, dismiss | Relevant feature data | None | Must |
| Error States | Handle validation, storage, and unavailable-feature errors. | Any feature | Retry or Continue | Contact support later, go back | Error context | Error log later without sensitive details | Must |

## Navigation Notes

- Bottom navigation contains Today, Log, Exercises, Progress, and Protect.
- Profile, Privacy, Data Controls, Notifications, App Lock, and Subscription live behind header/settings access.
- Bloom Plus should not be part of bottom navigation.
- There should be no Plus tab.

## Data Sensitivity Notes

- Private notes are sensitive and should be local-first.
- Adult-content details should be minimized and optional.
- Analytics, if added later, must not include private notes or sensitive content details.
- Deletion should remove local user records for all MVP data categories.
