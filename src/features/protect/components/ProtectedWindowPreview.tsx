import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { previewActions } from "../data/protectMockData";
import type { ProtectedWindowAction, ProtectionSchedule } from "../types";

type ProtectedWindowPreviewProps = {
  schedule: ProtectionSchedule;
  choiceMessage?: string;
  onAction: (action: ProtectedWindowAction) => void;
};

export function ProtectedWindowPreview({
  schedule,
  choiceMessage,
  onAction
}: ProtectedWindowPreviewProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">You are in a support window</AppText>
          <AppText tone="secondary">
            Before continuing, take a short moment to notice what is happening.
          </AppText>
          <View style={styles.contextChip}>
            <AppText variant="caption" tone="secondary">
              {schedule.startTime}-{schedule.endTime} - Evening support
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          {previewActions.map((action) => (
            <AppButton
              key={action.id}
              variant={action.id === "startPause" ? "primary" : "secondary"}
              onPress={() => onAction(action.id)}
            >
              {action.label}
            </AppButton>
          ))}
        </View>

        {choiceMessage ? (
          <AppText variant="bodySmall" tone="secondary">
            {choiceMessage}
          </AppText>
        ) : null}

        <AppText variant="bodySmall" tone="secondary">
          You are always in control.
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  },
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  contextChip: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  actions: {
    gap: theme.spacing.md
  }
});
