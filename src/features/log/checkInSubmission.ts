import {
  createBloomRecordId,
  prepareBloomNoteSubmission,
  type BloomCheckInEventType,
  type BloomCheckInMoment,
  type BloomCheckInMood,
  type BloomCheckInRecord
} from "../../storage/bloomState";
import {
  createCheckInErrorFeedback,
  type CheckInFeedback
} from "./checkInFeedback";

export type CheckInSubmissionValues = {
  mood: BloomCheckInMood;
  moment: BloomCheckInMoment;
  eventType?: BloomCheckInEventType;
  note?: string;
};

type CheckInSubmissionOptions = {
  now?: Date;
  randomValue?: number;
  previousCreatedAt?: string;
};

export type PreparedCheckInSubmission =
  | {
      ok: true;
      record: BloomCheckInRecord;
    }
  | {
      ok: false;
      feedback: CheckInFeedback;
    };

export function prepareCheckInSubmission(
  values: Omit<CheckInSubmissionValues, "note"> & {
    noteValue?: string;
  },
  options: CheckInSubmissionOptions = {}
): PreparedCheckInSubmission {
  const noteResult = prepareBloomNoteSubmission(values.noteValue ?? "");

  if (!noteResult.ok) {
    return {
      ok: false,
      feedback: createCheckInErrorFeedback(
        "That note is too long to save."
      )
    };
  }

  return {
    ok: true,
    record: createCheckInSubmission(
      {
        mood: values.mood,
        moment: values.moment,
        ...(values.eventType !== undefined
          ? { eventType: values.eventType }
          : {}),
        ...(noteResult.note !== null ? { note: noteResult.note } : {})
      },
      options
    )
  };
}

export function createCheckInSubmission(
  values: CheckInSubmissionValues,
  options: CheckInSubmissionOptions = {}
): BloomCheckInRecord {
  const createdAt = getNextCreatedAt(
    options.now ?? new Date(),
    options.previousCreatedAt
  );

  return {
    id: createBloomRecordId(
      "check-in",
      createdAt,
      options.randomValue ?? Math.random()
    ),
    createdAt: createdAt.toISOString(),
    ...values
  };
}

export function updateSavedCheckIn(
  savedRecord: BloomCheckInRecord,
  values: Partial<Omit<BloomCheckInRecord, "id" | "createdAt">>
): BloomCheckInRecord {
  return {
    ...savedRecord,
    ...values,
    id: savedRecord.id,
    createdAt: savedRecord.createdAt
  };
}

function getNextCreatedAt(now: Date, previousCreatedAt?: string) {
  if (previousCreatedAt === undefined) {
    return now;
  }

  const previousTimestamp = Date.parse(previousCreatedAt);

  if (!Number.isFinite(previousTimestamp) || now.getTime() > previousTimestamp) {
    return now;
  }

  return new Date(previousTimestamp + 1);
}
