# Bloom Maestro E2E

These flows exercise the installed Bloom iOS development build through the Expo Development
Client. They run visibly in the booted iOS Simulator.

## Prerequisites

- A booted iOS Simulator
- The Bloom development build (`com.umutcyilmaz.bloom`) installed in that Simulator
- Maestro CLI and Java 17 or newer installed
- E2E Metro running on port `8082`

Stop any normal Metro process, then start Metro in development-only E2E mode:

```sh
npm run start:e2e
```

Metro must be restarted when switching between normal and E2E mode because Expo public
environment variables are embedded in the JavaScript bundle.

## Commands

Run the onboarding smoke test:

```sh
npm run maestro:smoke
```

Run the complete general-onboarding journey:

```sh
npm run maestro:onboarding
```

Run the mixed-profile Protection setup journey:

```sh
npm run maestro:protection
```

Run the general-profile Pause entry journey:

```sh
npm run maestro:pause
```

Run the control-profile Arousal Control entry journey:

```sh
npm run maestro:arousal
```

Run all three core entry flows:

```sh
npm run maestro:core
```

Run the terminal Pause, Reset, and Arousal Control flows:

```sh
npm run maestro:terminal
```

Each terminal flow can also be run independently:

```sh
npm run maestro:pause-complete
npm run maestro:reset-complete
npm run maestro:arousal-complete
```

Run every maintainable top-level E2E flow:

```sh
npm run maestro:all
```

`maestro:all` lists only top-level flows. Files in `.maestro/subflows` are reusable helpers and
must not be run as standalone tests.

The core entry flows intentionally stop at the Pause timer or Arousal Control practice screen.
The terminal flows continue through the real completion mutations, Saved screens, persisted
summaries, relaunches, and concise duplicate-record checks.

## E2E Timing Safety

`EXPO_PUBLIC_E2E_MODE=1` only shortens timers when `__DEV__` is also true. It does not complete a
record, bypass a route guard, change a saved value, or enter Bloom local state. The visible test
still starts each timer, waits, completes required check-ins, and presses the normal save action.

Production and release builds always use the normal durations:

- Pause round: 90 seconds
- 10-Day Reset practice: 2 minutes
- Arousal Control pause: 30 seconds

E2E development uses three-second timer rounds. Never distribute a development build as a
release build.

After E2E testing, stop Metro and restart normal manual testing without the environment flag:

```sh
npm start
```

## Development Client Bootstrap

The top-level flows call `subflows/open-bloom.yaml`. Clearing app state also resets the Expo
Development Client launcher, so this helper reconnects to `http://localhost:8082`, closes the
developer menu, handles the optional Continue screen, and waits for a stable Bloom test ID.
Cold JavaScript bundle loads use intentionally generous timeouts. The tests remain visible live
in the iOS Simulator throughout each flow.

Core flows then open the development-only state screen through the registered `tms` scheme and
start a deterministic debug profile. This avoids repeating onboarding while still exercising the
real result screen and user-facing navigation.

## Inspecting Selectors

With the Simulator showing the screen you want to inspect, use:

```sh
maestro hierarchy
maestro studio
```

Prefer visible text for meaningful assertions. Use the focused `bloom.*` test IDs when repeated
labels or scrolling would otherwise make interaction ambiguous.
