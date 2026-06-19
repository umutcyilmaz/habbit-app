import { StyleSheet, View } from "react-native";
import type { DimensionValue } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { WeeklyProgressItem } from "../types";

type WeeklyProgressPreviewProps = {
  items: WeeklyProgressItem[];
};

export function WeeklyProgressPreview({ items }: WeeklyProgressPreviewProps) {
  return (
    <AppCard>
      <View style={styles.stack}>
        {items.map((item) => {
          const ratio = item.target > 0 ? item.current / item.target : 0;
          const progressWidth = `${Math.min(ratio, 1) * 100}%` as DimensionValue;

          return (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <AppText variant="label">{item.label}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {item.current}/{item.target}
                </AppText>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: progressWidth }]} />
              </View>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  item: {
    gap: theme.spacing.sm
  },
  itemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  track: {
    height: 8,
    overflow: "hidden",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted
  },
  fill: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  }
});
