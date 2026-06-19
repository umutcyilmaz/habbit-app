import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppChip } from "../../../shared/components/AppChip";
import { AppRatingScale } from "../../../shared/components/AppRatingScale";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { pauseSupportOptions, pauseTriggerOptions } from "../data/pauseMockData";
import type { PauseCheckInState, PauseSupportOption, PauseTrigger } from "../types";
import { PauseChoiceCard } from "./PauseChoiceCard";

type PauseCheckInFormProps = {
  value: PauseCheckInState;
  onChange: (value: PauseCheckInState) => void;
  onBack: () => void;
  onStartPause: () => void;
};

export function PauseCheckInForm({
  value,
  onChange,
  onBack,
  onStartPause
}: PauseCheckInFormProps) {
  const toggleTrigger = (trigger: PauseTrigger) => {
    const triggers = value.triggers.includes(trigger)
      ? value.triggers.filter((item) => item !== trigger)
      : [...value.triggers, trigger];

    onChange({ ...value, triggers });
  };

  const setSupportOption = (supportOption: PauseSupportOption) => {
    onChange({ ...value, supportOption });
  };

  return (
    <View style={styles.stack}>
      <AppCard>
        <View style={styles.formStack}>
          <AppRatingScale
            label="How strong does the urge feel right now?"
            value={value.urgeStrength}
            onChange={(urgeStrength) => onChange({ ...value, urgeStrength })}
          />

          <View style={styles.field}>
            <AppText variant="label">What showed up before this?</AppText>
            <View style={styles.chips}>
              {pauseTriggerOptions.map((trigger) => (
                <AppChip
                  key={trigger.id}
                  label={trigger.label}
                  value={trigger.id}
                  selected={value.triggers.includes(trigger.id)}
                  onPress={toggleTrigger}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <AppText variant="label">What might help right now?</AppText>
            <View style={styles.choices}>
              {pauseSupportOptions.map((support) => (
                <PauseChoiceCard
                  key={support.id}
                  label={support.label}
                  value={support.id}
                  selected={value.supportOption === support.id}
                  onSelect={setSupportOption}
                />
              ))}
            </View>
          </View>

          <AppText variant="bodySmall" tone="secondary">
            No judgment. Just notice what is here.
          </AppText>
        </View>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={onStartPause}>Start 90-Second Pause</AppButton>
        <AppButton variant="secondary" onPress={onBack}>
          Back
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  formStack: {
    gap: theme.spacing.xl
  },
  field: {
    gap: theme.spacing.md
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  choices: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  }
});
