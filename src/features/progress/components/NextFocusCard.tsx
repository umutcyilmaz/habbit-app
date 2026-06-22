import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type NextFocusCardProps = {
  onTodayPress: () => void;
  onEnableProtectionPress: () => void;
};

export function NextFocusCard({ onTodayPress, onEnableProtectionPress }: NextFocusCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <AppText variant="label">Ⅱ</AppText>
          </View>
          <View style={styles.copy}>
            <AppText variant="title">Next focus</AppText>
            <AppText tone="secondary">Create a short pause before the evening loop.</AppText>
          </View>
        </View>
        <View style={styles.actions}>
          <AppButton onPress={onTodayPress}>Go to Today</AppButton>
          <AppButton variant="secondary" onPress={onEnableProtectionPress}>
            Enable Protection
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.lg
  },
  headerRow: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  iconCircle: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  copy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
