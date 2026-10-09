import { getResetContentFreeContinuationOffer } from "../../domain/contentFree/getResetContentFreeCredit";
import type { BloomHomeState } from "../../domain/home/getBloomHomeReadModel";
import { getResetProgress } from "../../domain/reset/getResetProgress";
import type { BloomProductFlowIntent } from "./mapBloomHomeActionToFlowIntent";

// Reads supplied durable truth; route entry never activates either tracker.
export function getBloomContentFreeEntryIntent(state: BloomHomeState, at: string): BloomProductFlowIntent {
  const offer = getResetContentFreeContinuationOffer(state, state);
  const progress = offer === null ? null : getResetProgress(state.resetJourney, at);
  return offer !== null && progress !== null ? {
    flow: "resetCompletion", journeyId: offer.journeyId, attemptId: offer.attemptId, progress
  } : { flow: "contentFree" };
}
