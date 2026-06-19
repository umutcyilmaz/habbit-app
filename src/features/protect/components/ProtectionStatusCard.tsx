import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ProtectionLevel, ProtectionSchedule } from "../types";

type ProtectionStatusCardProps = {
  schedule: ProtectionSchedule;
  level: ProtectionLevel;
  onPreview: () => void;
  onChangeLevel: () => void;
  onPauseTonight: () => void;
  onTurnOff: () => void;
};

export function ProtectionStatusCard({
  schedule,
  level,
  onPreview,
  onChangeLevel,
  onPauseTonight,
  onTurnOff
}: ProtectionStatusCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">Evening support is on</AppText>
          <AppText variant="label">
            {schedule.startTime}-{schedule.endTime} - {schedule.repeatLabel}
          </AppText>
          <AppText tone="secondary">Level: {formatLevel(level)}</AppText>
          <AppText tone="secondary">
            During this window, the app can suggest a short pause before automatic habits continue.
          </AppText>
        </View>

        <View style={styles.actions}>
          <AppButton onPress={onPreview}>Preview Pause</AppButton>
          <AppButton variant="secondary" onPress={onChangeLevel}>
            Change Level
          </AppButton>
          <AppButton variant="secondary" onPress={onPauseTonight}>
            Pause for Tonight
          </AppButton>
          <AppButton variant="ghost" onPress={onTurnOff}>
            Turn Off
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

function formatLevel(level: ProtectionLevel) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  }
});
