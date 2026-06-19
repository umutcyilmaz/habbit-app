import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { HelpfulTool } from "../types";

type HelpfulToolCardProps = {
  tool: HelpfulTool;
  onPress: (tool: HelpfulTool) => void;
};

export function HelpfulToolCard({ tool, onPress }: HelpfulToolCardProps) {
  return (
    <AppCard>
      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText variant="title">{tool.title}</AppText>
          <AppText tone="secondary">{tool.copy}</AppText>
        </View>
        <AppButton onPress={() => onPress(tool)}>{tool.ctaLabel}</AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});
