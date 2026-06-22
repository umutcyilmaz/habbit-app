import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { ExerciseReminderNote } from "../components/ExerciseReminderNote";
import { FeaturedPracticeCard } from "../components/FeaturedPracticeCard";
import { GuidedToolsCard, type GuidedTool } from "../components/GuidedToolsCard";
import { QuickPracticeGrid, type QuickPractice } from "../components/QuickPracticeGrid";

export function ExercisesScreen() {
  const router = useRouter();
  const [practiceMessage, setPracticeMessage] = useState<string | undefined>();

  const quickPractices: readonly QuickPractice[] = [
    {
      title: "90-Second Pause",
      description: "A short reset before continuing.",
      icon: "Ⅱ",
      accent: "sage",
      onPress: () => router.push(routes.pause)
    },
    {
      title: "Quick Check-In",
      description: "Notice what is present right now.",
      icon: "✓",
      accent: "lavender",
      onPress: () => router.push(routes.log)
    },
    {
      title: "Breathing Reset",
      description: "Slow down your body response.",
      icon: "◌",
      accent: "peach",
      onPress: () =>
        setPracticeMessage("Try three slow breaths, then choose what feels supportive next.")
    },
    {
      title: "Evening Reset",
      description: "Prepare for a sensitive window.",
      icon: "☾",
      accent: "lavender",
      onPress: () => router.push(routes.protectNightSetup)
    }
  ];

  const guidedTools: readonly GuidedTool[] = [
    {
      title: "Put phone away",
      description: "Create a little distance from the screen.",
      icon: "↘",
      accent: "sage",
      onPress: () =>
        setPracticeMessage("A little distance can make the next choice feel less automatic.")
    },
    {
      title: "Leave the room",
      description: "Change the setting for a few minutes.",
      icon: "↗",
      accent: "lavender",
      onPress: () => setPracticeMessage("A change of place can create a useful pause.")
    },
    {
      title: "Add private note",
      description: "Write a few words for yourself.",
      icon: "✎",
      accent: "peach",
      onPress: () => router.push(routes.log)
    },
    {
      title: "Set up protection",
      description: "Add support during selected hours.",
      icon: "☾",
      accent: "navy",
      onPress: () => router.push(routes.protectSetup)
    }
  ];

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        title="Exercises"
        subtitle="Small practices for sensitive moments."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <FeaturedPracticeCard
          {...(practiceMessage !== undefined ? { message: practiceMessage } : {})}
          onStartPress={() =>
            setPracticeMessage(
              "Start by noticing your arousal level, then choose one small pause below."
            )
          }
          onLearnPress={() =>
            setPracticeMessage(
              "This practice is about noticing pressure and rushing earlier, then continuing gently or finishing today."
            )
          }
        />
        <QuickPracticeGrid practices={quickPractices} />
        <GuidedToolsCard tools={guidedTools} />
        <ExerciseReminderNote />
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
