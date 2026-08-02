# Bloom Maestro E2E

These flows exercise the separately installed Bloom E2E iOS development build through the Expo
Development Client. They run visibly in the booted iOS Simulator and target only
`com.umutcyilmaz.bloom.e2e`.

## Prerequisites

- A booted iOS Simulator
- The Bloom E2E development build (`com.umutcyilmaz.bloom.e2e`) installed in that Simulator
- Maestro CLI and Java 17 or newer installed
- Port `8082` available for E2E Metro

## Local E2E Workflow

1. Stop any normal Metro process before starting the E2E workflow.
2. Start Metro in development-only E2E mode on canonical `localhost:8082`, and leave this terminal
   running:

   ```sh
   npm run start:e2e
   ```

   If the Development Client launcher exposes only a LAN address instead, the bootstrap also
   accepts an IPv4 URL ending exactly in `:8082`; it never selects port `8081` or another port.
3. In another terminal, build and install Bloom E2E when it is not installed or its native
   configuration is stale:

   ```sh
   npm run ios:e2e
   ```

   After an application-identity or other native configuration change, regenerate the local native
   project first, then build and install:

   ```sh
   npm run ios:e2e:rebuild
   npm run ios:e2e
   ```

   `ios:e2e` applies the E2E Expo configuration, then builds and installs the development client
   while explicitly requesting port `8082`. Expo SDK 54's `run:ios` command does not expose a
   localhost host flag, so starting the canonical localhost server first lets the native launch
   reuse it. `ios:e2e:rebuild` explicitly deletes and regenerates the local gitignored `ios` project.
   The clean rebuild is not part of an ordinary Metro start and should be used only when native
   regeneration is required.

4. Run the appropriate Maestro command from the list below.

Metro must be restarted when switching between normal and E2E mode because Expo public
environment variables are embedded in the JavaScript bundle.

## Debug Tools and Test Data

The Bloom state debug route and onboarding quiz scoring preview are development-only tools guarded
by `__DEV__`. Production builds redirect away from `/debug/bloom-state` to the safest normal entry
and never mount the debug screen.

Maestro requires the Bloom E2E Expo Development Client. `npm run start:e2e` sets
`APP_VARIANT=e2e` and `EXPO_PUBLIC_E2E_MODE=1`, then starts Expo with `--dev-client`, `--localhost`,
and `--port 8082`.

`EXPO_PUBLIC_E2E_MODE=1` only enables development timer shortcuts when `__DEV__` is true; it cannot
select the native E2E application identity by itself, and it cannot enable the debug route or
scoring preview in a release build.

Bloom (`com.umutcyilmaz.bloom`) and Bloom E2E (`com.umutcyilmaz.bloom.e2e`) are separate installed
applications with separate data containers. Every Maestro flow targets Bloom E2E, so its retained
`clearState` operation clears only Bloom E2E. Never change Maestro back to the normal Bloom bundle
identifier, and never copy normal Bloom data into the E2E container.

Automated runs must use synthetic debug fixtures only, never real personal data. Treat screenshots,
videos, and hierarchy output as potentially sensitive even when they contain synthetic fixtures.

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
Development Client launcher, so this helper prefers the canonical `http://localhost:8082` row and
falls back to an IPv4 LAN URL only when it also ends exactly in `:8082`. The connected-state check
enforces the same host and port boundary before closing the developer menu. The helper then handles
the optional Continue screen and waits for a stable Bloom test ID. Cold JavaScript bundle loads use
intentionally generous timeouts. The tests remain visible live in the iOS Simulator throughout
each flow.

Core flows then open the development-only state screen through the Bloom E2E `tms-e2e` scheme and
start a deterministic synthetic debug profile. This avoids repeating onboarding while still
exercising the real result screen and user-facing navigation. The normal Bloom `tms` scheme is not
used by Maestro.

## Inspecting Selectors

With the Simulator showing the screen you want to inspect, use:

```sh
maestro hierarchy
maestro studio
```

Prefer visible text for meaningful assertions. Use the focused `bloom.*` test IDs when repeated
labels or scrolling would otherwise make interaction ambiguous.
