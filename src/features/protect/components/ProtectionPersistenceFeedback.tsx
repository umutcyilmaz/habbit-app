import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionPersistenceFeedbackProps = {
  message: string | undefined;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
};

export function ProtectionPersistenceFeedback({
  message,
  canRetry,
  retrying,
  onRetry
}: ProtectionPersistenceFeedbackProps) {
  if (message === undefined) {
    return null;
  }

  return (
    <View style={styles.feedback} accessibilityRole="alert">
      <AppText variant="bodySmall" tone="danger" align="center">
        {message}
      </AppText>
      {canRetry ? (
        <AppButton
          testID="bloom.protection.persistence.retry"
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
  );
}

const styles = StyleSheet.create({
  feedback: {
    gap: theme.spacing.sm
  }
});
