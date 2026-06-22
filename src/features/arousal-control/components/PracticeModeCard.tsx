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
          <View style={styles.titleRow}>
            <AppText variant="title">{title}</AppText>
            {badge ? (
              <View
                style={[
                  styles.badge,
                  badge === "Recommended" ? styles.recommendedBadge : undefined
                ]}
              >
                <AppText variant="caption">{badge}</AppText>
              </View>
            ) : null}
          </View>
          <AppText tone="secondary">{description}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            <AppText variant="caption" tone="secondary">
              Best for:{" "}
            </AppText>
            {bestFor}
          </AppText>
        </View>
        <View style={[styles.radio, selected ? styles.radioSelected : undefined]}>
          {selected ? (
            <View style={styles.radioDot} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    borderRadius: 24,
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
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
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
  radio: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  radioSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.surface
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.sage
  }
});
