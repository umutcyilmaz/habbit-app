import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionReassuranceCardProps = {
  body: string;
};

export function ProtectionReassuranceCard({ body }: ProtectionReassuranceCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Gentle support</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach,
    borderRadius: theme.radius.xxl,
    padding: 26
  },
  stack: {
    gap: theme.spacing.md
  }
});
