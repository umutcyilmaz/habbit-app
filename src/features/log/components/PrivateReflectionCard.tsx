import { StyleSheet, TextInput, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { MAX_BLOOM_NOTE_LENGTH } from "../../../storage/bloomState";

type PrivateReflectionCardProps = {
  note: string;
  onNoteChange: (note: string) => void;
  onSaveNote: () => void;
  disabled?: boolean;
  saving?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  savedMessage?: string;
};

export function PrivateReflectionCard({
  note,
  onNoteChange,
  onSaveNote,
  disabled = false,
  saving = false,
  retrying = false,
  onRetry,
  savedMessage
}: PrivateReflectionCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">Private reflection</AppText>
          <AppText tone="secondary">A few words for yourself, only if you want.</AppText>
        </View>

        <TextInput
          multiline
          value={note}
          onChangeText={onNoteChange}
          editable={!disabled}
          placeholder="What do you want to remember about this moment?"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
          textAlignVertical="top"
          maxLength={MAX_BLOOM_NOTE_LENGTH}
        />

        {savedMessage ? (
          <AppText
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            variant="bodySmall"
            tone="secondary"
          >
            {savedMessage}
          </AppText>
        ) : null}

        {onRetry !== undefined ? (
          <AppButton
            testID="bloom.log.note.persistence.retry"
            variant="subtle"
            loading={retrying}
            disabled={retrying}
            accessibilityState={{ busy: retrying, disabled: retrying }}
            onPress={onRetry}
          >
            Try saving again
          </AppButton>
        ) : null}

        <AppButton
          testID="bloom.log.note.save"
          variant="subtle"
          loading={saving}
          disabled={disabled}
          accessibilityState={{ busy: saving, disabled }}
          onPress={onSaveNote}
        >
          Save note
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.md
  },
  copy: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 104,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md
  }
});
