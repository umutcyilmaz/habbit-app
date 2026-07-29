import type {
  BloomCheckInRecord,
  BloomMutationResult
} from "../../storage/bloomState";

export type CheckInFeedback =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type CheckInFeedbackPresentation = {
  status: CheckInFeedback["status"];
  heading: "Check-in saved" | "Check-in not saved";
  message: string;
};

export type CheckInSaveOutcome = {
  feedback: CheckInFeedback;
  savedRecord: BloomCheckInRecord | null;
};

export function createCheckInErrorFeedback(
  message: string
): CheckInFeedback {
  return {
    status: "error",
    message
  };
}

export function resolveCheckInMutationFeedback(
  result: BloomMutationResult,
  successMessage: string,
  failureMessage: string
): CheckInFeedback {
  return result.ok
    ? {
        status: "success",
        message: successMessage
      }
    : createCheckInErrorFeedback(failureMessage);
}

export function resolveCheckInSaveOutcome(
  result: BloomMutationResult,
  candidateRecord: BloomCheckInRecord,
  successMessage: string,
  failureMessage: string
): CheckInSaveOutcome {
  const feedback = resolveCheckInMutationFeedback(
    result,
    successMessage,
    failureMessage
  );

  return {
    feedback,
    savedRecord: feedback.status === "success" ? candidateRecord : null
  };
}

export function getCheckInFeedbackPresentation(
  feedback: CheckInFeedback
): CheckInFeedbackPresentation {
  return {
    status: feedback.status,
    heading:
      feedback.status === "success"
        ? "Check-in saved"
        : "Check-in not saved",
    message: feedback.message
  };
}
