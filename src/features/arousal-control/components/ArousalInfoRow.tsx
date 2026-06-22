import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ArousalInfoRowProps = {
  title: string;
  body: string;
  icon: string;
};

export function ArousalInfoRow({ title, body, icon }: ArousalInfoRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <AppText variant="label">{icon}</AppText>
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  iconCircle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted
  },
  copy: {
    flex: 1,
    gap: theme.spacing.sm
  }
});
