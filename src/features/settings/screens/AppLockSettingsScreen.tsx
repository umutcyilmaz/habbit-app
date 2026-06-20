import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { ComingNextCard } from "../../../shared/components/states";
import { theme } from "../../../shared/design-system/theme";

export function AppLockSettingsScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="App Lock"
        subtitle="Add an extra layer of privacy when available."
      />

      <View style={styles.stack}>
        <ComingNextCard
          body="This support tool is planned for a future version."
          action={{
            label: "Back",
            onPress: () => router.push(routes.settings)
          }}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  }
});
