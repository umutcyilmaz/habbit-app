import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ExerciseCategory, ExerciseItem } from "../types";
import { ExerciseCard } from "./ExerciseCard";

type ExerciseCategorySectionProps = {
  category: ExerciseCategory;
  onStartExercise: (item: ExerciseItem) => void;
};

export function ExerciseCategorySection({
  category,
  onStartExercise
}: ExerciseCategorySectionProps) {
  return (
    <View style={styles.section}>
      <AppText variant="title">{category.title}</AppText>
      <View style={styles.cards}>
        {category.items.map((item) => (
          <ExerciseCard key={item.id} item={item} onStart={onStartExercise} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.md
  },
  cards: {
    gap: theme.spacing.md
  }
});
