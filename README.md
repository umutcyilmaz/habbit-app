# Bloom

Bloom is a privacy-first mobile app for sexual wellness, arousal awareness, and calmer habit change. It helps adult users notice patterns, pause before automatic loops, reflect without judgment, and build more intentional routines.

Bloom's core message is:

> Build awareness before automatic habits.

Progress in Bloom is awareness, not abstinence.

## What Bloom Is

- A discreet, adult-focused wellness app.
- A place to pause before automatic adult-content loops.
- A lightweight reflection tool for noticing triggers, sensitive windows, and rushing.
- A local-first product that treats privacy and data deletion as core trust features.
- A supportive companion for more mindful masturbation and arousal awareness.

## What Bloom Is Not

- Not a NoFap app.
- Not a relapse counter.
- Not a porn addiction app.
- Not a medical diagnosis or treatment product.
- Not a performance tracker.
- Not a shame-based blocker.

Bloom avoids language that frames users as broken, failing, or being monitored. The product should feel calm, mature, optional, and private.

## MVP Goal

The MVP should help a user:

- Complete a quick, privacy-aware onboarding.
- Understand the product boundaries and safety note.
- Use Today as the home base.
- Do a Quick Check-In.
- Use Pause Now and a 90-Second Pause.
- Add Daily Log reflections.
- Try basic exercises.
- Review basic progress and insights.
- Configure gentle protection around sensitive windows.
- Control privacy, notifications, and data deletion basics.

The MVP should not include backend sync, AI calls, authentication, payment integration, advanced coaching, or full analytics infrastructure.

## Development Philosophy

- Start local-first.
- Keep privacy and deletion basics out of any paywall.
- Separate UI, domain logic, storage, and feature modules.
- Prefer clear TypeScript models and validation boundaries.
- Design for future sync without requiring a backend in the foundation phase.
- Avoid sensitive analytics and unnecessary collection.
- Build trust through restrained copy, predictable controls, and user agency.

## Preferred Technical Direction

- React Native
- Expo
- TypeScript
- Expo Router
- Feature-based architecture
- Local-first storage
- Future-ready boundaries for sync, subscription, and optional backend services

## MVP Navigation

The final MVP bottom navigation should contain:

1. Today
2. Log
3. Exercises
4. Progress
5. Protect

Profile, Privacy, Data Controls, Notifications, App Lock, and Subscription should be accessed from the header or settings area, not as bottom tabs. There should be no Plus tab in the bottom navigation.

## Running The Project

This repository currently contains foundation documentation only. There is no app scaffold yet.

When the Expo app is added, expected setup will likely be:

```bash
npm install
npm run start
```

The exact commands should be updated after Phase 1 creates the app scaffold.
