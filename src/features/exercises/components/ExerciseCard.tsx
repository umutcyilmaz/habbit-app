import { Pressable, StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ExerciseItem } from "../types";
import { ExerciseDurationBadge } from "./ExerciseDurationBadge";
import { ExerciseStatusBadge } from "./ExerciseStatusBadge";

type ExerciseCardProps = {
  item: ExerciseItem;
  onStart: (item: ExerciseItem) => void;
};

export function ExerciseCard({ item, onStart }: ExerciseCardProps) {
  const isAvailable = item.status === "available";

  return (
    <Pressable
      accessibilityLabel={item.title}
      accessibilityRole={isAvailable ? "button" : undefined}
      disabled={!isAvailable}
      onPress={() => onStart(item)}
      style={({ pressed }) => [pressed && isAvailable ? styles.pressed : undefined]}
    >
      <AppCard style={[styles.card, !isAvailable ? styles.disabledCard : undefined]}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <ExerciseDurationBadge duration={item.duration} />
            <ExerciseStatusBadge status={item.status} />
          </View>

          <View style={styles.copy}>
            <AppText variant="title">{item.title}</AppText>
            <AppText tone="secondary">{item.description}</AppText>
          </View>

          <AppButton disabled={!isAvailable} onPress={() => onStart(item)}>
            {item.actionLabel}
          </AppButton>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 184
  },
  disabledCard: {
    opacity: 0.78
  },
  content: {
    gap: theme.spacing.lg
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "space-between"
  },
  copy: {
    gap: theme.spacing.sm
  },
  pressed: {
    opacity: 0.9
  }
});
