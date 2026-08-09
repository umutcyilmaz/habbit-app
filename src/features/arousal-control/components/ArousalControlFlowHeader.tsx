import { Platform, StyleSheet, View } from "react-native";

import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ArousalControlFlowHeaderProps = {
  label: string;
  title: string;
  subtitle: string;
  icon?: string;
  onBackPress: () => void;
  onClosePress?: () => void;
  backDisabled?: boolean;
  closeDisabled?: boolean;
  busy?: boolean;
};

export function ArousalControlFlowHeader({
  label,
  title,
  subtitle,
  icon,
  onBackPress,
  onClosePress,
  backDisabled = false,
  closeDisabled = false,
  busy = false
}: ArousalControlFlowHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <View style={styles.topBar}>
        <AppIconButton
          accessibilityLabel="Go back"
          accessibilityState={{ busy, disabled: backDisabled }}
          disabled={backDisabled}
          icon={<AppText variant="title">‹</AppText>}
          onPress={onBackPress}
          style={styles.iconButton}
        />
        <View style={styles.labelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.label}>
            {label}
          </AppText>
        </View>
        {onClosePress ? (
          <AppIconButton
            accessibilityLabel="Close practice"
            accessibilityState={{ busy, disabled: closeDisabled }}
            disabled={closeDisabled}
            icon={<AppText variant="title">×</AppText>}
            onPress={onClosePress}
            style={styles.iconButton}
          />
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      <View style={styles.copy}>
        {icon ? (
          <View style={styles.heroIcon}>
            <AppText variant="label">{icon}</AppText>
          </View>
        ) : null}
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
        <AppText tone="secondary" align="center">
          {subtitle}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    gap: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm
  },
  glow: {
    position: "absolute",
    top: -74,
    right: -20,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: theme.colors.sageMuted,
    opacity: 0.72
  },
  topBar: {
    minHeight: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  labelWrap: {
    position: "absolute",
    left: 58,
    right: 58,
    alignItems: "center"
  },
  label: {
    textTransform: "uppercase"
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
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md
  },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  title: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 42,
    lineHeight: 48,
    textAlign: "center"
  }
});
