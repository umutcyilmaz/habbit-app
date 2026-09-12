import type { BloomProductFlowIntent } from "../flows/mapBloomHomeActionToFlowIntent";

// Session start/resume/feedback have registered route entries. All other
// new-product paths remain reserved contracts until their features exist.
export const bloomProductRoutePaths = {
  masturbationSessionStart: "/bloom/masturbation-session/start",
  masturbationSessionResume: "/bloom/masturbation-session/resume",
  masturbationSessionFeedback: "/bloom/masturbation-session/feedback",
  urgeControlResume: "/bloom/urge-control/resume",
  resetCompletion: "/bloom/reset/completion",
  resetAssessment: "/bloom/reset/assessment",
  resetBaseline: "/bloom/reset/baseline",
  resetProgress: "/bloom/reset/progress",
  startingRecommendation: "/bloom/starting-recommendation",
  resetRecommendation: "/bloom/reset/recommendation",
  contentFree: "/bloom/content-free"
} as const;

type FlowIntent<Flow extends BloomProductFlowIntent["flow"]> = Extract<
  BloomProductFlowIntent,
  { flow: Flow }
>;

// URL params contain identity and small resume/review hints only. The pathname
// distinguishes session start/resume. Reset progress is derived at the screen
// boundary from canonical state, never carried as a navigation snapshot.
export type BloomProductRouteTarget =
  | {
      pathname: typeof bloomProductRoutePaths.masturbationSessionStart;
      params?: never;
    }
  | {
      pathname: typeof bloomProductRoutePaths.masturbationSessionResume;
      params: Pick<Extract<FlowIntent<"masturbationSession">, { mode: "resume" }>, "sessionId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.masturbationSessionFeedback;
      params: Pick<FlowIntent<"masturbationSessionFeedback">, "sessionId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.urgeControlResume;
      params: Pick<FlowIntent<"urgeControl">, "eventId" | "stage">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.resetCompletion;
      params: Pick<FlowIntent<"resetCompletion">, "journeyId" | "attemptId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.resetAssessment;
      params: Pick<FlowIntent<"resetAssessment">, "journeyId" | "attemptId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.resetBaseline;
      params: Pick<FlowIntent<"resetBaseline">, "journeyId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.resetProgress;
      params: Pick<FlowIntent<"resetProgress">, "journeyId" | "attemptId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.startingRecommendation;
      params: Pick<FlowIntent<"startingRecommendation">, "recommendation">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.resetRecommendation;
      params: Pick<FlowIntent<"resetRecommendation">, "journeyId">;
    }
  | {
      pathname: typeof bloomProductRoutePaths.contentFree;
      params?: never;
    };

export type BloomProductReadyRouteTarget = Extract<
  BloomProductRouteTarget,
  {
    pathname:
      | typeof bloomProductRoutePaths.masturbationSessionStart
      | typeof bloomProductRoutePaths.masturbationSessionResume
      | typeof bloomProductRoutePaths.masturbationSessionFeedback;
  }
>;

// Readiness is correlated with the target: deferred feature paths cannot be
// represented as ready destinations, even when constructed outside the mapper.
export type BloomProductRouteDestination =
  | { status: "ready"; destination: BloomProductReadyRouteTarget }
  | {
      status: "featurePending";
      destination: Exclude<BloomProductRouteTarget, BloomProductReadyRouteTarget>;
    };
