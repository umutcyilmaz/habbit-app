import { StyleSheet, View } from "react-native";

import { AppHeader } from "../../../shared/components/AppHeader";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type TodayGreetingProps = {
  userName: string;
  periodLabel: string;
  planNote: string;
  onSettingsPress: () => void;
};

export function TodayGreeting({
  userName,
  periodLabel,
  planNote,
  onSettingsPress
}: TodayGreetingProps) {
  return (
    <View style={styles.container}>
      <AppHeader
        title={`Good evening, ${userName}.`}
        subtitle={periodLabel}
        onSettingsPress={onSettingsPress}
      />
      <View style={styles.note}>
        <AppText variant="bodySmall" tone="secondary">
          {planNote}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm
  },
  note: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm
  }
});
