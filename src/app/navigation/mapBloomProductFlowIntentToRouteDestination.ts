import type { BloomProductFlowIntent } from "../flows/mapBloomHomeActionToFlowIntent";
import {
  bloomProductRoutePaths,
  type BloomProductRouteDestination,
  type BloomProductRouteTarget
} from "./bloomProductRoutes";

export function mapBloomProductFlowIntentToRouteDestination(
  intent: BloomProductFlowIntent
): BloomProductRouteDestination {
  return { status: "featurePending", destination: mapRouteTarget(intent) };
}

function mapRouteTarget(intent: BloomProductFlowIntent): BloomProductRouteTarget {
  switch (intent.flow) {
    case "masturbationSession":
      switch (intent.mode) {
        case "start":
          return { pathname: bloomProductRoutePaths.masturbationSessionStart };
        case "resume":
          return {
            pathname: bloomProductRoutePaths.masturbationSessionResume,
            params: { sessionId: intent.sessionId }
          };
        default:
          return assertNever(intent);
      }
    case "masturbationSessionFeedback":
      return {
        pathname: bloomProductRoutePaths.masturbationSessionFeedback,
        params: { sessionId: intent.sessionId }
      };
    case "urgeControl": {
      const mode = intent.mode;
      switch (mode) {
        case "resume":
          return {
            pathname: bloomProductRoutePaths.urgeControlResume,
            params: { eventId: intent.eventId, stage: intent.stage }
          };
        default:
          return assertNever(mode);
      }
    }
    case "resetCompletion":
      return {
        pathname: bloomProductRoutePaths.resetCompletion,
        params: { journeyId: intent.journeyId, attemptId: intent.attemptId }
      };
    case "resetAssessment":
      return {
        pathname: bloomProductRoutePaths.resetAssessment,
        params: { journeyId: intent.journeyId, attemptId: intent.attemptId }
      };
    case "resetBaseline":
      return {
        pathname: bloomProductRoutePaths.resetBaseline,
        params: { journeyId: intent.journeyId }
      };
    case "resetProgress":
      return {
        pathname: bloomProductRoutePaths.resetProgress,
        params: { journeyId: intent.journeyId, attemptId: intent.attemptId }
      };
    case "startingRecommendation":
      return {
        pathname: bloomProductRoutePaths.startingRecommendation,
        params: { recommendation: intent.recommendation }
      };
    case "resetRecommendation":
      return {
        pathname: bloomProductRoutePaths.resetRecommendation,
        params: { journeyId: intent.journeyId }
      };
    case "contentFree":
      return { pathname: bloomProductRoutePaths.contentFree };
    default:
      return assertNever(intent);
  }
}

function assertNever(_intent: never): never {
  throw new Error("Unsupported Bloom product flow intent.");
}
