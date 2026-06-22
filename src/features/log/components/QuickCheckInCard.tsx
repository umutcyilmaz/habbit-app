import { StyleSheet, View } from "react-native";

import type { DemoMoment, DemoMood } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { SelectableChipGroup, type SelectableChipOption } from "./SelectableChipGroup";

const moodOptions: readonly SelectableChipOption<DemoMood>[] = [
  { value: "neutral", label: "Neutral" },
  { value: "bored", label: "Bored" },
  { value: "restless", label: "Restless" },
  { value: "stressed", label: "Stressed" },
  { value: "calm", label: "Calm" }
];

const momentOptions: readonly SelectableChipOption<DemoMoment>[] = [
  { value: "evening", label: "Evening" },
  { value: "boredom", label: "Boredom" },
  { value: "alone", label: "Alone" },
  { value: "stress", label: "Stress" },
  { value: "scrolling", label: "Scrolling" }
];

type QuickCheckInCardProps = {
  mood: DemoMood;
  moment: DemoMoment;
  onMoodChange: (mood: DemoMood) => void;
  onMomentChange: (moment: DemoMoment) => void;
  onSave: () => void;
  onAddDetailPress: () => void;
  isContextVisible: boolean;
  savedSummary?: string;
};

export function QuickCheckInCard({
  mood,
  moment,
  onMoodChange,
  onMomentChange,
  onSave,
  onAddDetailPress,
  isContextVisible,
  savedSummary
}: QuickCheckInCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.badge}>
          <AppText variant="caption">Quick check-in</AppText>
        </View>

        <View style={styles.copy}>
          <AppText variant="title">What is present right now?</AppText>
          <AppText tone="secondary">Choose the closest fit. You can keep it simple.</AppText>
        </View>

        <View style={styles.groups}>
          <SelectableChipGroup
            title="Mood"
            options={moodOptions}
            value={mood}
            onChange={onMoodChange}
          />
          <SelectableChipGroup
            title="Moment"
            options={momentOptions}
            value={moment}
            onChange={onMomentChange}
          />
        </View>

        {savedSummary ? (
          <View style={styles.savedNote}>
            <AppText variant="label">Check-in saved</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {savedSummary}
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton onPress={onSave}>Save Check-In</AppButton>
          {isContextVisible ? (
            <AppText variant="bodySmall" tone="secondary" align="center">
              Optional context is below.
            </AppText>
          ) : (
            <AppButton variant="ghost" onPress={onAddDetailPress}>
              Add more detail
            </AppButton>
          )}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.lg
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  copy: {
    gap: theme.spacing.sm
  },
  groups: {
    gap: theme.spacing.lg
  },
  savedNote: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.sm
  }
});
