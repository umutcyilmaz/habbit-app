import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TodayObservationCardProps = {
  body: string;
  onViewProgressPress: () => void;
};

export function TodayObservationCard({ body, onViewProgressPress }: TodayObservationCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">Gentle observation</AppText>
          <AppText tone="secondary">{body}</AppText>
        </View>
        <AppButton variant="secondary" onPress={onViewProgressPress}>
          View Progress
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
    gap: theme.spacing.md
  },
  copy: {
    gap: theme.spacing.sm
  }
});
