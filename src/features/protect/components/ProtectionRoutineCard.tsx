import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionRoutineCardProps = {
  title: string;
  body: string;
};

export function ProtectionRoutineCard({ title, body }: ProtectionRoutineCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">{title}</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.lavender,
    borderColor: theme.colors.lavenderDeep,
    borderRadius: theme.radius.xxl,
    padding: 26
  },
  stack: {
    gap: theme.spacing.md
  }
});
