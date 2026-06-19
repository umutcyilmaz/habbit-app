import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { WeeklyReviewPreview as WeeklyReviewPreviewModel } from "../types";

type WeeklyReviewPreviewProps = {
  review: WeeklyReviewPreviewModel;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

export function WeeklyReviewPreview({
  review,
  onPrimaryPress,
  onSecondaryPress
}: WeeklyReviewPreviewProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">{review.title}</AppText>
          <AppText tone="secondary">{review.copy}</AppText>
        </View>
        <View style={styles.actions}>
          <AppButton onPress={onPrimaryPress}>{review.primaryCta}</AppButton>
          <AppButton variant="secondary" onPress={onSecondaryPress}>
            {review.secondaryCta}
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.md
  }
});
