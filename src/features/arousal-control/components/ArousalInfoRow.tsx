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
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  iconCircle: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
