# Bloom Maestro E2E

These flows exercise the installed Bloom iOS development build through the Expo Development
Client. They run visibly in the booted iOS Simulator.

## Prerequisites

- A booted iOS Simulator
- The Bloom development build (`com.umutcyilmaz.bloom`) installed in that Simulator
- Maestro CLI and Java 17 or newer installed
- Metro running on port `8082`

Start Metro before running a flow:

```sh
npx expo start --dev-client --port 8082
```

## Commands

Run the onboarding smoke test:

```sh
npm run maestro:smoke
```

Run the complete general-onboarding journey:

```sh
npm run maestro:onboarding
```

Run every maintainable top-level E2E flow:

```sh
npm run maestro:all
```

`maestro:all` lists only top-level flows. Files in `.maestro/subflows` are reusable helpers and
must not be run as standalone tests.

## Development Client Bootstrap

The top-level flows call `subflows/open-bloom.yaml`. Clearing app state also resets the Expo
Development Client launcher, so this helper reconnects to `http://localhost:8082`, closes the
developer menu, handles the optional Continue screen, and waits for a stable Bloom test ID.
Cold JavaScript bundle loads use intentionally generous timeouts.

## Inspecting Selectors

With the Simulator showing the screen you want to inspect, use:

```sh
maestro hierarchy
maestro studio
```

Prefer visible text for meaningful assertions. Use the focused `bloom.*` test IDs when repeated
labels or scrolling would otherwise make interaction ambiguous.
