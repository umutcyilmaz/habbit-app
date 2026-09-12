import type { MasturbationSessionFeedback } from "../../domain/models/MasturbationSession";
import type { PostResetAssessment } from "../../domain/models/PostResetAssessment";
import type { ResetBaseline } from "../../domain/models/ResetBaseline";
import type { ISODateString, UUID } from "../../domain/models/shared";
import type { BloomProductAcknowledgedActions } from "../providers/bloomProductAcknowledgedActions";

export type BloomProductFlowIdPrefix =
  | "reset-journey"
  | "reset-baseline"
  | "reset-attempt"
  | "reset-violation"
  | "reset-assessment"
  | "content-free-activation"
  | "content-free-violation"
  | "masturbation-session"
  | "urge-control-event"
  | "log-action";

export type BloomResetBaselineValues = Omit<ResetBaseline, "id" | "capturedAt">;
export type BloomResetAssessmentValues = Omit<PostResetAssessment, "id" | "completedAt">;
export type BloomResetViolationValues = {
  reason: Parameters<BloomProductAcknowledgedActions["reset"]["recordViolation"]>[0]["reason"];
  source: { kind: "manual" } | { kind: "masturbationSession"; sessionId: UUID };
  // An explicitly supplied occurrence is an event fact, not the recording time.
  occurredAt?: ISODateString;
};

type BloomProductFlowActionOptions = {
  productActions: BloomProductAcknowledgedActions;
  now?: () => Date;
  createId?: (prefix: BloomProductFlowIdPrefix, operationTime: Date) => UUID;
};

export function createBloomProductFlowActions({
  productActions,
  now = () => new Date(),
  createId = createProductFlowId
}: BloomProductFlowActionOptions) {
  const captureOperation = () => {
    const operationTime = now();
    return { operationTime, timestamp: operationTime.toISOString() };
  };

  // Prepare facts before dispatch. Commands still own validation, state access,
  // acknowledgements, and persistence retries; this factory holds no state.
  return {
    onboarding: {
      saveProductOnboardingResult: productActions.onboarding.saveProductOnboardingResult,
      acceptRecommendation: () => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.onboarding.acceptRecommendation({
          acceptedAt: timestamp,
          resetJourneyId: createId("reset-journey", operationTime),
          contentFreeActivationId: createId("content-free-activation", operationTime)
        });
      }
    },
    reset: {
      startFromBaseline: (baseline: BloomResetBaselineValues) => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.reset.startFromBaseline({
          resetBaseline: {
            ...baseline,
            id: createId("reset-baseline", operationTime),
            capturedAt: timestamp
          },
          resetAttemptId: createId("reset-attempt", operationTime),
          startedAt: timestamp
        });
      },
      recordViolation: (input: BloomResetViolationValues) => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.reset.recordViolation({
          ...input,
          violationId: createId("reset-violation", operationTime),
          replacementAttemptId: createId("reset-attempt", operationTime),
          contentFreeViolationId: createId("content-free-violation", operationTime),
          source: input?.source?.kind === "manual"
            ? { ...input.source, logActionId: createId("log-action", operationTime) }
            : input?.source,
          occurredAt: input?.occurredAt === undefined ? timestamp : input.occurredAt,
          recordedAt: timestamp
        });
      },
      undoViolation: (input: { violationId: UUID }) => {
        const { timestamp } = captureOperation();
        return productActions.reset.undoViolation({ ...input, undoneAt: timestamp });
      },
      completeElapsed: () => {
        const { timestamp } = captureOperation();
        return productActions.reset.completeElapsed({ observedAt: timestamp });
      },
      completeAssessment: (assessment: BloomResetAssessmentValues) => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.reset.completeAssessment({
          ...assessment,
          id: createId("reset-assessment", operationTime),
          completedAt: timestamp
        });
      }
    },
    tracking: {
      enable: productActions.tracking.enable,
      disable: productActions.tracking.disable,
      session: {
        start: () => {
          const { operationTime, timestamp } = captureOperation();
          return productActions.tracking.session.start({
            sessionId: createId("masturbation-session", operationTime),
            startedAt: timestamp
          });
        },
        startPause: () => {
          const { timestamp } = captureOperation();
          return productActions.tracking.session.startPause({ startedAt: timestamp });
        },
        endPause: () => {
          const { timestamp } = captureOperation();
          return productActions.tracking.session.endPause({ endedAt: timestamp });
        },
        end: () => {
          const { timestamp } = captureOperation();
          return productActions.tracking.session.end({ endedAt: timestamp });
        },
        completeFeedback: (feedback: MasturbationSessionFeedback) => {
          const { operationTime, timestamp } = captureOperation();
          return productActions.tracking.session.completeFeedback({
            feedback,
            recordedAt: timestamp,
            contentFreeViolationId: createId("content-free-violation", operationTime)
          });
        },
        discardActive: productActions.tracking.session.discardActive
      },
      corrections: {
        editFeedback: (input: { sessionId: UUID; feedback: MasturbationSessionFeedback }) => {
          const { operationTime, timestamp } = captureOperation();
          return productActions.tracking.corrections.editFeedback({
            ...input,
            editedAt: timestamp,
            contentFreeViolationId: createId("content-free-violation", operationTime)
          });
        },
        deleteSession: (input: { sessionId: UUID }) => {
          const { timestamp } = captureOperation();
          return productActions.tracking.corrections.deleteSession({ ...input, deletedAt: timestamp });
        }
      }
    },
    contentFree: {
      activate: () => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.contentFree.activate({
          activationId: createId("content-free-activation", operationTime),
          activatedAt: timestamp
        });
      },
      deactivate: () => {
        const { timestamp } = captureOperation();
        return productActions.contentFree.deactivate({ endedAt: timestamp });
      },
      recordManualViolation: (occurredAt?: ISODateString) => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.contentFree.recordManualViolation({
          violationId: createId("content-free-violation", operationTime),
          logActionId: createId("log-action", operationTime),
          occurredAt: occurredAt === undefined ? timestamp : occurredAt,
          recordedAt: timestamp
        });
      },
      undoManualViolation: (input: { violationId: UUID }) => {
        const { timestamp } = captureOperation();
        return productActions.contentFree.undoManualViolation({ ...input, undoneAt: timestamp });
      }
    },
    urgeControl: {
      start: () => {
        const { operationTime, timestamp } = captureOperation();
        return productActions.urgeControl.start({
          eventId: createId("urge-control-event", operationTime),
          startedAt: timestamp
        });
      },
      completeInterrupt: () => {
        const { timestamp } = captureOperation();
        return productActions.urgeControl.completeInterrupt({ completedAt: timestamp });
      },
      selectTechnique: productActions.urgeControl.selectTechnique,
      startPhoneAway: () => {
        const { timestamp } = captureOperation();
        return productActions.urgeControl.startPhoneAway({ startedAt: timestamp });
      },
      endPhoneAway: () => {
        const { timestamp } = captureOperation();
        return productActions.urgeControl.endPhoneAway({ endedAt: timestamp });
      },
      recordOutcome: productActions.urgeControl.recordOutcome,
      recordTrigger: productActions.urgeControl.recordTrigger,
      selectSecondLineAction: productActions.urgeControl.selectSecondLineAction,
      complete: () => {
        const { timestamp } = captureOperation();
        return productActions.urgeControl.complete({ completedAt: timestamp });
      },
      discardActive: productActions.urgeControl.discardActive
    }
  };
}

export type BloomProductFlowActions = ReturnType<typeof createBloomProductFlowActions>;

// Follow createBloomRecordId's prefix/timestamp/base36 nonce convention. Its
// legacy-only prefix type and callers remain unchanged.
function createProductFlowId(prefix: BloomProductFlowIdPrefix, operationTime: Date): UUID {
  const timestamp = operationTime.toISOString().replace(/[^0-9A-Za-z]/g, "");
  const nonce = Math.floor(Math.random() * 0x100000000).toString(36).padStart(7, "0");
  return `${prefix}-${timestamp}-${nonce}`;
}
