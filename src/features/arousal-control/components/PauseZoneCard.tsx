import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PauseZoneTone = "neutral" | "pause" | "high";

type PauseZoneCardProps = {
  title: string;
  body: string;
  tone: PauseZoneTone;
  actionLabel?: string;
  onActionPress?: () => void;
  disabled?: boolean;
};

export function PauseZoneCard({
  title,
  body,
  tone,
  actionLabel,
  onActionPress,
  disabled = false
}: PauseZoneCardProps) {
  return (
    <View style={[styles.card, toneStyles[tone]]}>
      <View style={styles.copy}>
        <AppText variant="title">{title}</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
      {actionLabel && onActionPress ? (
        <AppButton
          variant="secondary"
          disabled={disabled}
          onPress={onActionPress}
        >
          {actionLabel}
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderWidth: 1,
    padding: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});

const toneStyles = StyleSheet.create({
  neutral: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  pause: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  high: {
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.peachMuted
  }
});
