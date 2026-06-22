import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export type PracticeModeId = "softAwareness" | "onePause" | "practicePlus";

type PracticeModeCardProps = {
  id: PracticeModeId;
  title: string;
  description: string;
  bestFor: string;
  selected: boolean;
  badge?: string;
  onSelect: (id: PracticeModeId) => void;
};

export function PracticeModeCard({
  id,
  title,
  description,
  bestFor,
  selected,
  badge,
  onSelect
}: PracticeModeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(id)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : undefined,
        pressed ? styles.cardPressed : undefined
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleStack}>
          <AppText variant="title">{title}</AppText>
          <AppText tone="secondary">{description}</AppText>
        </View>
        {badge ? (
          <View
            style={[styles.badge, badge === "Recommended" ? styles.recommendedBadge : undefined]}
          >
            <AppText variant="caption">{badge}</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.bestFor}>
        <AppText variant="caption" tone="secondary">
          Best for
        </AppText>
        <AppText variant="bodySmall">{bestFor}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  cardSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md
  },
  titleStack: {
    flex: 1,
    gap: theme.spacing.sm
  },
  badge: {
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  recommendedBadge: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.surface
  },
  bestFor: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  }
});
