import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { BloomCheckInEventType } from "../../../storage/bloomState";
import { SelectableChipGroup, type SelectableChipOption } from "./SelectableChipGroup";

export type LogEventType = BloomCheckInEventType;

const eventTypeOptions: readonly SelectableChipOption<LogEventType>[] = [
  { value: "nothing", label: "Nothing happened" },
  { value: "urge", label: "I felt an urge" },
  { value: "paused", label: "I paused" },
  { value: "adultContent", label: "I watched adult content" },
  { value: "masturbated", label: "I masturbated" },
  { value: "both", label: "Both happened" }
];

type OptionalContextCardProps = {
  eventType: LogEventType;
  onEventTypeChange: (eventType: LogEventType) => void;
  onSaveWithContext: () => void;
};

export function OptionalContextCard({
  eventType,
  onEventTypeChange,
  onSaveWithContext
}: OptionalContextCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">Want to add context?</AppText>
          <AppText tone="secondary">
            Optional details can help future observations feel more useful.
          </AppText>
        </View>

        <SelectableChipGroup
          title="Event type"
          options={eventTypeOptions}
          value={eventType}
          onChange={onEventTypeChange}
        />

        <AppButton variant="secondary" onPress={onSaveWithContext}>
          Save with context
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.lavenderDeep,
    backgroundColor: theme.colors.lavender,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});
