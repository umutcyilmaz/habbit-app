import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { logEntryOptions } from "../data/logMockData";
import type { LogEntryOption } from "../types";
import { LogOptionCard } from "./LogOptionCard";

type LogEntrySelectorProps = {
  comingNextOption?: LogEntryOption | undefined;
  onSelect: (option: LogEntryOption) => void;
  onStartCheckIn: () => void;
};

export function LogEntrySelector({
  comingNextOption,
  onSelect,
  onStartCheckIn
}: LogEntrySelectorProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.options}>
        {logEntryOptions.map((option) => (
          <LogOptionCard key={option.id} option={option} onPress={onSelect} />
        ))}
      </View>

      <AppText variant="bodySmall" tone="secondary">
        This log helps the app understand patterns, not judge behavior.
      </AppText>

      {comingNextOption ? (
        <AppCard style={styles.comingNext}>
          <View style={styles.comingNextContent}>
            <AppText variant="title">{comingNextOption.label}</AppText>
            <AppText tone="secondary">
              A fuller reflection for this moment is coming later. For now, you can save a quick
              check-in to keep today’s signal simple.
            </AppText>
            <AppButton variant="secondary" onPress={onStartCheckIn}>
              Continue with Quick Check-In
            </AppButton>
          </View>
        </AppCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  options: {
    gap: theme.spacing.sm
  },
  comingNext: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  comingNextContent: {
    gap: theme.spacing.md
  }
});
