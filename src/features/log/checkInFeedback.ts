import type {
  BloomPersistedMutationResult
} from "../../app/providers/bloomLocalStateMutationRuntime";

export type CheckInFeedback =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "pending";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type CheckInFeedbackPresentation = {
  status: CheckInFeedback["status"];
  heading:
    | "Check-in saved"
    | "Save still pending"
    | "Check-in not saved";
  message: string;
};

export type CheckInPersistenceAction = "checkIn" | "context" | "note";

export type CheckInFeedbackChannels = Readonly<{
  checkInFeedback: CheckInFeedback | null;
  reflectionStatus: string | undefined;
}>;

export function routeCheckInPersistenceFeedback(
  channels: CheckInFeedbackChannels,
  action: CheckInPersistenceAction,
  feedback: CheckInFeedback
): CheckInFeedbackChannels {
  return action === "note"
    ? {
        ...channels,
        reflectionStatus: feedback.message
      }
    : {
        ...channels,
        checkInFeedback: feedback
      };
}

export function clearCheckInPersistenceFeedback(
  channels: CheckInFeedbackChannels,
  action: CheckInPersistenceAction
): CheckInFeedbackChannels {
  return action === "note"
    ? {
        ...channels,
        reflectionStatus: undefined
      }
    : {
        ...channels,
        checkInFeedback: null
      };
}

export function createCheckInErrorFeedback(
  message: string
): CheckInFeedback {
  return {
    status: "error",
    message
  };
}

export function createCheckInPendingFeedback(
  message: string
): CheckInFeedback {
  return {
    status: "pending",
    message
  };
}

export function resolveCheckInPersistenceFeedback(
  result: BloomPersistedMutationResult,
  successMessage: string,
  failureMessage: string,
  subject: "This moment" | "This note"
): CheckInFeedback {
  if (result.ok) {
    return {
      status: "success",
      message: successMessage
    };
  }

  if (result.reason === "persistenceUnknown") {
    return createCheckInPendingFeedback(
      `${subject} is still waiting for local storage confirmation. You can leave safely or try again; Bloom won’t call it saved yet.`
    );
  }

  return createCheckInErrorFeedback(
    result.reason === "persistenceSuperseded"
      ? `${subject} was replaced by a newer change and was not saved by this request.`
      : result.accepted
        ? result.retryable
          ? `${subject} was updated in this session, but Bloom couldn’t save it to local storage. Try again.`
          : `${subject} was updated in this session, but Bloom couldn’t confirm a local save.`
        : failureMessage
  );
}

export function getCheckInFeedbackPresentation(
  feedback: CheckInFeedback
): CheckInFeedbackPresentation {
  return {
    status: feedback.status,
    heading:
      feedback.status === "success"
        ? "Check-in saved"
        : feedback.status === "pending"
          ? "Save still pending"
          : "Check-in not saved",
    message: feedback.message
  };
}
