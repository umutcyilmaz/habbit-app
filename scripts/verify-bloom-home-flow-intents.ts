import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  mapBloomHomeActionToFlowIntent,
  type BloomProductFlowIntent
} from "../src/app/flows/mapBloomHomeActionToFlowIntent";
import type { BloomHomeAction } from "../src/domain/home/getBloomHomeReadModel";

type HomeActionCases = {
  [ActionId in BloomHomeAction["id"]]: {
    action: Extract<BloomHomeAction, { id: ActionId }>;
    expected: BloomProductFlowIntent;
  };
};

const completedProgress = {
  completedDays: 15,
  currentDay: 15,
  isPeriodComplete: true,
  remainingDays: 0,
  remainingSeconds: 0
} as const;

const activeProgress = {
  completedDays: 6,
  currentDay: 7,
  isPeriodComplete: false,
  remainingDays: 9,
  remainingSeconds: 750_000.5
} as const;

// A new Home action must add a typed test case as well as a mapping branch.
const cases = {
  resumeMasturbationSession: {
    action: {
      id: "resumeMasturbationSession",
      sessionId: "flow-existing-session"
    },
    expected: {
      flow: "masturbationSession",
      mode: "resume",
      sessionId: "flow-existing-session"
    }
  },
  finishMasturbationSessionFeedback: {
    action: {
      id: "finishMasturbationSessionFeedback",
      sessionId: "flow-feedback-session"
    },
    expected: {
      flow: "masturbationSessionFeedback",
      sessionId: "flow-feedback-session"
    }
  },
  resumeUrgeControl: {
    action: {
      id: "resumeUrgeControl",
      eventId: "flow-existing-urge",
      stage: "phoneAwayActive"
    },
    expected: {
      flow: "urgeControl",
      mode: "resume",
      eventId: "flow-existing-urge",
      stage: "phoneAwayActive"
    }
  },
  recordResetElapsedCompletion: {
    action: {
      id: "recordResetElapsedCompletion",
      journeyId: "flow-elapsed-journey",
      attemptId: "flow-elapsed-attempt",
      progress: completedProgress
    },
    expected: {
      flow: "resetCompletion",
      journeyId: "flow-elapsed-journey",
      attemptId: "flow-elapsed-attempt",
      progress: completedProgress
    }
  },
  completeResetAssessment: {
    action: {
      id: "completeResetAssessment",
      journeyId: "flow-assessment-journey",
      attemptId: "flow-assessment-attempt"
    },
    expected: {
      flow: "resetAssessment",
      journeyId: "flow-assessment-journey",
      attemptId: "flow-assessment-attempt"
    }
  },
  completeResetBaseline: {
    action: {
      id: "completeResetBaseline",
      journeyId: "flow-baseline-journey"
    },
    expected: {
      flow: "resetBaseline",
      journeyId: "flow-baseline-journey"
    }
  },
  viewActiveReset: {
    action: {
      id: "viewActiveReset",
      journeyId: "flow-active-journey",
      attemptId: "flow-active-attempt",
      progress: activeProgress
    },
    expected: {
      flow: "resetProgress",
      journeyId: "flow-active-journey",
      attemptId: "flow-active-attempt",
      progress: activeProgress
    }
  },
  reviewStartingRecommendation: {
    action: {
      id: "reviewStartingRecommendation",
      recommendation: "reset_and_content_free"
    },
    expected: {
      flow: "startingRecommendation",
      recommendation: "reset_and_content_free"
    }
  },
  reviewResetRecommendation: {
    action: {
      id: "reviewResetRecommendation",
      journeyId: "flow-recommended-journey"
    },
    expected: {
      flow: "resetRecommendation",
      journeyId: "flow-recommended-journey"
    }
  },
  startMasturbationSession: {
    action: { id: "startMasturbationSession" },
    expected: { flow: "masturbationSession", mode: "start" }
  },
  viewContentFree: {
    action: { id: "viewContentFree" },
    expected: { flow: "contentFree" }
  }
} satisfies HomeActionCases;

export function verifyBloomHomeFlowIntents() {
  for (const testCase of Object.values(cases)) {
    const action = testCase.action;
    if ("progress" in action) Object.freeze(action.progress);
    Object.freeze(action);
    const before = JSON.stringify(action);
    const intent = mapBloomHomeActionToFlowIntent(action);
    assert(
      isDeepStrictEqual(intent, testCase.expected),
      `${action.id} must map to its exact semantic flow and payload.`
    );
    assert(
      isDeepStrictEqual(mapBloomHomeActionToFlowIntent(action), intent),
      `${action.id} must map deterministically without generated facts.`
    );
    assert(
      JSON.stringify(action) === before,
      `${action.id} must support frozen input without changing Home facts.`
    );
    for (const [key, value] of Object.entries(action)) {
      if (key === "id") continue;
      assert(
        (intent as Record<string, unknown>)[key] === value,
        `${action.id} must retain its ${key} value or reference unchanged.`
      );
    }
  }

  verifyMappingDependencies();
  console.log(
    "Bloom Home flow-intent verification passed (all 11 actions, exact payloads, frozen/deterministic mapping, and dependency isolation)."
  );
}

function verifyMappingDependencies() {
  const source = readFileSync(
    resolve("src/app/flows/mapBloomHomeActionToFlowIntent.ts"),
    "utf8"
  );
  const imports = Array.from(source.matchAll(
    /import\s+(type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/g
  ));
  assert(
    imports.length === 1 &&
      imports[0]![1] !== undefined &&
      imports[0]![2] === "../../domain/home/getBloomHomeReadModel",
    "Home mapping must depend only on the Home action type, without runtime selectors, React, routes, or storage."
  );
  assert(
    !/\brequire\s*\(|\bimport\s*\(|router\.(?:push|replace)|navigation\.navigate|AsyncStorage|saveBloomLocalState|persistBloomLocalState/.test(source),
    "The semantic mapping must not load infrastructure, navigate, or persist product facts."
  );
  assert(
    !/Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(|randomUUID\s*\(|getBloomHomeReadModel\s*\(/.test(source),
    "The mapping must not generate facts or reevaluate the Home selector."
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
