import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppDispatch } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import type { DemoMoment, DemoMood } from "../../../domain/demo/demoTypes";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
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
  const dispatch = useDemoAppDispatch();
  const [mood, setMood] = useState<DemoMood>("neutral");
  const [moment, setMoment] = useState<DemoMoment>("evening");
  const [savedSummary, setSavedSummary] = useState<string | undefined>();
  const [showContext, setShowContext] = useState(false);
  const [eventType, setEventType] = useState<LogEventType>("nothing");
  const [reflectionNote, setReflectionNote] = useState("");
  const [reflectionStatus, setReflectionStatus] = useState<string | undefined>();

  const handleSave = () => {
    const createdAt = new Date().toISOString();

    dispatch({
      type: "ADD_CHECK_IN",
      payload: {
        id: `check-in-${createdAt}`,
        createdAt,
        mood,
        moment
      }
    });

    setSavedSummary("Your recent activity now includes this moment.");
  };

  const handleSaveNote = () => {
    setReflectionStatus(
      reflectionNote.trim().length > 0
        ? "Note saved for this session."
        : "Nothing added. You can leave this blank."
    );
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
          onMoodChange={setMood}
          onMomentChange={setMoment}
          onSave={handleSave}
          onAddDetailPress={() => setShowContext(true)}
          isContextVisible={showContext}
          {...(savedSummary !== undefined ? { savedSummary } : {})}
        />

        {showContext ? (
          <OptionalContextCard
            eventType={eventType}
            onEventTypeChange={setEventType}
            onSaveWithContext={handleSave}
          />
        ) : null}

        <PrivateReflectionCard
          note={reflectionNote}
          onNoteChange={setReflectionNote}
          onSaveNote={handleSaveNote}
          {...(reflectionStatus !== undefined ? { savedMessage: reflectionStatus } : {})}
        />

        <RecentMomentsCard />
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
