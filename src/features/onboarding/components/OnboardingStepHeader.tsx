import { StyleSheet, View } from "react-native";

import { appConfig } from "../../../app/config/appConfig";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type OnboardingStepHeaderProps = {
  title: string;
  subtitle?: string;
};

export function OnboardingStepHeader({ title, subtitle }: OnboardingStepHeaderProps) {
  return (
    <View style={styles.container}>
      <AppText variant="caption" tone="secondary">
        {appConfig.APP_NAME}
      </AppText>
      <AppText variant="heading">{title}</AppText>
      {subtitle ? (
        <AppText variant="body" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl
  }
});
