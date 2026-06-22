import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TodayRecommendationCardProps = {
  badge: string;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

export function TodayRecommendationCard({
  badge,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress
}: TodayRecommendationCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <AppText variant="caption">{badge}</AppText>
          </View>
          <View style={styles.visual}>
            <View style={styles.visualInner}>
              <AppText variant="label">Ⅱ</AppText>
            </View>
          </View>
        </View>

        <View style={styles.copy}>
          <AppText variant="title">{title}</AppText>
          <AppText tone="secondary">{body}</AppText>
        </View>

        <View style={styles.actions}>
          <AppButton onPress={onPrimaryPress}>{primaryLabel}</AppButton>
          <AppButton variant="secondary" onPress={onSecondaryPress}>
            {secondaryLabel}
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.lg
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  badge: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  visual: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  visualInner: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: theme.colors.lavender
  },
  copy: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
