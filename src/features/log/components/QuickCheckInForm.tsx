import { StyleSheet, TextInput, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { QuickCheckInFormState } from "../types";
import { FeelingChips } from "./FeelingChips";
import { RatingScale } from "./RatingScale";
import { SupportToolChips } from "./SupportToolChips";

type QuickCheckInFormProps = {
  value: QuickCheckInFormState;
  onChange: (value: QuickCheckInFormState) => void;
  onBack: () => void;
  onSave: () => void;
};

export function QuickCheckInForm({ value, onChange, onBack, onSave }: QuickCheckInFormProps) {
  const updateValue = <TKey extends keyof QuickCheckInFormState>(
    key: TKey,
    nextValue: QuickCheckInFormState[TKey]
  ) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <View style={styles.stack}>
      <AppCard>
        <View style={styles.formStack}>
          <RatingScale
            label="How aware did you feel today?"
            value={value.awarenessRating}
            onChange={(rating) => updateValue("awarenessRating", rating)}
          />

          <RatingScale
            label="How grounded do you feel right now?"
            value={value.groundedRating}
            onChange={(rating) => updateValue("groundedRating", rating)}
          />

          <FeelingChips
            value={value.strongestFeeling}
            onChange={(feeling) => updateValue("strongestFeeling", feeling)}
          />

          <SupportToolChips
            value={value.supportTools}
            onChange={(tools) => updateValue("supportTools", tools)}
          />

          <View style={styles.noteStack}>
            <AppText variant="label">Optional private note</AppText>
            <TextInput
              multiline
              placeholder="Private note, optional"
              placeholderTextColor={theme.colors.textSecondary}
              value={value.privateNote}
              onChangeText={(text) => updateValue("privateNote", text)}
              style={styles.noteInput}
              textAlignVertical="top"
            />
            <AppText variant="caption" tone="secondary">
              This note stays local in this screen for now. Persistence will be added later.
            </AppText>
          </View>
        </View>
      </AppCard>

      <View style={styles.actions}>
        <AppButton onPress={onSave}>Save Check-In</AppButton>
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
  noteStack: {
    gap: theme.spacing.sm
  },
  noteInput: {
    minHeight: 96,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
    padding: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  }
});
