import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { PauseSavedSummary } from "../components/PauseSavedSummary";
import { defaultPauseSessionSummary } from "../data/pauseMockData";

export function PauseSavedScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader title="Pause saved" />
        <PauseSavedSummary
          summary={defaultPauseSessionSummary}
          onBackToToday={() => router.replace(routes.home)}
          onViewProgress={() => router.push("/(tabs)/progress")}
          onLogMoment={() => router.push("/(tabs)/log")}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  }
});
