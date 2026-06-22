import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const recentMoments = [
  {
    icon: "✓",
    title: "Evening check-in",
    detail: "Boredom · saved today"
  },
  {
    icon: "Ⅱ",
    title: "Pause saved",
    detail: "90-second pause · reduced"
  },
  {
    icon: "☾",
    title: "Protection suggestion",
    detail: "Evening window noticed"
  }
] as const;

export function RecentMomentsCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Recent moments</AppText>
        <View style={styles.rows}>
          {recentMoments.map((moment) => (
            <View key={moment.title} style={styles.row}>
              <View style={styles.iconCircle}>
                <AppText variant="label">{moment.icon}</AppText>
              </View>
              <View style={styles.rowCopy}>
                <AppText variant="label">{moment.title}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {moment.detail}
                </AppText>
              </View>
            </View>
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
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  rowCopy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
