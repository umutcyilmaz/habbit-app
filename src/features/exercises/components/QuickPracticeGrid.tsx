import { Pressable, StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PracticeAccent = "sage" | "lavender" | "peach";

export type QuickPractice = {
  title: string;
  description: string;
  icon: string;
  accent: PracticeAccent;
  onPress: () => void;
};

type QuickPracticeGridProps = {
  practices: readonly QuickPractice[];
};

export function QuickPracticeGrid({ practices }: QuickPracticeGridProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Quick practices</AppText>
        <View style={styles.grid}>
          {practices.map((practice) => (
            <Pressable
              key={practice.title}
              accessibilityRole="button"
              onPress={practice.onPress}
              style={({ pressed }) => [styles.practiceCard, pressed ? styles.pressed : undefined]}
            >
              <View style={[styles.iconCircle, accentStyles[practice.accent]]}>
                <AppText variant="label">{practice.icon}</AppText>
              </View>
              <View style={styles.copy}>
                <AppText variant="label">{practice.title}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {practice.description}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.md
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  practiceCard: {
    minWidth: 136,
    flex: 1,
    minHeight: 118,
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  pressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  iconCircle: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    borderWidth: 1
  },
  copy: {
    gap: theme.spacing.xs
  }
});

const accentStyles = StyleSheet.create({
  sage: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  lavender: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep
  },
  peach: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  }
});
