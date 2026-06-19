import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { PauseTimer } from "../components/PauseTimer";

export function PauseTimerScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader title="Pause" subtitle="Take the next 90 seconds at your pace." />
        <PauseTimer onComplete={() => router.push("/pause/saved")} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  }
});
