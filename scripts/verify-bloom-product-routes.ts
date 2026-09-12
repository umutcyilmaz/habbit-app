import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { BloomProductFlowIntent } from "../src/app/flows/mapBloomHomeActionToFlowIntent";
import {
  bloomProductRoutePaths,
  type BloomProductRouteTarget
} from "../src/app/navigation/bloomProductRoutes";
import { mapBloomProductFlowIntentToRouteDestination } from "../src/app/navigation/mapBloomProductFlowIntentToRouteDestination";

type FlowIntentKey<Intent extends BloomProductFlowIntent> =
  Intent extends { mode: infer Mode extends string }
    ? `${Intent["flow"]}:${Mode}`
    : Intent["flow"];

type RouteCases = {
  [Intent in BloomProductFlowIntent as FlowIntentKey<Intent>]: {
    intent: Intent;
    target: BloomProductRouteTarget;
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
    intent: { flow: "masturbationSession", mode: "start" },
    target: { pathname: "/bloom/masturbation-session/start" }
  },
  "masturbationSession:resume": {
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
    intent: { flow: "resetBaseline", journeyId: "route-baseline-journey" },
    target: {
      pathname: "/bloom/reset/baseline",
      params: { journeyId: "route-baseline-journey" }
    }
  },
  resetProgress: {
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
    intent: { flow: "resetRecommendation", journeyId: "route-recommendation" },
    target: {
      pathname: "/bloom/reset/recommendation",
      params: { journeyId: "route-recommendation" }
    }
  },
  contentFree: {
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
        status: "featurePending",
        destination: testCase.target
      }),
      `${intent.flow} must resolve to its exact deferred pathname and params.`
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
      "A feature-pending result must not masquerade as an executable router target."
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
  verifyNamespaceAndDependencies();
  console.log(
    "Bloom product-route verification passed (all 11 flow variants, exact deferred destinations, omitted derived progress, purity, and legacy isolation)."
  );
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
    "The central contract must expose exactly the unique planned Bloom namespace paths."
  );
  assert(
    !existsSync(resolve("app/bloom")),
    "Feature-pending destinations must not be filled with placeholder route screens."
  );
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
      "The deferred contract and pure mapper must not navigate, mutate, or access React/storage."
    );
    assert(
      !/get(?:BloomHomeReadModel|ResetRestrictionStatus|MasturbationTrackingAvailability|ContentFreeProgress|UrgeControlProgress)\s*\(|Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(/.test(source),
      "Route resolution must not evaluate selectors or generate new domain facts."
    );
  }

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
