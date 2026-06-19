# Architecture Decision Log

This log records product and technical decisions that should guide implementation. Add new entries when a decision changes the app's architecture, privacy posture, navigation, monetization, or product boundaries.

## ADR-001: Today Is The Home Base

Status: Accepted

Decision:

Today is the primary home screen after onboarding.

Rationale:

Bloom is a daily awareness product. Today should surface timely actions, gentle prompts, and the next useful step without requiring the user to navigate through multiple sections.

Implications:

- Onboarding ends at Today.
- Today can link to Pause, Quick Check-In, Daily Log, Exercises, Progress, and Protection.
- Today should remain calm and uncluttered.

## ADR-002: Bottom Navigation Has 5 Tabs

Status: Accepted

Decision:

The MVP bottom navigation contains Today, Log, Exercises, Progress, and Protect.

Rationale:

These tabs map to the core MVP jobs: daily action, reflection, practice, awareness review, and gentle support.

Implications:

- Do not add Plus as a bottom tab.
- Do not add Profile or Settings as bottom tabs.
- Any route shell should preserve these five primary destinations.

## ADR-003: Profile And Settings Are Header-Accessed

Status: Accepted

Decision:

Profile, Privacy, Data Controls, Notifications, App Lock, and Subscription are accessed from the header/settings area.

Rationale:

Settings are important, but they should not compete with the core daily navigation.

Implications:

- Today and other primary tabs should include a consistent settings entry point.
- Privacy and deletion controls must still be easy to find.

## ADR-004: Protection Is Not A Blocker

Status: Accepted

Decision:

Protection features provide gentle support around sensitive windows. They should not be framed or implemented as hard blockers.

Rationale:

Bloom's principle is awareness and agency. Hard blocking can create shame, avoidance, and a surveillance-like product feel.

Implications:

- Use terms like "pause", "delay", and "gentle support".
- Users can continue, edit, disable, or delete protection settings.
- Avoid device-level surveillance in the MVP.

## ADR-005: Progress Is Awareness-Based, Not Score-Based

Status: Accepted

Decision:

Progress should summarize patterns, moments, pauses, and reflections. It should not produce performance scores or failure states.

Rationale:

The product should support noticing and intentionality, not grading sexual behavior.

Implications:

- No performance score.
- No shame-based streak reset mechanics.
- Insights should explain observations in neutral language.

## ADR-006: Privacy And Deletion Basics Are Never Paywalled

Status: Accepted

Decision:

Privacy overview, notification privacy basics, app data deletion, and safety boundaries must remain available to all users.

Rationale:

Trust controls are core product responsibilities, not premium features.

Implications:

- Bloom Plus cannot gate data deletion.
- Paywall copy must state that core privacy controls remain available when relevant.
- Tests should protect access to Data Controls.

## ADR-007: No Backend In Foundation Phase

Status: Accepted

Decision:

The foundation phase will not introduce a backend.

Rationale:

The MVP can be designed local-first. Adding a backend now would increase privacy, security, architecture, and compliance complexity before the product foundation is validated.

Implications:

- Data models should still include future sync considerations.
- Repositories should make storage replaceable.
- Authentication is not required in Phase 0.

## ADR-008: No AI Integration In Foundation Phase

Status: Accepted

Decision:

The foundation phase will not include AI API calls or AI-generated insights.

Rationale:

Bloom handles sensitive reflections. AI features need a stronger consent, privacy, safety, and copy framework before implementation.

Implications:

- Initial insights should be deterministic and explainable.
- Sensitive text should not be sent to external services.
- AI can be revisited after MVP trust controls are proven.
