import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { PrivacyPrinciple } from "../types";

type PrivacyPrincipleCardProps = {
  principle: PrivacyPrinciple;
};

export function PrivacyPrincipleCard({ principle }: PrivacyPrincipleCardProps) {
  return (
    <AppCard style={[styles.card, accentStyles[principle.accent]]}>
      <View style={styles.content}>
        <AppText variant="title">{principle.title}</AppText>
        <AppText tone="secondary">{principle.body}</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowOpacity: 0
  },
  content: {
    gap: theme.spacing.sm
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
