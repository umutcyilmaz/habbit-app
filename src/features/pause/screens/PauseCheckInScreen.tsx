import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { PauseCheckInForm } from "../components/PauseCheckInForm";
import { defaultPauseCheckInState } from "../data/pauseMockData";
import type { PauseCheckInState } from "../types";

export function PauseCheckInScreen() {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<PauseCheckInState>(defaultPauseCheckInState);

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader
          title="Quick pause check-in"
          subtitle="A few small signals can help you choose what support fits this moment."
        />

        <PauseCheckInForm
          value={checkIn}
          onChange={setCheckIn}
          onBack={() => router.back()}
          onStartPause={() => router.push("/pause/timer")}
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
