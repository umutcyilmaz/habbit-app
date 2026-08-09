import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useBloomLocalState,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import {
  prepareBloomNoteSubmission,
  type BloomCheckInMoment,
  type BloomCheckInMood,
  type BloomCheckInRecord
} from "../../../storage/bloomState";
import {
  prepareCheckInSubmission,
  updateSavedCheckIn
} from "../checkInSubmission";
import {
  clearCheckInPersistenceFeedback,
  createCheckInErrorFeedback,
  resolveCheckInPersistenceFeedback,
  routeCheckInPersistenceFeedback,
  type CheckInFeedback,
  type CheckInFeedbackChannels,
  type CheckInPersistenceAction
} from "../checkInFeedback";
import { LogReassuranceNote } from "../components/LogReassuranceNote";
import {
  OptionalContextCard,
  type LogEventType
} from "../components/OptionalContextCard";
import { PrivateReflectionCard } from "../components/PrivateReflectionCard";
import { QuickCheckInCard } from "../components/QuickCheckInCard";
import { RecentMomentsCard } from "../components/RecentMomentsCard";

type CheckInPersistenceOperation = {
  action: CheckInPersistenceAction;
  record: BloomCheckInRecord;
  successMessage: string;
  failureMessage: string;
};

type PendingCheckInRetry = {
  operation: CheckInPersistenceOperation;
  retryToken: BloomPersistenceRetryToken;
};

export function LogScreen() {
  const router = useRouter();
  const { durableState, retryPersistedMutation, saveCheckInRecord } =
    useBloomLocalState();
  const [lastSavedRecord, setLastSavedRecord] =
    useState<BloomCheckInRecord | null>(null);
  const [mood, setMood] = useState<BloomCheckInMood>("neutral");
  const [moment, setMoment] = useState<BloomCheckInMoment>("evening");
  const [feedbackChannels, setFeedbackChannels] =
    useState<CheckInFeedbackChannels>({
      checkInFeedback: null,
      reflectionStatus: undefined
    });
  const { checkInFeedback, reflectionStatus } = feedbackChannels;
  const [showContext, setShowContext] = useState(false);
  const [eventType, setEventType] = useState<LogEventType>("nothing");
  const [reflectionNote, setReflectionNote] = useState("");
  const [savingAction, setSavingAction] =
    useState<CheckInPersistenceAction | null>(null);
  const [pendingRetry, setPendingRetry] =
    useState<PendingCheckInRetry | null>(null);
  const saveInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingRetryRef = useRef<PendingCheckInRetry | null>(null);
  const preparedPrimaryRecordRef = useRef<BloomCheckInRecord | null>(null);

  const isSaveLocked = savingAction !== null || pendingRetry !== null;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setCheckInFeedback = (feedback: CheckInFeedback | null) => {
    setFeedbackChannels((currentChannels) => ({
      ...currentChannels,
      checkInFeedback: feedback
    }));
  };

  const setReflectionStatus = (status: string | undefined) => {
    setFeedbackChannels((currentChannels) => ({
      ...currentChannels,
      reflectionStatus: status
    }));
  };

  const setPersistenceFeedback = (
    operation: CheckInPersistenceOperation,
    feedback: CheckInFeedback
  ) => {
    if (!isMountedRef.current) {
      return;
    }

    setFeedbackChannels((currentChannels) =>
      routeCheckInPersistenceFeedback(
        currentChannels,
        operation.action,
        feedback
      )
    );
  };

  const finishPersistedOperation = (operation: CheckInPersistenceOperation) => {
    if (!isMountedRef.current) {
      return;
    }

    pendingRetryRef.current = null;
    setPendingRetry(null);
    preparedPrimaryRecordRef.current = null;
    setLastSavedRecord(operation.record);
    setPersistenceFeedback(operation, {
      status: "success",
      message: operation.successMessage
    });
  };

  const handlePersistedResult = (
    result: BloomPersistedMutationResult,
    operation: CheckInPersistenceOperation
  ) => {
    if (!isMountedRef.current) {
      return false;
    }

    if (result.ok) {
      finishPersistedOperation(operation);
      return true;
    }

    const subject = operation.action === "note" ? "This note" : "This moment";
    const feedback = resolveCheckInPersistenceFeedback(
      result,
      operation.successMessage,
      operation.failureMessage,
      subject
    );

    setPersistenceFeedback(operation, feedback);

    if (result.accepted && result.retryable) {
      const nextPendingRetry = {
        operation,
        retryToken: result.retryToken
      } satisfies PendingCheckInRetry;
      pendingRetryRef.current = nextPendingRetry;
      setPendingRetry(nextPendingRetry);
    } else {
      pendingRetryRef.current = null;
      setPendingRetry(null);
    }

    return false;
  };

  const persistOperation = async (operation: CheckInPersistenceOperation) => {
    if (saveInFlightRef.current || pendingRetryRef.current !== null) {
      return;
    }

    saveInFlightRef.current = true;
    setSavingAction(operation.action);

    setFeedbackChannels((currentChannels) =>
      clearCheckInPersistenceFeedback(currentChannels, operation.action)
    );

    try {
      const result = await saveCheckInRecord(operation.record);
      handlePersistedResult(result, operation);
    } catch {
      setPersistenceFeedback(
        operation,
        createCheckInErrorFeedback(operation.failureMessage)
      );
    } finally {
      saveInFlightRef.current = false;

      if (isMountedRef.current) {
        setSavingAction(null);
      }
    }
  };

  const retryPendingPersistence = async () => {
    const pending = pendingRetryRef.current;

    if (pending === null || saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setSavingAction(pending.operation.action);

    try {
      const result = await retryPersistedMutation(pending.retryToken);
      handlePersistedResult(result, pending.operation);
    } catch {
      setPersistenceFeedback(
        pending.operation,
        createCheckInErrorFeedback(
          "Bloom still couldn’t save this change to local storage. Try again."
        )
      );
    } finally {
      saveInFlightRef.current = false;

      if (isMountedRef.current) {
        setSavingAction(null);
      }
    }
  };

  const prepareNewCheckIn = (
    includeContext: boolean,
    noteValue = ""
  ) => {
    setCheckInFeedback(null);
    const submission = prepareCheckInSubmission(
      {
        mood,
        moment,
        ...(includeContext ? { eventType } : {}),
        noteValue
      },
      {
        ...(lastSavedRecord !== null
          ? { previousCreatedAt: lastSavedRecord.createdAt }
          : {})
      }
    );

    if (!submission.ok) {
      setCheckInFeedback(submission.feedback);
      return null;
    }

    const preparedRecord = preparedPrimaryRecordRef.current;
    const record =
      preparedRecord === null
        ? submission.record
        : {
            ...submission.record,
            id: preparedRecord.id,
            createdAt: preparedRecord.createdAt
          };
    preparedPrimaryRecordRef.current = record;
    return record;
  };

  const handleSave = () => {
    if (saveInFlightRef.current || pendingRetryRef.current !== null) {
      return;
    }

    const record = prepareNewCheckIn(showContext, reflectionNote);

    if (record !== null) {
      void persistOperation({
        action: "checkIn",
        record,
        successMessage: "Your recent activity now includes this moment.",
        failureMessage: "This moment could not be saved yet."
      });
    }
  };

  const handleSaveContext = () => {
    if (saveInFlightRef.current || pendingRetryRef.current !== null) {
      return;
    }

    setCheckInFeedback(null);
    const noteResult = prepareBloomNoteSubmission(reflectionNote);

    if (!noteResult.ok) {
      setCheckInFeedback(
        createCheckInErrorFeedback("That note is too long to save.")
      );
      return;
    }

    const record =
      lastSavedRecord === null
        ? prepareNewCheckIn(true, reflectionNote)
        : updateSavedCheckIn(lastSavedRecord, {
            eventType,
            ...(noteResult.note !== null ? { note: noteResult.note } : {})
          });

    if (record !== null) {
      void persistOperation({
        action: "context",
        record,
        successMessage: "Context saved with your recent moment.",
        failureMessage: "This moment could not be updated yet."
      });
    }
  };

  const handleSaveNote = () => {
    if (saveInFlightRef.current || pendingRetryRef.current !== null) {
      return;
    }

    setCheckInFeedback(null);
    setReflectionStatus(undefined);
    const noteResult = prepareBloomNoteSubmission(reflectionNote);

    if (!noteResult.ok) {
      setReflectionStatus("That note is too long to save.");
      return;
    }

    if (noteResult.note === null) {
      setReflectionStatus("Nothing added. You can leave this blank.");
      return;
    }

    const record =
      lastSavedRecord === null
        ? prepareNewCheckIn(showContext, reflectionNote)
        : updateSavedCheckIn(lastSavedRecord, {
            note: noteResult.note,
            ...(showContext ? { eventType } : {})
          });

    if (record !== null) {
      void persistOperation({
        action: "note",
        record,
        successMessage: "Note saved with this check-in.",
        failureMessage: "This note could not be saved yet."
      });
    }
  };

  const handleMoodChange = (nextMood: BloomCheckInMood) => {
    setCheckInFeedback(null);
    setMood(nextMood);
  };

  const handleMomentChange = (nextMoment: BloomCheckInMoment) => {
    setCheckInFeedback(null);
    setMoment(nextMoment);
  };

  const handleEventTypeChange = (nextEventType: LogEventType) => {
    setCheckInFeedback(null);
    setEventType(nextEventType);
  };

  const handleReflectionNoteChange = (nextNote: string) => {
    setCheckInFeedback(null);
    setReflectionStatus(undefined);
    setReflectionNote(nextNote);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        title="Log"
        subtitle="A private place to notice what is here."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <QuickCheckInCard
          mood={mood}
          moment={moment}
          onMoodChange={handleMoodChange}
          onMomentChange={handleMomentChange}
          onSave={handleSave}
          onAddDetailPress={() => {
            setCheckInFeedback(null);
            setShowContext(true);
          }}
          isContextVisible={showContext}
          disabled={isSaveLocked}
          saving={savingAction === "checkIn" && pendingRetry === null}
          retrying={
            savingAction !== null &&
            pendingRetry !== null &&
            pendingRetry?.operation.action !== "note"
          }
          {...(pendingRetry !== null && pendingRetry.operation.action !== "note"
            ? { onRetry: () => void retryPendingPersistence() }
            : {})}
          {...(checkInFeedback !== null
            ? { feedback: checkInFeedback }
            : {})}
        />

        {showContext ? (
          <OptionalContextCard
            eventType={eventType}
            onEventTypeChange={handleEventTypeChange}
            onSaveWithContext={handleSaveContext}
            disabled={isSaveLocked}
            saving={savingAction === "context" && pendingRetry === null}
          />
        ) : null}

        <PrivateReflectionCard
          note={reflectionNote}
          onNoteChange={handleReflectionNoteChange}
          onSaveNote={handleSaveNote}
          disabled={isSaveLocked}
          saving={savingAction === "note" && pendingRetry === null}
          retrying={savingAction === "note" && pendingRetry !== null}
          {...(pendingRetry?.operation.action === "note"
            ? { onRetry: () => void retryPendingPersistence() }
            : {})}
          {...(reflectionStatus !== undefined ? { savedMessage: reflectionStatus } : {})}
        />

        <RecentMomentsCard records={durableState.checkIns.records} />
        <LogReassuranceNote />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  }
});
