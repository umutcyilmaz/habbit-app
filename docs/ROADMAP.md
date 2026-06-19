# Roadmap

## Phase 0: Foundation And Documentation

Status: Current phase.

Goals:

- Define product scope and principles.
- Document MVP modules and non-goals.
- Create initial user flows and screen inventory.
- Draft data model and architecture direction.
- Establish copy and privacy guidelines.
- Record initial architecture decisions.

Exit criteria:

- Foundation docs are complete.
- Team agrees on MVP navigation and product boundaries.
- Open questions are identified before screen implementation.

## Phase 1: App Scaffold, Navigation, Design System

Goals:

- Create Expo + React Native + TypeScript scaffold.
- Add Expo Router.
- Implement bottom navigation with Today, Log, Exercises, Progress, and Protect.
- Add header/settings access pattern.
- Create design tokens, typography, spacing, and basic components.
- Add linting, formatting, and test setup.
- Add local storage foundation and repository interfaces.

Exit criteria:

- App runs locally.
- Navigation shell is in place.
- Design system primitives are usable.
- No full feature flows are required yet.

## Phase 2: Onboarding + Today

Goals:

- Build Welcome, Safety Note, Privacy / Trust, Goal Selection, Adaptive Questions, Starting Profile, and Starting Plan.
- Create Today Dashboard as the home base.
- Save onboarding answers locally.
- Generate the first UserPlan.
- Add empty states for Today.

Exit criteria:

- A new user can complete onboarding and land on Today.
- Onboarding data persists locally.
- Copy follows Bloom guidelines.

## Phase 3: Check-In + Pause + Log

Goals:

- Build Quick Check-In.
- Build Pause Now and 90-Second Pause.
- Build After Pause Check-In.
- Build Daily Log Selector.
- Build Content Reflection if capacity allows.
- Store DailyCheckIn, PauseSession, and LogEntry records locally.

Exit criteria:

- A user can pause, reflect, and log moments.
- Data appears in local history.
- Empty and error states are covered.

## Phase 4: Progress + Basic Insights

Goals:

- Build Progress Overview.
- Add basic awareness summaries.
- Add simple Insights screen or insight details.
- Add Weekly Review and Next Week Focus if capacity allows.
- Keep progress language pattern-based, not score-based.

Exit criteria:

- A user can review basic patterns.
- Insights are explainable and non-judgmental.
- No sensitive analytics are required.

## Phase 5: Protection + Settings / Privacy / Data Controls

Goals:

- Build Protection Center.
- Build Sensitive Window Setup.
- Add Protected Window Delay.
- Build Account & Settings.
- Build Privacy Overview.
- Build Data Controls with local deletion.
- Build Notification Preferences with discreet wording.
- Add App Lock if feasible.

Exit criteria:

- A user can configure gentle support.
- A user can manage privacy and notifications.
- A user can delete local app data.
- Privacy basics are not paywalled.

## Phase 6: Subscription / Paywall Experiments

Goals:

- Define Bloom Plus offer.
- Explore advanced insights, custom routines, and deeper reports.
- Add subscription UI experiments.
- Integrate payments only after offer validation.

Exit criteria:

- Paid features do not restrict core privacy, deletion, or safety controls.
- Paywall copy follows Bloom guidelines.
- Subscription state is represented cleanly in the app.

## Later Considerations

- Backend sync.
- Optional account model.
- Data export polish.
- Advanced reports.
- Multiple profiles.
- Full coaching library.
- Deep adaptive plans.
- AI-assisted insights only after privacy, safety, and consent requirements are clearly defined.
