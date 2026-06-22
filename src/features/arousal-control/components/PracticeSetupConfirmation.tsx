import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PracticeSetupConfirmationProps = {
  onBackToExercises: () => void;
};

export function PracticeSetupConfirmation({ onBackToExercises }: PracticeSetupConfirmationProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <AppText variant="title" align="center">
          Setup saved
        </AppText>
        <AppText tone="secondary" align="center">
          Your practice setup is ready.
        </AppText>
      </View>
      <AppButton onPress={onBackToExercises}>Back to Exercises</AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});
