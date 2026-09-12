import type { BloomProductFlowIntent } from "../flows/mapBloomHomeActionToFlowIntent";

// Reserved new-product paths. These are planned contracts, not registered Expo
// routes: feature screens and their route entries are outside Phase 1R.
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

// Keep deferred resolution distinct from an executable router href. A later
// phase must implement/register the destination before adding navigation.
export type BloomProductRouteDestination = {
  status: "featurePending";
  destination: BloomProductRouteTarget;
};
