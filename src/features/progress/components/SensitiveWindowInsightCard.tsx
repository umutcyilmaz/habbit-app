import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type SensitiveWindowInsightCardProps = {
  onSetupPress: () => void;
};

export function SensitiveWindowInsightCard({ onSetupPress }: SensitiveWindowInsightCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.topRow}>
          <View style={styles.iconCircle}>
            <AppText variant="label">☾</AppText>
          </View>
          <AppText variant="title">Sensitive window</AppText>
        </View>
        <AppText tone="secondary">
          Evenings between 22:00 and 00:00 appear often in recent activity.
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          A short pause before this window may help you notice the loop earlier.
        </AppText>
        <AppButton variant="secondary" onPress={onSetupPress}>
          Set up Night Protection
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.lavenderDeep,
    backgroundColor: theme.colors.lavender,
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.lg
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  iconCircle: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderColor: theme.colors.lavenderDeep,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  }
});
