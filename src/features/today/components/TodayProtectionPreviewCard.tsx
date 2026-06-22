import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TodayProtectionPreviewCardProps = {
  title: string;
  body: string;
  ctaLabel: string;
  active: boolean;
  onPress: () => void;
};

export function TodayProtectionPreviewCard({
  title,
  body,
  ctaLabel,
  active,
  onPress
}: TodayProtectionPreviewCardProps) {
  return (
    <AppCard style={[styles.card, active ? styles.activeCard : undefined]}>
      <View style={styles.stack}>
        <View style={styles.topRow}>
          <View style={[styles.dot, active ? styles.activeDot : undefined]} />
          <AppText variant="caption" tone="secondary">
            Protection
          </AppText>
        </View>
        <View style={styles.copy}>
          <AppText variant="title">{title}</AppText>
          <AppText tone="secondary">{body}</AppText>
        </View>
        <AppButton variant={active ? "secondary" : "primary"} onPress={onPress}>
          {ctaLabel}
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xl
  },
  activeCard: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  stack: {
    gap: theme.spacing.md
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textSecondary
  },
  activeDot: {
    backgroundColor: theme.colors.sage
  },
  copy: {
    gap: theme.spacing.sm
  }
});
