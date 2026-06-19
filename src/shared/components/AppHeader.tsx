import { StyleSheet, View } from "react-native";

import { appConfig } from "../../app/config/appConfig";
import { theme } from "../design-system/theme";
import { AppIconButton } from "./AppIconButton";
import { AppText } from "./AppText";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onSettingsPress?: (() => void) | undefined;
};

export function AppHeader({
  title,
  subtitle,
  eyebrow = appConfig.APP_NAME,
  onSettingsPress
}: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <AppText variant="caption" tone="secondary">
          {eyebrow}
        </AppText>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySmall" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onSettingsPress ? <AppIconButton accessibilityLabel="Open settings" onPress={onSettingsPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.lg,
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl
  },
  copy: {
    flex: 1,
    gap: theme.spacing.sm
  }
});
