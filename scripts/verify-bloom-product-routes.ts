import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { BloomProductFlowIntent } from "../src/app/flows/mapBloomHomeActionToFlowIntent";
import {
  bloomProductRoutePaths,
  type BloomProductRouteDestination,
  type BloomProductRouteTarget
} from "../src/app/navigation/bloomProductRoutes";
import { mapBloomProductFlowIntentToRouteDestination } from "../src/app/navigation/mapBloomProductFlowIntentToRouteDestination";
import { navigateBloomProductFlow } from "../src/app/navigation/navigateBloomProductFlow";

type Assert<Condition extends true> = Condition;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type ReadyRoutePath =
  | typeof bloomProductRoutePaths.masturbationSessionStart
  | typeof bloomProductRoutePaths.masturbationSessionResume
  | typeof bloomProductRoutePaths.masturbationSessionFeedback
  | typeof bloomProductRoutePaths.contentFree;
type ReadyRouteContract = Assert<Equal<
  Extract<BloomProductRouteDestination, { status: "ready" }>["destination"]["pathname"],
  ReadyRoutePath
>>;
type PendingRouteContract = Assert<Equal<
  Extract<BloomProductRouteDestination, { status: "featurePending" }>["destination"]["pathname"],
  Exclude<BloomProductRouteTarget["pathname"], ReadyRoutePath>
>>;

type FlowIntentKey<Intent extends BloomProductFlowIntent> =
  Intent extends { mode: infer Mode extends string }
    ? `${Intent["flow"]}:${Mode}`
    : Intent["flow"];

type RouteCases = {
  [Intent in BloomProductFlowIntent as FlowIntentKey<Intent>]: {
    intent: Intent;
    target: BloomProductRouteTarget;
    status: Intent["flow"] extends "masturbationSession" | "masturbationSessionFeedback" | "contentFree"
      ? "ready"
      : "featurePending";
  };
};

const progress = {
  completedDays: 9,
  currentDay: 10,
  isPeriodComplete: false,
  remainingDays: 6,
  remainingSeconds: 500_000.5
} as const;

// Keys include modes so adding a new mode also requires a new typed fixture.
const cases = {
  "masturbationSession:start": {
    status: "ready",
    intent: { flow: "masturbationSession", mode: "start" },
    target: { pathname: "/bloom/masturbation-session/start" }
  },
  "masturbationSession:resume": {
    status: "ready",
    intent: {
      flow: "masturbationSession",
      mode: "resume",
      sessionId: "route-session"
    },
    target: {
      pathname: "/bloom/masturbation-session/resume",
      params: { sessionId: "route-session" }
    }
  },
  masturbationSessionFeedback: {
    status: "ready",
    intent: {
      flow: "masturbationSessionFeedback",
      sessionId: "route-feedback-session"
    },
    target: {
      pathname: "/bloom/masturbation-session/feedback",
      params: { sessionId: "route-feedback-session" }
    }
  },
  "urgeControl:resume": {
    status: "featurePending",
    intent: {
      flow: "urgeControl",
      mode: "resume",
      eventId: "route-urge",
      stage: "phoneAwayActive"
    },
    target: {
      pathname: "/bloom/urge-control/resume",
      params: { eventId: "route-urge", stage: "phoneAwayActive" }
    }
  },
  resetCompletion: {
    status: "featurePending",
    intent: {
      flow: "resetCompletion",
      journeyId: "route-elapsed-journey",
      attemptId: "route-elapsed-attempt",
      progress: {
        completedDays: 15,
        currentDay: 15,
        isPeriodComplete: true,
        remainingDays: 0,
        remainingSeconds: 0
      }
    },
    target: {
      pathname: "/bloom/reset/completion",
      params: {
        journeyId: "route-elapsed-journey",
        attemptId: "route-elapsed-attempt"
      }
    }
  },
  resetAssessment: {
    status: "featurePending",
    intent: {
      flow: "resetAssessment",
      journeyId: "route-assessment-journey",
      attemptId: "route-assessment-attempt"
    },
    target: {
      pathname: "/bloom/reset/assessment",
      params: {
        journeyId: "route-assessment-journey",
        attemptId: "route-assessment-attempt"
      }
    }
  },
  resetBaseline: {
    status: "featurePending",
    intent: { flow: "resetBaseline", journeyId: "route-baseline-journey" },
    target: {
      pathname: "/bloom/reset/baseline",
      params: { journeyId: "route-baseline-journey" }
    }
  },
  resetProgress: {
    status: "featurePending",
    intent: {
      flow: "resetProgress",
      journeyId: "route-active-journey",
      attemptId: "route-active-attempt",
      progress
    },
    target: {
      pathname: "/bloom/reset/progress",
      params: {
        journeyId: "route-active-journey",
        attemptId: "route-active-attempt"
      }
    }
  },
  startingRecommendation: {
    status: "featurePending",
    intent: {
      flow: "startingRecommendation",
      recommendation: "reset_and_content_free"
    },
    target: {
      pathname: "/bloom/starting-recommendation",
      params: { recommendation: "reset_and_content_free" }
    }
  },
  resetRecommendation: {
    status: "featurePending",
    intent: { flow: "resetRecommendation", journeyId: "route-recommendation" },
    target: {
      pathname: "/bloom/reset/recommendation",
      params: { journeyId: "route-recommendation" }
    }
  },
  contentFree: {
    status: "ready",
    intent: { flow: "contentFree" },
    target: { pathname: "/bloom/content-free" }
  }
} satisfies RouteCases;

export function verifyBloomProductRoutes() {
  for (const testCase of Object.values(cases)) {
    const intent = testCase.intent;
    if ("progress" in intent) Object.freeze(intent.progress);
    Object.freeze(intent);
    const before = JSON.stringify(intent);
    const destination = mapBloomProductFlowIntentToRouteDestination(intent);
    assert(
      isDeepStrictEqual(destination, {
        status: testCase.status,
        destination: testCase.target
      }),
      `${intent.flow} must resolve to its exact readiness, pathname, and params.`
    );
    assert(
      isDeepStrictEqual(
        mapBloomProductFlowIntentToRouteDestination(intent),
        destination
      ) && JSON.stringify(intent) === before,
      `${intent.flow} must resolve deterministically without mutating frozen input.`
    );
    assert(
      !("pathname" in destination) && !("params" in destination),
      "Route resolution must keep readiness explicit around its router target."
    );
    if ("params" in destination.destination) {
      assert(
        Object.values(destination.destination.params!).every(
          (value) => typeof value === "string"
        ),
        "Navigation params must contain stable primitive facts, not state snapshots."
      );
    }
  }

  verifyProgressIsNotRouteIdentity();
  verifyNavigationExecution();
  verifyNamespaceAndDependencies();
  console.log(
    "Bloom product-route verification passed (three ready session routes, ready Content-Free, seven pending destinations, navigation execution, and legacy isolation)."
  );
}

function verifyNavigationExecution() {
  for (const testCase of Object.values(cases)) {
    for (const method of [undefined, "push", "replace"] as const) {
      const calls: Array<{ method: "push" | "replace"; target: unknown }> = [];
      const router: Parameters<typeof navigateBloomProductFlow>[0] = {
        push: (target) => calls.push({ method: "push", target }),
        replace: (target) => calls.push({ method: "replace", target })
      };
      const before = JSON.stringify(testCase.intent);
      mapBloomProductFlowIntentToRouteDestination(testCase.intent);
      assert(calls.length === 0, "Pure route mapping must never invoke a router.");
      const navigated = navigateBloomProductFlow(router, testCase.intent, method);
      assert(
        navigated === (testCase.status === "ready") &&
          isDeepStrictEqual(calls, testCase.status === "ready"
            ? [{ method: method ?? "push", target: testCase.target }]
            : []),
        "Navigation must call the exact requested router method once for ready routes and refuse every pending route."
      );
      assert(
        JSON.stringify(testCase.intent) === before,
        "Navigation execution must not modify its semantic intent or domain facts."
      );
    }
  }
}

function verifyProgressIsNotRouteIdentity() {
  for (const testCase of [cases.resetCompletion, cases.resetProgress]) {
    const changed = {
      ...testCase.intent,
      progress: {
        completedDays: 1,
        currentDay: 2,
        isPeriodComplete: false,
        remainingDays: 14,
        remainingSeconds: 1_200_000
      }
    } satisfies BloomProductFlowIntent;
    assert(
      isDeepStrictEqual(
        mapBloomProductFlowIntentToRouteDestination(changed).destination,
        testCase.target
      ),
      "Reset progress changes must not change a destination's journey/attempt identity."
    );
    const unreadableProgress = { ...testCase.intent };
    Object.defineProperty(unreadableProgress, "progress", {
      enumerable: true,
      get() {
        throw new Error("Route mapping must not read derived Reset progress.");
      }
    });
    Object.freeze(unreadableProgress);
    assert(
      isDeepStrictEqual(
        mapBloomProductFlowIntentToRouteDestination(unreadableProgress).destination,
        testCase.target
      ),
      "Reset routing must use stable identifiers without evaluating or serializing progress."
    );
  }
}

function verifyNamespaceAndDependencies() {
  const paths = Object.values(bloomProductRoutePaths);
  assert(
    paths.every((pathname) => pathname.startsWith("/bloom/")) &&
      new Set(paths).size === paths.length &&
      isDeepStrictEqual(
        [...paths].sort(),
        Object.values(cases).map((testCase) => testCase.target.pathname).sort()
      ),
    "The central contract must expose exactly the unique Bloom namespace paths."
  );
  assert(
    isDeepStrictEqual(readdirSync(resolve("app/bloom")).sort(), ["content-free.tsx", "masturbation-session"]) &&
      isDeepStrictEqual(
        readdirSync(resolve("app/bloom/masturbation-session")).sort(),
        ["feedback.tsx", "resume.tsx", "start.tsx"]
      ),
    "Exactly the session and Content-Free routes must exist; other Bloom features remain deferred."
  );
  for (const [file, feature] of [
    ["app/bloom/masturbation-session/start.tsx", "masturbation-tracking"],
    ["app/bloom/masturbation-session/resume.tsx", "masturbation-tracking"],
    ["app/bloom/masturbation-session/feedback.tsx", "masturbation-tracking"],
    ["app/bloom/content-free.tsx", "content-free"]
  ] as const) {
    const entry = readFileSync(
      resolve(file),
      "utf8"
    );
    assert(
      new RegExp(`from\\s+["'][^"']*src/features/${feature}/`).test(entry) &&
        /export\s+(?:default\s+\w+|\{[^}]*\bas\s+default\b[^}]*\})/.test(entry) &&
        (!/\bfunction\b/.test(entry) ||
          /export\s+default\s+function\s+\w+\(\)\s*\{\s*return\s+<\w+\s*\/>;\s*\}\s*$/.test(entry)) &&
        !/\b(?:const|let|useEffect|useState|router|productActions|flowActions|AsyncStorage)\b/.test(entry),
      `${file} must remain a thin route entry delegating to its real feature.`
    );
  }
  for (const file of [
    "src/app/navigation/bloomProductRoutes.ts",
    "src/app/navigation/mapBloomProductFlowIntentToRouteDestination.ts"
  ]) {
    const source = readFileSync(resolve(file), "utf8");
    const runtimeImports = Array.from(source.matchAll(
      /import\s+(type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g
    )).filter((match) => match[1] === undefined);
    assert(
      runtimeImports.every((match) => match[2] === "./bloomProductRoutes"),
      "Route mapping may only import its route constants at runtime."
    );
    assert(
      !/expo-router|["']react["']|AsyncStorage|\brequire\s*\(|\bimport\s*\(|router\.(?:push|replace)|navigation\.navigate|applyAcknowledgedMutation|saveBloomLocalState|persistBloomLocalState/.test(source),
      "The route contract and pure mapper must not navigate, mutate, or access React/storage."
    );
    assert(
      !/get(?:BloomHomeReadModel|ResetRestrictionStatus|MasturbationTrackingAvailability|ContentFreeProgress|UrgeControlProgress)\s*\(|Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(/.test(source),
      "Route resolution must not evaluate selectors or generate new domain facts."
    );
  }

  const adapter = readFileSync(
    resolve("src/app/navigation/navigateBloomProductFlow.ts"),
    "utf8"
  );
  const adapterImports = Array.from(adapter.matchAll(
    /import\s+(type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g
  ));
  assert(
    adapterImports.some((match) => match[1] !== undefined && match[2] === "expo-router") &&
      adapterImports.filter((match) => match[1] === undefined).every(
        (match) => match[2] === "./mapBloomProductFlowIntentToRouteDestination"
      ),
    "The thin adapter must use Expo Router types and only the pure mapper at runtime."
  );
  assert(
    !/AsyncStorage|applyAcknowledgedMutation|saveBloomLocalState|persistBloomLocalState|productActions|flowActions|useEffect|Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(|get(?:BloomHomeReadModel|ResetRestrictionStatus|MasturbationTrackingAvailability|ContentFreeProgress|UrgeControlProgress)\s*\(/.test(adapter),
    "The navigation adapter must not mutate state, evaluate policy, or generate application facts."
  );

  for (const file of [
    "app/index.tsx",
    "app/_layout.tsx",
    "app/onboarding/index.tsx",
    "app/onboarding/quiz.tsx",
    "app/onboarding/result.tsx",
    "app/(tabs)/today.tsx",
    "app/pause/index.tsx",
    "app/pause/timer.tsx",
    "app/pause/saved.tsx",
    "app/exercises/arousal-control/index.tsx",
    "app/protect/setup.tsx",
    "app/protect/active.tsx",
    "app/reset/ten-day/index.tsx",
    "app/reset/ten-day/practice.tsx",
    "app/reset/ten-day/saved.tsx",
    "src/domain/journey/getNextBloomAction.ts"
  ]) {
    const source = readFileSync(resolve(file), "utf8");
    assert(
      !/mapBloomProductFlowIntentToRouteDestination|bloomProductRoutePaths|useBloomProductFlowActions|["']\/bloom\//.test(source),
      `${file} must remain present and isolated from new-product routing/cutover.`
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
