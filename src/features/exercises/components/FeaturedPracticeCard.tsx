import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type FeaturedPracticeCardProps = {
  message?: string;
  onStartPress: () => void;
  onLearnPress: () => void;
};

const supportPoints = [
  "No duration goal",
  "Pause is the practice",
  "Continue gently or finish today"
] as const;

export function FeaturedPracticeCard({
  message,
  onStartPress,
  onLearnPress
}: FeaturedPracticeCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <AppText variant="caption">New practice</AppText>
          </View>
          <View style={styles.iconCircle}>
            <AppText variant="label">∿</AppText>
          </View>
        </View>

        <View style={styles.copy}>
          <AppText variant="title">Arousal Control Practice</AppText>
          <AppText variant="heading" style={styles.headline}>
            Notice the rise earlier.
          </AppText>
          <AppText tone="secondary">
            Practice recognizing your arousal level, pausing before things feel automatic, and
            continuing gently if you choose.
          </AppText>
        </View>

        <View style={styles.points}>
          {supportPoints.map((point) => (
            <View key={point} style={styles.pointRow}>
              <View style={styles.pointDot}>
                <AppText variant="caption">✓</AppText>
              </View>
              <AppText variant="bodySmall">{point}</AppText>
            </View>
          ))}
        </View>

        {message ? (
          <View style={styles.message}>
            <AppText variant="bodySmall" tone="secondary">
              {message}
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton onPress={onStartPress}>Start Practice</AppButton>
          <AppButton variant="secondary" onPress={onLearnPress}>
            Learn how it works
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  iconCircle: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  copy: {
    gap: theme.spacing.sm
  },
  headline: {
    fontSize: 30,
    lineHeight: 36
  },
  points: {
    gap: theme.spacing.sm
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  pointDot: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: theme.colors.sageMuted
  },
  message: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.sm
  }
});
