import { Platform, StyleSheet, View } from "react-native";

import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ArousalControlFlowHeaderProps = {
  label: string;
  title: string;
  subtitle: string;
  onBackPress: () => void;
  onClosePress?: () => void;
};

export function ArousalControlFlowHeader({
  label,
  title,
  subtitle,
  onBackPress,
  onClosePress
}: ArousalControlFlowHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <AppIconButton
          accessibilityLabel="Go back"
          icon={<AppText variant="title">‹</AppText>}
          onPress={onBackPress}
          style={styles.iconButton}
        />
        {onClosePress ? (
          <AppIconButton
            accessibilityLabel="Close practice"
            icon={<AppText variant="title">×</AppText>}
            onPress={onClosePress}
            style={styles.iconButton}
          />
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      <View style={styles.copy}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
        <AppText tone="secondary">{subtitle}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.xl
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  iconButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface
  },
  iconSpacer: {
    width: 46,
    height: 46
  },
  copy: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg
  },
  title: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 38,
    lineHeight: 44
  }
});
