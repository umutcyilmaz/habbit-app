import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ProtectionLevel, ProtectionSchedule } from "../types";
import { ProtectionLevelSelector } from "./ProtectionLevelSelector";

type ProtectionScheduleCardProps = {
  schedule: ProtectionSchedule;
  level: ProtectionLevel;
  onLevelChange: (level: ProtectionLevel) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ProtectionScheduleCard({
  schedule,
  level,
  onLevelChange,
  onSave,
  onCancel
}: ProtectionScheduleCardProps) {
  return (
    <AppCard>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">Choose your support window</AppText>
          <ScheduleRow label="Start time" value={schedule.startTime} />
          <ScheduleRow label="End time" value={schedule.endTime} />
          <ScheduleRow label="Repeat" value={schedule.repeatLabel} />
        </View>

        <ProtectionLevelSelector value={level} onChange={onLevelChange} />

        <View style={styles.actions}>
          <AppButton onPress={onSave}>Save Support Window</AppButton>
          <AppButton variant="secondary" onPress={onCancel}>
            Cancel
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

function ScheduleRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.xl
  },
  copy: {
    gap: theme.spacing.md
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  }
});
