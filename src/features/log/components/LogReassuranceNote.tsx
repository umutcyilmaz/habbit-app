import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function LogReassuranceNote() {
  return (
    <View style={styles.note}>
      <AppText variant="bodySmall" tone="secondary" align="center">
        You can skip anything. A short check-in is enough.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.peach,
    borderWidth: 1,
    backgroundColor: theme.colors.peachMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  }
});
