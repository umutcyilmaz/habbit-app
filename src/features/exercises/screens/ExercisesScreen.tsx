import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { ExerciseCategorySection } from "../components/ExerciseCategorySection";
import { RecommendedExerciseCard } from "../components/RecommendedExerciseCard";
import { exerciseCategories, recommendedExercise } from "../data/exercisesMockData";
import type { ExerciseItem } from "../types";

export function ExercisesScreen() {
  const router = useRouter();

  const startExercise = (item: ExerciseItem) => {
    if (!item.route) {
      return;
    }

    router.push(item.route);
  };

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader
          title="Exercises"
          subtitle="Small tools for pauses, reflection, and calmer routines."
          onSettingsPress={() => router.push(routes.settings)}
        />

        <RecommendedExerciseCard
          recommendation={recommendedExercise}
          onStart={() => router.push(recommendedExercise.exercise.route ?? routes.pause)}
        />

        {exerciseCategories.map((category) => (
          <ExerciseCategorySection
            key={category.id}
            category={category}
            onStartExercise={startExercise}
          />
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  }
});
