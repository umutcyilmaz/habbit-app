import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
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
  createCheckInErrorFeedback,
  resolveCheckInSaveOutcome,
  type CheckInFeedback
} from "../checkInFeedback";
import { LogReassuranceNote } from "../components/LogReassuranceNote";
import {
  OptionalContextCard,
  type LogEventType
} from "../components/OptionalContextCard";
import { PrivateReflectionCard } from "../components/PrivateReflectionCard";
import { QuickCheckInCard } from "../components/QuickCheckInCard";
import { RecentMomentsCard } from "../components/RecentMomentsCard";

export function LogScreen() {
  const router = useRouter();
  const { state, saveCheckInRecord } = useBloomLocalState();
  const [lastSavedRecord, setLastSavedRecord] =
    useState<BloomCheckInRecord | null>(null);
  const [mood, setMood] = useState<BloomCheckInMood>("neutral");
  const [moment, setMoment] = useState<BloomCheckInMoment>("evening");
  const [checkInFeedback, setCheckInFeedback] =
    useState<CheckInFeedback | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [eventType, setEventType] = useState<LogEventType>("nothing");
  const [reflectionNote, setReflectionNote] = useState("");
  const [reflectionStatus, setReflectionStatus] = useState<string | undefined>();

  const createNewCheckIn = (
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
      return false;
    }

    const { record } = submission;
    const result = saveCheckInRecord(record);
    const outcome = resolveCheckInSaveOutcome(
      result,
      record,
      "Your recent activity now includes this moment.",
      "This moment could not be saved yet."
    );
    setCheckInFeedback(outcome.feedback);

    if (outcome.savedRecord === null) {
      return false;
    }

    setLastSavedRecord(outcome.savedRecord);
    return true;
  };

  const updateLastCheckIn = (
    values: Partial<Omit<BloomCheckInRecord, "id" | "createdAt">>,
    successMessage: string
  ) => {
    setCheckInFeedback(null);

    if (lastSavedRecord === null) {
      return null;
    }

    const updatedRecord = updateSavedCheckIn(lastSavedRecord, values);
    const result = saveCheckInRecord(updatedRecord);
    const outcome = resolveCheckInSaveOutcome(
      result,
      updatedRecord,
      successMessage,
      "This moment could not be updated yet."
    );
    setCheckInFeedback(outcome.feedback);

    if (outcome.savedRecord === null) {
      return false;
    }

    setLastSavedRecord(outcome.savedRecord);
    return true;
  };

  const handleSave = () => {
    createNewCheckIn(showContext, reflectionNote);
  };

  const handleSaveContext = () => {
    setCheckInFeedback(null);
    const noteResult = prepareBloomNoteSubmission(reflectionNote);

    if (!noteResult.ok) {
      setCheckInFeedback(
        createCheckInErrorFeedback("That note is too long to save.")
      );
      return;
    }

    const updated = updateLastCheckIn(
      {
        eventType,
        ...(noteResult.note !== null ? { note: noteResult.note } : {})
      },
      "Context saved with your recent moment."
    );

    if (updated === null) {
      createNewCheckIn(true, reflectionNote);
    }
  };

  const handleSaveNote = () => {
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

    const updated = updateLastCheckIn(
      {
        note: noteResult.note,
        ...(showContext ? { eventType } : {})
      },
      "Note saved with this check-in."
    );

    if (updated === null) {
      if (createNewCheckIn(showContext, reflectionNote)) {
        setReflectionStatus("Note saved with this check-in.");
      }
    } else if (updated) {
      setReflectionStatus("Note saved with this check-in.");
    } else {
      setReflectionStatus("This note could not be saved yet.");
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
          {...(checkInFeedback !== null
            ? { feedback: checkInFeedback }
            : {})}
        />

        {showContext ? (
          <OptionalContextCard
            eventType={eventType}
            onEventTypeChange={handleEventTypeChange}
            onSaveWithContext={handleSaveContext}
          />
        ) : null}

        <PrivateReflectionCard
          note={reflectionNote}
          onNoteChange={handleReflectionNoteChange}
          onSaveNote={handleSaveNote}
          {...(reflectionStatus !== undefined ? { savedMessage: reflectionStatus } : {})}
        />

        <RecentMomentsCard records={state.checkIns.records} />
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
