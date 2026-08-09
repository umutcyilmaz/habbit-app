import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type {
  BloomCheckInMoment,
  BloomCheckInMood
} from "../../../storage/bloomState";
import {
  getCheckInFeedbackPresentation,
  type CheckInFeedback
} from "../checkInFeedback";
import { SelectableChipGroup, type SelectableChipOption } from "./SelectableChipGroup";

const moodOptions: readonly SelectableChipOption<BloomCheckInMood>[] = [
  { value: "neutral", label: "Neutral" },
  { value: "bored", label: "Bored" },
  { value: "restless", label: "Restless" },
  { value: "stressed", label: "Stressed" },
  { value: "calm", label: "Calm" }
];

const momentOptions: readonly SelectableChipOption<BloomCheckInMoment>[] = [
  { value: "evening", label: "Evening" },
  { value: "boredom", label: "Boredom" },
  { value: "alone", label: "Alone" },
  { value: "stress", label: "Stress" },
  { value: "scrolling", label: "Scrolling" }
];

type QuickCheckInCardProps = {
  mood: BloomCheckInMood;
  moment: BloomCheckInMoment;
  onMoodChange: (mood: BloomCheckInMood) => void;
  onMomentChange: (moment: BloomCheckInMoment) => void;
  onSave: () => void;
  onAddDetailPress: () => void;
  isContextVisible: boolean;
  disabled?: boolean;
  saving?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  feedback?: CheckInFeedback;
};

export function QuickCheckInCard({
  mood,
  moment,
  onMoodChange,
  onMomentChange,
  onSave,
  onAddDetailPress,
  isContextVisible,
  disabled = false,
  saving = false,
  retrying = false,
  onRetry,
  feedback
}: QuickCheckInCardProps) {
  const feedbackPresentation =
    feedback !== undefined
      ? getCheckInFeedbackPresentation(feedback)
      : null;

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
            disabled={disabled}
          />
          <SelectableChipGroup
            title="Moment"
            options={momentOptions}
            value={moment}
            onChange={onMomentChange}
            disabled={disabled}
          />
        </View>

        {feedbackPresentation !== null ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.feedbackNote,
              feedbackPresentation.status === "success"
                ? styles.successFeedback
                : feedbackPresentation.status === "pending"
                  ? styles.pendingFeedback
                  : styles.errorFeedback
            ]}
          >
            <AppText variant="label">
              {feedbackPresentation.heading}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {feedbackPresentation.message}
            </AppText>
            {feedbackPresentation.status !== "success" &&
            onRetry !== undefined ? (
              <AppButton
                testID="bloom.log.persistence.retry"
                variant="subtle"
                loading={retrying}
                disabled={retrying}
                accessibilityState={{ busy: retrying, disabled: retrying }}
                onPress={onRetry}
              >
                Try saving again
              </AppButton>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton
            testID="bloom.log.check-in.save"
            loading={saving}
            disabled={disabled}
            accessibilityState={{ busy: saving, disabled }}
            onPress={onSave}
          >
            Save Check-In
          </AppButton>
          {isContextVisible ? (
            <AppText variant="bodySmall" tone="secondary" align="center">
              Optional context is below.
            </AppText>
          ) : (
            <AppButton
              variant="ghost"
              disabled={disabled}
              accessibilityState={{ disabled }}
              onPress={onAddDetailPress}
            >
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
  feedbackNote: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: theme.spacing.md
  },
  successFeedback: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  pendingFeedback: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted
  },
  errorFeedback: {
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.peachMuted
  },
  actions: {
    gap: theme.spacing.sm
  }
});
