import { Pressable, StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ToolAccent = "sage" | "lavender" | "peach" | "navy";

export type GuidedTool = {
  title: string;
  description: string;
  icon: string;
  accent: ToolAccent;
  onPress: () => void;
};

type GuidedToolsCardProps = {
  tools: readonly GuidedTool[];
};

export function GuidedToolsCard({ tools }: GuidedToolsCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Guided tools</AppText>
        <View style={styles.rows}>
          {tools.map((tool) => (
            <Pressable
              key={tool.title}
              accessibilityRole="button"
              onPress={tool.onPress}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : undefined]}
            >
              <View style={[styles.iconCircle, accentStyles[tool.accent]]}>
                <AppText variant="label" tone={tool.accent === "navy" ? "inverse" : "primary"}>
                  {tool.icon}
                </AppText>
              </View>
              <View style={styles.copy}>
                <AppText variant="label">{tool.title}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {tool.description}
                </AppText>
              </View>
              <AppText variant="body" tone="secondary">
                ›
              </AppText>
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
  rows: {
    gap: theme.spacing.sm
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
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
    flex: 1,
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
  },
  navy: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  }
});
