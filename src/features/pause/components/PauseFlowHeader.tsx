import { Platform, StyleSheet, View } from "react-native";

import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseFlowHeaderProps = {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onBackPress?: (() => void) | undefined;
  onClosePress: () => void;
};

export function PauseFlowHeader({
  title,
  subtitle,
  disabled = false,
  onBackPress,
  onClosePress
}: PauseFlowHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        {onBackPress ? (
          <AppIconButton
            accessibilityLabel="Go back"
            accessibilityState={{ disabled }}
            disabled={disabled}
            icon={<AppText variant="title">‹</AppText>}
            onPress={onBackPress}
          />
        ) : (
          <View style={styles.actionSpacer} />
        )}
        <AppIconButton
          accessibilityLabel="Close pause flow"
          accessibilityState={{ disabled }}
          disabled={disabled}
          icon={<AppText variant="title">×</AppText>}
          onPress={onClosePress}
        />
      </View>

      <View style={styles.copy}>
        <AppText variant="heading" align="center" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="secondary" align="center">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xxl,
    marginBottom: theme.spacing.xxl
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  actionSpacer: {
    width: 44,
    height: 44
  },
  copy: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md
  },
  title: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 34,
    lineHeight: 42
  }
});
