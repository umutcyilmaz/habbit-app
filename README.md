# tms

This repository contains the mobile app foundation for a privacy-first sexual wellness, arousal awareness, and habit improvement product.

The current working title is controlled by `src/app/config/appConfig.json`. The brand name is not final, so visible app naming should flow through:

- `APP_NAME`
- `APP_WORKING_TITLE`
- `APP_TAGLINE`

The current product message is:

> Build awareness before automatic habits.

Progress is awareness, not abstinence.

## What The Product Is

- A discreet, adult-focused wellness app.
- A place to pause before automatic adult-content loops.
- A lightweight reflection tool for noticing triggers, sensitive windows, and rushing.
- A local-first product that treats privacy and data deletion as core trust features.
- A supportive companion for more mindful masturbation and arousal awareness.

## What The Product Is Not

- Not a NoFap app.
- Not a relapse counter.
- Not a porn addiction app.
- Not a medical diagnosis or treatment product.
- Not a performance tracker.
- Not a shame-based blocker.

The product avoids language that frames users as broken, failing, or being monitored. It should feel calm, mature, optional, and private.

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

## Current App Foundation

Phase 1 has started. The repository now includes:

- Expo + React Native + TypeScript setup.
- Expo Router root stack and five-tab MVP navigation.
- Placeholder screens for Today, Log, Exercises, Progress, Protect, and Settings.
- Shared design tokens and reusable app components.
- TypeScript-only domain models based on `docs/DATA_MODEL.md`.
- Placeholder storage abstraction prepared for local-first persistence.

## MVP Navigation

The final MVP bottom navigation should contain:

1. Today
2. Log
3. Exercises
4. Progress
5. Protect

Profile, Privacy, Data Controls, Notifications, App Lock, and Subscription should be accessed from the header or settings area, not as bottom tabs. There should be no Plus tab in the bottom navigation.

## Running The Project

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

For a clean Expo Go restart:

```bash
npx expo start -c --port 8082
```

Development uses port `8082` by default. Do not use Expo or Metro on port `8081` for this project. If `8082` is busy, choose another free port such as `8083`.

Run on a target:

```bash
npm run ios
npm run android
npm run web
```

Typecheck:

```bash
npm run typecheck
```
