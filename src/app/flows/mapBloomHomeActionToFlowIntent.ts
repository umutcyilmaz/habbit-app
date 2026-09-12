import type { BloomHomeAction } from "../../domain/home/getBloomHomeReadModel";

type HomeActionPayload<ActionId extends BloomHomeAction["id"]> = Omit<
  Extract<BloomHomeAction, { id: ActionId }>,
  "id"
>;

export type BloomProductFlowIntent =
  | ({ flow: "masturbationSession"; mode: "resume" } &
      HomeActionPayload<"resumeMasturbationSession">)
  | ({ flow: "masturbationSessionFeedback" } &
      HomeActionPayload<"finishMasturbationSessionFeedback">)
  | ({ flow: "urgeControl"; mode: "resume" } &
      HomeActionPayload<"resumeUrgeControl">)
  | ({ flow: "resetCompletion" } &
      HomeActionPayload<"recordResetElapsedCompletion">)
  | ({ flow: "resetAssessment" } &
      HomeActionPayload<"completeResetAssessment">)
  | ({ flow: "resetBaseline" } &
      HomeActionPayload<"completeResetBaseline">)
  | ({ flow: "resetProgress" } & HomeActionPayload<"viewActiveReset">)
  | ({ flow: "startingRecommendation" } &
      HomeActionPayload<"reviewStartingRecommendation">)
  | ({ flow: "resetRecommendation" } &
      HomeActionPayload<"reviewResetRecommendation">)
  | { flow: "masturbationSession"; mode: "start" }
  | { flow: "contentFree" };

// Translate a selected semantic action without reading state, running a
// command, or choosing a route. Future route integration consumes this intent.
export function mapBloomHomeActionToFlowIntent(
  action: BloomHomeAction
): BloomProductFlowIntent {
  switch (action.id) {
    case "resumeMasturbationSession":
      return {
        flow: "masturbationSession",
        mode: "resume",
        sessionId: action.sessionId
      };
    case "finishMasturbationSessionFeedback":
      return {
        flow: "masturbationSessionFeedback",
        sessionId: action.sessionId
      };
    case "resumeUrgeControl":
      return {
        flow: "urgeControl",
        mode: "resume",
        eventId: action.eventId,
        stage: action.stage
      };
    case "recordResetElapsedCompletion":
      return {
        flow: "resetCompletion",
        journeyId: action.journeyId,
        attemptId: action.attemptId,
        progress: action.progress
      };
    case "completeResetAssessment":
      return {
        flow: "resetAssessment",
        journeyId: action.journeyId,
        attemptId: action.attemptId
      };
    case "completeResetBaseline":
      return { flow: "resetBaseline", journeyId: action.journeyId };
    case "viewActiveReset":
      return {
        flow: "resetProgress",
        journeyId: action.journeyId,
        attemptId: action.attemptId,
        progress: action.progress
      };
    case "reviewStartingRecommendation":
      return {
        flow: "startingRecommendation",
        recommendation: action.recommendation
      };
    case "reviewResetRecommendation":
      return { flow: "resetRecommendation", journeyId: action.journeyId };
    case "startMasturbationSession":
      return { flow: "masturbationSession", mode: "start" };
    case "viewContentFree":
      return { flow: "contentFree" };
    default:
      return assertNever(action);
  }
}

function assertNever(_action: never): never {
  throw new Error("Unsupported Bloom Home action.");
}
