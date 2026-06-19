import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppButton } from "../../../shared/components/AppButton";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { PauseIntroCard } from "../components/PauseIntroCard";

export function PauseIntroScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader
          title="You do not have to decide immediately."
          subtitle="Take a short moment to notice what is happening before reacting."
        />

        <PauseIntroCard />

        <View style={styles.actions}>
          <AppButton onPress={() => router.push("/pause/check-in")}>Start Check-In</AppButton>
          <AppButton variant="secondary" onPress={() => router.push("/pause/timer")}>
            Skip to 90-Second Pause
          </AppButton>
        </View>

        <AppText variant="bodySmall" tone="secondary">
          You remain in control.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  actions: {
    gap: theme.spacing.md
  }
});
